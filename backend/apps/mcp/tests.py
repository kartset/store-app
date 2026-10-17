from decimal import Decimal

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from db.models.category import Category
from db.models.customer import Customer
from db.models.inventory import Inventory
from db.models.invoice import (
    Invoice,
    InvoiceStatus,
    InvoiceType,
    Payment,
    PaymentMethod,
)
from db.models.organisation import Organization
from db.models.products import Product
from db.models.store import Store
from db.models.store_customer import StoreCustomer

from .tools import MCPToolRegistry


class MCPToolsAndCopilotTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create base test organization
        self.org = Organization.objects.create(name="Test Retail Org")

        # Create test store
        self.store = Store.objects.create(
            name="Downtown Supermarket",
            organization_id=self.org,
            gst_number="27AABCU9603R1ZM",
            address="123 Market Street, Mumbai, Maharashtra",
            is_active=True,
        )

        # Create test category & products
        self.cat = Category.objects.create(name="Dairy & Cold", slug="dairy-cold")
        self.prod1 = Product.objects.create(
            name="Amul Butter 500g",
            sku="AMUL-BUT-500",
            barcode="8901262010053",
            organization_id=self.org,
            category_id=self.cat,
            cost_price=Decimal("230.00"),
            base_mrp=Decimal("275.00"),
            tax_slab=Decimal("12.00"),
            hsn_code="04051000",
            uom="PIECE",
            is_active=True,
        )

        self.prod2 = Product.objects.create(
            name="Mother Dairy Full Cream Milk 1L",
            sku="MD-MILK-1L",
            barcode="8901262020014",
            organization_id=self.org,
            category_id=self.cat,
            cost_price=Decimal("60.00"),
            base_mrp=Decimal("68.00"),
            tax_slab=Decimal("5.00"),
            hsn_code="04012000",
            uom="LITRE",
            is_active=True,
        )

        # Create inventory
        self.inv1 = Inventory.objects.create(
            store_id=self.store,
            product_id=self.prod1,
            stock_quantity=5,  # Below threshold
            low_stock_threshold=10,
            reorder_quantity=40,
            store_price=Decimal("270.00"),
        )

        self.inv2 = Inventory.objects.create(
            store_id=self.store,
            product_id=self.prod2,
            stock_quantity=80,  # Healthy stock
            low_stock_threshold=20,
            reorder_quantity=100,
            store_price=Decimal("68.00"),
        )

        # Create customer & store relationship
        self.cust = Customer.objects.create(
            name="Rajesh Sharma",
            mobile_number="9876543210",
            customer_type="RETAIL",
        )
        self.store_cust = StoreCustomer.objects.create(
            customer_id=self.cust,
            store_id=self.store,
            loyalty_points=350,
            total_visits=12,
            last_visit=timezone.now(),
        )

        # Create paid test invoice
        self.inv = Invoice.objects.create(
            store_id=self.store,
            customer_id=self.cust,
            invoice_number="INV-DOWN-20261018-0001",
            type=InvoiceType.POS,
            status=InvoiceStatus.PAID,
            subtotal=Decimal("1000.00"),
            total_discount=Decimal("50.00"),
            cgst_amount=Decimal("60.00"),
            sgst_amount=Decimal("60.00"),
            igst_amount=Decimal("0.00"),
            total_gst=Decimal("120.00"),
            grand_total=Decimal("1070.00"),
        )
        Payment.objects.create(
            invoice_id=self.inv,
            method=PaymentMethod.UPI,
            amount=Decimal("1070.00"),
            status="SUCCESS",
        )

    def test_mcp_tool_registry_tools_list(self):
        tools = MCPToolRegistry.list_tools()
        self.assertGreaterEqual(len(tools), 6)
        tool_names = [t["name"] for t in tools]
        self.assertIn("search_products", tool_names)
        self.assertIn("check_inventory", tool_names)
        self.assertIn("get_daily_sales_summary", tool_names)
        self.assertIn("lookup_customer", tool_names)
        self.assertIn("get_gst_filing_summary", tool_names)
        self.assertIn("list_stores", tool_names)

        # Verify JSON Schema standard compliance
        for t in tools:
            self.assertIn("name", t)
            self.assertIn("description", t)
            self.assertIn("inputSchema", t)
            self.assertEqual(t["inputSchema"]["type"], "object")

    def test_jsonrpc_tools_list(self):
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/list",
            "id": 1,
        }
        res = self.client.post("/api/mcp/rpc/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["jsonrpc"], "2.0")
        self.assertEqual(data["id"], 1)
        self.assertIn("tools", data["result"])
        self.assertGreaterEqual(len(data["result"]["tools"]), 6)

    def test_jsonrpc_call_search_products(self):
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "search_products",
                "arguments": {"query": "Butter"},
            },
            "id": 2,
        }
        res = self.client.post("/api/mcp/rpc/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["result"]["isError"])
        content_text = data["result"]["content"][0]["text"]
        self.assertIn("Amul Butter", content_text)
        self.assertIn("8901262010053", content_text)

    def test_jsonrpc_call_check_inventory_low_stock(self):
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "check_inventory",
                "arguments": {
                    "store_id": str(self.store.id),
                    "low_stock_only": True,
                },
            },
            "id": 3,
        }
        res = self.client.post("/api/mcp/rpc/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["result"]["isError"])
        content_text = data["result"]["content"][0]["text"]
        self.assertIn("Amul Butter 500g", content_text)
        self.assertNotIn("Mother Dairy Full Cream Milk", content_text)

    def test_jsonrpc_call_sales_summary(self):
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "get_daily_sales_summary",
                "arguments": {"store_id": str(self.store.id)},
            },
            "id": 4,
        }
        res = self.client.post("/api/mcp/rpc/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["result"]["isError"])
        content_text = data["result"]["content"][0]["text"]
        self.assertIn("1070", content_text)
        self.assertIn("UPI", content_text)

    def test_jsonrpc_call_lookup_customer(self):
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "lookup_customer",
                "arguments": {"phone": "9876543210"},
            },
            "id": 5,
        }
        res = self.client.post("/api/mcp/rpc/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertFalse(data["result"]["isError"])
        content_text = data["result"]["content"][0]["text"]
        self.assertIn("Rajesh Sharma", content_text)
        self.assertIn("350", content_text)

    def test_jsonrpc_invalid_tool_returns_error(self):
        payload = {
            "jsonrpc": "2.0",
            "method": "tools/call",
            "params": {
                "name": "non_existent_tool",
                "arguments": {},
            },
            "id": 99,
        }
        res = self.client.post("/api/mcp/rpc/", payload, format="json")
        self.assertEqual(res.status_code, 404)
        data = res.json()
        self.assertIn("error", data)
        self.assertEqual(data["error"]["code"], -32601)

    def test_rest_tools_list_endpoint(self):
        res = self.client.get("/api/mcp/tools/")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertGreaterEqual(data["count"], 6)
        self.assertEqual(len(data["tools"]), data["count"])

    def test_ai_chat_offline_intent_sales_query(self):
        payload = {
            "messages": [
                {"role": "user", "content": "What is our total sales revenue today?"}
            ],
            "store_id": str(self.store.id),
        }
        res = self.client.post("/api/mcp/chat/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("message", data)
        self.assertEqual(data["message"]["role"], "assistant")
        content = data["message"]["content"]
        self.assertIn("Daily Sales & Revenue Summary", content)
        self.assertIn("1,070.00", content)
        self.assertGreaterEqual(len(data["executed_tools"]), 1)
        self.assertEqual(data["executed_tools"][0]["tool"], "get_daily_sales_summary")

    def test_ai_chat_offline_intent_low_stock_query(self):
        payload = {
            "messages": [
                {"role": "user", "content": "Show me products that are low in stock."}
            ],
            "store_id": str(self.store.id),
        }
        res = self.client.post("/api/mcp/chat/", payload, format="json")
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("message", data)
        content = data["message"]["content"]
        self.assertIn("Inventory Stock Overview", content)
        self.assertIn("Amul Butter 500g", content)
        self.assertGreaterEqual(len(data["executed_tools"]), 1)
        self.assertEqual(data["executed_tools"][0]["tool"], "check_inventory")
