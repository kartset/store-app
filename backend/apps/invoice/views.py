from decimal import Decimal

from django.db import transaction
from django.db.models import Q, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.invoice.serializers import (
    InvoiceCheckoutSerializer,
    InvoiceSerializer,
)
from db.models import (
    CashRegisterSession,
    CashTransaction,
    CashTransactionType,
    Customer,
    Inventory,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    InvoiceType,
    Payment,
    PaymentMethod,
    Product,
    RegisterSessionStatus,
    StockMovementType,
    Store,
    StoreCustomer,
)


def _determine_inter_state(store: Store, customer: Customer | None, customer_gstin: str | None) -> bool:
    """
    Determines if sale is inter-state (IGST) or intra-state (CGST + SGST).
    Compares 2-digit GST state codes if present.
    """
    store_gst = (store.gst_number or '').strip()
    store_state_code = store_gst[:2] if len(store_gst) >= 2 and store_gst[:2].isdigit() else None

    cust_gst = (customer_gstin or (customer.gstin if customer else '') or '').strip()
    cust_state_code = cust_gst[:2] if len(cust_gst) >= 2 and cust_gst[:2].isdigit() else None

    return bool(store_state_code and cust_state_code and store_state_code != cust_state_code)


class InvoiceViewSet(viewsets.ModelViewSet):
    """
    CRUD ViewSet for Retail Invoices with Atomic Checkout and POS support.
    """
    queryset = Invoice.objects.filter(is_deleted=False).select_related(
        'store_id', 'customer_id'
    ).prefetch_related('items__product_id', 'payments').order_by('-created_at')
    serializer_class = InvoiceSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store_id')
        if store_id:
            qs = qs.filter(store_id=store_id)

        customer_id = self.request.query_params.get('customer_id')
        if customer_id:
            qs = qs.filter(customer_id=customer_id)

        invoice_status = self.request.query_params.get('status')
        if invoice_status:
            qs = qs.filter(status=invoice_status)

        invoice_type = self.request.query_params.get('type')
        if invoice_type:
            qs = qs.filter(type=invoice_type)

        search = self.request.query_params.get('search')
        if search:
            search = search.strip()
            qs = qs.filter(
                Q(invoice_number__icontains=search) |
                Q(customer_name_snapshot__icontains=search) |
                Q(customer_phone_snapshot__icontains=search)
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
        Atomic checkout endpoint:
        Validates inventory stock, computes GST, creates invoice and items,
        deducts store inventory with StockMovement audit trail, awards/redeems loyalty points,
        and registers payments.
        """
        checkout_serializer = InvoiceCheckoutSerializer(data=request.data)
        checkout_serializer.is_valid(raise_exception=True)
        data = checkout_serializer.validated_data

        store = get_object_or_404(Store, id=data['store_id'], is_deleted=False)

        # 1. Customer & Loyalty lookup
        customer = None
        store_customer = None
        customer_id = data.get('customer_id')
        if customer_id:
            customer = get_object_or_404(Customer, id=customer_id, is_deleted=False)
            store_customer, _ = StoreCustomer.objects.get_or_create(
                store_id=store,
                customer_id=customer,
                defaults={'loyalty_points': 0}
            )

        # Customer snapshot data
        customer_phone = (
            data.get('customer_phone') or
            (customer.mobile_number if customer else '') or
            ''
        ).strip()
        customer_name = (
            data.get('customer_name') or
            (customer.name if customer else '') or
            ''
        ).strip()
        customer_gstin = (
            data.get('customer_gstin') or
            (customer.gstin if customer else '') or
            ''
        ).strip()

        is_tax_inclusive = data.get('is_tax_inclusive', True)
        is_inter_state = _determine_inter_state(store, customer, customer_gstin)

        # 2. Process Line Items & Inventory
        items_payload = data['items']
        item_rows = []

        subtotal = Decimal('0.00')
        total_discount = Decimal('0.00')
        total_cgst = Decimal('0.00')
        total_sgst = Decimal('0.00')
        total_igst = Decimal('0.00')
        total_gst = Decimal('0.00')

        # Cache product and inventory with concurrency locks
        for row in items_payload:
            product = get_object_or_404(Product, id=row['product_id'], is_deleted=False)
            qty = row['quantity']
            discount = Decimal(str(row.get('discount') or 0.00))

            try:
                inv = Inventory.objects.select_for_update().get(
                    store_id=store,
                    product_id=product,
                    is_deleted=False
                )
            except Inventory.DoesNotExist:
                raise ValidationError(
                    f"Product '{product.name}' is not stocked in store '{store.name}'."
                )

            if inv.stock_quantity < qty:
                raise ValidationError(
                    f"Insufficient stock for product '{product.name}'. Available: {inv.stock_quantity}, requested: {qty}."
                )

            # Determine unit price (custom price or store override or product base MRP)
            unit_price = Decimal(str(row.get('unit_price') or inv.effective_price or product.base_mrp or '0.00'))
            tax_slab = Decimal(str(product.tax_slab or '0.00'))

            gross_line = (unit_price * qty) - discount
            gross_line = max(gross_line, Decimal('0.00'))

            if is_tax_inclusive:
                tax_factor = Decimal('1.00') + (tax_slab / Decimal('100.00'))
                taxable_amount = (gross_line / tax_factor).quantize(Decimal('0.01'))
                gst_amount = (gross_line - taxable_amount).quantize(Decimal('0.01'))
                line_total = gross_line.quantize(Decimal('0.01'))
            else:
                taxable_amount = gross_line.quantize(Decimal('0.01'))
                gst_amount = (taxable_amount * (tax_slab / Decimal('100.00'))).quantize(Decimal('0.01'))
                line_total = (taxable_amount + gst_amount).quantize(Decimal('0.01'))

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

            item_rows.append({
                'inventory': inv,
                'product': product,
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
                'hsn_code': product.hsn_code or '',
                'barcode': product.barcode or product.internal_barcode or '',
            })

        # 3. Loyalty Redemption Calculation
        points_to_redeem = data.get('loyalty_points_to_redeem', 0)
        loyalty_discount_amount = Decimal('0.00')
        if points_to_redeem > 0:
            if not store_customer:
                raise ValidationError("Customer required to redeem loyalty reward points.")
            if points_to_redeem > store_customer.loyalty_points:
                raise ValidationError(
                    f"Cannot redeem {points_to_redeem} points. Customer has only {store_customer.loyalty_points} points."
                )
            # 1 point = 1 Rupee discount
            max_redeemable = (subtotal - total_discount) if is_tax_inclusive else (subtotal - total_discount + total_gst)
            max_redeemable = max(max_redeemable, Decimal('0.00'))

            points_to_redeem = min(points_to_redeem, int(max_redeemable))
            loyalty_discount_amount = Decimal(points_to_redeem)

        # 4. Net Grand Total & Round Off
        if is_tax_inclusive:
            raw_grand_total = (subtotal - total_discount - loyalty_discount_amount)
        else:
            raw_grand_total = (subtotal - total_discount - loyalty_discount_amount + total_gst)

        raw_grand_total = max(raw_grand_total, Decimal('0.00'))

        rounded_grand_total = Decimal(str(round(raw_grand_total)))
        round_off = rounded_grand_total - raw_grand_total

        # 5. Calculate Points Earned (1 point per ₹100 spent)
        loyalty_points_earned = int(rounded_grand_total // Decimal('100.00')) if store_customer else 0

        # Check active register session for this store
        active_session = CashRegisterSession.objects.filter(
            store_id=store,
            status=RegisterSessionStatus.OPEN,
            is_deleted=False
        ).first()

        # 6. Create Invoice
        invoice = Invoice.objects.create(
            store_id=store,
            customer_id=customer,
            register_session_id=active_session,
            type=data.get('type', InvoiceType.POS),
            status=InvoiceStatus.DRAFT,
            subtotal=subtotal.quantize(Decimal('0.01')),
            total_discount=total_discount.quantize(Decimal('0.01')),
            cgst_amount=total_cgst.quantize(Decimal('0.01')),
            sgst_amount=total_sgst.quantize(Decimal('0.01')),
            igst_amount=total_igst.quantize(Decimal('0.01')),
            total_gst=total_gst.quantize(Decimal('0.01')),
            round_off=round_off.quantize(Decimal('0.01')),
            grand_total=rounded_grand_total.quantize(Decimal('0.01')),
            is_tax_inclusive=is_tax_inclusive,
            loyalty_points_redeemed=points_to_redeem,
            loyalty_discount_amount=loyalty_discount_amount.quantize(Decimal('0.01')),
            loyalty_points_earned=loyalty_points_earned,
            customer_name_snapshot=customer_name,
            customer_phone_snapshot=customer_phone,
            customer_gstin_snapshot=customer_gstin,
            notes=data.get('notes', ''),
        )

        # 7. Create Line Items and Atomically Adjust Inventory
        for item_data in item_rows:
            inv = item_data['inventory']
            product = item_data['product']
            qty = item_data['quantity']

            InvoiceItem.objects.create(
                invoice_id=invoice,
                product_id=product,
                product_name_snapshot=product.name,
                sku_snapshot=product.sku,
                barcode_snapshot=item_data['barcode'],
                hsn_code=item_data['hsn_code'],
                quantity=qty,
                unit_price=item_data['unit_price'],
                discount=item_data['discount'],
                tax_slab=item_data['tax_slab'],
                taxable_amount=item_data['taxable_amount'],
                gst_amount=item_data['gst_amount'],
                cgst_amount=item_data['cgst_amount'],
                sgst_amount=item_data['sgst_amount'],
                igst_amount=item_data['igst_amount'],
                line_total=item_data['line_total'],
            )

            # Deduct inventory with atomic stock movement
            inv.adjust_stock(
                quantity_delta=-qty,
                movement_type=StockMovementType.POS_SALE,
                reason=f"POS Sale #{invoice.invoice_number}",
                reference_id=str(invoice.invoice_number),
            )

        # 8. Record Payments
        payments_payload = data.get('payments', [])
        total_paid = Decimal('0.00')
        created_payments = []
        for pay in payments_payload:
            amount = Decimal(str(pay['amount']))
            p_obj = Payment.objects.create(
                invoice_id=invoice,
                method=pay.get('method', PaymentMethod.CASH),
                amount=amount,
                amount_tendered=Decimal(str(pay['amount_tendered'])) if pay.get('amount_tendered') is not None else None,
                change_returned=Decimal(str(pay['change_returned'])) if pay.get('change_returned') is not None else None,
                external_transaction_id=pay.get('external_transaction_id') or '',
                status='SUCCESS',
            )
            created_payments.append(p_obj)
            total_paid += amount

        # If fully paid, transition status to PAID
        if total_paid >= rounded_grand_total > Decimal('0.00') or rounded_grand_total == Decimal('0.00'):
            invoice.status = InvoiceStatus.PAID
        invoice.save()

        # Update active register session shift totals and record cash transactions
        if active_session:
            active_session.invoices_count += 1
            active_session.total_sales += rounded_grand_total

            for pay_record in created_payments:
                if pay_record.method == PaymentMethod.CASH:
                    active_session.total_cash_sales += pay_record.amount
                    active_session.expected_cash += pay_record.amount
                    CashTransaction.objects.create(
                        session_id=active_session,
                        type=CashTransactionType.CASH_SALE,
                        amount=pay_record.amount,
                        invoice_id=invoice,
                        payment_id=pay_record,
                        reason=f"Cash Sale Invoice #{invoice.invoice_number}",
                        created_by=request.user if request.user.is_authenticated else None,
                    )
                elif pay_record.method == PaymentMethod.UPI:
                    active_session.total_upi_sales += pay_record.amount
                elif pay_record.method == PaymentMethod.CARD:
                    active_session.total_card_sales += pay_record.amount
                elif pay_record.method == PaymentMethod.STORE_CREDIT:
                    active_session.total_credit_sales += pay_record.amount

            active_session.save()

        # 9. Update Store Customer Loyalty Ledger
        if store_customer:
            # Deduct redeemed points
            if points_to_redeem > 0:
                store_customer.loyalty_points -= points_to_redeem

            # Add newly earned points (if invoice is marked PAID)
            if invoice.status == InvoiceStatus.PAID and loyalty_points_earned > 0:
                store_customer.loyalty_points += loyalty_points_earned

            store_customer.total_visits += 1
            store_customer.last_visit = timezone.now()
            store_customer.save()

        response_serializer = InvoiceSerializer(invoice)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'], url_path='cancel')
    @transaction.atomic
    def cancel_invoice(self, request, pk=None):
        """
        Cancels an invoice, reverses inventory deductions back to store stock,
        and reverts loyalty points.
        """
        invoice = self.get_object()
        if invoice.status == InvoiceStatus.CANCELLED:
            raise ValidationError("Invoice is already cancelled.")

        # Re-inward stock for each item
        for item in invoice.items.select_related('product_id').all():
            try:
                inv = Inventory.objects.select_for_update().get(
                    store_id=invoice.store_id,
                    product_id=item.product_id,
                    is_deleted=False
                )
                inv.adjust_stock(
                    quantity_delta=item.quantity,
                    movement_type=StockMovementType.RETURN_RESTOCK,
                    reason=f"Cancellation of Invoice #{invoice.invoice_number}",
                    reference_id=str(invoice.invoice_number),
                )
            except Inventory.DoesNotExist:
                pass

        # Revert Loyalty Points
        if invoice.customer_id:
            try:
                store_customer = StoreCustomer.objects.get(
                    store_id=invoice.store_id,
                    customer_id=invoice.customer_id
                )
                # Re-credit redeemed points
                if invoice.loyalty_points_redeemed > 0:
                    store_customer.loyalty_points += invoice.loyalty_points_redeemed
                # Revoke earned points
                if invoice.loyalty_points_earned > 0:
                    store_customer.loyalty_points = max(0, store_customer.loyalty_points - invoice.loyalty_points_earned)
                store_customer.save()
            except StoreCustomer.DoesNotExist:
                pass

        invoice.status = InvoiceStatus.CANCELLED
        invoice.save()

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'], url_path='summary')
    def daily_summary(self, request):
        """
        Returns sales summary metrics for a given store and date (default today).
        """
        store_id = request.query_params.get('store_id')
        if not store_id:
            raise ValidationError("Query param 'store_id' is required.")

        date_str = request.query_params.get('date')
        if date_str:
            target_date = date_str
        else:
            target_date = timezone.now().date()

        invoices = Invoice.objects.filter(
            store_id=store_id,
            created_at__date=target_date,
            is_deleted=False
        )

        paid_invoices = invoices.filter(status=InvoiceStatus.PAID)

        total_sales = paid_invoices.aggregate(total=Sum('grand_total'))['total'] or Decimal('0.00')
        total_gst = paid_invoices.aggregate(total=Sum('total_gst'))['total'] or Decimal('0.00')
        total_discount = paid_invoices.aggregate(total=Sum('total_discount'))['total'] or Decimal('0.00')
        loyalty_discount = paid_invoices.aggregate(total=Sum('loyalty_discount_amount'))['total'] or Decimal('0.00')

        payments = Payment.objects.filter(
            invoice_id__in=paid_invoices,
            is_deleted=False
        )
        cash_total = payments.filter(method=PaymentMethod.CASH).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        card_total = payments.filter(method=PaymentMethod.CARD).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        upi_total = payments.filter(method=PaymentMethod.UPI).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        return Response({
            'date': str(target_date),
            'store_id': store_id,
            'total_invoices': invoices.count(),
            'paid_invoices_count': paid_invoices.count(),
            'cancelled_invoices_count': invoices.filter(status=InvoiceStatus.CANCELLED).count(),
            'total_sales': total_sales,
            'total_gst': total_gst,
            'total_discount': total_discount,
            'loyalty_discount': loyalty_discount,
            'tender_breakdown': {
                'cash': cash_total,
                'card': card_total,
                'upi': upi_total,
            }
        })
