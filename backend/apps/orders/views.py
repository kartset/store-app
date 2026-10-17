from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.invoice.serializers import InvoiceSerializer
from apps.invoice.views import _determine_inter_state
from apps.orders.serializers import (
    OrderCancelSerializer,
    OrderConvertToInvoiceSerializer,
    OrderCreateSerializer,
    OrderSerializer,
)
from db.models import (
    CashRegisterSession,
    FulfillmentType,
    Inventory,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    InvoiceType,
    Order,
    OrderItem,
    OrderPaymentStatus,
    OrderStatus,
    Payment,
    RegisterSessionStatus,
    StockMovementType,
)


class OrderViewSet(viewsets.ModelViewSet):
    """
    ViewSet for Omnichannel Retail Orders:
    - Supports store scoping, customer filtering, date ranges, and search.
    - Fulfillment state transitions: confirm, pack, ready, cancel.
    - Atomic order-to-invoice conversion with inventory stock deduction.
    """
    queryset = Order.objects.filter(is_deleted=False).select_related(
        'store_id', 'customer_id', 'invoice_id'
    ).prefetch_related('items__product_id').order_by('-created_at')
    serializer_class = OrderSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store_id')
        if store_id:
            qs = qs.filter(store_id=store_id)

        customer_id = self.request.query_params.get('customer_id')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        order_status = self.request.query_params.get('status')
        if order_status:
            qs = qs.filter(status=order_status)

        fulfillment_type = self.request.query_params.get('fulfillment_type')
        if fulfillment_type:
            qs = qs.filter(fulfillment_type=fulfillment_type)

        payment_status = self.request.query_params.get('payment_status')
        if payment_status:
            qs = qs.filter(payment_status=payment_status)

        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(order_number__icontains=search) |
                Q(customer_name_snapshot__icontains=search) |
                Q(customer_phone_snapshot__icontains=search) |
                Q(delivery_city__icontains=search)
            )

        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)

        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)

        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        """
        Create a new Order with nested line items and snapshots.
        """
        serializer = OrderCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        store = data['store_id']
        customer = data.get('customer_id')

        # Snapshot customer details
        customer_name = (
            data.get('customer_name') or
            (customer.name if customer else '')
        ).strip()
        customer_phone = (
            data.get('customer_phone') or
            (getattr(customer, 'mobile_number', '') or getattr(customer, 'phone', '')) if customer else ''
        ).strip()
        customer_email = (
            data.get('customer_email') or
            (customer.email if customer else '')
        ).strip()

        # Delivery address snapshots
        delivery_address_line1 = data.get('delivery_address_line1', '')
        delivery_address_line2 = data.get('delivery_address_line2', '')
        delivery_city = data.get('delivery_city', '')
        delivery_state = data.get('delivery_state', '')
        delivery_pincode = data.get('delivery_pincode', '')
        delivery_notes = data.get('delivery_notes', '')

        # Fallback to customer's saved address if not explicitly specified
        if customer and not delivery_address_line1:
            delivery_address_line1 = getattr(customer, 'address_line1', '') or getattr(customer, 'address', '') or ''
            delivery_city = delivery_city or getattr(customer, 'city', '') or ''
            delivery_state = delivery_state or getattr(customer, 'state', '') or ''
            delivery_pincode = delivery_pincode or getattr(customer, 'pincode', '') or ''

        # Calculate line items and totals
        items_payload = data['items']
        subtotal = Decimal('0.00')
        total_discount = Decimal('0.00')
        total_tax = Decimal('0.00')

        prepared_items = []
        for item_data in items_payload:
            product = item_data['product_id']
            qty = item_data['quantity']
            discount = item_data.get('discount') or Decimal('0.00')

            unit_price = item_data.get('unit_price')
            if unit_price is None:
                inv = Inventory.objects.filter(
                    store_id=store,
                    product_id=product,
                    is_deleted=False
                ).first()
                if inv and inv.effective_price:
                    unit_price = inv.effective_price
                elif product.base_mrp:
                    unit_price = product.base_mrp
                else:
                    unit_price = Decimal('0.00')

            unit_price = Decimal(str(unit_price))
            tax_slab = Decimal(str(product.tax_slab or '0.00'))

            gross_line = (unit_price * qty) - discount
            gross_line = max(gross_line, Decimal('0.00'))

            # Standard tax-inclusive breakdown
            tax_factor = Decimal('1.00') + (tax_slab / Decimal('100.00'))
            taxable_amount = (gross_line / tax_factor).quantize(Decimal('0.01'))
            tax_amount = (gross_line - taxable_amount).quantize(Decimal('0.01'))
            line_total = gross_line.quantize(Decimal('0.01'))

            subtotal += (unit_price * qty)
            total_discount += discount
            total_tax += tax_amount

            prepared_items.append({
                'product': product,
                'quantity': qty,
                'unit_price': unit_price,
                'discount': discount,
                'tax_slab': tax_slab,
                'tax_amount': tax_amount,
                'line_total': line_total,
            })

        grand_total = max(Decimal('0.00'), subtotal - total_discount).quantize(Decimal('0.01'))

        # Create Order
        order = Order.objects.create(
            store_id=store,
            customer_id=customer,
            fulfillment_type=data.get('fulfillment_type', FulfillmentType.STORE_PICKUP),
            payment_status=data.get('payment_status', OrderPaymentStatus.UNPAID),
            status=OrderStatus.PENDING,
            subtotal=subtotal.quantize(Decimal('0.01')),
            total_discount=total_discount.quantize(Decimal('0.01')),
            total_tax=total_tax.quantize(Decimal('0.01')),
            grand_total=grand_total,
            customer_name_snapshot=customer_name,
            customer_phone_snapshot=customer_phone,
            customer_email_snapshot=customer_email,
            delivery_address_line1=delivery_address_line1,
            delivery_address_line2=delivery_address_line2,
            delivery_city=delivery_city,
            delivery_state=delivery_state,
            delivery_pincode=delivery_pincode,
            delivery_notes=delivery_notes,
            notes=data.get('notes', ''),
        )

        # Create OrderItems
        for p_item in prepared_items:
            prod = p_item['product']
            OrderItem.objects.create(
                order_id=order,
                product_id=prod,
                product_name_snapshot=prod.name,
                sku_snapshot=prod.sku,
                barcode_snapshot=prod.barcode or prod.internal_barcode or '',
                quantity=p_item['quantity'],
                unit_price=p_item['unit_price'],
                discount=p_item['discount'],
                tax_slab=p_item['tax_slab'],
                tax_amount=p_item['tax_amount'],
                line_total=p_item['line_total'],
            )

        return Response(OrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """
        Transition order from PENDING to CONFIRMED.
        """
        order = self.get_object()
        if order.status != OrderStatus.PENDING:
            raise ValidationError(
                f"Only PENDING orders can be confirmed. Current status: '{order.status}'."
            )

        order.status = OrderStatus.CONFIRMED
        order.confirmed_at = timezone.now()
        order.save(update_fields=['status', 'confirmed_at', 'updated_at'])
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def pack(self, request, pk=None):
        """
        Transition order from CONFIRMED to PACKED.
        """
        order = self.get_object()
        if order.status != OrderStatus.CONFIRMED:
            raise ValidationError(
                f"Only CONFIRMED orders can be packed. Current status: '{order.status}'."
            )

        order.status = OrderStatus.PACKED
        order.packed_at = timezone.now()
        order.save(update_fields=['status', 'packed_at', 'updated_at'])
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='ready')
    def ready(self, request, pk=None):
        """
        Transition order from PACKED to READY_FOR_PICKUP.
        """
        order = self.get_object()
        if order.status != OrderStatus.PACKED:
            raise ValidationError(
                f"Only PACKED orders can be marked ready. Current status: '{order.status}'."
            )

        order.status = OrderStatus.READY_FOR_PICKUP
        order.ready_at = timezone.now()
        order.save(update_fields=['status', 'ready_at', 'updated_at'])
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """
        Cancel order if not already completed or cancelled.
        """
        order = self.get_object()
        if order.status in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
            raise ValidationError(
                f"Cannot cancel order in status '{order.status}'."
            )

        serializer = OrderCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        order.status = OrderStatus.CANCELLED
        order.cancelled_at = timezone.now()
        order.cancellation_reason = serializer.validated_data.get('reason', '')
        order.save(update_fields=['status', 'cancelled_at', 'cancellation_reason', 'updated_at'])
        return Response(OrderSerializer(order).data)

    @action(detail=True, methods=['post'], url_path='convert-to-invoice')
    def convert_to_invoice(self, request, pk=None):
        """
        Atomically converts an Order into an Invoice:
        1. Checks sufficient stock for all line items at the order's store.
        2. Deducts inventory atomically with StockMovement audit trail.
        3. Creates the Invoice and InvoiceItem records.
        4. Optionally records immediate payment.
        5. Updates Order status to COMPLETED, links invoice_id.
        """
        order = self.get_object()
        if order.status in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
            raise ValidationError(
                f"Cannot convert order in status '{order.status}' to invoice."
            )

        if order.invoice_id:
            raise ValidationError(
                f"Order is already converted to Invoice '{order.invoice_id.invoice_number}'."
            )

        serializer = OrderConvertToInvoiceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            # Lock order
            locked_order = Order.objects.select_for_update().get(pk=order.pk)
            if locked_order.invoice_id or locked_order.status in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
                raise ValidationError("Order state changed concurrently. Conversion aborted.")

            items = list(locked_order.items.filter(is_deleted=False).select_related('product_id'))
            if not items:
                raise ValidationError("Cannot convert an order with no line items.")

            store = locked_order.store_id
            customer = locked_order.customer_id
            customer_gstin = getattr(customer, 'gstin', '') or ''
            is_inter_state = _determine_inter_state(store, customer, customer_gstin)

            # Check and lock inventories
            inventory_map = {}
            for item in items:
                try:
                    inv = Inventory.objects.select_for_update().get(
                        store_id=store,
                        product_id=item.product_id,
                        is_deleted=False
                    )
                except Inventory.DoesNotExist:
                    raise ValidationError(
                        f"Product '{item.product_name_snapshot or item.product_id.name}' is not stocked in store '{store.name}'."
                    )

                if inv.stock_quantity < item.quantity:
                    raise ValidationError(
                        f"Insufficient stock for '{item.product_name_snapshot or item.product_id.name}'. "
                        f"Available: {inv.stock_quantity}, requested: {item.quantity}."
                    )
                inventory_map[item.id] = inv

            # Check register session
            session_id = data.get('register_session_id')
            active_session = None
            if session_id:
                active_session = CashRegisterSession.objects.filter(
                    id=session_id,
                    is_deleted=False
                ).first()
            if not active_session:
                active_session = CashRegisterSession.objects.filter(
                    store_id=store,
                    status=RegisterSessionStatus.OPEN,
                    is_deleted=False
                ).first()

            # Calculate line totals & GST splits
            subtotal = Decimal('0.00')
            total_discount = Decimal('0.00')
            total_cgst = Decimal('0.00')
            total_sgst = Decimal('0.00')
            total_igst = Decimal('0.00')
            total_gst = Decimal('0.00')

            invoice_items_payload = []
            for item in items:
                qty = item.quantity
                unit_price = item.unit_price
                discount = item.discount
                tax_slab = item.tax_slab

                gross_line = (unit_price * qty) - discount
                gross_line = max(gross_line, Decimal('0.00'))

                tax_factor = Decimal('1.00') + (tax_slab / Decimal('100.00'))
                taxable_amount = (gross_line / tax_factor).quantize(Decimal('0.01'))
                gst_amount = (gross_line - taxable_amount).quantize(Decimal('0.01'))
                line_total = gross_line.quantize(Decimal('0.01'))

                if is_inter_state:
                    line_cgst = Decimal('0.00')
                    line_sgst = Decimal('0.00')
                    line_igst = gst_amount
                else:
                    line_cgst = (gst_amount / Decimal('2.00')).quantize(Decimal('0.01'))
                    line_sgst = gst_amount - line_cgst
                    line_igst = Decimal('0.00')

                subtotal += (unit_price * qty)
                total_discount += discount
                total_cgst += line_cgst
                total_sgst += line_sgst
                total_igst += line_igst
                total_gst += gst_amount

                invoice_items_payload.append({
                    'item': item,
                    'inventory': inventory_map[item.id],
                    'quantity': qty,
                    'unit_price': unit_price,
                    'discount': discount,
                    'tax_slab': tax_slab,
                    'taxable_amount': taxable_amount,
                    'gst_amount': gst_amount,
                    'cgst_amount': line_cgst,
                    'sgst_amount': line_sgst,
                    'igst_amount': line_igst,
                    'line_total': line_total,
                })

            raw_grand_total = max(Decimal('0.00'), subtotal - total_discount)
            rounded_grand_total = Decimal(str(round(raw_grand_total)))
            round_off = rounded_grand_total - raw_grand_total

            invoice_notes = f"Converted from Order {locked_order.order_number}."
            extra_notes = data.get('notes', '').strip()
            if extra_notes:
                invoice_notes += f" {extra_notes}"

            # Create Invoice
            invoice = Invoice.objects.create(
                store_id=store,
                customer_id=customer,
                register_session_id=active_session,
                type=InvoiceType.ONLINE,
                status=InvoiceStatus.DRAFT,
                subtotal=subtotal.quantize(Decimal('0.01')),
                total_discount=total_discount.quantize(Decimal('0.01')),
                cgst_amount=total_cgst.quantize(Decimal('0.01')),
                sgst_amount=total_sgst.quantize(Decimal('0.01')),
                igst_amount=total_igst.quantize(Decimal('0.01')),
                total_gst=total_gst.quantize(Decimal('0.01')),
                round_off=round_off.quantize(Decimal('0.01')),
                grand_total=rounded_grand_total.quantize(Decimal('0.01')),
                is_tax_inclusive=True,
                customer_name_snapshot=locked_order.customer_name_snapshot,
                customer_phone_snapshot=locked_order.customer_phone_snapshot,
                customer_gstin_snapshot=customer_gstin,
                notes=invoice_notes,
            )

            # Create InvoiceItems and deduct stock
            for row in invoice_items_payload:
                order_item = row['item']
                inv = row['inventory']
                qty = row['quantity']

                InvoiceItem.objects.create(
                    invoice_id=invoice,
                    product_id=order_item.product_id,
                    product_name_snapshot=order_item.product_name_snapshot,
                    sku_snapshot=order_item.sku_snapshot,
                    barcode_snapshot=order_item.barcode_snapshot,
                    hsn_code=order_item.product_id.hsn_code or '',
                    quantity=qty,
                    unit_price=row['unit_price'],
                    discount=row['discount'],
                    tax_slab=row['tax_slab'],
                    taxable_amount=row['taxable_amount'],
                    gst_amount=row['gst_amount'],
                    cgst_amount=row['cgst_amount'],
                    sgst_amount=row['sgst_amount'],
                    igst_amount=row['igst_amount'],
                    line_total=row['line_total'],
                )

                inv.adjust_stock(
                    quantity_delta=-qty,
                    movement_type=StockMovementType.POS_SALE,
                    reference_id=invoice.invoice_number,
                    notes=f"Order conversion {locked_order.order_number}",
                )

            # Handle optional payment
            payment_method = data.get('payment_method')
            if payment_method:
                pay_amount = data.get('payment_amount') or invoice.grand_total
                pay_amount = Decimal(str(pay_amount))

                Payment.objects.create(
                    invoice_id=invoice,
                    method=payment_method,
                    amount=pay_amount,
                    status='SUCCESS',
                )

                if pay_amount >= invoice.grand_total:
                    invoice.status = InvoiceStatus.PAID
                    locked_order.payment_status = OrderPaymentStatus.PAID
                elif pay_amount > 0:
                    invoice.status = InvoiceStatus.PARTIALLY_PAID
                    locked_order.payment_status = OrderPaymentStatus.PARTIALLY_PAID
                invoice.save(update_fields=['status', 'updated_at'])

            # Update Order
            locked_order.invoice_id = invoice
            locked_order.status = OrderStatus.COMPLETED
            locked_order.completed_at = timezone.now()
            locked_order.save(update_fields=['invoice_id', 'status', 'completed_at', 'payment_status', 'updated_at'])

        return Response({
            'order': OrderSerializer(locked_order).data,
            'invoice': InvoiceSerializer(invoice).data,
            'message': f"Order {locked_order.order_number} successfully converted to Invoice {invoice.invoice_number}.",
        }, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def stats(self, request):
        """
        Dashboard statistics for omnichannel orders.
        """
        store_id = request.query_params.get('store_id')
        qs = Order.objects.filter(is_deleted=False)
        if store_id:
            qs = qs.filter(store_id=store_id)

        today = timezone.now().date()
        status_counts = qs.values('status').annotate(count=Count('id'))
        counts_by_status = {item['status']: item['count'] for item in status_counts}

        today_qs = qs.filter(created_at__date=today)
        today_count = today_qs.count()
        today_revenue = today_qs.filter(
            status__in=[OrderStatus.CONFIRMED, OrderStatus.PACKED, OrderStatus.READY_FOR_PICKUP, OrderStatus.COMPLETED]
        ).aggregate(total=Sum('grand_total'))['total'] or Decimal('0.00')

        return Response({
            'total_orders': qs.count(),
            'pending': counts_by_status.get(OrderStatus.PENDING, 0),
            'confirmed': counts_by_status.get(OrderStatus.CONFIRMED, 0),
            'packed': counts_by_status.get(OrderStatus.PACKED, 0),
            'ready_for_pickup': counts_by_status.get(OrderStatus.READY_FOR_PICKUP, 0),
            'completed': counts_by_status.get(OrderStatus.COMPLETED, 0),
            'cancelled': counts_by_status.get(OrderStatus.CANCELLED, 0),
            'today_orders': today_count,
            'today_revenue': str(today_revenue),
        })
