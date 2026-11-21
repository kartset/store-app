import random
import re
import uuid
from datetime import date, datetime, time, timedelta
from decimal import Decimal, ROUND_HALF_UP

from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone

from db.models import (
    Brand,
    CashRegisterSession,
    CashTransaction,
    CashTransactionType,
    Category,
    CreditNote,
    CreditNoteItem,
    CreditNoteStatus,
    Customer,
    Delivery,
    DeliveryStatus,
    DeliveryType,
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
    Organization,
    OrganizationStaff,
    Payment,
    PaymentMethod,
    PaymentTerms,
    Product,
    RefundMethod,
    RegisterSessionStatus,
    ReturnReason,
    StockMovement,
    StockMovementType,
    Store,
    StoreCustomer,
    StoreStaff,
    Subcategory,
    UnitOfMeasure,
    User,
    Vendor,
)


TARGET_ORG_ID = "4fc1a46a-e0e2-4f3b-9215-4b9aa3925283"
TARGET_STORE_ID = "693c5ff3-607e-424c-a305-b7327d858ddb"


DEMO_CATEGORIES = [
    {
        "name": "Beverages",
        "slug": "beverages",
        "tax_slab": Decimal("28.00"),
        "hsn": "220210",
        "subcategories": ["Cold Drinks & Soda", "Juices & Energy Drinks", "Tea & Coffee"],
    },
    {
        "name": "Snacks & Munchies",
        "slug": "snacks-munchies",
        "tax_slab": Decimal("12.00"),
        "hsn": "190590",
        "subcategories": ["Chips & Crisps", "Biscuits & Cookies", "Roasted Nuts & Seeds"],
    },
    {
        "name": "Dairy & Breakfast",
        "slug": "dairy-breakfast",
        "tax_slab": Decimal("12.00"),
        "hsn": "040510",
        "subcategories": ["Butter & Cheese", "Milk & Yogurt", "Breakfast Cereals"],
    },
    {
        "name": "Chocolates & Sweets",
        "slug": "chocolates-sweets",
        "tax_slab": Decimal("18.00"),
        "hsn": "180690",
        "subcategories": ["Milk Chocolates", "Dark Chocolates", "Traditional Indian Sweets"],
    },
    {
        "name": "Instant Food",
        "slug": "instant-food",
        "tax_slab": Decimal("18.00"),
        "hsn": "190230",
        "subcategories": ["Instant Noodles", "Pasta & Sauces", "Ready to Eat Meals"],
    },
    {
        "name": "Staples & Grains",
        "slug": "staples-grains",
        "tax_slab": Decimal("5.00"),
        "hsn": "100630",
        "subcategories": ["Basmati Rice", "Whole Wheat Flour", "Pulses & Dal"],
    },
]

DEMO_BRANDS = [
    "Coca-Cola",
    "Lay's",
    "Cadbury",
    "Amul",
    "Maggi",
    "Tata Sampann",
    "Nestle",
    "Britannia",
    "Haldiram's",
    "Epigamia",
]

DEMO_VENDORS = [
    {
        "name": "Metro Cash & Carry India Pvt Ltd",
        "trade_name": "Metro Wholesale Bengaluru",
        "code": "VEND-METRO-001",
        "gstin": "29AABCM1234F1Z5",
        "pan": "AABCM1234F",
        "terms": PaymentTerms.NET_30,
    },
    {
        "name": "Hindustan Unilever Distribution Depot",
        "trade_name": "HUL Karnataka Hub",
        "code": "VEND-HUL-002",
        "gstin": "29AAACH1955H1Z3",
        "pan": "AAACH1955H",
        "terms": PaymentTerms.NET_15,
    },
    {
        "name": "Amul State Dairy Co-Operative Logistics",
        "trade_name": "GCMMF Amul Branch",
        "code": "VEND-AMUL-003",
        "gstin": "29AABCG0123L1ZK",
        "pan": "AABCG0123L",
        "terms": PaymentTerms.NET_7,
    },
    {
        "name": "ITC National Distribution Network",
        "trade_name": "ITC Foods Supply",
        "code": "VEND-ITC-004",
        "gstin": "29AAACI0123E1ZP",
        "pan": "AAACI0123E",
        "terms": PaymentTerms.NET_30,
    },
]

