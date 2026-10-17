from datetime import datetime, date
from decimal import Decimal
import re
from typing import Dict, Any, List, Optional
from django.db.models import Sum, Count, Min, Max, Q
from django.utils import timezone

from db.models import (
    CreditNote,
    CreditNoteItem,
    Invoice,
    InvoiceItem,
    InvoiceStatus,
    Store,
)


def parse_period_key(period_key: str):
    """
    Parses period_key like '2026-10' into timezone-aware start_datetime and end_datetime.
    Defaults to current month if invalid.
    """
    tz = timezone.get_current_timezone()
    try:
        parts = period_key.split('-')
        year = int(parts[0])
        month = int(parts[1])
        start_dt = datetime(year, month, 1, 0, 0, 0)
        if month == 12:
            end_dt = datetime(year + 1, 1, 1, 0, 0, 0)
        else:
            end_dt = datetime(year, month + 1, 1, 0, 0, 0)
        return timezone.make_aware(start_dt, tz), timezone.make_aware(end_dt, tz)
    except Exception:
        now = timezone.now()
        start_dt = datetime(now.year, now.month, 1, 0, 0, 0)
        if now.month == 12:
            end_dt = datetime(now.year + 1, 1, 1, 0, 0, 0)
        else:
            end_dt = datetime(now.year, now.month + 1, 1, 0, 0, 0)
        return timezone.make_aware(start_dt, tz), timezone.make_aware(end_dt, tz)


def get_gst_state_code(gstin: Optional[str], default: str = '29') -> str:
    """
    Extracts 2-digit Indian State code from GSTIN (e.g. '29' for Karnataka, '07' for Delhi).
    """
    if not gstin or len(gstin.strip()) < 2:
        return default
    code = gstin.strip()[:2]
    return code if code.isdigit() else default


