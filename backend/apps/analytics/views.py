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
from rest_framework.permissions import AllowAny
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
    Payment,
)


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
    permission_classes = [AllowAny]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        start_date, end_date = _parse_date_range(request)

        # Base Invoice Filters
        inv_filter = Q(
            is_deleted=False,
            status__in=[InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID],
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
        if store_id:
            inv_filter &= Q(store_id=store_id)

        # Base Credit Note Filters
        cn_filter = Q(
            is_deleted=False,
            status=CreditNoteStatus.COMPLETED,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
        if store_id:
            cn_filter &= Q(store_id=store_id)

        # Base Order Filters
        ord_filter = Q(
            is_deleted=False,
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
        if store_id:
            ord_filter &= Q(store_id=store_id)

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
            status__in=[InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID],
            created_at__date__gte=prev_start,
            created_at__date__lte=prev_end,
        )
        if store_id:
            prev_inv_filter &= Q(store_id=store_id)

        prev_cn_filter = Q(
            is_deleted=False,
            status=CreditNoteStatus.COMPLETED,
            created_at__date__gte=prev_start,
            created_at__date__lte=prev_end,
        )
        if store_id:
            prev_cn_filter &= Q(store_id=store_id)

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
            'period': {
                'start_date': str(start_date),
                'end_date': str(end_date),
                'days': period_days,
            },
            'gross_sales': str(gross_sales.quantize(Decimal('0.01'))),
            'returns_total': str(returns_total.quantize(Decimal('0.01'))),
            'net_sales': str(net_sales.quantize(Decimal('0.01'))),
            'total_invoices': total_invoices,
            'total_orders': total_orders,
            'average_order_value': str(aov),
            'total_discount': str(total_discount.quantize(Decimal('0.01'))),
            'total_tax': str(total_tax.quantize(Decimal('0.01'))),
            'growth': {
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
    permission_classes = [AllowAny]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        interval = request.query_params.get('interval', 'day').lower()
        start_date, end_date = _parse_date_range(request)

        trunc_fn = TruncDate
        if interval == 'week':
            trunc_fn = TruncWeek
        elif interval == 'month':
            trunc_fn = TruncMonth

        inv_filter = Q(
            is_deleted=False,
            status__in=[InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID],
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
        if store_id:
            inv_filter &= Q(store_id=store_id)

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
        if store_id:
            cn_filter &= Q(store_id=store_id)

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
        for row in sales_by_date:
            b_date = row['bucket']
            date_key = b_date.strftime('%Y-%m-%d') if hasattr(b_date, 'strftime') else str(b_date)
            gross = row['gross_sales'] or Decimal('0.00')
            refunds = returns_map.get(date_key, Decimal('0.00'))
            net = max(Decimal('0.00'), gross - refunds)

            trend_data.append({
                'date': date_key,
                'gross_sales': str(gross.quantize(Decimal('0.01'))),
                'returns': str(refunds.quantize(Decimal('0.01'))),
                'net_sales': str(net.quantize(Decimal('0.01'))),
                'discount': str((row['discount'] or Decimal('0.00')).quantize(Decimal('0.01'))),
                'tax': str((row['tax'] or Decimal('0.00')).quantize(Decimal('0.01'))),
                'invoices': row['invoices'],
            })

        return Response({
            'interval': interval,
            'start_date': str(start_date),
            'end_date': str(end_date),
            'data': trend_data,
        })


class TopProductsAnalyticsView(APIView):
    """
    Best-Selling Products by Revenue and Volume.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        sort_by = request.query_params.get('sort_by', 'revenue')
        limit = min(50, max(1, int(request.query_params.get('limit', 10))))
        start_date, end_date = _parse_date_range(request)

        item_filter = Q(
            invoice_id__is_deleted=False,
            invoice_id__status__in=[InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID],
            invoice_id__created_at__date__gte=start_date,
            invoice_id__created_at__date__lte=end_date,
            is_deleted=False,
        )
        if store_id:
            item_filter &= Q(invoice_id__store_id=store_id)

        # Total revenue in period for calculating percentage contribution
        total_period_revenue = InvoiceItem.objects.filter(item_filter).aggregate(
            sum=Sum('line_total')
        )['sum'] or Decimal('0.00')

        order_clause = '-total_revenue' if sort_by == 'revenue' else '-units_sold'

        products_agg = (
            InvoiceItem.objects.filter(item_filter)
            .values('product_id', 'product_name_snapshot', 'sku_snapshot')
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

            results.append({
                'rank': idx,
                'product_id': item['product_id'],
                'name': item['product_name_snapshot'],
                'sku': item['sku_snapshot'],
                'units_sold': units,
                'revenue': str(rev.quantize(Decimal('0.01'))),
                'average_price': str(avg_price),
                'contribution_pct': float(pct),
            })

        return Response({
            'total_revenue': str(total_period_revenue.quantize(Decimal('0.01'))),
            'products': results,
        })


class CategoryBreakdownAnalyticsView(APIView):
    """
    Sales and Volume Breakdown by Product Category.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        start_date, end_date = _parse_date_range(request)

        item_filter = Q(
            invoice_id__is_deleted=False,
            invoice_id__status__in=[InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID],
            invoice_id__created_at__date__gte=start_date,
            invoice_id__created_at__date__lte=end_date,
            is_deleted=False,
        )
        if store_id:
            item_filter &= Q(invoice_id__store_id=store_id)

        total_revenue = InvoiceItem.objects.filter(item_filter).aggregate(
            sum=Sum('line_total')
        )['sum'] or Decimal('0.00')

        category_agg = (
            InvoiceItem.objects.filter(item_filter)
            .values('product_id__category_id', 'product_id__category_id__name')
            .annotate(
                revenue=Sum('line_total'),
                units_sold=Sum('quantity'),
                items_count=Count('id'),
            )
            .order_by('-revenue')
        )

        categories = []
        for cat in category_agg:
            rev = cat['revenue'] or Decimal('0.00')
            cat_name = cat['product_id__category_id__name'] or 'Uncategorized'
            pct = (
                (rev / total_revenue * 100).quantize(Decimal('0.1'))
                if total_revenue > Decimal('0.00')
                else Decimal('0.0')
            )

            categories.append({
                'category_id': cat['product_id__category_id'],
                'category_name': cat_name,
                'revenue': str(rev.quantize(Decimal('0.01'))),
                'units_sold': cat['units_sold'] or 0,
                'items_count': cat['items_count'] or 0,
                'percentage_share': float(pct),
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
    permission_classes = [AllowAny]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        start_date, end_date = _parse_date_range(request)

        inv_filter = Q(
            is_deleted=False,
            status__in=[InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID],
            created_at__date__gte=start_date,
            created_at__date__lte=end_date,
        )
        if store_id:
            inv_filter &= Q(store_id=store_id)

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
                'revenue': str(rev.quantize(Decimal('0.01'))),
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
    permission_classes = [AllowAny]

    def get(self, request):
        store_id = request.query_params.get('store_id')
        start_date, end_date = _parse_date_range(request)

        payment_filter = Q(
            invoice_id__is_deleted=False,
            invoice_id__created_at__date__gte=start_date,
            invoice_id__created_at__date__lte=end_date,
            is_deleted=False,
            status='SUCCESS',
        )
        if store_id:
            payment_filter &= Q(invoice_id__store_id=store_id)

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

        results = []
        for row in payments_agg:
            amt = row['total_amount'] or Decimal('0.00')
            pct = (
                (amt / total_tendered * 100).quantize(Decimal('0.1'))
                if total_tendered > Decimal('0.00')
                else Decimal('0.0')
            )

            results.append({
                'method': row['method'],
                'count': row['count'],
                'total_amount': str(amt.quantize(Decimal('0.01'))),
                'percentage_share': float(pct),
            })

        return Response({
            'total_amount': str(total_tendered.quantize(Decimal('0.01'))),
            'methods': results,
        })


class InventoryHealthAnalyticsView(APIView):
    """
    Inventory Stock Health, Holding Valuation & Low Stock Risk Monitor.
    """
    permission_classes = [AllowAny]

    def get(self, request):
        store_id = request.query_params.get('store_id')

        inv_filter = Q(is_deleted=False)
        if store_id:
            inv_filter &= Q(store_id=store_id)

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