DEMO_PRODUCTS = [
    # Beverages (28% GST)
    {"name": "Coca-Cola Original 500ml", "sku": "COKE-500ML", "barcode": "8901764012297", "brand": "Coca-Cola", "cat": "Beverages", "subcat": "Cold Drinks & Soda", "cost": Decimal("28.00"), "mrp": Decimal("40.00"), "tax": Decimal("28.00"), "hsn": "220210"},
    {"name": "Sprite Refreshing Lime 750ml", "sku": "SPRITE-750ML", "barcode": "8901764022296", "brand": "Coca-Cola", "cat": "Beverages", "subcat": "Cold Drinks & Soda", "cost": Decimal("32.00"), "mrp": Decimal("45.00"), "tax": Decimal("28.00"), "hsn": "220210"},
    {"name": "Tropicana 100% Orange Juice 1L", "sku": "TROP-ORANGE-1L", "barcode": "8902080104112", "brand": "Nestle", "cat": "Beverages", "subcat": "Juices & Energy Drinks", "cost": Decimal("90.00"), "mrp": Decimal("130.00"), "tax": Decimal("12.00"), "hsn": "200912"},
    {"name": "Nescafe Classic Instant Coffee 100g", "sku": "NES-COFFEE-100G", "barcode": "8901058852329", "brand": "Nestle", "cat": "Beverages", "subcat": "Tea & Coffee", "cost": Decimal("210.00"), "mrp": Decimal("295.00"), "tax": Decimal("18.00"), "hsn": "210111"},

    # Snacks & Munchies (12% GST)
    {"name": "Lay's Classic Salted Potato Chips 50g", "sku": "LAYS-SALTED-50G", "barcode": "8901491101853", "brand": "Lay's", "cat": "Snacks & Munchies", "subcat": "Chips & Crisps", "cost": Decimal("14.00"), "mrp": Decimal("20.00"), "tax": Decimal("12.00"), "hsn": "190590"},
    {"name": "Lay's Magic Masala Chips 50g", "sku": "LAYS-MASALA-50G", "barcode": "8901491101860", "brand": "Lay's", "cat": "Snacks & Munchies", "subcat": "Chips & Crisps", "cost": Decimal("14.00"), "mrp": Decimal("20.00"), "tax": Decimal("12.00"), "hsn": "190590"},
    {"name": "Britannia Good Day Butter Cookies 200g", "sku": "BRIT-GOODDAY-200G", "barcode": "8901063102112", "brand": "Britannia", "cat": "Snacks & Munchies", "subcat": "Biscuits & Cookies", "cost": Decimal("35.00"), "mrp": Decimal("50.00"), "tax": Decimal("18.00"), "hsn": "190531"},
    {"name": "Haldiram's Salted Roasted Cashews 100g", "sku": "HALD-CASHEW-100G", "barcode": "8904063200118", "brand": "Haldiram's", "cat": "Snacks & Munchies", "subcat": "Roasted Nuts & Seeds", "cost": Decimal("150.00"), "mrp": Decimal("220.00"), "tax": Decimal("12.00"), "hsn": "200819"},

    # Dairy & Breakfast (12% GST)
    {"name": "Amul Pasteurised Butter 100g", "sku": "AMUL-BUTTER-100G", "barcode": "8901262010099", "brand": "Amul", "cat": "Dairy & Breakfast", "subcat": "Butter & Cheese", "cost": Decimal("44.00"), "mrp": Decimal("60.00"), "tax": Decimal("12.00"), "hsn": "040510"},
    {"name": "Amul Processed Cheese Blocks 200g", "sku": "AMUL-CHEESE-200G", "barcode": "8901262020081", "brand": "Amul", "cat": "Dairy & Breakfast", "subcat": "Butter & Cheese", "cost": Decimal("105.00"), "mrp": Decimal("140.00"), "tax": Decimal("12.00"), "hsn": "040610"},
    {"name": "Epigamia Greek Yogurt Natural 85g", "sku": "EPIG-YOGURT-85G", "barcode": "8906076130018", "brand": "Epigamia", "cat": "Dairy & Breakfast", "subcat": "Milk & Yogurt", "cost": Decimal("28.00"), "mrp": Decimal("40.00"), "tax": Decimal("5.00"), "hsn": "040310"},

    # Chocolates & Sweets (18% GST)
    {"name": "Cadbury Dairy Milk Silk Chocolate 150g", "sku": "CAD-SILK-150G", "barcode": "8901233024994", "brand": "Cadbury", "cat": "Chocolates & Sweets", "subcat": "Milk Chocolates", "cost": Decimal("125.00"), "mrp": Decimal("175.00"), "tax": Decimal("18.00"), "hsn": "180690"},
    {"name": "Cadbury Bournville 50% Dark Chocolate 80g", "sku": "CAD-DARK-80G", "barcode": "8901233025113", "brand": "Cadbury", "cat": "Chocolates & Sweets", "subcat": "Dark Chocolates", "cost": Decimal("75.00"), "mrp": Decimal("110.00"), "tax": Decimal("18.00"), "hsn": "180690"},
    {"name": "Haldiram's Kaju Katli Gift Pack 250g", "sku": "HALD-KAJU-250G", "barcode": "8904063200224", "brand": "Haldiram's", "cat": "Chocolates & Sweets", "subcat": "Traditional Indian Sweets", "cost": Decimal("220.00"), "mrp": Decimal("320.00"), "tax": Decimal("5.00"), "hsn": "210690"},

    # Instant Food (18% GST)
    {"name": "Maggi 2-Minute Masala Noodles 4-Pack", "sku": "MAGGI-4PACK-280G", "barcode": "8901058852893", "brand": "Maggi", "cat": "Instant Food", "subcat": "Instant Noodles", "cost": Decimal("44.00"), "mrp": Decimal("60.00"), "tax": Decimal("18.00"), "hsn": "190230"},
    {"name": "Tata Sampann Ready to Eat Dal Makhani 300g", "sku": "TATA-RTE-DAL-300G", "barcode": "8904043901112", "brand": "Tata Sampann", "cat": "Instant Food", "subcat": "Ready to Eat Meals", "cost": Decimal("85.00"), "mrp": Decimal("125.00"), "tax": Decimal("12.00"), "hsn": "210690"},

    # Staples (5% GST)
    {"name": "Tata Sampann Royal Basmati Rice 1kg", "sku": "TATA-RICE-1KG", "barcode": "8904043902228", "brand": "Tata Sampann", "cat": "Staples & Grains", "subcat": "Basmati Rice", "cost": Decimal("110.00"), "mrp": Decimal("160.00"), "tax": Decimal("5.00"), "hsn": "100630"},
    {"name": "Tata Sampann Unpolished Toor Dal 1kg", "sku": "TATA-TOOR-1KG", "barcode": "8904043903334", "brand": "Tata Sampann", "cat": "Staples & Grains", "subcat": "Pulses & Dal", "cost": Decimal("130.00"), "mrp": Decimal("180.00"), "tax": Decimal("5.00"), "hsn": "071360"},
]

