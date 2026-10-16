from decimal import Decimal
from django.core.management.base import BaseCommand
from db.models import CatalogueItem, UnitOfMeasure


SEED_ITEMS = [
    {
        "name": "Coca-Cola Original Taste 500ml",
        "sku": "COKE-500ML",
        "barcode": "8901764012297",
        "brand_name": "Coca-Cola",
        "category_name": "Beverages",
        "hsn_code": "220210",
        "tax_slab": Decimal("28.00"),
        "uom": UnitOfMeasure.PCS,
        "suggested_mrp": Decimal("40.00"),
        "description": "500ml PET bottle chilled carbonated soft drink",
    },
    {
        "name": "Lay's Classic Salted Potato Chips 50g",
        "sku": "LAYS-SALTED-50G",
        "barcode": "8901491101853",
        "brand_name": "Lay's",
        "category_name": "Snacks & Munchies",
        "hsn_code": "190590",
        "tax_slab": Decimal("12.00"),
        "uom": UnitOfMeasure.PACKET,
        "suggested_mrp": Decimal("20.00"),
        "description": "Crispy salted potato chips 50g pack",
    },
    {
        "name": "Cadbury Dairy Milk Chocolate 50g",
        "sku": "CADBURY-DM-50G",
        "barcode": "8901233024888",
        "brand_name": "Cadbury",
        "category_name": "Chocolates & Sweets",
        "hsn_code": "180690",
        "tax_slab": Decimal("18.00"),
        "uom": UnitOfMeasure.PCS,
        "suggested_mrp": Decimal("45.00"),
        "description": "Smooth and creamy milk chocolate bar 50g",
    },
    {
        "name": "Amul Butter Pasteurised 100g",
        "sku": "AMUL-BUTTER-100G",
        "barcode": "8901262010099",
        "brand_name": "Amul",
        "category_name": "Dairy & Breakfast",
        "hsn_code": "040510",
        "tax_slab": Decimal("12.00"),
        "uom": UnitOfMeasure.PACKET,
        "suggested_mrp": Decimal("60.00"),
        "description": "Pasteurised table butter 100g pack",
    },
    {
        "name": "Maggi 2-Minute Instant Noodles Masala 70g",
        "sku": "MAGGI-MASALA-70G",
        "barcode": "8901058852893",
        "brand_name": "Maggi",
        "category_name": "Instant Food",
        "hsn_code": "190230",
        "tax_slab": Decimal("18.00"),
        "uom": UnitOfMeasure.PACKET,
        "suggested_mrp": Decimal("14.00"),
        "description": "Classic 2-minute masala instant noodles single pack 70g",
    },
    {
        "name": "Tata Salt Vacuum Evaporated Iodised Salt 1kg",
        "sku": "TATA-SALT-1KG",
        "barcode": "8904043901005",
        "brand_name": "Tata",
        "category_name": "Staples & Spices",
        "hsn_code": "250100",
        "tax_slab": Decimal("0.00"),
        "uom": UnitOfMeasure.KG,
        "suggested_mrp": Decimal("28.00"),
        "description": "Vacuum evaporated iodised edible salt 1kg packet",
    },
    {
        "name": "Dettol Antiseptic Liquid 250ml",
        "sku": "DETTOL-LIQUID-250ML",
        "barcode": "8901396113203",
        "brand_name": "Dettol",
        "category_name": "Personal Care & Hygiene",
        "hsn_code": "300490",
        "tax_slab": Decimal("18.00"),
        "uom": UnitOfMeasure.PCS,
        "suggested_mrp": Decimal("165.00"),
        "description": "Antiseptic disinfectant liquid for first aid and personal hygiene 250ml",
    },
    {
        "name": "Parle-G Original Gluco Biscuits 80g",
        "sku": "PARLE-G-80G",
        "barcode": "8901719101038",
        "brand_name": "Parle",
        "category_name": "Biscuits & Cookies",
        "hsn_code": "190531",
        "tax_slab": Decimal("18.00"),
        "uom": UnitOfMeasure.PACKET,
        "suggested_mrp": Decimal("10.00"),
        "description": "Iconic glucose biscuits 80g packet",
    },
    {
        "name": "Colgate Strong Teeth Dental Cream 100g",
        "sku": "COLGATE-STRONG-100G",
        "barcode": "8901314010522",
        "brand_name": "Colgate",
        "category_name": "Oral Care",
        "hsn_code": "330610",
        "tax_slab": Decimal("18.00"),
        "uom": UnitOfMeasure.PCS,
        "suggested_mrp": Decimal("75.00"),
        "description": "Calcium boost formula toothpaste 100g tube",
    },
    {
        "name": "Brooke Bond Red Label Tea 250g",
        "sku": "RED-LABEL-TEA-250G",
        "barcode": "8901030018446",
        "brand_name": "Red Label",
        "category_name": "Beverages & Tea",
        "hsn_code": "090240",
        "tax_slab": Decimal("5.00"),
        "uom": UnitOfMeasure.PACKET,
        "suggested_mrp": Decimal("140.00"),
        "description": "Natural care blend black tea 250g box",
    },
    {
        "name": "Fortune Sunlite Refined Sunflower Oil 1L",
        "sku": "FORTUNE-SUN-1L",
        "barcode": "8906007280145",
        "brand_name": "Fortune",
        "category_name": "Edible Oils",
        "hsn_code": "151219",
        "tax_slab": Decimal("5.00"),
        "uom": UnitOfMeasure.LITRE,
        "suggested_mrp": Decimal("165.00"),
        "description": "Refined sunflower cooking oil 1 litre pouch",
    },
    {
        "name": "Aashirvaad Shudh Chakki Whole Wheat Atta 5kg",
        "sku": "AASHIRVAAD-ATTA-5KG",
        "barcode": "8901030383704",
        "brand_name": "Aashirvaad",
        "category_name": "Atta & Flours",
        "hsn_code": "110100",
        "tax_slab": Decimal("0.00"),
        "uom": UnitOfMeasure.KG,
        "suggested_mrp": Decimal("245.00"),
        "description": "100% whole wheat chakki atta 5kg bag",
    },
    {
        "name": "Haldiram's Nagpur Bhujia Sev 200g",
        "sku": "HALDIRAMS-BHUJIA-200G",
        "barcode": "8904004400110",
        "brand_name": "Haldiram's",
        "category_name": "Snacks & Namkeen",
        "hsn_code": "190590",
        "tax_slab": Decimal("12.00"),
        "uom": UnitOfMeasure.PACKET,
        "suggested_mrp": Decimal("65.00"),
        "description": "Authentic spicy moth bean flour bhujia sev 200g",
    },
    {
        "name": "Nescafe Classic Instant Coffee 50g",
        "sku": "NESCAFE-CLASSIC-50G",
        "barcode": "8901058857447",
        "brand_name": "Nescafe",
        "category_name": "Coffee & Beverages",
        "hsn_code": "210111",
        "tax_slab": Decimal("18.00"),
        "uom": UnitOfMeasure.PCS,
        "suggested_mrp": Decimal("195.00"),
        "description": "100% pure instant coffee glass jar 50g",
    },
    {
        "name": "Dove Cream Beauty Bathing Bar 100g",
        "sku": "DOVE-BEAUTY-100G",
        "barcode": "8901030704981",
        "brand_name": "Dove",
        "category_name": "Soaps & Bath",
        "hsn_code": "340111",
        "tax_slab": Decimal("18.00"),
        "uom": UnitOfMeasure.PCS,
        "suggested_mrp": Decimal("82.00"),
        "description": "1/4 moisturising cream gentle bathing bar 100g",
    },
]


class Command(BaseCommand):
    help = "Seeds common retail/FMCG products into the Global Product Register (CatalogueItem)."

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Seeding Global Product Register (CatalogueItem)..."))
        created_count = 0
        updated_count = 0

        for item_data in SEED_ITEMS:
            barcode = item_data["barcode"]
            sku = item_data["sku"]
            obj, created = CatalogueItem.objects.update_or_create(
                barcode=barcode,
                defaults={
                    "name": item_data["name"],
                    "sku": sku,
                    "brand_name": item_data["brand_name"],
                    "category_name": item_data["category_name"],
                    "hsn_code": item_data["hsn_code"],
                    "tax_slab": item_data["tax_slab"],
                    "uom": item_data["uom"],
                    "suggested_mrp": item_data["suggested_mrp"],
                    "description": item_data["description"],
                    "is_active": True,
                    "is_deleted": False,
                },
            )
            if created:
                created_count += 1
            else:
                updated_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f"Successfully seeded Global Product Register: {created_count} created, {updated_count} updated."
            )
        )
