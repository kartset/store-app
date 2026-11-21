from datetime import date, timedelta
from decimal import Decimal

from django.db.models import (
    Count,
    F,
    Q,
    Sum,
)
from django.db.models.functions import (
    ExtractHour,
    TruncDate,
    TruncMonth,
    TruncWeek,
)
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from db.models import (
    CreditNote,
    CreditNoteStatus,
    Inventory,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    Order,
    OrganizationStaff,
    Payment,
    Store,
    StoreStaff,
)
from utils.tenant import get_user_organization


def get_analytics_accessible_store_ids(request, requested_store_id=None):
    """
    Resolves the list of Store IDs the authenticated user is permitted to query for analytics:
    1. Superuser:
       - If requested_store_id is specified: validates store exists, returns [requested_store_id].
       - If no requested_store_id: returns None (unrestricted global query).
    2. Org Admin (role='ORG_ADMIN'):
       - Auto-scopes to their organization's active stores.
       - If requested_store_id: validates it belongs to user's organization; raises PermissionDenied if not.
       - If no requested_store_id: returns list of all store IDs in user's organization.
    3. Store Staff:
       - Auto-scopes to their assigned stores in StoreStaff.
       - If requested_store_id: validates it is in their assigned stores; raises PermissionDenied if not.
       - If no requested_store_id: returns list of all assigned store IDs.
    4. Unaffiliated user:
       - Returns [] (evaluates to empty queryset / 0 metrics).
    """
    user = request.user
    if not user or not user.is_authenticated:
        raise PermissionDenied("Authentication credentials were not provided.")

    if getattr(user, 'is_superuser', False):
        if requested_store_id:
            if not Store.objects.filter(id=requested_store_id, is_deleted=False).exists():
                raise PermissionDenied("Store location not found.")
            return [requested_store_id]
        return None

    # Check Organization affiliation via OrganizationStaff
    org_staff = OrganizationStaff.objects.filter(
        user_id=user,
        is_active=True,
        is_deleted=False,
    ).select_related('organization_id').first()

    if org_staff:
        user_org = org_staff.organization_id
        org_store_ids = list(
            Store.objects.filter(
                organization_id=user_org,
                is_deleted=False,
            ).values_list('id', flat=True)
        )
        if requested_store_id:
            store_exists = Store.objects.filter(
                id=requested_store_id,
                organization_id=user_org,
                is_deleted=False,
            ).exists()
            if not store_exists:
                raise PermissionDenied("You do not have permission to view analytics for this store location.")
            return [requested_store_id]

        return org_store_ids

    # Store Staff (direct store assignment without org role)
    assigned_store_ids = list(
        StoreStaff.objects.filter(
            user_id=user,
            is_deleted=False,
        ).values_list('store_id_id', flat=True)
    )
    if not assigned_store_ids:
        return []

    if requested_store_id:
        store_exists = Store.objects.filter(
            id=requested_store_id,
            id__in=assigned_store_ids,
            is_deleted=False,
        ).exists()
        if not store_exists:
            raise PermissionDenied("You do not have permission to view analytics for this store location.")
        return [requested_store_id]

    return assigned_store_ids


def _parse_date_range(request):
    """
    Safely parses start_date and end_date query params,
    defaulting to the last 30 days up to today.
    """
    today = timezone.now().date()
    start_str = request.query_params.get('start_date')
    end_str = request.query_params.get('end_date')

    if start_str:
        try:
            start_date = date.fromisoformat(start_str.strip())
        except ValueError:
            start_date = today - timedelta(days=29)
    else:
        start_date = today - timedelta(days=29)

    if end_str:
        try:
            end_date = date.fromisoformat(end_str.strip())
        except ValueError:
            end_date = today
    else:
        end_date = today

    if start_date > end_date:
        start_date, end_date = end_date, start_date

    return start_date, end_date