DEMO_CUSTOMERS = [
    {"name": "Aarav Sharma", "phone": "9876543210", "email": "aarav.sharma@example.com", "loyalty": 240},
    {"name": "Priya Venkatesh", "phone": "9845012345", "email": "priya.v@example.com", "loyalty": 380},
    {"name": "Rohan Mehta", "phone": "9900112233", "email": "rohan.m@example.com", "loyalty": 110},
    {"name": "Ananya Deshmukh", "phone": "9811223344", "email": "ananya.d@example.com", "loyalty": 520},
    {"name": "Karthik Setia", "phone": "9888776655", "email": "kartik@storecraft.in", "loyalty": 450},
    {"name": "Siddharth Roy", "phone": "9741002233", "email": "siddharth.roy@example.com", "loyalty": 90},
    {"name": "Deepika Nair", "phone": "9988776611", "email": "deepika.nair@example.com", "loyalty": 310},
    {"name": "B2B Canteen Supplies", "phone": "9820099887", "email": "canteen@techpark.com", "gstin": "29AABCC4321K1Z8", "loyalty": 850},
    {"name": "Walk-in Retail Customer", "phone": "9999999999", "email": "", "loyalty": 0},
]


class Command(BaseCommand):
    help = "Seeds comprehensive 100-day realistic demo retail data for the specified organization and store."

    def add_arguments(self, parser):
        parser.add_argument(
            "--org-id",
            type=str,
            default=TARGET_ORG_ID,
            help=f"Target Organization UUID (default: {TARGET_ORG_ID})",
        )
        parser.add_argument(
            "--store-id",
            type=str,
            default=TARGET_STORE_ID,
            help=f"Target Store UUID (default: {TARGET_STORE_ID})",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=100,
            help="Number of historical days of daily retail shifts, invoices, and stock movements to simulate (default: 100)",
        )
        parser.add_argument(
            "--invoices-per-day",
            type=int,
            default=3,
            help="Average invoices generated per day (default: 3)",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        org_id_str = options["org_id"]
        store_id_str = options["store_id"]
        days = options["days"]
        invoices_per_day = options["invoices_per_day"]

        self.stdout.write(self.style.NOTICE(f"🚀 Starting 100-Day Demo Store Seeding..."))
        self.stdout.write(f"  Organization: {org_id_str}")
        self.stdout.write(f"  Store:        {store_id_str}")
        self.stdout.write(f"  Simulation:   {days} days ({days * invoices_per_day} approx invoices)\n")

        # 1. Organization & Store
        try:
            org = Organization.objects.get(id=uuid.UUID(org_id_str))
            self.stdout.write(f"  ✓ Found existing Organization: {org.name}")
        except Organization.DoesNotExist:
            org = Organization.objects.create(
                id=uuid.UUID(org_id_str),
                name="StoreCraft Retail Corp",
                subdomain="storecraft",
                is_active=True,
            )
            self.stdout.write(self.style.SUCCESS(f"  ✓ Created Organization: {org.name} ({org.id})"))

        try:
            store = Store.objects.get(id=uuid.UUID(store_id_str))
            self.stdout.write(f"  ✓ Found existing Store: {store.name}")
        except Store.DoesNotExist:
            store = Store.objects.create(
                id=uuid.UUID(store_id_str),
                organization_id=org,
                name="Indiranagar Superstore",
                address="100 Feet Rd, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka 560038",
                gst_number="29ABCDE1234F1Z5",
                is_active=True,
            )
            self.stdout.write(self.style.SUCCESS(f"  ✓ Created Store: {store.name} ({store.id})"))

        # 2. Staff & User
        admin_user = User.objects.filter(email="admin@storecraft.in").first()
        if not admin_user:
            admin_user = User.objects.first()
        if not admin_user:
            admin_user = User.objects.create_user(
                email="admin@storecraft.in",
                password="Password123!",
                first_name="Store",
                last_name="Manager",
            )

        OrganizationStaff.objects.get_or_create(
            user_id=admin_user,
            organization_id=org,
            defaults={"role": "ORG_ADMIN", "is_active": True},
        )
        StoreStaff.objects.get_or_create(
            user_id=admin_user,
            store_id=store,
            defaults={"role": "ADMIN", "is_active": True},
        )

        # 3. Categories & Subcategories
        self.stdout.write("  📦 Setting up Categories & Subcategories...")
        cat_map = {}
        subcat_map = {}
        for c_data in DEMO_CATEGORIES:
            cat, _ = Category.objects.get_or_create(
                slug=c_data["slug"],
                defaults={
                    "name": c_data["name"],
                    "default_tax_slab": c_data["tax_slab"],
                    "default_hsn_code": c_data["hsn"],
                    "is_active": True,
                },
            )
            cat_map[c_data["name"]] = cat

            for sub_name in c_data["subcategories"]:
                sub_slug = re.sub(r"[^a-z0-9]+", "-", sub_name.lower()).strip("-")
                subcat, _ = Subcategory.objects.get_or_create(
                    organization_id=org,
                    category_id=cat,
                    name=sub_name,
                    defaults={"slug": sub_slug, "is_active": True},
                )
                subcat_map[f"{c_data['name']}::{sub_name}"] = subcat

        # 4. Brands
        self.stdout.write("  🏷️  Setting up Brands...")
        brand_map = {}
        for b_name in DEMO_BRANDS:
            b_slug = re.sub(r"[^a-z0-9]+", "-", b_name.lower()).strip("-")
            brand, _ = Brand.objects.get_or_create(
                organization_id=org,
                name=b_name,
                defaults={"slug": b_slug, "is_active": True},
            )
            brand_map[b_name] = brand

        # 5. Vendors
        self.stdout.write("  🏭 Setting up Vendors & Suppliers...")
        vendor_objs = []
        for v_data in DEMO_VENDORS:
            vendor, _ = Vendor.objects.get_or_create(
                organization_id=org,
                name=v_data["name"],
                defaults={
                    "trade_name": v_data["trade_name"],
                    "vendor_code": v_data["code"],
                    "gstin": v_data["gstin"],
                    "pan_number": v_data["pan"],
                    "payment_terms": v_data["terms"],
                    "is_active": True,
                },
            )
            vendor_objs.append(vendor)

        # 6. Products & Inventory
        self.stdout.write("  🛒 Setting up Products & Store Inventory...")
        created_products = []
        inventory_objs = []
        for p_data in DEMO_PRODUCTS:
            category = cat_map[p_data["cat"]]
            subcategory = subcat_map[f"{p_data['cat']}::{p_data['subcat']}"]
            brand = brand_map[p_data["brand"]]
            vendor = random.choice(vendor_objs)

            product, _ = Product.objects.get_or_create(
                organization_id=org,
                sku=p_data["sku"],
                defaults={
                    "name": p_data["name"],
                    "barcode": p_data["barcode"],
                    "internal_barcode": f"INT-{p_data['sku']}",
                    "brand_id": brand,
                    "category_id": category,
                    "subcategory_id": subcategory,
                    "cost_price": p_data["cost"],
                    "base_mrp": p_data["mrp"],
                    "tax_slab": p_data["tax"],
                    "hsn_code": p_data["hsn"],
                    "uom": UnitOfMeasure.PCS,
                    "is_active": True,
                },
            )
            created_products.append(product)

            # Assign stock
            initial_stock = random.randint(45, 120)
            if p_data["sku"] == "AMUL-BUTTER-100G":
                # Low stock alert demo item
                initial_stock = 4
            elif p_data["sku"] == "HALD-CASHEW-100G":
                # Out of stock demo item
                initial_stock = 0

            inventory, _ = Inventory.objects.get_or_create(
                store_id=store,
                product_id=product,
                defaults={
                    "vendor_id": vendor,
                    "stock_quantity": initial_stock,
                    "store_price": p_data["mrp"],
                    "low_stock_threshold": 10,
                    "reorder_quantity": 25,
                },
            )
            inventory_objs.append(inventory)

            # Record Inbound Stock Receipt
            if initial_stock > 0 and not StockMovement.objects.filter(inventory_id=inventory, movement_type=StockMovementType.PURCHASE_RECEIPT).exists():
                StockMovement.objects.create(
                    store_id=store,
                    inventory_id=inventory,
                    product_id=product,
                    vendor_id=vendor,
                    movement_type=StockMovementType.PURCHASE_RECEIPT,
                    quantity_delta=initial_stock,
                    quantity_before=0,
                    quantity_after=initial_stock,
                    reason=f"Procurement Inflow from {vendor.trade_name or vendor.name}",
                    reference_id=f"PO-{vendor.vendor_code}-2026",
                )

        # 7. Customers
        self.stdout.write("  👥 Setting up Retail & B2B Customers...")
        customer_objs = []
        for c_data in DEMO_CUSTOMERS:
            cust, _ = Customer.objects.get_or_create(
                mobile_number=c_data["phone"],
                defaults={
                    "name": c_data["name"],
                    "email": c_data["email"],
                    "gstin": c_data.get("gstin", ""),
                    "is_active": True,
                },
            )
            StoreCustomer.objects.get_or_create(
                store_id=store,
                customer_id=cust,
                defaults={"loyalty_points": c_data["loyalty"]},
            )
            customer_objs.append(cust)

        # 8. 100-Day Historical Sales Simulation
        self.stdout.write(f"  📈 Simulating daily shifts, sales, orders and payments across past {days} days...")
        today = timezone.now().date()
        base_date = today - timedelta(days=days - 1)

        total_invoices_created = 0
        total_revenue_generated = Decimal("0.00")
        total_deliveries_created = 0

        for d in range(days):
            current_date = base_date + timedelta(days=d)
            date_str = current_date.strftime("%Y%m%d")

            # Daily Cash Register Shift
            shift_open_dt = timezone.make_aware(datetime.combine(current_date, time(hour=9, minute=30)))
            shift_close_dt = timezone.make_aware(datetime.combine(current_date, time(hour=21, minute=30)))

            session_num = f"SHIFT-IND-{date_str}-001"
            reg_session = CashRegisterSession.objects.filter(session_number=session_num).first()
            if not reg_session:
                reg_session = CashRegisterSession.objects.create(
                    store_id=store,
                    cashier_id=admin_user,
                    session_number=session_num,
                    status=RegisterSessionStatus.CLOSED if d < (days - 1) else RegisterSessionStatus.OPEN,
                    opened_at=shift_open_dt,
                    closed_at=shift_close_dt if d < (days - 1) else None,
                    opening_float=Decimal("2000.00"),
                    expected_cash=Decimal("2000.00"),
                    closing_cash_counted=Decimal("2000.00"),
                    total_sales=Decimal("0.00"),
                    total_cash_sales=Decimal("0.00"),
                    total_upi_sales=Decimal("0.00"),
                    total_card_sales=Decimal("0.00"),
                    invoices_count=0,
                )
                CashRegisterSession.objects.filter(id=reg_session.id).update(
                    created_at=shift_open_dt, updated_at=shift_close_dt
                )

                # Opening float transaction
                CashTransaction.objects.create(
                    session_id=reg_session,
                    type=CashTransactionType.OPENING_FLOAT,
                    amount=Decimal("2000.00"),
                    reason="Shift Opening Drawer Cash Float",
                    created_by=admin_user,
                )

            # Invoices per day (2 to 4 transactions)
            num_invoices = random.randint(2, max(2, invoices_per_day + 1))
            daily_cash_inflow = Decimal("0.00")
            daily_upi_inflow = Decimal("0.00")
            daily_card_inflow = Decimal("0.00")
            daily_gross_sales = Decimal("0.00")

            for inv_idx in range(1, num_invoices + 1):
                inv_seq_str = f"{inv_idx:04d}"
                inv_number = f"INV-IND-{date_str}-{inv_seq_str}"
                if Invoice.objects.filter(invoice_number=inv_number).exists():
                    continue

                # Transaction time between 10:00 and 21:00
                txn_hour = random.randint(10, 20)
                txn_minute = random.randint(0, 59)
                inv_timestamp = timezone.make_aware(datetime.combine(current_date, time(hour=txn_hour, minute=txn_minute)))

                customer = random.choice(customer_objs)
                is_b2b = bool(customer.gstin)

                # Pick 1 to 4 items for this shopping basket
                basket_size = random.randint(1, 4)
                chosen_products = random.sample(created_products, basket_size)

                subtotal = Decimal("0.00")
                total_cgst = Decimal("0.00")
                total_sgst = Decimal("0.00")
                total_igst = Decimal("0.00")
                total_gst = Decimal("0.00")
                total_discount = Decimal("0.00")

                items_data = []
                for prod in chosen_products:
                    qty = random.randint(1, 3)
                    unit_price = prod.base_mrp
                    disc = Decimal("0.00")
                    if random.random() < 0.25:
                        disc = (Decimal(random.randint(5, 20)) * qty).quantize(Decimal("0.01"))

                    line_gross = (unit_price * qty) - disc
                    tax_rate = prod.tax_slab or Decimal("12.00")

                    # Tax inclusive breakdown
                    tax_factor = tax_rate / Decimal("100.00")
                    taxable = (line_gross / (Decimal("1.00") + tax_factor)).quantize(Decimal("0.01"))
                    gst_amount = (line_gross - taxable).quantize(Decimal("0.01"))

                    cgst = (gst_amount / Decimal("2.00")).quantize(Decimal("0.01"))
                    sgst = (gst_amount - cgst).quantize(Decimal("0.01"))
                    igst = Decimal("0.00")

                    subtotal += taxable
                    total_cgst += cgst
                    total_sgst += sgst
                    total_gst += gst_amount
                    total_discount += disc

                    items_data.append({
                        "product": prod,
                        "qty": qty,
                        "unit_price": unit_price,
                        "discount": disc,
                        "tax_rate": tax_rate,
                        "taxable": taxable,
                        "gst_amount": gst_amount,
                        "cgst": cgst,
                        "sgst": sgst,
                        "igst": igst,
                        "line_total": line_gross,
                    })

                raw_grand_total = subtotal + total_gst
                rounded_grand_total = raw_grand_total.quantize(Decimal("1"), rounding=ROUND_HALF_UP)
                round_off = (rounded_grand_total - raw_grand_total).quantize(Decimal("0.01"))

                invoice = Invoice.objects.create(
                    store_id=store,
                    customer_id=customer if customer.mobile_number != "9999999999" else None,
                    register_session_id=reg_session,
                    type=InvoiceType.POS if inv_idx < num_invoices else InvoiceType.ONLINE,
                    status=InvoiceStatus.PAID,
                    invoice_number=inv_number,
                    subtotal=subtotal.quantize(Decimal("0.01")),
                    total_discount=total_discount.quantize(Decimal("0.01")),
                    cgst_amount=total_cgst.quantize(Decimal("0.01")),
                    sgst_amount=total_sgst.quantize(Decimal("0.01")),
                    igst_amount=total_igst.quantize(Decimal("0.01")),
                    total_gst=total_gst.quantize(Decimal("0.01")),
                    round_off=round_off,
                    grand_total=rounded_grand_total,
                    is_tax_inclusive=True,
                    customer_name_snapshot=customer.name,
                    customer_phone_snapshot=customer.mobile_number,
                    customer_gstin_snapshot=customer.gstin or "",
                    notes="Thank you for shopping at StoreCraft Indiranagar!",
                )

                # Stamp historical created_at and updated_at
                Invoice.objects.filter(id=invoice.id).update(
                    created_at=inv_timestamp, updated_at=inv_timestamp
                )

                # Line Items and Stock Out
                for it in items_data:
                    p = it["product"]
                    inv_item = InvoiceItem.objects.create(
                        invoice_id=invoice,
                        product_id=p,
                        product_name_snapshot=p.name,
                        sku_snapshot=p.sku,
                        barcode_snapshot=p.barcode or "",
                        hsn_code=p.hsn_code or "190590",
                        quantity=it["qty"],
                        unit_price=it["unit_price"],
                        discount=it["discount"],
                        tax_slab=it["tax_rate"],
                        taxable_amount=it["taxable"],
                        gst_amount=it["gst_amount"],
                        cgst_amount=it["cgst"],
                        sgst_amount=it["sgst"],
                        igst_amount=it["igst"],
                        line_total=it["line_total"],
                    )
                    InvoiceItem.objects.filter(id=inv_item.id).update(
                        created_at=inv_timestamp, updated_at=inv_timestamp
                    )

                    # Stock Movement Out
                    inv_record = Inventory.objects.filter(store_id=store, product_id=p).first()
                    if inv_record:
                        qty_before = inv_record.stock_quantity
                        inv_record.stock_quantity = max(0, qty_before - it["qty"])
                        inv_record.save(update_fields=["stock_quantity"])

                        sm = StockMovement.objects.create(
                            store_id=store,
                            inventory_id=inv_record,
                            product_id=p,
                            movement_type=StockMovementType.POS_SALE,
                            quantity_delta=-it["qty"],
                            quantity_before=qty_before,
                            quantity_after=inv_record.stock_quantity,
                            reason=f"POS Sale Invoice #{invoice.invoice_number}",
                            reference_id=str(invoice.invoice_number),
                        )
                        StockMovement.objects.filter(id=sm.id).update(
                            created_at=inv_timestamp, updated_at=inv_timestamp
                        )

                # Payment Tender (Cash 45%, UPI 40%, Card 15%)
                pay_rand = random.random()
                if pay_rand < 0.45:
                    pay_method = PaymentMethod.CASH
                    daily_cash_inflow += rounded_grand_total
                elif pay_rand < 0.85:
                    pay_method = PaymentMethod.UPI
                    daily_upi_inflow += rounded_grand_total
                else:
                    pay_method = PaymentMethod.CARD
                    daily_card_inflow += rounded_grand_total

                payment = Payment.objects.create(
                    invoice_id=invoice,
                    method=pay_method,
                    amount=rounded_grand_total,
                    amount_tendered=rounded_grand_total if pay_method == PaymentMethod.CASH else None,
                    change_returned=Decimal("0.00") if pay_method == PaymentMethod.CASH else None,
                    external_transaction_id=f"TXN-{date_str}-{inv_seq_str}",
                    status="SUCCESS",
                )
                Payment.objects.filter(id=payment.id).update(
                    created_at=inv_timestamp, updated_at=inv_timestamp
                )

                if pay_method == PaymentMethod.CASH:
                    cash_txn = CashTransaction.objects.create(
                        session_id=reg_session,
                        type=CashTransactionType.CASH_SALE,
                        amount=rounded_grand_total,
                        invoice_id=invoice,
                        payment_id=payment,
                        reason=f"Cash Sale Invoice #{invoice.invoice_number}",
                        created_by=admin_user,
                    )
                    CashTransaction.objects.filter(id=cash_txn.id).update(
                        created_at=inv_timestamp, updated_at=inv_timestamp
                    )

                # If this was an ONLINE order, create Order and Delivery dispatch
                if invoice.type == InvoiceType.ONLINE:
                    ord_num = f"ORD-IND-{date_str}-{inv_seq_str}"
                    order = Order.objects.create(
                        store_id=store,
                        customer_id=customer,
                        invoice_id=invoice,
                        order_number=ord_num,
                        status=OrderStatus.COMPLETED,
                        fulfillment_type=FulfillmentType.HOME_DELIVERY,
                        payment_status=OrderPaymentStatus.PAID,
                        subtotal=invoice.subtotal,
                        total_tax=invoice.total_gst,
                        grand_total=invoice.grand_total,
                        delivery_address_line1="42, 12th Main Rd, HAL 2nd Stage",
                        delivery_city="Bengaluru",
                        delivery_state="Karnataka",
                        delivery_pincode="560038",
                        customer_name_snapshot=customer.name,
                        customer_phone_snapshot=customer.mobile_number,
                        completed_at=inv_timestamp + timedelta(minutes=45),
                    )
                    Order.objects.filter(id=order.id).update(
                        created_at=inv_timestamp, updated_at=inv_timestamp + timedelta(minutes=45)
                    )

                    deliv = Delivery.objects.create(
                        store_id=store,
                        order_id=order,
                        invoice_id=invoice,
                        tracking_id=f"TRK-IND-{date_str}-{inv_seq_str}",
                        delivery_type=DeliveryType.INTERNAL,
                        status=DeliveryStatus.DELIVERED,
                        driver_name="Ramesh Kumar",
                        driver_phone="9876500112",
                        vehicle_number="KA-01-EA-5544",
                        recipient_name=customer.name,
                        recipient_phone=customer.mobile_number,
                        delivery_address=f"{order.delivery_address_line1}, {order.delivery_city}, {order.delivery_state} - {order.delivery_pincode}",
                        otp_code="4829",
                        dispatched_at=inv_timestamp + timedelta(minutes=15),
                        delivered_at=inv_timestamp + timedelta(minutes=45),
                    )
                    Delivery.objects.filter(id=deliv.id).update(
                        created_at=inv_timestamp, updated_at=inv_timestamp + timedelta(minutes=45)
                    )
                    total_deliveries_created += 1

                daily_gross_sales += rounded_grand_total
                total_invoices_created += 1
                total_revenue_generated += rounded_grand_total

            # Update register session totals
            reg_session.total_cash_sales += daily_cash_inflow
            reg_session.total_upi_sales += daily_upi_inflow
            reg_session.total_card_sales += daily_card_inflow
            reg_session.total_sales += daily_gross_sales
            reg_session.invoices_count += num_invoices
            reg_session.expected_cash = reg_session.opening_float + reg_session.total_cash_sales
            reg_session.closing_cash_counted = reg_session.expected_cash
            reg_session.save(update_fields=[
                "total_cash_sales", "total_upi_sales", "total_card_sales",
                "total_sales", "invoices_count", "expected_cash", "closing_cash_counted"
            ])

        # 9. Customer Returns & Credit Notes on Days -20, -12, and -3
        self.stdout.write("  ↩️  Creating sample customer returns and credit notes...")
        return_days = [20, 12, 3]
        for rd in return_days:
            ret_date = today - timedelta(days=rd)
            date_str = ret_date.strftime("%Y%m%d")
            cn_number = f"CN-IND-{date_str}-0001"
            if CreditNote.objects.filter(credit_note_number=cn_number).exists():
                continue

            inv_to_return = Invoice.objects.filter(
                created_at__date=ret_date, is_deleted=False
            ).first()
            if inv_to_return:
                item_to_return = inv_to_return.items.first()
                if item_to_return:
                    refund_amt = item_to_return.line_total
                    ret_timestamp = timezone.make_aware(datetime.combine(ret_date, time(hour=16, minute=0)))

                    cn = CreditNote.objects.create(
                        store_id=store,
                        invoice_id=inv_to_return,
                        credit_note_number=cn_number,
                        status=CreditNoteStatus.COMPLETED,
                        subtotal=item_to_return.taxable_amount,
                        cgst_amount=item_to_return.cgst_amount,
                        sgst_amount=item_to_return.sgst_amount,
                        igst_amount=item_to_return.igst_amount,
                        total_gst=item_to_return.gst_amount,
                        total_refund_amount=refund_amt,
                        reason=ReturnReason.CUSTOMER_DISSATISFACTION,
                        refund_method=RefundMethod.CASH,
                        notes="Customer return processed smoothly within 7-day exchange window.",
                    )
                    CreditNote.objects.filter(id=cn.id).update(
                        created_at=ret_timestamp, updated_at=ret_timestamp
                    )

                    cn_item = CreditNoteItem.objects.create(
                        credit_note_id=cn,
                        invoice_item_id=item_to_return,
                        product_id=item_to_return.product_id,
                        product_name_snapshot=item_to_return.product_name_snapshot,
                        sku_snapshot=item_to_return.sku_snapshot,
                        hsn_code=item_to_return.hsn_code,
                        quantity=1,
                        unit_price=item_to_return.unit_price,
                        refund_amount=refund_amt,
                        reason=ReturnReason.CUSTOMER_DISSATISFACTION,
                        restock_inventory=True,
                    )
                    CreditNoteItem.objects.filter(id=cn_item.id).update(
                        created_at=ret_timestamp, updated_at=ret_timestamp
                    )

                    # Restock inventory movement
                    inv_record = Inventory.objects.filter(store_id=store, product_id=item_to_return.product_id).first()
                    if inv_record:
                        qty_before = inv_record.stock_quantity
                        inv_record.stock_quantity = qty_before + 1
                        inv_record.save(update_fields=["stock_quantity"])

                        sm = StockMovement.objects.create(
                            store_id=store,
                            inventory_id=inv_record,
                            product_id=item_to_return.product_id,
                            movement_type=StockMovementType.RETURN_RESTOCK,
                            quantity_delta=1,
                            quantity_before=qty_before,
                            quantity_after=inv_record.stock_quantity,
                            reason=f"Customer Return Restock CN #{cn.credit_note_number}",
                            reference_id=str(cn.credit_note_number),
                        )
                        StockMovement.objects.filter(id=sm.id).update(
                            created_at=ret_timestamp, updated_at=ret_timestamp
                        )

        self.stdout.write(self.style.SUCCESS(f"\n🎉 Demo Seeding Completed Successfully!"))
        self.stdout.write(f"  • Organization: {org.name} ({org.id})")
        self.stdout.write(f"  • Store:        {store.name} ({store.id})")
        self.stdout.write(f"  • Products:     {len(created_products)} active SKUs with Inventory")
        self.stdout.write(f"  • Days Seeded:  {days} days of retail operations")
        self.stdout.write(f"  • Invoices:     {total_invoices_created} POS transactions")
        self.stdout.write(f"  • Deliveries:   {total_deliveries_created} dispatched & completed deliveries")
        self.stdout.write(f"  • Total Sales:  ₹{total_revenue_generated:,.2f}")
        self.stdout.write(f"  • Shifts:       {days} daily cash register sessions")