class GSTComputationService:
    def __init__(self, store: Optional[Store] = None, period_key: Optional[str] = None):
        self.store = store
        self.period_key = period_key or timezone.now().strftime('%Y-%m')
        self.start_date, self.end_date = parse_period_key(self.period_key)

    def _get_invoices_queryset(self):
        qs = Invoice.objects.filter(
            created_at__gte=self.start_date,
            created_at__lt=self.end_date,
        )
        if self.store:
            qs = qs.filter(store_id=self.store)
        return qs

    def _get_credit_notes_queryset(self):
        qs = CreditNote.objects.filter(
            created_at__gte=self.start_date,
            created_at__lt=self.end_date,
            status='COMPLETED',
        )
        if self.store:
            qs = qs.filter(store_id=self.store)
        return qs

    def compute_gstr1(self) -> Dict[str, Any]:
        """
        Computes GSTR-1 tables:
        - b2b: Invoices to registered taxpayers (Table 4)
        - b2cl: Inter-state supplies to unregistered persons > 2.5L (Table 5)
        - b2cs: Intra-state and small inter-state supplies to unregistered (Table 7)
        - cdnr: Credit/Debit notes to registered persons (Table 9B)
        - cdnur: Credit/Debit notes to unregistered persons (Table 9B)
        - hsn: HSN-wise summary of outward supplies (Table 12)
        - doc_issue: Details of documents issued (Table 13)
        """
        all_invoices = self._get_invoices_queryset()
        valid_invoices = all_invoices.filter(status__in=[InvoiceStatus.PAID, InvoiceStatus.PARTIALLY_PAID])
        cancelled_invoices = all_invoices.filter(status=InvoiceStatus.CANCELLED)

        credit_notes = self._get_credit_notes_queryset()

        store_state = '29'
        if self.store and self.store.gst_number:
            store_state = get_gst_state_code(self.store.gst_number)

        b2b_list: List[Dict[str, Any]] = []
        b2cl_list: List[Dict[str, Any]] = []
        b2cs_map: Dict[str, Dict[str, Any]] = {}

        # Categorize invoices
        for inv in valid_invoices.prefetch_related('items'):
            customer_gstin = (inv.customer_gstin_snapshot or '').strip()
            inv_total = Decimal(str(inv.grand_total or '0.00'))
            buyer_pos = get_gst_state_code(customer_gstin, store_state)

            items_data = []
            for item in inv.items.all():
                tax_rate = Decimal(str(item.tax_slab or '0.00'))
                taxable = Decimal(str(item.taxable_amount or '0.00'))
                cgst = Decimal(str(item.cgst_amount or '0.00'))
                sgst = Decimal(str(item.sgst_amount or '0.00'))
                igst = Decimal(str(item.igst_amount or '0.00'))

                items_data.append({
                    'rate': float(tax_rate),
                    'taxable_value': float(taxable),
                    'cgst': float(cgst),
                    'sgst': float(sgst),
                    'igst': float(igst),
                })

            if customer_gstin and len(customer_gstin) >= 15:
                # Table 4: B2B
                b2b_list.append({
                    'invoice_number': inv.invoice_number,
                    'invoice_date': inv.created_at.strftime('%Y-%m-%d'),
                    'invoice_value': float(inv_total),
                    'customer_name': inv.customer_name_snapshot or 'Registered Buyer',
                    'customer_gstin': customer_gstin,
                    'pos': buyer_pos,
                    'reverse_charge': 'N',
                    'invoice_type': 'Regular',
                    'items': items_data,
                    'taxable_value': float(inv.subtotal),
                    'cgst': float(inv.cgst_amount),
                    'sgst': float(inv.sgst_amount),
                    'igst': float(inv.igst_amount),
                })
            elif buyer_pos != store_state and inv_total > Decimal('250000.00'):
                # Table 5: B2C Large (Inter-state unregistered > 2.5L)
                b2cl_list.append({
                    'invoice_number': inv.invoice_number,
                    'invoice_date': inv.created_at.strftime('%Y-%m-%d'),
                    'invoice_value': float(inv_total),
                    'pos': buyer_pos,
                    'items': items_data,
                    'taxable_value': float(inv.subtotal),
                    'igst': float(inv.igst_amount),
                })
            else:
                # Table 7: B2C Small
                for item in inv.items.all():
                    rate_key = f"{buyer_pos}_{float(item.tax_slab)}"
                    if rate_key not in b2cs_map:
                        b2cs_map[rate_key] = {
                            'pos': buyer_pos,
                            'type': 'OE',  # Other than E-commerce
                            'rate': float(item.tax_slab),
                            'taxable_value': Decimal('0.00'),
                            'cgst': Decimal('0.00'),
                            'sgst': Decimal('0.00'),
                            'igst': Decimal('0.00'),
                        }
                    b2cs_map[rate_key]['taxable_value'] += Decimal(str(item.taxable_amount or '0.00'))
                    b2cs_map[rate_key]['cgst'] += Decimal(str(item.cgst_amount or '0.00'))
                    b2cs_map[rate_key]['sgst'] += Decimal(str(item.sgst_amount or '0.00'))
                    b2cs_map[rate_key]['igst'] += Decimal(str(item.igst_amount or '0.00'))

        b2cs_list = [
            {
                'pos': entry['pos'],
                'type': entry['type'],
                'rate': entry['rate'],
                'taxable_value': float(entry['taxable_value']),
                'cgst': float(entry['cgst']),
                'sgst': float(entry['sgst']),
                'igst': float(entry['igst']),
            }
            for entry in b2cs_map.values()
        ]

        # Table 9B: Credit Notes (CDNR & CDNUR)
        cdnr_list: List[Dict[str, Any]] = []
        cdnur_list: List[Dict[str, Any]] = []

        for cn in credit_notes.select_related('invoice_id'):
            orig_inv = cn.invoice_id
            cust_gstin = (orig_inv.customer_gstin_snapshot or '').strip() if orig_inv else ''
            cn_data = {
                'credit_note_number': cn.credit_note_number,
                'credit_note_date': cn.created_at.strftime('%Y-%m-%d'),
                'original_invoice_number': orig_inv.invoice_number if orig_inv else '',
                'original_invoice_date': orig_inv.created_at.strftime('%Y-%m-%d') if orig_inv else '',
                'note_type': 'C',
                'note_value': float(cn.refund_amount),
                'taxable_value': float(cn.taxable_amount),
                'cgst': float(cn.cgst_amount),
                'sgst': float(cn.sgst_amount),
                'igst': float(cn.igst_amount),
                'reason': cn.reason,
            }
            if cust_gstin and len(cust_gstin) >= 15:
                cn_data['customer_gstin'] = cust_gstin
                cdnr_list.append(cn_data)
            else:
                cdnur_list.append(cn_data)

        # Table 12: HSN Summary
        hsn_map: Dict[str, Dict[str, Any]] = {}
        invoice_items = InvoiceItem.objects.filter(invoice_id__in=valid_invoices)

        for it in invoice_items:
            hsn = (it.hsn_code or 'OTHER').strip().upper()
            rate = float(it.tax_slab or '0.00')
            hsn_key = f"{hsn}_{rate}"

            if hsn_key not in hsn_map:
                hsn_map[hsn_key] = {
                    'hsn_code': hsn,
                    'description': it.product_name_snapshot or 'Retail Product',
                    'uom': 'NOS',
                    'total_quantity': 0,
                    'total_value': Decimal('0.00'),
                    'taxable_value': Decimal('0.00'),
                    'rate': rate,
                    'cgst': Decimal('0.00'),
                    'sgst': Decimal('0.00'),
                    'igst': Decimal('0.00'),
                }
            hsn_map[hsn_key]['total_quantity'] += it.quantity
            hsn_map[hsn_key]['total_value'] += Decimal(str(it.line_total or '0.00'))
            hsn_map[hsn_key]['taxable_value'] += Decimal(str(it.taxable_amount or '0.00'))
            hsn_map[hsn_key]['cgst'] += Decimal(str(it.cgst_amount or '0.00'))
            hsn_map[hsn_key]['sgst'] += Decimal(str(it.sgst_amount or '0.00'))
            hsn_map[hsn_key]['igst'] += Decimal(str(it.igst_amount or '0.00'))

        hsn_list = [
            {
                'hsn_code': entry['hsn_code'],
                'description': entry['description'],
                'uom': entry['uom'],
                'total_quantity': entry['total_quantity'],
                'total_value': float(entry['total_value']),
                'taxable_value': float(entry['taxable_value']),
                'rate': entry['rate'],
                'cgst': float(entry['cgst']),
                'sgst': float(entry['sgst']),
                'igst': float(entry['igst']),
            }
            for entry in hsn_map.values()
        ]

        # Table 13: Documents Issued
        inv_first = all_invoices.order_by('invoice_number').first()
        inv_last = all_invoices.order_by('-invoice_number').first()

        doc_issue = {
            'invoices': {
                'doc_type': 'Invoices for outward supply',
                'from_serial': inv_first.invoice_number if inv_first else 'N/A',
                'to_serial': inv_last.invoice_number if inv_last else 'N/A',
                'total_count': all_invoices.count(),
                'cancelled_count': cancelled_invoices.count(),
                'net_issued': valid_invoices.count(),
            },
            'credit_notes': {
                'doc_type': 'Credit Notes for customer returns',
                'total_count': credit_notes.count(),
                'cancelled_count': 0,
                'net_issued': credit_notes.count(),
            }
        }

        # Totals computation
        tot_turnover = sum(Decimal(str(inv.grand_total or '0.00')) for inv in valid_invoices)
        tot_taxable = sum(Decimal(str(inv.subtotal or '0.00')) for inv in valid_invoices)
        tot_cgst = sum(Decimal(str(inv.cgst_amount or '0.00')) for inv in valid_invoices)
        tot_sgst = sum(Decimal(str(inv.sgst_amount or '0.00')) for inv in valid_invoices)
        tot_igst = sum(Decimal(str(inv.igst_amount or '0.00')) for inv in valid_invoices)
        tot_gst = tot_cgst + tot_sgst + tot_igst

        # Deduct credit notes from totals
        cn_taxable = sum(Decimal(str(cn.taxable_amount or '0.00')) for cn in credit_notes)
        cn_cgst = sum(Decimal(str(cn.cgst_amount or '0.00')) for cn in credit_notes)
        cn_sgst = sum(Decimal(str(cn.sgst_amount or '0.00')) for cn in credit_notes)
        cn_igst = sum(Decimal(str(cn.igst_amount or '0.00')) for cn in credit_notes)

        return {
            'period_key': self.period_key,
            'store_id': str(self.store.id) if self.store else None,
            'store_name': self.store.name if self.store else 'All Stores',
            'store_gstin': self.store.gst_number if self.store else '',
            'summary': {
                'gross_turnover': float(tot_turnover),
                'taxable_value': float(tot_taxable),
                'cgst': float(tot_cgst),
                'sgst': float(tot_sgst),
                'igst': float(tot_igst),
                'total_tax': float(tot_gst),
                'invoices_count': valid_invoices.count(),
                'credit_notes_count': credit_notes.count(),
                'net_taxable_value': float(tot_taxable - cn_taxable),
                'net_tax': float(tot_gst - (cn_cgst + cn_sgst + cn_igst)),
            },
            'b2b': b2b_list,
            'b2cl': b2cl_list,
            'b2cs': b2cs_list,
            'cdnr': cdnr_list,
            'cdnur': cdnur_list,
            'hsn': hsn_list,
            'doc_issue': doc_issue,
        }

    def compute_gstr3b(self) -> Dict[str, Any]:
        """
        Computes GSTR-3B monthly return tables:
        - 3.1: Details of Outward Supplies and Inward Supplies Liable to Reverse Charge
        - 3.2: Inter-state supplies made to unregistered persons
        """
        gstr1_data = self.compute_gstr1()
        summary = gstr1_data['summary']

        # 3.1 (a) Outward Taxable Supplies
        table_3_1 = {
            'outward_taxable_supplies': {
                'nature': 'Outward taxable supplies (other than zero rated, nil rated and exempted)',
                'taxable_value': summary['net_taxable_value'],
                'igst': summary['igst'],
                'cgst': summary['cgst'],
                'sgst': summary['sgst'],
                'cess': 0.0,
            },
            'zero_rated': {
                'nature': 'Outward taxable supplies (zero rated)',
                'taxable_value': 0.0,
                'igst': 0.0,
                'cess': 0.0,
            },
            'nil_exempt': {
                'nature': 'Other outward supplies (Nil rated, exempted)',
                'taxable_value': 0.0,
            },
            'reverse_charge': {
                'nature': 'Inward supplies liable to reverse charge',
                'taxable_value': 0.0,
                'igst': 0.0,
                'cgst': 0.0,
                'sgst': 0.0,
                'cess': 0.0,
            },
            'non_gst': {
                'nature': 'Non-GST outward supplies',
                'taxable_value': 0.0,
            }
        }

        # 3.2 Inter-state supplies to unregistered persons (B2CL + B2CS inter-state)
        store_state = '29'
        if self.store and self.store.gst_number:
            store_state = get_gst_state_code(self.store.gst_number)

        interstate_supplies_map: Dict[str, Dict[str, Any]] = {}

        for item in gstr1_data['b2cl']:
            pos = item['pos']
            if pos != store_state:
                if pos not in interstate_supplies_map:
                    interstate_supplies_map[pos] = {'pos': pos, 'taxable_value': 0.0, 'igst': 0.0}
                interstate_supplies_map[pos]['taxable_value'] += item['taxable_value']
                interstate_supplies_map[pos]['igst'] += item['igst']

        for item in gstr1_data['b2cs']:
            pos = item['pos']
            if pos != store_state:
                if pos not in interstate_supplies_map:
                    interstate_supplies_map[pos] = {'pos': pos, 'taxable_value': 0.0, 'igst': 0.0}
                interstate_supplies_map[pos]['taxable_value'] += item['taxable_value']
                interstate_supplies_map[pos]['igst'] += item['igst']

        table_3_2 = list(interstate_supplies_map.values())

        return {
            'period_key': self.period_key,
            'store_id': str(self.store.id) if self.store else None,
            'store_name': self.store.name if self.store else 'All Stores',
            'store_gstin': self.store.gst_number if self.store else '',
            'table_3_1': table_3_1,
            'table_3_2': table_3_2,
            'tax_liability': {
                'total_taxable_value': summary['net_taxable_value'],
                'igst': summary['igst'],
                'cgst': summary['cgst'],
                'sgst': summary['sgst'],
                'total_tax_payable': summary['net_tax'],
            }
        }

    def generate_gstn_json(self) -> Dict[str, Any]:
        """
        Generates standard GSTN Offline Tool JSON export format for GSTR-1.
        """
        gstr1 = self.compute_gstr1()

        # Format period like 102026 (MMYYYY)
        try:
            parts = self.period_key.split('-')
            fp = f"{int(parts[1]):02d}{parts[0]}"
        except Exception:
            fp = timezone.now().strftime('%m%Y')

        gstin = self.store.gst_number if self.store and self.store.gst_number else "29ABCDE1234F1Z5"

        # Transform B2B into GSTN schema format
        b2b_gstn_map: Dict[str, List[Dict[str, Any]]] = {}
        for b2b_inv in gstr1['b2b']:
            ctin = b2b_inv['customer_gstin']
            if ctin not in b2b_gstn_map:
                b2b_gstn_map[ctin] = []

            items_gstn = []
            for num, it in enumerate(b2b_inv['items'], start=1):
                items_gstn.append({
                    'num': num,
                    'itm_det': {
                        'rt': it['rate'],
                        'txval': it['taxable_value'],
                        'iamt': it['igst'],
                        'camt': it['cgst'],
                        'samt': it['sgst'],
                        'csamt': 0.0
                    }
                })

            b2b_gstn_map[ctin].append({
                'inum': b2b_inv['invoice_number'],
                'idt': datetime.strptime(b2b_inv['invoice_date'], '%Y-%m-%d').strftime('%d-%m-%Y'),
                'val': b2b_inv['invoice_value'],
                'pos': b2b_inv['pos'],
                'rchrg': b2b_inv['reverse_charge'],
                'inv_typ': 'R',
                'itms': items_gstn
            })

        b2b_payload = [
            {'ctin': ctin, 'inv': invs}
            for ctin, invs in b2b_gstn_map.items()
        ]

        # Transform B2CS into GSTN schema format
        b2cs_payload = [
            {
                'sply_ty': 'INTRA' if entry['pos'] == gstin[:2] else 'INTER',
                'pos': entry['pos'],
                'typ': entry['type'],
                'rt': entry['rate'],
                'txval': entry['taxable_value'],
                'iamt': entry['igst'],
                'camt': entry['cgst'],
                'samt': entry['sgst'],
                'csamt': 0.0
            }
            for entry in gstr1['b2cs']
        ]

        # Transform HSN summary
        hsn_payload = [
            {
                'num': idx,
                'hsn_sc': h['hsn_code'],
                'desc': h['description'],
                'uqc': h['uom'],
                'qty': h['total_quantity'],
                'val': h['total_value'],
                'txval': h['taxable_value'],
                'iamt': h['igst'],
                'camt': h['cgst'],
                'samt': h['sgst'],
                'csamt': 0.0
            }
            for idx, h in enumerate(gstr1['hsn'], start=1)
        ]

        return {
            'gstin': gstin,
            'fp': fp,
            'version': 'GSTR1_V2.1',
            'hash': 'GSTN_ONLINE_HASH',
            'b2b': b2b_payload,
            'b2cl': gstr1['b2cl'],
            'b2cs': b2cs_payload,
            'cdnr': gstr1['cdnr'],
            'cdnur': gstr1['cdnur'],
            'hsn': {'data': hsn_payload},
            'doc_issue': gstr1['doc_issue'],
        }
