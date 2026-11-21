"""StoreCraft MCP Analytics Tools.

Provides read-only multi-tenant analytics and KPI intelligence via Django ORM.
All queries strictly enforce organization and optional store boundary filters.
"""

from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any

from db.models.invoice import Invoice, InvoiceItem, InvoiceStatus, Payment
from django.db.models import Avg, Count, Sum
from django.db.models.functions import ExtractHour, TruncDate
from django.utils import timezone


def _filter_invoices(
    organization_id: str,
    store_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    exclude_cancelled: bool = True,
):
    """Build a filtered Invoice queryset with strict tenant boundaries."""
    qs = Invoice.objects.filter(
        store_id__organization_id=organization_id,
        is_deleted=False,
    )

    if store_id:
        qs = qs.filter(store_id=store_id)

    if exclude_cancelled:
        qs = qs.exclude(status=InvoiceStatus.CANCELLED)

    if date_from:
        try:
            parsed_date = date.fromisoformat(date_from)
            start_dt = timezone.make_aware(datetime.combine(parsed_date, time.min))
            qs = qs.filter(created_at__gte=start_dt)
        except ValueError:
            pass

    if date_to:
        try:
            parsed_date = date.fromisoformat(date_to)
            end_dt = timezone.make_aware(datetime.combine(parsed_date, time.max))
            qs = qs.filter(created_at__lte=end_dt)
        except ValueError:
            pass

    return qs


