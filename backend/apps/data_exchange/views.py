import csv
import io
import re
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.http import HttpResponse
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from db.models import (
    Category,
    Customer,
    CustomerType,
    Inventory,
    Invoice,
    Organization,
    Product,
    StockMovementType,
    Store,
    StoreCustomer,
)


def normalize_header(header: str) -> str:
    """Standardizes column headers by lowercasing and stripping whitespace/symbols."""
    return re.sub(r'[^a-z0-9]', '', header.lower().strip())


def parse_decimal(value, default=Decimal('0.00')) -> Decimal:
    if value is None or str(value).strip() == '':
        return default
    clean = re.sub(r'[^\d.-]', '', str(value).strip())
    try:
        return Decimal(clean)
    except (InvalidOperation, ValueError):
        return default


def clean_mobile(value: str) -> str:
    """Strips non-digits, normalizes Indian numbers (strips leading 0 or 91 if >10 digits)."""
    digits = re.sub(r'\D', '', str(value or ''))
    if len(digits) == 12 and digits.startswith('91'):
        digits = digits[2:]
    elif len(digits) == 11 and digits.startswith('0'):
        digits = digits[1:]
    return digits


def find_column_index(header_map: dict, aliases: list) -> int | None:
    """Safely retrieves column index from header_map without treating 0 as falsy."""
    for alias in aliases:
        if alias in header_map:
            return header_map[alias]
    return None



class ProductBulkImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        dry_run = request.query_params.get('dry_run', '').lower() in ['true', '1', 'yes'] or \
            str(request.data.get('dry_run', '')).lower() in ['true', '1', 'yes']
        store_id = request.query_params.get('store_id') or request.data.get('store_id')
        update_existing = request.data.get('update_existing', True)

        csv_file = request.FILES.get('file')
        csv_text = request.data.get('csv_content')

        if not csv_file and not csv_text:
            return Response(
                {'error': 'A CSV file or csv_content string must be uploaded.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            if csv_file:
                raw_bytes = csv_file.read()
                text = raw_bytes.decode('utf-8-sig', errors='replace')
            else:
                text = str(csv_text)
        except (UnicodeDecodeError, ValueError, AttributeError) as e:
            return Response({'error': f'Failed to decode file: {e!s}'}, status=status.HTTP_400_BAD_REQUEST)

        # Organization scoping
        org = getattr(request.user, 'organization_id', None)
        if not org:
            org = Organization.objects.first()

        store = None
        if store_id:
            store = Store.objects.filter(id=store_id, is_active=True).first()

        # Parse CSV
        reader = csv.reader(io.StringIO(text))
        raw_headers = None
        for row in reader:
            if row and any(cell.strip() for cell in row):
                raw_headers = row
                break

        if not raw_headers:
            return Response({'error': 'The uploaded CSV file is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        header_map = {}
        for idx, h in enumerate(raw_headers):
            normalized = normalize_header(h)
            header_map[normalized] = idx

        # Column aliases
        name_idx = find_column_index(header_map, ['name', 'productname', 'title'])
        sku_idx = find_column_index(header_map, ['sku', 'itemcode', 'code'])
        barcode_idx = find_column_index(header_map, ['barcode', 'ean', 'upc'])
        internal_barcode_idx = find_column_index(header_map, ['internalbarcode', 'storebarcode'])
        category_idx = find_column_index(header_map, ['category', 'categoryslug', 'categoryname'])
        cost_price_idx = find_column_index(header_map, ['costprice', 'cost', 'purchaseprice'])
        price_idx = find_column_index(header_map, ['basemrp', 'mrp', 'price', 'retailprice'])
        hsn_idx = find_column_index(header_map, ['hsncode', 'hsn'])
        tax_idx = find_column_index(header_map, ['taxslab', 'tax', 'gst', 'taxrate'])
        uom_idx = find_column_index(header_map, ['uom', 'unit'])
        stock_idx = find_column_index(header_map, ['initialstock', 'stock', 'quantity', 'qty'])
        batch_idx = find_column_index(header_map, ['batchnumber', 'batch'])

        if name_idx is None or sku_idx is None:
            return Response(
                {
                    'error': 'Missing required headers. CSV must at minimum include "name" and "sku" columns.',
                    'detected_headers': raw_headers,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        parsed_rows = []
        errors = []
        seen_skus = set()

        for row_num, row in enumerate(reader, start=2):
            if not row or not any(field.strip() for field in row):
                continue

            name = row[name_idx].strip() if name_idx < len(row) else ''
            sku = row[sku_idx].strip() if sku_idx < len(row) else ''

            if not name:
                errors.append({'row': row_num, 'sku': sku, 'error': 'Product name cannot be empty.'})
                continue
            if not sku:
                errors.append({'row': row_num, 'sku': '', 'error': 'Product SKU cannot be empty.'})
                continue

            if sku in seen_skus:
                errors.append({'row': row_num, 'sku': sku, 'error': f'Duplicate SKU "{sku}" in CSV file.'})
                continue
            seen_skus.add(sku)

            barcode = row[barcode_idx].strip() if barcode_idx is not None and barcode_idx < len(row) else None
            internal_barcode = row[internal_barcode_idx].strip() if internal_barcode_idx is not None and internal_barcode_idx < len(row) else None
            cat_name = row[category_idx].strip() if category_idx is not None and category_idx < len(row) else ''
            cost_price = parse_decimal(row[cost_price_idx] if cost_price_idx is not None and cost_price_idx < len(row) else '0.00')
            base_mrp = parse_decimal(row[price_idx] if price_idx is not None and price_idx < len(row) else '0.00')
            hsn_code = row[hsn_idx].strip() if hsn_idx is not None and hsn_idx < len(row) else None
            tax_slab = parse_decimal(row[tax_idx] if tax_idx is not None and tax_idx < len(row) else '18.00', default=Decimal('18.00'))
            uom = row[uom_idx].strip().upper() if uom_idx is not None and uom_idx < len(row) and row[uom_idx].strip() else 'PCS'
            stock_qty = int(parse_decimal(row[stock_idx] if stock_idx is not None and stock_idx < len(row) else '0'))
            batch_num = row[batch_idx].strip() if batch_idx is not None and batch_idx < len(row) else None

            # Category Lookup or Match
            category = None
            if cat_name:
                category = Category.objects.filter(slug__iexact=cat_name).first() or \
                    Category.objects.filter(name__iexact=cat_name).first()

            parsed_rows.append({
                'row_num': row_num,
                'name': name,
                'sku': sku,
                'barcode': barcode or None,
                'internal_barcode': internal_barcode or None,
                'category': category,
                'category_name': cat_name,
                'cost_price': cost_price,
                'base_mrp': base_mrp,
                'hsn_code': hsn_code,
                'tax_slab': tax_slab,
                'uom': uom,
                'stock_qty': max(0, stock_qty),
                'batch_num': batch_num,
            })

        if dry_run:
            return Response({
                'dry_run': True,
                'total_rows': len(parsed_rows) + len(errors),
                'valid_rows': len(parsed_rows),
                'invalid_rows': len(errors),
                'errors': errors,
                'preview': [
                    {
                        'row_num': r['row_num'],
                        'name': r['name'],
                        'sku': r['sku'],
                        'category': r['category'].name if r['category'] else r['category_name'],
                        'base_mrp': str(r['base_mrp']),
                        'cost_price': str(r['cost_price']),
                        'stock_qty': r['stock_qty'],
                    }
                    for r in parsed_rows[:15]
                ]
            })

        # Atomic commit
        created_products = 0
        updated_products = 0
        inwarded_stock_count = 0

        with transaction.atomic():
            for item in parsed_rows:
                existing = Product.objects.filter(organization_id=org, sku=item['sku']).first()

                if existing:
                    if update_existing:
                        existing.name = item['name']
                        if item['barcode']:
                            existing.barcode = item['barcode']
                        if item['internal_barcode']:
                            existing.internal_barcode = item['internal_barcode']
                        if item['category']:
                            existing.category_id = item['category']
                        existing.cost_price = item['cost_price']
                        existing.base_mrp = item['base_mrp']
                        if item['hsn_code']:
                            existing.hsn_code = item['hsn_code']
                        existing.tax_slab = item['tax_slab']
                        existing.uom = item['uom']
                        existing.save()
                        updated_products += 1
                        prod_instance = existing
                    else:
                        continue
                else:
                    prod_instance = Product.objects.create(
                        organization_id=org,
                        name=item['name'],
                        sku=item['sku'],
                        barcode=item['barcode'],
                        internal_barcode=item['internal_barcode'],
                        category_id=item['category'],
                        cost_price=item['cost_price'],
                        base_mrp=item['base_mrp'],
                        hsn_code=item['hsn_code'],
                        tax_slab=item['tax_slab'],
                        uom=item['uom'],
                    )
                    created_products += 1

                # If store provided and stock specified, inward initial inventory
                if store and item['stock_qty'] > 0:
                    inv, _ = Inventory.objects.get_or_create(
                        store_id=store,
                        product_id=prod_instance,
                        defaults={
                            'stock_quantity': 0,
                            'store_price': item['base_mrp'],
                            'batch_number': item['batch_num'] or '',
                        }
                    )
                    if item['batch_num']:
                        inv.batch_number = item['batch_num']
                        inv.save(update_fields=['batch_number'])

                    inv.adjust_stock(
                        quantity_delta=item['stock_qty'],
                        movement_type=StockMovementType.INITIAL_STOCK,
                        reason="Bulk Import Opening Stock",
                        user=request.user,
                        notes=f"Bulk imported initial opening stock balance: {item['stock_qty']} {item['uom']}"
                    )
                    inwarded_stock_count += 1

        return Response({
            'success': True,
            'dry_run': False,
            'imported_count': created_products,
            'updated_count': updated_products,
            'inwarded_inventory_count': inwarded_stock_count,
            'errors': errors,
        })


class CustomerBulkImportView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        dry_run = request.query_params.get('dry_run', '').lower() in ['true', '1', 'yes'] or \
            str(request.data.get('dry_run', '')).lower() in ['true', '1', 'yes']
        store_id = request.query_params.get('store_id') or request.data.get('store_id')

        csv_file = request.FILES.get('file')
        csv_text = request.data.get('csv_content')

        if not csv_file and not csv_text:
            return Response({'error': 'A CSV file or csv_content string must be provided.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            if csv_file:
                raw_bytes = csv_file.read()
                text = raw_bytes.decode('utf-8-sig', errors='replace')
            else:
                text = str(csv_text)
        except (UnicodeDecodeError, ValueError, AttributeError) as e:
            return Response({'error': f'Failed to decode file: {e!s}'}, status=status.HTTP_400_BAD_REQUEST)

        store = None
        if store_id:
            store = Store.objects.filter(id=store_id, is_active=True).first()

        reader = csv.reader(io.StringIO(text))
        raw_headers = None
        for row in reader:
            if row and any(cell.strip() for cell in row):
                raw_headers = row
                break

        if not raw_headers:
            return Response({'error': 'The uploaded CSV file is empty.'}, status=status.HTTP_400_BAD_REQUEST)

        header_map = {normalize_header(h): idx for idx, h in enumerate(raw_headers)}

        name_idx = find_column_index(header_map, ['name', 'customername', 'fullname'])
        mobile_idx = find_column_index(header_map, ['mobilenumber', 'mobile', 'phone', 'phonenumber'])
        email_idx = find_column_index(header_map, ['email', 'emailaddress'])
        type_idx = find_column_index(header_map, ['customertype', 'type'])
        gstin_idx = find_column_index(header_map, ['gstin', 'gstnumber'])
        points_idx = find_column_index(header_map, ['loyaltypoints', 'points', 'initialpoints'])

        if mobile_idx is None:
            return Response(
                {
                    'error': 'Missing required header. CSV must include a "mobile_number" or "phone" column.',
                    'detected_headers': raw_headers,
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        parsed_customers = []
        errors = []
        seen_mobiles = set()

        for row_num, row in enumerate(reader, start=2):
            if not row or not any(field.strip() for field in row):
                continue

            raw_mobile = row[mobile_idx].strip() if mobile_idx < len(row) else ''
            mobile = clean_mobile(raw_mobile)

            if len(mobile) < 10:
                errors.append({'row': row_num, 'mobile': raw_mobile, 'error': 'Invalid mobile number. Must contain at least 10 digits.'})
                continue

            if mobile in seen_mobiles:
                errors.append({'row': row_num, 'mobile': mobile, 'error': f'Duplicate mobile "{mobile}" in CSV file.'})
                continue
            seen_mobiles.add(mobile)

            name = row[name_idx].strip() if name_idx is not None and name_idx < len(row) else 'Customer'
            email = row[email_idx].strip() if email_idx is not None and email_idx < len(row) else None
            cust_type = CustomerType.B2B if type_idx is not None and type_idx < len(row) and 'b2b' in row[type_idx].lower() else CustomerType.RETAIL
            gstin = row[gstin_idx].strip() if gstin_idx is not None and gstin_idx < len(row) else None
            points = int(parse_decimal(row[points_idx] if points_idx is not None and points_idx < len(row) else '0'))

            parsed_customers.append({
                'row_num': row_num,
                'name': name or 'Customer',
                'mobile_number': mobile,
                'email': email or None,
                'customer_type': cust_type,
                'gstin': gstin or None,
                'loyalty_points': max(0, points),
            })

        if dry_run:
            return Response({
                'dry_run': True,
                'total_rows': len(parsed_customers) + len(errors),
                'valid_rows': len(parsed_customers),
                'invalid_rows': len(errors),
                'errors': errors,
                'preview': parsed_customers[:15]
            })

        created_count = 0
        updated_count = 0

        with transaction.atomic():
            for item in parsed_customers:
                cust, created = Customer.objects.get_or_create(
                    mobile_number=item['mobile_number'],
                    defaults={
                        'name': item['name'],
                        'email': item['email'],
                        'customer_type': item['customer_type'],
                        'gstin': item['gstin'],
                    }
                )

                if created:
                    created_count += 1
                else:
                    cust.name = item['name']
                    if item['email']:
                        cust.email = item['email']
                    if item['gstin']:
                        cust.gstin = item['gstin']
                    cust.customer_type = item['customer_type']
                    cust.save()
                    updated_count += 1

                # If store provided and points > 0, set or credit loyalty points
                if store and item['loyalty_points'] > 0:
                    sc, _ = StoreCustomer.objects.get_or_create(
                        store_id=store,
                        customer_id=cust,
                        defaults={'loyalty_points': item['loyalty_points']}
                    )
                    if not created:
                        sc.loyalty_points += item['loyalty_points']
                        sc.save()

        return Response({
            'success': True,
            'dry_run': False,
            'created_count': created_count,
            'updated_count': updated_count,
            'errors': errors,
        })


class SampleTemplateDownloadView(APIView):
    """Generates standard starter CSV templates with prefilled sample rows."""
    permission_classes = [IsAuthenticated]

    def get(self, request, template_type):
        output = io.StringIO()
        writer = csv.writer(output)

        if template_type.lower() == 'products':
            writer.writerow([
                'name',
                'sku',
                'barcode',
                'category',
                'cost_price',
                'base_mrp',
                'hsn_code',
                'tax_slab',
                'uom',
                'initial_stock',
                'batch_number',
            ])
            writer.writerow([
                'Artisan Arabica Coffee Beans 500g',
                'PAC-500',
                '8901234567890',
                'Beverages',
                '450.00',
                '650.00',
                '0901',
                '5.00',
                'PCS',
                '50',
                'BATCH-2026-01',
            ])
            writer.writerow([
                'Organic Green Tea 100g',
                'OGT-100',
                '8901234567891',
                'Beverages',
                '180.00',
                '280.00',
                '0902',
                '5.00',
                'PCS',
                '100',
                'BATCH-2026-02',
            ])
            writer.writerow([
                'Stainless Steel Water Bottle 1L',
                'SWB-1000',
                '8901234567892',
                'Electronics',
                '350.00',
                '599.00',
                '7323',
                '18.00',
                'PCS',
                '25',
                'BATCH-2026-03',
            ])
            filename = 'products_import_template.csv'

        elif template_type.lower() == 'customers':
            writer.writerow([
                'name',
                'mobile_number',
                'email',
                'customer_type',
                'gstin',
                'loyalty_points',
            ])
            writer.writerow([
                'Aarav Patel',
                '9876500001',
                'aarav.patel@example.com',
                'RETAIL',
                '',
                '120',
            ])
            writer.writerow([
                'Apex Solutions Private Limited',
                '9876500002',
                'accounts@apexsolutions.com',
                'B2B',
                '29ABCDE1234F1Z5',
                '500',
            ])
            filename = 'customers_import_template.csv'

        elif template_type.lower() == 'inventory':
            writer.writerow([
                'sku',
                'barcode',
                'product_name',
                'opening_stock',
                'store_price',
                'low_stock_threshold',
                'batch_number',
            ])
            writer.writerow([
                'PAC-500',
                '8901234567890',
                'Artisan Arabica Coffee Beans 500g',
                '50',
                '650.00',
                '10',
                'BATCH-2026-01',
            ])
            filename = 'inventory_inwarding_template.csv'
        else:
            return Response({'error': f'Unsupported template type "{template_type}". Supported: products, customers, inventory.'}, status=status.HTTP_400_BAD_REQUEST)

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response


class UniversalExportView(APIView):
    """Exports Products, Inventory, Invoices, or Customers directly to streaming CSV."""
    permission_classes = [IsAuthenticated]

    def get(self, request, entity):
        store_id = request.query_params.get('store_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        output = io.StringIO()
        writer = csv.writer(output)

        entity_clean = entity.lower().strip()

        if entity_clean == 'products':
            writer.writerow([
                'Product ID',
                'Name',
                'SKU',
                'Global Barcode',
                'Internal Barcode',
                'Category',
                'Cost Price',
                'Base MRP',
                'HSN Code',
                'GST Tax Slab %',
                'UOM',
                'Status',
                'Created At',
            ])
            products = Product.objects.filter(is_deleted=False).select_related('category_id').order_by('name')
            for p in products:
                writer.writerow([
                    str(p.id),
                    p.name,
                    p.sku,
                    p.barcode or '',
                    p.internal_barcode or '',
                    p.category_id.name if p.category_id else '',
                    str(p.cost_price),
                    str(p.base_mrp),
                    p.hsn_code or '',
                    str(p.tax_slab),
                    p.uom,
                    'ACTIVE' if p.is_active else 'INACTIVE',
                    p.created_at.strftime('%Y-%m-%d %H:%M'),
                ])
            filename = 'products_catalog_export.csv'

        elif entity_clean == 'inventory':
            writer.writerow([
                'Inventory ID',
                'Store Name',
                'Product Name',
                'SKU',
                'Barcode',
                'Current Stock Quantity',
                'Store Retail Price',
                'Stock Valuation (₹)',
                'Low Stock Threshold',
                'Batch Number',
                'Health Status',
            ])
            qs = Inventory.objects.filter(is_deleted=False).select_related('store_id', 'product_id').order_by('store_id__name', 'product_id__name')
            if store_id:
                qs = qs.filter(store_id=store_id)

            for inv in qs:
                retail = inv.store_price or inv.product_id.base_mrp
                val = retail * inv.stock_quantity
                status_label = 'OUT_OF_STOCK' if inv.stock_quantity <= 0 else 'LOW_STOCK' if inv.stock_quantity <= inv.low_stock_threshold else 'HEALTHY'

                writer.writerow([
                    str(inv.id),
                    inv.store_id.name,
                    inv.product_id.name,
                    inv.product_id.sku,
                    inv.product_id.barcode or '',
                    inv.stock_quantity,
                    str(retail),
                    str(val),
                    inv.low_stock_threshold,
                    inv.batch_number or '',
                    status_label,
                ])
            filename = 'inventory_stock_export.csv'

        elif entity_clean == 'invoices':
            writer.writerow([
                'Invoice Number',
                'Store Name',
                'Date',
                'Customer Mobile',
                'Customer Name',
                'Status',
                'Subtotal (₹)',
                'Total Discount (₹)',
                'CGST (₹)',
                'SGST (₹)',
                'IGST (₹)',
                'Total GST (₹)',
                'Grand Total (₹)',
            ])
            qs = Invoice.objects.filter(is_deleted=False).select_related('store_id', 'customer_id').order_by('-created_at')
            if store_id:
                qs = qs.filter(store_id=store_id)
            if start_date:
                qs = qs.filter(created_at__date__gte=start_date)
            if end_date:
                qs = qs.filter(created_at__date__lte=end_date)

            for inv in qs:
                writer.writerow([
                    inv.invoice_number,
                    inv.store_id.name,
                    inv.created_at.strftime('%Y-%m-%d %H:%M'),
                    inv.customer_id.mobile_number if inv.customer_id else 'Guest Walk-in',
                    inv.customer_id.name if inv.customer_id and inv.customer_id.name else '',
                    inv.status,
                    str(inv.subtotal),
                    str(inv.total_discount),
                    str(inv.cgst_amount),
                    str(inv.sgst_amount),
                    str(inv.igst_amount),
                    str(inv.total_gst),
                    str(inv.grand_total),
                ])
            filename = 'sales_invoices_register.csv'

        elif entity_clean == 'customers':
            writer.writerow([
                'Customer ID',
                'Full Name',
                'Mobile Number',
                'Email',
                'Customer Type',
                'GSTIN',
                'Created At',
            ])
            customers = Customer.objects.filter(is_deleted=False).order_by('name')
            for c in customers:
                writer.writerow([
                    str(c.id),
                    c.name or '',
                    c.mobile_number,
                    c.email or '',
                    c.customer_type,
                    c.gstin or '',
                    c.created_at.strftime('%Y-%m-%d %H:%M'),
                ])
            filename = 'customers_directory_export.csv'

        else:
            return Response(
                {'error': f'Unsupported export entity "{entity}". Supported: products, inventory, invoices, customers.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
        response['Content-Disposition'] = f'attachment; filename="{filename}"'
        return response
