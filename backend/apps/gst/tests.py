from datetime import date
from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from db.models import (
    Customer,
    GSTFilingPeriod,
    GSTFilingStatus,
    GSTReturnType,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    Organization,
    Product,
    Store,
)


class GSTModuleTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="Karnataka Retail Hub Pvt Ltd")
        self.store = Store.objects.create(
            name="Indiranagar Store",
            organization_id=self.org,
            gst_number="29AABCS1429B1Z1",
            address="100 Feet Rd, Indiranagar, Bengaluru, KA"
        )
        self.b2b_customer = Customer.objects.create(
            name="Tech Enterprises Pvt Ltd",
            mobile_number="9880011223",
            customer_type="CORPORATE",
            gstin="29AABCT8899K1Z5"
        )
        self.b2c_customer = Customer.objects.create(
            name="Ananya Sharma",
            mobile_number="9988776655",
            customer_type="RETAIL"
        )
        self.prod_electronics = Product.objects.create(
            name="Mechanical Keyboard",
            sku="KB-M100",
            base_mrp=Decimal("3540.00"),
            cost_price=Decimal("2000.00"),
            tax_slab=Decimal("18.0"),
            organization_id=self.org
        )
        self.prod_grocery = Product.objects.create(
            name="Organic Almonds 500g",
            sku="GR-ALM-500",
            base_mrp=Decimal("525.00"),
            cost_price=Decimal("350.00"),
            tax_slab=Decimal("5.0"),
            organization_id=self.org
        )

        # Create 1 B2B Invoice (Intra-state KA 18%)
        self.inv_b2b = Invoice.objects.create(
            store_id=self.store,
            customer_id=self.b2b_customer,
            invoice_number="INV-INDI-20261018-0001",
            status=InvoiceStatus.PAID,
            subtotal=Decimal("3000.00"),
            total_discount=Decimal("0.00"),
            cgst_amount=Decimal("270.00"),
            sgst_amount=Decimal("270.00"),
            igst_amount=Decimal("0.00"),
            total_gst=Decimal("540.00"),
            grand_total=Decimal("3540.00"),
            customer_name_snapshot="Tech Enterprises Pvt Ltd",
            customer_phone_snapshot="9880011223",
            customer_gstin_snapshot="29AABCT8899K1Z5"
        )
        InvoiceItem.objects.create(
            invoice_id=self.inv_b2b,
            product_id=self.prod_electronics,
            product_name_snapshot="Mechanical Keyboard",
            sku_snapshot="KB-M100",
            hsn_code="84716060",
            quantity=1,
            unit_price=Decimal("3000.00"),
            tax_slab=Decimal("18.0"),
            taxable_amount=Decimal("3000.00"),
            cgst_amount=Decimal("270.00"),
            sgst_amount=Decimal("270.00"),
            igst_amount=Decimal("0.00"),
            gst_amount=Decimal("540.00"),
            line_total=Decimal("3540.00")
        )

        # Create 1 B2C Invoice (Intra-state KA 5%)
        self.inv_b2c = Invoice.objects.create(
            store_id=self.store,
            customer_id=self.b2c_customer,
            invoice_number="INV-INDI-20261018-0002",
            status=InvoiceStatus.PAID,
            subtotal=Decimal("500.00"),
            total_discount=Decimal("0.00"),
            cgst_amount=Decimal("12.50"),
            sgst_amount=Decimal("12.50"),
            igst_amount=Decimal("0.00"),
            total_gst=Decimal("25.00"),
            grand_total=Decimal("525.00"),
            customer_name_snapshot="Ananya Sharma",
            customer_phone_snapshot="9988776655",
            customer_gstin_snapshot=""
        )
        InvoiceItem.objects.create(
            invoice_id=self.inv_b2c,
            product_id=self.prod_grocery,
            product_name_snapshot="Organic Almonds 500g",
            sku_snapshot="GR-ALM-500",
            hsn_code="08021200",
            quantity=1,
            unit_price=Decimal("500.00"),
            tax_slab=Decimal("5.0"),
            taxable_amount=Decimal("500.00"),
            cgst_amount=Decimal("12.50"),
            sgst_amount=Decimal("12.50"),
            igst_amount=Decimal("0.00"),
            gst_amount=Decimal("25.00"),
            line_total=Decimal("525.00")
        )

        self.current_period = timezone.now().strftime('%Y-%m')

    def test_gstr1_summary_endpoint(self):
        """Test GET /api/gst/gstr1-summary/ categorizing B2B and B2CS."""
        url = f"/api/gst/gstr1-summary/?store_id={self.store.id}&period={self.current_period}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        # Check B2B (Table 4)
        self.assertEqual(len(data['b2b']), 1)
        b2b_inv = data['b2b'][0]
        self.assertEqual(b2b_inv['invoice_number'], "INV-INDI-20261018-0001")
        self.assertEqual(b2b_inv['customer_gstin'], "29AABCT8899K1Z5")
        self.assertEqual(Decimal(str(b2b_inv['taxable_value'])), Decimal("3000.00"))
        self.assertEqual(Decimal(str(b2b_inv['cgst'])), Decimal("270.00"))

        # Check B2CS (Table 7)
        self.assertEqual(len(data['b2cs']), 1)
        b2cs_entry = data['b2cs'][0]
        self.assertEqual(b2cs_entry['pos'], "29")
        self.assertEqual(b2cs_entry['rate'], 5.0)
        self.assertEqual(Decimal(str(b2cs_entry['taxable_value'])), Decimal("500.00"))
        self.assertEqual(Decimal(str(b2cs_entry['cgst'])), Decimal("12.50"))

        # Check Summary
        summary = data['summary']
        self.assertEqual(Decimal(str(summary['gross_turnover'])), Decimal("4065.00"))
        self.assertEqual(Decimal(str(summary['taxable_value'])), Decimal("3500.00"))
        self.assertEqual(Decimal(str(summary['total_tax'])), Decimal("565.00"))
        self.assertEqual(summary['invoices_count'], 2)

    def test_hsn_summary_table12(self):
        """Test GET /api/gst/hsn-summary/ grouping by HSN code and tax slab."""
        url = f"/api/gst/hsn-summary/?store_id={self.store.id}&period={self.current_period}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        self.assertEqual(data['total_items'], 2)
        hsn_codes = [h['hsn_code'] for h in data['hsn']]
        self.assertIn("84716060", hsn_codes)
        self.assertIn("08021200", hsn_codes)

        elec_hsn = next(h for h in data['hsn'] if h['hsn_code'] == "84716060")
        self.assertEqual(Decimal(str(elec_hsn['taxable_value'])), Decimal("3000.00"))
        self.assertEqual(elec_hsn['rate'], 18.0)

    def test_gstr3b_summary_endpoint(self):
        """Test GET /api/gst/gstr3b-summary/ outward liability table 3.1."""
        url = f"/api/gst/gstr3b-summary/?store_id={self.store.id}&period={self.current_period}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.data

        table_3_1 = data['table_3_1']
        outward = table_3_1['outward_taxable_supplies']
        self.assertEqual(Decimal(str(outward['taxable_value'])), Decimal("3500.00"))
        self.assertEqual(Decimal(str(outward['cgst'])), Decimal("282.50"))
        self.assertEqual(Decimal(str(outward['sgst'])), Decimal("282.50"))
        self.assertEqual(Decimal(str(outward['igst'])), Decimal("0.00"))

    def test_export_gstn_json(self):
        """Test GET /api/gst/export-gstn-json/ structure conforming to offline tool."""
        url = f"/api/gst/export-gstn-json/?store_id={self.store.id}&period={self.current_period}"
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payload = response.data

        self.assertEqual(payload['gstin'], "29AABCS1429B1Z1")
        self.assertIn('b2b', payload)
        self.assertIn('b2cs', payload)
        self.assertIn('hsn', payload)
        self.assertIn('doc_issue', payload)

        # Verify B2B in GSTN schema
        self.assertEqual(len(payload['b2b']), 1)
        ctin_entry = payload['b2b'][0]
        self.assertEqual(ctin_entry['ctin'], "29AABCT8899K1Z5")
        self.assertEqual(ctin_entry['inv'][0]['inum'], "INV-INDI-20261018-0001")

    def test_filing_period_generate_and_mark_filed(self):
        """Test filing period lifecycle: generate snapshot -> lock and mark filed."""
        # 1. Generate filing period
        gen_url = "/api/gst/filing-periods/generate/"
        gen_payload = {
            "store_id": str(self.store.id),
            "period_key": self.current_period,
            "return_type": "GSTR1"
        }
        gen_res = self.client.post(gen_url, gen_payload, format="json")
        self.assertEqual(gen_res.status_code, status.HTTP_200_OK)
        period_data = gen_res.data

        self.assertEqual(period_data['status'], GSTFilingStatus.GENERATED)
        self.assertEqual(Decimal(str(period_data['taxable_value'])), Decimal("3500.00"))
        self.assertEqual(period_data['invoices_count'], 2)
        self.assertFalse(period_data['is_locked'])

        period_id = period_data['id']

        # 2. Mark filed with ARN
        filed_url = "/api/gst/filing-periods/mark-filed/"
        filed_payload = {
            "store_id": str(self.store.id),
            "period_key": self.current_period,
            "return_type": "GSTR1",
            "arn": "AA291026000123P",
            "notes": "Filed successfully on GST portal"
        }
        filed_res = self.client.post(filed_url, filed_payload, format="json")
        self.assertEqual(filed_res.status_code, status.HTTP_200_OK)
        self.assertEqual(filed_res.data['status'], GSTFilingStatus.FILED)
        self.assertTrue(filed_res.data['is_locked'])
        self.assertEqual(filed_res.data['acknowledged_ref_number'], "AA291026000123P")

        # 3. Toggle lock
        toggle_res = self.client.post(f"/api/gst/filing-periods/{period_id}/toggle-lock/")
        self.assertEqual(toggle_res.status_code, status.HTTP_200_OK)
        self.assertFalse(toggle_res.data['is_locked'])