def get_sales_kpis(
    organization_id: str,
    store_id: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict[str, Any]:
    """Retrieve financial KPIs including gross revenue, net sales, taxes, discounts, and order counts.

    Args:
        organization_id: Unique UUID of the organization (tenant boundary).
        store_id: Optional UUID of a specific store branch.
        date_from: Optional start date in YYYY-MM-DD format.
        date_to: Optional end date in YYYY-MM-DD format.

    Returns:
        Dictionary containing aggregated retail performance metrics.
    """
    qs = _filter_invoices(
        organization_id,
        store_id=store_id,
        date_from=date_from,
        date_to=date_to,
        exclude_cancelled=True,
    )

    aggregates = qs.aggregate(
        gross_revenue=Sum("grand_total"),
        net_sales=Sum("subtotal"),
        total_tax=Sum("total_gst"),
        total_discount=Sum("total_discount"),
        avg_order_value=Avg("grand_total"),
        invoice_count=Count("id"),
    )

    # Status counts including cancelled
    raw_qs = _filter_invoices(
        organization_id,
        store_id=store_id,
        date_from=date_from,
        date_to=date_to,
        exclude_cancelled=False,
    )
    status_counts = dict(
        raw_qs.values("status").annotate(count=Count("id")).values_list("status", "count")
    )

    gross = aggregates["gross_revenue"] or Decimal("0.00")
    net = aggregates["net_sales"] or Decimal("0.00")
    tax = aggregates["total_tax"] or Decimal("0.00")
    discount = aggregates["total_discount"] or Decimal("0.00")
    aov = aggregates["avg_order_value"] or Decimal("0.00")
    count = aggregates["invoice_count"] or 0

    return {
        "organization_id": organization_id,
        "store_id": store_id,
        "period": {"from": date_from, "to": date_to},
        "gross_revenue": float(round(gross, 2)),
        "net_sales": float(round(net, 2)),
        "total_tax": float(round(tax, 2)),
        "total_discount": float(round(discount, 2)),
        "average_order_value": float(round(aov, 2)),
        "paid_invoices_count": count,
        "status_breakdown": status_counts,
    }


def get_sales_trajectory(
    organization_id: str,
    store_id: str | None = None,
    days: int = 30,
) -> dict[str, Any]:
    """Retrieve daily sales time-series (revenue, net sales, invoice volume) over the past N days.

    Args:
        organization_id: Unique UUID of the organization.
        store_id: Optional UUID of a specific store branch.
        days: Number of past days to query (default: 30, max: 365).

    Returns:
        List of daily trajectory data points for sales forecasting and charts.
    """
    days = min(max(1, days), 365)
    start_date = timezone.now().date() - timedelta(days=days - 1)
    date_from = start_date.strftime("%Y-%m-%d")

    qs = _filter_invoices(
        organization_id,
        store_id=store_id,
        date_from=date_from,
        exclude_cancelled=True,
    )

    daily_rows = (
        qs.annotate(day=TruncDate("created_at"))
        .values("day")
        .annotate(
            revenue=Sum("grand_total"),
            net_sales=Sum("subtotal"),
            invoices=Count("id"),
        )
        .order_by("day")
    )

    # Convert to lookup dict
    data_by_date = {
        row["day"].strftime("%Y-%m-%d"): {
            "date": row["day"].strftime("%Y-%m-%d"),
            "revenue": float(round(row["revenue"] or Decimal("0.00"), 2)),
            "net_sales": float(round(row["net_sales"] or Decimal("0.00"), 2)),
            "invoices": row["invoices"],
        }
        for row in daily_rows
    }

    # Fill full continuous timeline
    trajectory = []
    total_rev = Decimal("0.00")
    total_inv = 0

    for i in range(days):
        current_date = (start_date + timedelta(days=i)).strftime("%Y-%m-%d")
        item = data_by_date.get(
            current_date,
            {"date": current_date, "revenue": 0.0, "net_sales": 0.0, "invoices": 0},
        )
        trajectory.append(item)
        total_rev += Decimal(str(item["revenue"]))
        total_inv += item["invoices"]

    return {
        "organization_id": organization_id,
        "store_id": store_id,
        "days": days,
        "total_revenue": float(round(total_rev, 2)),
        "total_invoices": total_inv,
        "trajectory": trajectory,
    }


def get_top_selling_products(
    organization_id: str,
    store_id: str | None = None,
    limit: int = 10,
    days: int = 30,
) -> dict[str, Any]:
    """Retrieve ranked top-selling items by revenue and quantity sold over a given period.

    Args:
        organization_id: Unique UUID of the organization.
        store_id: Optional UUID of a specific store branch.
        limit: Max products to return (default: 10, max: 100).
        days: Days to look back (default: 30).

    Returns:
        Ranked list of top-performing products with volume and revenue metrics.
    """
    limit = min(max(1, limit), 100)
    start_date = timezone.now().date() - timedelta(days=days - 1)
    date_from = start_date.strftime("%Y-%m-%d")

    inv_qs = _filter_invoices(
        organization_id,
        store_id=store_id,
        date_from=date_from,
        exclude_cancelled=True,
    )

    items = (
        InvoiceItem.objects.filter(
            invoice_id__in=inv_qs,
            is_deleted=False,
        )
        .values("product_id", "product_name_snapshot", "sku_snapshot")
        .annotate(
            quantity_sold=Sum("quantity"),
            total_revenue=Sum("line_total"),
            order_count=Count("invoice_id", distinct=True),
        )
        .order_by("-total_revenue")[:limit]
    )

    products = []
    for rank, item in enumerate(items, start=1):
        rev = item["total_revenue"] or Decimal("0.00")
        products.append(
            {
                "rank": rank,
                "product_id": str(item["product_id"]),
                "name": item["product_name_snapshot"],
                "sku": item["sku_snapshot"],
                "quantity_sold": item["quantity_sold"] or 0,
                "total_revenue": float(round(rev, 2)),
                "orders_count": item["order_count"],
            }
        )

    return {
        "organization_id": organization_id,
        "store_id": store_id,
        "days": days,
        "products": products,
    }


def get_payment_method_breakdown(
    organization_id: str,
    store_id: str | None = None,
    days: int = 30,
) -> dict[str, Any]:
    """Retrieve breakdown of payment tenders (Cash, Card, UPI, etc.) and their percentage share.

    Args:
        organization_id: Unique UUID of the organization.
        store_id: Optional UUID of a specific store branch.
        days: Days to look back (default: 30).

    Returns:
        Summary of tender distribution and transaction volumes.
    """
    start_date = timezone.now().date() - timedelta(days=days - 1)
    date_from = start_date.strftime("%Y-%m-%d")

    inv_qs = _filter_invoices(
        organization_id,
        store_id=store_id,
        date_from=date_from,
        exclude_cancelled=True,
    )

    payments = (
        Payment.objects.filter(
            invoice_id__in=inv_qs,
            is_deleted=False,
        )
        .values("method")
        .annotate(
            total_amount=Sum("amount"),
            transaction_count=Count("id"),
        )
        .order_by("-total_amount")
    )

    total_collected = sum(
        (p["total_amount"] or Decimal("0.00") for p in payments),
        Decimal("0.00"),
    )

    breakdown = []
    for p in payments:
        amount = p["total_amount"] or Decimal("0.00")
        share = float(round((amount / total_collected * 100), 2)) if total_collected > 0 else 0.0
        breakdown.append(
            {
                "method": p["method"],
                "amount": float(round(amount, 2)),
                "transaction_count": p["transaction_count"],
                "percentage_share": share,
            }
        )

    return {
        "organization_id": organization_id,
        "store_id": store_id,
        "days": days,
        "total_collected": float(round(total_collected, 2)),
        "payment_methods": breakdown,
    }


def get_hourly_store_traffic(
    organization_id: str,
    store_id: str | None = None,
    target_date: str | None = None,
) -> dict[str, Any]:
    """Retrieve hourly distribution (00:00 to 23:00) of customer billing transactions.

    Args:
        organization_id: Unique UUID of the organization.
        store_id: Optional UUID of a specific store branch.
        target_date: Date to inspect in YYYY-MM-DD format (defaults to today).

    Returns:
        24-hour breakdown of invoice volume and hourly revenue to pinpoint rush periods.
    """
    if not target_date:
        target_date = timezone.now().date().strftime("%Y-%m-%d")

    qs = _filter_invoices(
        organization_id,
        store_id=store_id,
        date_from=target_date,
        date_to=target_date,
        exclude_cancelled=True,
    )

    hourly_rows = (
        qs.annotate(hour=ExtractHour("created_at"))
        .values("hour")
        .annotate(
            invoices=Count("id"),
            revenue=Sum("grand_total"),
        )
        .order_by("hour")
    )

    hourly_data = {
        row["hour"]: {
            "hour": row["hour"],
            "hour_label": f"{row['hour']:02d}:00",
            "invoices": row["invoices"],
            "revenue": float(round(row["revenue"] or Decimal("0.00"), 2)),
        }
        for row in hourly_rows
    }

    # Generate complete 24 hours (0-23)
    traffic = []
    total_rev = Decimal("0.00")
    total_inv = 0

    for h in range(24):
        item = hourly_data.get(
            h,
            {"hour": h, "hour_label": f"{h:02d}:00", "invoices": 0, "revenue": 0.0},
        )
        traffic.append(item)
        total_rev += Decimal(str(item["revenue"]))
        total_inv += item["invoices"]

    return {
        "organization_id": organization_id,
        "store_id": store_id,
        "date": target_date,
        "total_revenue": float(round(total_rev, 2)),
        "total_invoices": total_inv,
        "hourly_traffic": traffic,
    }


def register_analytics_tools(mcp_server: Any):
    """Register all analytics tools on the given MCPServer instance."""
    mcp_server.tool()(get_sales_kpis)
    mcp_server.tool()(get_sales_trajectory)
    mcp_server.tool()(get_top_selling_products)
    mcp_server.tool()(get_payment_method_breakdown)
    mcp_server.tool()(get_hourly_store_traffic)
