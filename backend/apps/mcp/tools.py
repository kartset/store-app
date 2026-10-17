import json
import uuid
from collections.abc import Callable
from datetime import date
from typing import Any

from django.db.models import F, Q, Sum
from django.utils import timezone

from apps.gst.services import GSTComputationService
from db.models.customer import Customer
from db.models.inventory import Inventory
from db.models.invoice import Invoice, Payment
from db.models.orders import Order
from db.models.products import Product
from db.models.store import Store
from db.models.store_customer import StoreCustomer


class MCPToolRegistry:
    """
    Registry for Store App Model Context Protocol (MCP) tools.
    Exposes high-speed, safe, read-only and operational retail queries
    as standardized MCP tools.
    """
    _tools: dict[str, dict[str, Any]] = {}
    _handlers: dict[str, Callable] = {}

    @classmethod
    def register(cls, name: str, description: str, input_schema: dict[str, Any]):
        def decorator(fn: Callable):
            cls._tools[name] = {
                "name": name,
                "description": description,
                "inputSchema": input_schema,
            }
            cls._handlers[name] = fn
            return fn
        return decorator

    @classmethod
    def list_tools(cls) -> list[dict[str, Any]]:
        return list(cls._tools.values())

    @classmethod
    def get_tool(cls, name: str) -> dict[str, Any] | None:
        return cls._tools.get(name)

    @classmethod
    def call_tool(cls, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        handler = cls._handlers.get(name)
        if not handler:
            return {
                "content": [{"type": "text", "text": f"Error: Tool '{name}' not found."}],
                "isError": True,
            }
        try:
            result = handler(**arguments)
            return {
                "content": [{"type": "text", "text": json.dumps(result, default=str, indent=2)}],
                "isError": False,
                "structured_data": result,
            }
        except TypeError as e:
            return {
                "content": [{"type": "text", "text": f"Invalid arguments for tool '{name}': {e!s}"}],
                "isError": True,
            }
        except Exception as e:  # noqa: BLE001
            return {
                "content": [{"type": "text", "text": f"Tool execution failed for '{name}': {e!s}"}],
                "isError": True,
            }


# -------------------------------------------------------------------------
# Tool 1: search_products
# -------------------------------------------------------------------------
@MCPToolRegistry.register(
    name="search_products",
    description="Search products in the retail master catalog by product name, universal barcode, internal sticker barcode, or SKU.",
    input_schema={
        "type": "object",
        "properties": {
            "query": {
                "type": "string",
                "description": "Product name, barcode number (EAN/UPC), or SKU to search for.",
            },
            "category": {
                "type": "string",
                "description": "Optional category name filter (e.g. 'Dairy', 'Snacks', 'Beverages').",
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of matching products to return (default: 10, max: 50).",
                "default": 10,
            },
        },
        "required": ["query"],
    },
)
def search_products(query: str, category: str | None = None, limit: int = 10) -> list[dict[str, Any]]:
    limit = min(max(1, limit), 50)
    qs = Product.objects.filter(is_active=True).select_related('category_id')

    q_filter = (
        Q(name__icontains=query) |
        Q(barcode__icontains=query) |
        Q(internal_barcode__icontains=query) |
        Q(sku__icontains=query)
    )
    qs = qs.filter(q_filter)

    if category:
        qs = qs.filter(category_id__name__icontains=category)

    results = []
    for p in qs[:limit]:
        results.append({
            "id": str(p.id),
            "name": p.name,
            "sku": p.sku,
            "barcode": p.barcode or p.internal_barcode or "N/A",
            "mrp": float(p.base_mrp),
            "cost_price": float(p.cost_price),
            "tax_slab": float(p.tax_slab),
            "hsn_code": p.hsn_code or "N/A",
            "category": p.category_id.name if p.category_id else "Uncategorized",
            "uom": p.uom,
        })
    return results


# -------------------------------------------------------------------------
# Tool 2: check_inventory
# -------------------------------------------------------------------------
@MCPToolRegistry.register(
    name="check_inventory",
    description="Check live store stock quantities, low-stock threshold warnings, reorder suggestions, and store price overrides.",
    input_schema={
        "type": "object",
        "properties": {
            "store_id": {
                "type": "string",
                "description": "Optional UUID or store name of the retail store. If omitted, queries across all stores.",
            },
            "low_stock_only": {
                "type": "boolean",
                "description": "If true, only returns items whose quantity is below or at their low-stock threshold.",
                "default": False,
            },
            "product_query": {
                "type": "string",
                "description": "Optional product name or barcode to filter stock for.",
            },
            "limit": {
                "type": "integer",
                "description": "Maximum number of inventory records to return (default: 20).",
                "default": 20,
            },
        },
    },
)
def check_inventory(
    store_id: str | None = None,
    low_stock_only: bool = False,
    product_query: str | None = None,
    limit: int = 20,
) -> list[dict[str, Any]]:
    limit = min(max(1, limit), 100)
    qs = Inventory.objects.filter(is_deleted=False).select_related('product_id', 'store_id')

    if store_id:
        try:
            uuid.UUID(str(store_id))
            qs = qs.filter(store_id_id=store_id)
        except (ValueError, AttributeError):
            qs = qs.filter(store_id__name__icontains=store_id)

    if low_stock_only:
        qs = qs.filter(stock_quantity__lte=F('low_stock_threshold'))

    if product_query:
        qs = qs.filter(
            Q(product_id__name__icontains=product_query) |
            Q(product_id__barcode__icontains=product_query) |
            Q(product_id__internal_barcode__icontains=product_query)
        )

    results = []
    for inv in qs.order_by('stock_quantity')[:limit]:
        p = inv.product_id
        s = inv.store_id
        store_price = float(inv.store_price) if inv.store_price is not None else float(p.base_mrp)
        is_low = inv.stock_quantity <= inv.low_stock_threshold

        results.append({
            "inventory_id": str(inv.id),
            "product_id": str(p.id),
            "product_name": p.name,
            "barcode": p.barcode or p.internal_barcode or "N/A",
            "store_id": str(s.id),
            "store_name": s.name,
            "stock_quantity": inv.stock_quantity,
            "low_stock_threshold": inv.low_stock_threshold,
            "reorder_quantity": inv.reorder_quantity,
            "is_low_stock": is_low,
            "selling_price": store_price,
            "cost_price": float(p.cost_price),
            "total_valuation": round(inv.stock_quantity * float(p.cost_price), 2),
            "batch_number": inv.batch_number or "N/A",
        })
    return results


# -------------------------------------------------------------------------
# Tool 3: get_daily_sales_summary
# -------------------------------------------------------------------------
@MCPToolRegistry.register(
    name="get_daily_sales_summary",
    description="Retrieve real-time sales overview, gross turnover, net revenue, GST collection, invoice volume, and payment method split for a specific date.",
    input_schema={
        "type": "object",
        "properties": {
            "date": {
                "type": "string",
                "description": "Date in YYYY-MM-DD format. Defaults to today if omitted.",
            },
            "store_id": {
                "type": "string",
                "description": "Optional store UUID or name to scope sales. If omitted, sums across all active stores.",
            },
        },
    },
)
def get_daily_sales_summary(date_str: str | None = None, store_id: str | None = None) -> dict[str, Any]:
    if date_str:
        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            target_date = timezone.now().date()
    else:
        target_date = timezone.now().date()

    inv_qs = Invoice.objects.filter(status='PAID', created_at__date=target_date)

    if store_id:
        try:
            uuid.UUID(str(store_id))
            inv_qs = inv_qs.filter(store_id_id=store_id)
        except (ValueError, AttributeError):
            inv_qs = inv_qs.filter(store_id__name__icontains=store_id)

    total_invoices = inv_qs.count()
    aggregates = inv_qs.aggregate(
        gross=Sum('grand_total'),
        subtotal=Sum('subtotal'),
        discount=Sum('total_discount'),
        gst=Sum('total_gst'),
        cgst=Sum('cgst_amount'),
        sgst=Sum('sgst_amount'),
        igst=Sum('igst_amount'),
    )

    gross_total = float(aggregates['gross'] or 0)
    subtotal = float(aggregates['subtotal'] or 0)
    discount = float(aggregates['discount'] or 0)
    total_gst = float(aggregates['gst'] or 0)
    cgst = float(aggregates['cgst'] or 0)
    sgst = float(aggregates['sgst'] or 0)
    igst = float(aggregates['igst'] or 0)

    # Payment breakdown
    payments = Payment.objects.filter(
        invoice_id__in=inv_qs,
        status='SUCCESS'
    ).values('method').annotate(total=Sum('amount'))

    tenders = {}
    for p in payments:
        tenders[p['method']] = float(p['total'] or 0)

    aov = round(gross_total / total_invoices, 2) if total_invoices > 0 else 0.0

    return {
        "date": target_date.isoformat(),
        "store_filter": store_id or "All Stores",
        "total_invoices": total_invoices,
        "gross_turnover": round(gross_total, 2),
        "net_subtotal": round(subtotal, 2),
        "discounts_given": round(discount, 2),
        "average_order_value": aov,
        "tax_breakup": {
            "total_gst": round(total_gst, 2),
            "cgst": round(cgst, 2),
            "sgst": round(sgst, 2),
            "igst": round(igst, 2),
        },
        "payment_tenders": tenders,
    }


# -------------------------------------------------------------------------
# Tool 4: lookup_customer
# -------------------------------------------------------------------------
@MCPToolRegistry.register(
    name="lookup_customer",
    description="Look up a customer profile by 10-digit mobile phone number, retrieving loyalty points, visit history, customer tier, and recent invoices.",
    input_schema={
        "type": "object",
        "properties": {
            "phone": {
                "type": "string",
                "description": "10-digit mobile number of the customer (e.g. '9876543210' or '+919876543210').",
            },
        },
        "required": ["phone"],
    },
)
def lookup_customer(phone: str) -> dict[str, Any]:
    cleaned_phone = "".join(filter(str.isdigit, phone))
    if len(cleaned_phone) > 10:
        cleaned_phone = cleaned_phone[-10:]

    customer = Customer.objects.filter(mobile_number__endswith=cleaned_phone).first()
    if not customer:
        return {
            "found": False,
            "message": f"No customer found with phone number ending in '{cleaned_phone}'.",
        }

    store_relations = StoreCustomer.objects.filter(customer_id=customer).select_related('store_id')
    stores_data = []
    total_loyalty = 0
    total_visits = 0

    for sc in store_relations:
        total_loyalty += sc.loyalty_points
        total_visits += sc.total_visits
        stores_data.append({
            "store_name": sc.store_id.name,
            "loyalty_points": sc.loyalty_points,
            "visit_count": sc.total_visits,
            "last_visit": sc.last_visit.isoformat() if sc.last_visit else None,
        })

    # Recent invoices
    recent_invoices = []
    for inv in customer.invoices.filter(status='PAID').order_by('-created_at')[:5]:
        recent_invoices.append({
            "invoice_number": inv.invoice_number,
            "date": inv.created_at.date().isoformat(),
            "amount": float(inv.grand_total),
            "type": inv.type,
        })

    return {
        "found": True,
        "customer_id": str(customer.id),
        "name": customer.name,
        "mobile_number": customer.mobile_number,
        "email": customer.email or "N/A",
        "customer_type": customer.customer_type,
        "gstin": customer.gstin or "N/A",
        "total_loyalty_points": total_loyalty,
        "total_store_visits": total_visits,
        "store_memberships": stores_data,
        "recent_invoices": recent_invoices,
    }


# -------------------------------------------------------------------------
# Tool 5: get_gst_filing_summary
# -------------------------------------------------------------------------
@MCPToolRegistry.register(
    name="get_gst_filing_summary",
    description="Retrieve statutory GST compliance return summary (GSTR-1 outward supplies & GSTR-3B tax liability) for any tax period (e.g. '2026-10').",
    input_schema={
        "type": "object",
        "properties": {
            "period": {
                "type": "string",
                "description": "Tax period key in YYYY-MM (e.g. '2026-10') or MMYYYY (e.g. '102026') format. Defaults to current month.",
            },
            "store_id": {
                "type": "string",
                "description": "Optional retail store UUID. If omitted, aggregates across stores.",
            },
        },
    },
)
def get_gst_filing_summary(period: str | None = None, store_id: str | None = None) -> dict[str, Any]:
    if not period:
        now = timezone.now()
        period = f"{now.year}-{now.month:02d}"

    gstr1 = GSTComputationService.compute_gstr1(store_id=store_id, period_key=period)
    gstr3b = GSTComputationService.compute_gstr3b(store_id=store_id, period_key=period)

    summary = gstr1.get("summary", {})
    liability = gstr3b.get("tax_liability", {})

    return {
        "period_key": period,
        "store_name": gstr1.get("store_name", "All Stores"),
        "store_gstin": gstr1.get("store_gstin", "N/A"),
        "gross_turnover": summary.get("gross_turnover", 0.0),
        "net_taxable_value": summary.get("taxable_value", 0.0),
        "cgst_amount": summary.get("cgst", 0.0),
        "sgst_amount": summary.get("sgst", 0.0),
        "igst_amount": summary.get("igst", 0.0),
        "total_tax_liability": liability.get("total_tax_payable", summary.get("total_tax", 0.0)),
        "invoices_count": summary.get("invoices_count", 0),
        "b2b_invoices_count": len(gstr1.get("b2b", [])),
        "b2cs_entries_count": len(gstr1.get("b2cs", [])),
        "hsn_codes_count": len(gstr1.get("hsn", [])),
        "documents_issued": gstr1.get("doc_issue", {}),
    }


# -------------------------------------------------------------------------
# Tool 6: list_stores
# -------------------------------------------------------------------------
@MCPToolRegistry.register(
    name="list_stores",
    description="List active retail stores, branch codes, addresses, and GST numbers.",
    input_schema={
        "type": "object",
        "properties": {
            "active_only": {
                "type": "boolean",
                "description": "Filter by active stores only (default: True).",
                "default": True,
            },
        },
    },
)
def list_stores(active_only: bool = True) -> list[dict[str, Any]]:
    qs = Store.objects.all()
    if active_only:
        qs = qs.filter(is_active=True)

    results = []
    for s in qs.order_by('name'):
        results.append({
            "id": str(s.id),
            "name": s.name,
            "gst_number": s.gst_number or "N/A",
            "address": s.address or "N/A",
            "is_active": s.is_active,
        })
    return results


# -------------------------------------------------------------------------
# Tool 7: lookup_order
# -------------------------------------------------------------------------
@MCPToolRegistry.register(
    name="lookup_order",
    description="Lookup an omnichannel customer order by order number or customer phone.",
    input_schema={
        "type": "object",
        "properties": {
            "order_number": {
                "type": "string",
                "description": "Order number (e.g. 'ORD-STR1-20261017-0001').",
            },
            "phone": {
                "type": "string",
                "description": "Customer mobile number to search recent orders for.",
            },
        },
    },
)
def lookup_order(order_number: str | None = None, phone: str | None = None) -> list[dict[str, Any]]:
    qs = Order.objects.all().select_related('store_id')
    if order_number:
        qs = qs.filter(order_number__icontains=order_number)
    elif phone:
        cleaned = "".join(filter(str.isdigit, phone))
        if len(cleaned) > 10:
            cleaned = cleaned[-10:]
        qs = qs.filter(customer_phone_snapshot__icontains=cleaned)
    else:
        return []

    results = []
    for ord in qs.order_by('-created_at')[:5]:
        results.append({
            "id": str(ord.id),
            "order_number": ord.order_number,
            "store_name": ord.store_id.name if ord.store_id else "N/A",
            "customer_name": ord.customer_name_snapshot,
            "customer_phone": ord.customer_phone_snapshot,
            "status": ord.status,
            "fulfillment_type": ord.fulfillment_type,
            "grand_total": float(ord.grand_total),
            "payment_status": ord.payment_status,
            "date": ord.created_at.date().isoformat(),
        })
    return results