class AnalyticsOverviewView(APIView):
    """
    Executive Sales & Retail Performance KPI Overview.
    Provides Gross Sales, Returns, Net Revenue, AOV, Total Invoices,
    Orders, Discounts, Taxes, and Growth comparison against prior equivalent period.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        start_date, end_date = _parse_date_range(request)
        store_ids = get_analytics_accessible_store_ids(request, requested_store_id=store_id)

        # Base Invoice Filters - include all non-cancelled invoices
        inv_filter = Q(
            is_deleted=False,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        ) & ~Q(status=InvoiceStatus.CANCELLED)
        if store_ids is not None:
            inv_filter &= Q(store_id__in=store_ids)

        # Base Credit Note Filters
        cn_filter = Q(
            is_deleted=False,
            status=CreditNoteStatus.COMPLETED,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
        if store_ids is not None:
            cn_filter &= Q(store_id__in=store_ids)

        # Base Order Filters
        ord_filter = Q(
            is_deleted=False,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
        if store_ids is not None:
            ord_filter &= Q(store_id__in=store_ids)

        # Current Period Aggregations
        inv_agg = Invoice.objects.filter(inv_filter).aggregate(
            gross_sales=Sum('grand_total'),
            total_discount=Sum('total_discount'),
            total_tax=Sum('total_gst'),
            invoice_count=Count('id'),
        )
        gross_sales = inv_agg['gross_sales'] or Decimal('0.00')
        total_discount = inv_agg['total_discount'] or Decimal('0.00')
        total_tax = inv_agg['total_tax'] or Decimal('0.00')
        total_invoices = inv_agg['invoice_count'] or 0

        returns_total = CreditNote.objects.filter(cn_filter).aggregate(
            refund_sum=Sum('total_refund_amount')
        )['refund_sum'] or Decimal('0.00')

        net_sales = max(Decimal('0.00'), gross_sales - returns_total)
        total_orders = Order.objects.filter(ord_filter).count()

        aov = (net_sales / total_invoices).quantize(Decimal('0.01')) if total_invoices > 0 else Decimal('0.00')

        # Prior Equivalent Period Comparison
        period_days = (end_date - start_date).days + 1
        prev_start = start_date - timedelta(days=period_days)
        prev_end = start_date - timedelta(days=1)

        prev_inv_filter = Q(
            is_deleted=False,
            created_at__date__gte=prev_start,
            created_at__date__lte=prev_end,
        ) & ~Q(status=InvoiceStatus.CANCELLED)
        if store_ids is not None:
            prev_inv_filter &= Q(store_id__in=store_ids)

        prev_cn_filter = Q(
            is_deleted=False,
            status=CreditNoteStatus.COMPLETED,
            created_at__date__gte=prev_start,
            created_at__date__lte=prev_end,
        )
        if store_ids is not None:
            prev_cn_filter &= Q(store_id__in=store_ids)

        prev_gross = Invoice.objects.filter(prev_inv_filter).aggregate(sum=Sum('grand_total'))['sum'] or Decimal('0.00')
        prev_returns = CreditNote.objects.filter(prev_cn_filter).aggregate(sum=Sum('total_refund_amount'))['sum'] or Decimal('0.00')
        prev_net = max(Decimal('0.00'), prev_gross - prev_returns)
        prev_invoices = Invoice.objects.filter(prev_inv_filter).count()

        sales_growth_pct = (
            ((net_sales - prev_net) / prev_net * 100).quantize(Decimal('0.1'))
            if prev_net > Decimal('0.00')
            else None
        )
        invoice_growth_pct = (
            ((total_invoices - prev_invoices) / prev_invoices * 100)
            if prev_invoices > 0
            else None
        )

        return Response({
            'period_start': start_date.isoformat(),
            'period_end': end_date.isoformat(),
            'store_id': store_id,
            'gross_sales': str(gross_sales.quantize(Decimal('0.01'))),
            'returns_total': str(returns_total.quantize(Decimal('0.01'))),
            'net_sales': str(net_sales.quantize(Decimal('0.01'))),
            'total_discount': str(total_discount.quantize(Decimal('0.01'))),
            'total_tax': str(total_tax.quantize(Decimal('0.01'))),
            'total_invoices': total_invoices,
            'total_orders': total_orders,
            'aov': str(aov),
            'average_order_value': str(aov),
            'comparison': {
                'sales_growth_pct': float(sales_growth_pct) if sales_growth_pct is not None else 0.0,
                'invoice_growth_pct': round(float(invoice_growth_pct), 1) if invoice_growth_pct is not None else 0.0,
                'prev_net_sales': str(prev_net.quantize(Decimal('0.01'))),
                'prev_invoices': prev_invoices,
            },
        })


class SalesTrendAnalyticsView(APIView):
    """
    Time-Series Sales Revenue Trend:
    Supports interval grouping ('day', 'week', 'month') with sales, returns,
    discounts, taxes, and transaction volume over time.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        interval = (request.query_params.get('granularity') or request.query_params.get('interval') or 'day').lower()
        start_date, end_date = _parse_date_range(request)
        store_ids = get_analytics_accessible_store_ids(request, requested_store_id=store_id)

        trunc_fn = TruncDate
        if interval == 'week':
            trunc_fn = TruncWeek
        elif interval == 'month':
            trunc_fn = TruncMonth

        inv_filter = Q(
            is_deleted=False,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        ) & ~Q(status=InvoiceStatus.CANCELLED)
        if store_ids is not None:
            inv_filter &= Q(store_id__in=store_ids)

        sales_by_date = (
            Invoice.objects.filter(inv_filter)
            .annotate(bucket=trunc_fn('created_at'))
            .values('bucket')
            .annotate(
                gross_sales=Sum('grand_total'),
                discount=Sum('total_discount'),
                tax=Sum('total_gst'),
                invoices=Count('id'),
            )
            .order_by('bucket')
        )

        cn_filter = Q(
            is_deleted=False,
            status=CreditNoteStatus.COMPLETED,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
        if store_ids is not None:
            cn_filter &= Q(store_id__in=store_ids)

        returns_by_date = (
            CreditNote.objects.filter(cn_filter)
            .annotate(bucket=trunc_fn('created_at'))
            .values('bucket')
            .annotate(refunds=Sum('total_refund_amount'))
        )
        returns_map = {
            item['bucket'].strftime('%Y-%m-%d') if hasattr(item['bucket'], 'strftime') else str(item['bucket']): item['refunds']
            for item in returns_by_date if item['bucket']
        }

        # Build combined chronological points
        trend_data = []
        for point in sales_by_date:
            b_val = point['bucket']
            date_key = b_val.strftime('%Y-%m-%d') if hasattr(b_val, 'strftime') else str(b_val)
            if hasattr(b_val, 'strftime'):
                if interval == 'month':
                    label = b_val.strftime('%b %Y')
                elif interval == 'week':
                    label = f"Wk {b_val.strftime('%d %b')}"
                else:
                    label = b_val.strftime('%d %b')
            else:
                label = str(b_val)

            gross = point['gross_sales'] or Decimal('0.00')
            ret = returns_map.get(date_key, Decimal('0.00')) or Decimal('0.00')
            net = max(Decimal('0.00'), gross - ret)
            disc = point['discount'] or Decimal('0.00')
            tax_val = point['tax'] or Decimal('0.00')
            inv_count = point['invoices'] or 0

            trend_data.append({
                'date': date_key,
                'label': label,
                'gross_sales': float(gross.quantize(Decimal('0.01'))),
                'returns': float(ret.quantize(Decimal('0.01'))),
                'net_sales': float(net.quantize(Decimal('0.01'))),
                'discount': str(disc.quantize(Decimal('0.01'))),
                'discounts': float(disc.quantize(Decimal('0.01'))),
                'tax': str(tax_val.quantize(Decimal('0.01'))),
                'taxes': float(tax_val.quantize(Decimal('0.01'))),
                'invoices': inv_count,
                'invoice_count': inv_count,
            })

        return Response({
            'granularity': interval,
            'interval': interval,
            'start_date': start_date.isoformat(),
            'end_date': end_date.isoformat(),
            'trend': trend_data,
            'points': trend_data,
            'data': trend_data,
        })


class TopProductsAnalyticsView(APIView):
    """
    Best-Selling Products by Revenue and Volume.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        sort_by = request.query_params.get('sort_by', 'revenue')
        limit = min(50, max(1, int(request.query_params.get('limit', 10))))
        start_date, end_date = _parse_date_range(request)
        store_ids = get_analytics_accessible_store_ids(request, requested_store_id=store_id)

        item_filter = Q(
            invoice_id__is_deleted=False,
            invoice_id__created_at__date__gte=start_date,
            invoice_id__created_at__date__lte=end_date,
            is_deleted=False,
        ) & ~Q(invoice_id__status=InvoiceStatus.CANCELLED)
        if store_ids is not None:
            item_filter &= Q(invoice_id__store_id__in=store_ids)

        # Total revenue in period for calculating percentage contribution
        total_period_revenue = InvoiceItem.objects.filter(item_filter).aggregate(
            sum=Sum('line_total')
        )['sum'] or Decimal('0.00')

        order_clause = '-total_revenue' if sort_by == 'revenue' else '-units_sold'

        products_agg = (
            InvoiceItem.objects.filter(item_filter)
            .values('product_id', 'product_name_snapshot', 'sku_snapshot', 'barcode_snapshot', 'product_id__category_id__name')
            .annotate(
                units_sold=Sum('quantity'),
                total_revenue=Sum('line_total'),
                total_discount=Sum('discount'),
            )
            .order_by(order_clause)[:limit]
        )

        results = []
        for idx, item in enumerate(products_agg, start=1):
            rev = item['total_revenue'] or Decimal('0.00')
            units = item['units_sold'] or 0
            avg_price = (rev / units).quantize(Decimal('0.01')) if units > 0 else Decimal('0.00')
            pct = (
                (rev / total_period_revenue * 100).quantize(Decimal('0.1'))
                if total_period_revenue > Decimal('0.00')
                else Decimal('0.0')
            )
            cat_name = item.get('product_id__category_id__name') or 'General'

            results.append({
                'rank': idx,
                'id': str(item['product_id']) if item['product_id'] else str(idx),
                'product_id': item['product_id'],
                'name': item['product_name_snapshot'],
                'sku': item['sku_snapshot'] or '',
                'barcode': item.get('barcode_snapshot') or '',
                'category_name': cat_name,
                'units_sold': units,
                'revenue': float(rev.quantize(Decimal('0.01'))),
                'average_price': str(avg_price),
                'contribution_pct': float(pct),
                'revenue_share_pct': float(pct),
            })

        return Response({
            'total_revenue': str(total_period_revenue.quantize(Decimal('0.01'))),
            'period_total_revenue': float(total_period_revenue.quantize(Decimal('0.01'))),
            'products': results,
        })


class CategoryBreakdownAnalyticsView(APIView):
    """
    Sales and Volume Breakdown by Product Category.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        start_date, end_date = _parse_date_range(request)
        store_ids = get_analytics_accessible_store_ids(request, requested_store_id=store_id)

        item_filter = Q(
            invoice_id__is_deleted=False,
            invoice_id__created_at__date__gte=start_date,
            invoice_id__created_at__date__lte=end_date,
            is_deleted=False,
        ) & ~Q(invoice_id__status=InvoiceStatus.CANCELLED)
        if store_ids is not None:
            item_filter &= Q(invoice_id__store_id__in=store_ids)

        total_revenue = InvoiceItem.objects.filter(item_filter).aggregate(
            sum=Sum('line_total')
        )['sum'] or Decimal('0.00')

        category_agg = (
            InvoiceItem.objects.filter(item_filter)
            .values('product_id__category_id', 'product_id__category_id__name')
            .annotate(
                units_sold=Sum('quantity'),
                revenue=Sum('line_total'),
            )
            .order_by('-revenue')
        )

        categories = []
        for row in category_agg:
            cat_name = row['product_id__category_id__name'] or 'Uncategorized'
            cat_id = str(row['product_id__category_id']) if row['product_id__category_id'] else None
            rev = row['revenue'] or Decimal('0.00')
            units = row['units_sold'] or 0
            share_pct = (
                (rev / total_revenue * 100).quantize(Decimal('0.1'))
                if total_revenue > Decimal('0.00')
                else Decimal('0.0')
            )

            categories.append({
                'category_id': cat_id,
                'category_name': cat_name,
                'units_sold': units,
                'revenue': float(rev.quantize(Decimal('0.01'))),
                'revenue_share_pct': float(share_pct),
            })

        return Response({
            'total_revenue': str(total_revenue.quantize(Decimal('0.01'))),
            'categories': categories,
        })


class HourlyFootfallAnalyticsView(APIView):
    """
    Hourly Transaction & Sales Footfall Distribution (00:00 to 23:00).
    Identifies peak customer buying hours across store branches.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        start_date, end_date = _parse_date_range(request)
        store_ids = get_analytics_accessible_store_ids(request, requested_store_id=store_id)

        inv_filter = Q(
            is_deleted=False,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        ) & ~Q(status=InvoiceStatus.CANCELLED)
        if store_ids is not None:
            inv_filter &= Q(store_id__in=store_ids)

        hourly_qs = (
            Invoice.objects.filter(inv_filter)
            .annotate(hour=ExtractHour('created_at'))
            .values('hour')
            .annotate(
                count=Count('id'),
                revenue=Sum('grand_total'),
            )
            .order_by('hour')
        )

        hourly_map = {item['hour']: item for item in hourly_qs if item['hour'] is not None}

        full_24_hours = []
        peak_hour = None
        max_trans = -1

        for h in range(24):
            record = hourly_map.get(h)
            cnt = record['count'] if record else 0
            rev = (record['revenue'] if record else Decimal('0.00')) or Decimal('0.00')

            if cnt > max_trans:
                max_trans = cnt
                peak_hour = f"{h:02d}:00"

            full_24_hours.append({
                'hour': h,
                'hour_label': f"{h:02d}:00",
                'transaction_count': cnt,
                'revenue': float(rev.quantize(Decimal('0.01'))),
            })

        return Response({
            'peak_hour': peak_hour,
            'max_transactions': max(0, max_trans),
            'hourly_distribution': full_24_hours,
        })


class PaymentMethodsAnalyticsView(APIView):
    """
    Payment Tender Distribution (Cash, UPI, Card, Store Credit, Razorpay).
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        start_date, end_date = _parse_date_range(request)
        store_ids = get_analytics_accessible_store_ids(request, requested_store_id=store_id)

        payment_filter = Q(
            invoice_id__is_deleted=False,
            invoice_id__created_at__date__gte=start_date,
            invoice_id__created_at__date__lte=end_date,
            is_deleted=False,
            status='SUCCESS',
        ) & ~Q(invoice_id__status=InvoiceStatus.CANCELLED)
        if store_ids is not None:
            payment_filter &= Q(invoice_id__store_id__in=store_ids)

        total_tendered = Payment.objects.filter(payment_filter).aggregate(
            sum=Sum('amount')
        )['sum'] or Decimal('0.00')

        payments_agg = (
            Payment.objects.filter(payment_filter)
            .values('method')
            .annotate(
                count=Count('id'),
                total_amount=Sum('amount'),
            )
            .order_by('-total_amount')
        )

        TENDER_LABELS = {
            'CASH': 'Cash',
            'UPI': 'UPI QR',
            'CARD': 'Credit / Debit Card',
            'STORE_CREDIT': 'Store Credit',
            'RAZORPAY': 'Online / Gateway',
        }

        results = []
        for row in payments_agg:
            amt = row['total_amount'] or Decimal('0.00')
            pct = (
                (amt / total_tendered * 100).quantize(Decimal('0.1'))
                if total_tendered > Decimal('0.00')
                else Decimal('0.0')
            )
            m_code = row['method']
            label = TENDER_LABELS.get(m_code, m_code.replace('_', ' ').title())

            results.append({
                'method': m_code,
                'label': label,
                'count': row['count'],
                'total_amount': float(amt.quantize(Decimal('0.01'))),
                'percentage': float(pct),
                'percentage_share': float(pct),
            })

        return Response({
            'total_amount': str(total_tendered.quantize(Decimal('0.01'))),
            'total_collected': float(total_tendered.quantize(Decimal('0.01'))),
            'methods': results,
            'payment_methods': results,
        })


class InventoryHealthAnalyticsView(APIView):
    """
    Inventory Stock Health, Holding Valuation & Low Stock Risk Monitor.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        store_ids = get_analytics_accessible_store_ids(request, requested_store_id=store_id)

        inv_filter = Q(is_deleted=False)
        if store_ids is not None:
            inv_filter &= Q(store_id__in=store_ids)

        qs = Inventory.objects.filter(inv_filter).select_related('product_id', 'store_id')

        total_skus = qs.count()
        total_units = qs.aggregate(sum=Sum('stock_quantity'))['sum'] or 0

        # Inventory valuation at retail price
        valuation = sum(
            (item.stock_quantity * (item.effective_price or Decimal('0.00')))
            for item in qs
        )

        low_stock_qs = qs.filter(
            stock_quantity__lte=F('low_stock_threshold'),
            stock_quantity__gt=0,
        )
        out_of_stock_qs = qs.filter(stock_quantity=0)
        healthy_stock_qs = qs.filter(stock_quantity__gt=F('low_stock_threshold'))

        low_stock_count = low_stock_qs.count()
        out_of_stock_count = out_of_stock_qs.count()
        healthy_stock_count = healthy_stock_qs.count()

        # Critical low stock items (top 10)
        critical_items = []
        for item in low_stock_qs.order_by('stock_quantity')[:10]:
            critical_items.append({
                'product_id': str(item.product_id.id),
                'product_name': item.product_id.name,
                'sku': item.product_id.sku,
                'store_name': item.store_id.name,
                'stock_quantity': item.stock_quantity,
                'threshold': item.low_stock_threshold,
                'reorder_quantity': item.reorder_quantity,
            })

        return Response({
            'total_skus': total_skus,
            'total_units': total_units,
            'valuation_retail': str(Decimal(str(valuation)).quantize(Decimal('0.01'))),
            'healthy_stock_count': healthy_stock_count,
            'low_stock_count': low_stock_count,
            'out_of_stock_count': out_of_stock_count,
            'critical_items': critical_items,
        })
