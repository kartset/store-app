"""Unit tests for StoreCraft MCP Analytics Tools."""

import os
import sys
import uuid
from decimal import Decimal
from pathlib import Path

# Ensure backend directory is in path and Django is setup
backend_dir = str(Path(__file__).resolve().parent.parent.parent / "backend")
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "core.settings")
import django

django.setup()

from db.models import (
    Category,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    InvoiceType,
    Organization,
    Payment,
    PaymentMethod,
    Product,
    Store,
)
from django.test import TestCase
from django.utils import timezone

# Ensure mcp directory is in path
mcp_dir = str(Path(__file__).resolve().parent.parent)
if mcp_dir not in sys.path:
    sys.path.insert(0, mcp_dir)

from tools.analytics import (
    get_hourly_store_traffic,
    get_payment_method_breakdown,
    get_sales_kpis,
    get_sales_trajectory,
    get_top_selling_products,
    register_analytics_tools,
)


class MockMCPServer:
    """Mock MCP server to test tool registration."""

    def __init__(self):
        self.registered_tools = []

    def tool(self):
        def decorator(func):
            self.registered_tools.append(func)
            return func

        return decorator


class MCPAnalyticsToolsTests(TestCase):
    @classmethod
    def setUpClass(cls):
        from django.core.management import call_command
        from django.db import connection
        if connection.vendor == 'sqlite':
            call_command('migrate', verbosity=0)
        super().setUpClass()

    def setUp(self):
        self.org = Organization.objects.create(
            name="Retail Analytics Org", subdomain="retail-analytics"
        )
        self.other_org = Organization.objects.create(
            name="Other Isolated Org", subdomain="isolated-org"
        )

        self.store = Store.objects.create(
            organization_id=self.org,
            name="Indiranagar Branch",
            gst_number="29AAAAA1111A1Z5",
            is_active=True,
        )
        self.other_store = Store.objects.create(
            organization_id=self.other_org,
            name="Other Org Branch",
            gst_number="29BBBBB2222B1Z5",
            is_active=True,
        )

        self.category = Category.objects.create(name="Dairy", slug="dairy")
        self.product = Product.objects.create(
            organization_id=self.org,
            category_id=self.category,
            name="Fresh Cow Milk 1L",
            sku="MILK-1L",
            barcode="8901234567890",
            tax_slab=Decimal("5.00"),
            cost_price=Decimal("40.00"),
            base_mrp=Decimal("60.00"),
            uom="LITRE",
        )

        # Create Paid Invoices for our org
        self.inv1 = Invoice.objects.create(
            store_id=self.store,
            type=InvoiceType.POS,
            status=InvoiceStatus.PAID,
            subtotal=Decimal("100.00"),
            total_discount=Decimal("10.00"),
            cgst_amount=Decimal("2.50"),
            sgst_amount=Decimal("2.50"),
            total_gst=Decimal("5.00"),
            grand_total=Decimal("95.00"),
        )
        InvoiceItem.objects.create(
            invoice_id=self.inv1,
            product_id=self.product,
            product_name_snapshot="Fresh Cow Milk 1L",
            sku_snapshot="MILK-1L",
            quantity=2,
            unit_price=Decimal("50.00"),
            discount=Decimal("5.00"),
            tax_slab=Decimal("5.00"),
            taxable_amount=Decimal("95.00"),
            gst_amount=Decimal("5.00"),
            line_total=Decimal("95.00"),
        )
        Payment.objects.create(
            invoice_id=self.inv1,
            method=PaymentMethod.UPI,
            amount=Decimal("95.00"),
        )

        # Create a second Paid invoice with Cash
        self.inv2 = Invoice.objects.create(
            store_id=self.store,
            type=InvoiceType.POS,
            status=InvoiceStatus.PAID,
            subtotal=Decimal("200.00"),
            total_discount=Decimal("0.00"),
            total_gst=Decimal("10.00"),
            grand_total=Decimal("210.00"),
        )
        InvoiceItem.objects.create(
            invoice_id=self.inv2,
            product_id=self.product,
            product_name_snapshot="Fresh Cow Milk 1L",
            sku_snapshot="MILK-1L",
            quantity=4,
            unit_price=Decimal("50.00"),
            discount=Decimal("0.00"),
            tax_slab=Decimal("5.00"),
            taxable_amount=Decimal("200.00"),
            gst_amount=Decimal("10.00"),
            line_total=Decimal("210.00"),
        )
        Payment.objects.create(
            invoice_id=self.inv2,
            method=PaymentMethod.CASH,
            amount=Decimal("210.00"),
        )

        # Create a Cancelled invoice (should be excluded from revenue aggregates)
        self.inv_cancelled = Invoice.objects.create(
            store_id=self.store,
            type=InvoiceType.POS,
            status=InvoiceStatus.CANCELLED,
            subtotal=Decimal("500.00"),
            grand_total=Decimal("500.00"),
        )

        # Create invoice in the other org (tenant isolation check)
        self.inv_other = Invoice.objects.create(
            store_id=self.other_store,
            type=InvoiceType.POS,
            status=InvoiceStatus.PAID,
            subtotal=Decimal("1000.00"),
            grand_total=Decimal("1000.00"),
        )

    def test_get_sales_kpis_valid(self):
        kpis = get_sales_kpis(str(self.org.id), store_id=str(self.store.id))
        self.assertEqual(kpis["organization_id"], str(self.org.id))
        self.assertEqual(kpis["paid_invoices_count"], 2)
        # inv1: 95.00 + inv2: 210.00 = 305.00 (cancelled 500 excluded)
        self.assertEqual(kpis["gross_revenue"], 305.00)
        self.assertEqual(kpis["net_sales"], 300.00)
        self.assertEqual(kpis["total_tax"], 15.00)
        self.assertEqual(kpis["total_discount"], 10.00)
        self.assertEqual(kpis["average_order_value"], 152.50)
        self.assertIn("PAID", kpis["status_breakdown"])
        self.assertIn("CANCELLED", kpis["status_breakdown"])

    def test_get_sales_kpis_tenant_isolation(self):
        # Querying with a non-existent or other org UUID
        random_org_id = str(uuid.uuid4())
        kpis = get_sales_kpis(random_org_id)
        self.assertEqual(kpis["gross_revenue"], 0.0)
        self.assertEqual(kpis["paid_invoices_count"], 0)

        # Other org has only 1 invoice of 1000.00
        other_kpis = get_sales_kpis(str(self.other_org.id))
        self.assertEqual(other_kpis["gross_revenue"], 1000.00)
        self.assertEqual(other_kpis["paid_invoices_count"], 1)

    def test_get_sales_trajectory(self):
        res = get_sales_trajectory(str(self.org.id), store_id=str(self.store.id), days=7)
        self.assertEqual(res["organization_id"], str(self.org.id))
        self.assertEqual(res["days"], 7)
        self.assertEqual(len(res["trajectory"]), 7)
        self.assertEqual(res["total_revenue"], 305.00)
        self.assertEqual(res["total_invoices"], 2)

    def test_get_top_selling_products(self):
        res = get_top_selling_products(str(self.org.id), store_id=str(self.store.id), limit=5)
        self.assertEqual(len(res["products"]), 1)
        top = res["products"][0]
        self.assertEqual(top["sku"], "MILK-1L")
        self.assertEqual(top["name"], "Fresh Cow Milk 1L")
        self.assertEqual(top["quantity_sold"], 6)  # 2 + 4
        self.assertEqual(top["total_revenue"], 305.00)

    def test_get_payment_method_breakdown(self):
        res = get_payment_method_breakdown(str(self.org.id), store_id=str(self.store.id), days=30)
        self.assertEqual(res["total_collected"], 305.00)
        self.assertEqual(len(res["payment_methods"]), 2)
        methods = {p["method"]: p for p in res["payment_methods"]}
        self.assertIn(PaymentMethod.CASH, methods)
        self.assertIn(PaymentMethod.UPI, methods)
        self.assertEqual(methods[PaymentMethod.CASH]["amount"], 210.00)
        self.assertEqual(methods[PaymentMethod.UPI]["amount"], 95.00)

    def test_get_hourly_store_traffic(self):
        today = timezone.now().date().strftime("%Y-%m-%d")
        res = get_hourly_store_traffic(str(self.org.id), store_id=str(self.store.id), target_date=today)
        self.assertEqual(len(res["hourly_traffic"]), 24)
        self.assertEqual(res["total_invoices"], 2)
        self.assertEqual(res["total_revenue"], 305.00)

    def test_register_analytics_tools(self):
        mock_server = MockMCPServer()
        register_analytics_tools(mock_server)
        self.assertEqual(len(mock_server.registered_tools), 5)

    def test_health_check_endpoint(self):
        import asyncio
        import json

        import server
        from starlette.requests import Request

        scope = {"type": "http", "method": "GET", "headers": []}
        req = Request(scope)
        resp = asyncio.run(server.health_check(req))
        self.assertEqual(resp.status_code, 200)
        body = json.loads(resp.body.decode())
        self.assertEqual(body["status"], "healthy")
        self.assertEqual(body["tools_count"], 12)

    def test_portal_landing_page_endpoint(self):
        import asyncio

        import server
        from starlette.requests import Request

        scope = {
            "type": "http",
            "method": "GET",
            "headers": [
                (b"host", b"mcp.139.59.36.22.sslip.io"),
                (b"x-forwarded-proto", b"https"),
            ],
        }
        req = Request(scope)
        resp = asyncio.run(server.portal_page(req))
        self.assertEqual(resp.status_code, 200)
        html = resp.body.decode()
        self.assertIn("StoreCraft MCP Service", html)
        self.assertIn("https://mcp.139.59.36.22.sslip.io/sse", html)
        self.assertIn("get_sales_kpis", html)
        self.assertIn("search_products", html)



if __name__ == "__main__":
    import unittest
    unittest.main()
