import json
from decimal import Decimal
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.views import APIView

from db.models import GSTFilingPeriod, GSTFilingStatus, GSTReturnType, Store
from .serializers import GSTFilingPeriodSerializer, GSTPeriodActionSerializer
from .services import GSTComputationService


class GSTR1SummaryView(APIView):
    """
    Returns full GSTR-1 outward supplies breakdown:
    B2B, B2CL, B2CS, CDNR, CDNUR, HSN Summary, and Documents Issued.
    """
    def get(self, request):
        store_id = request.query_params.get('store_id')
        period_key = request.query_params.get('period') or timezone.now().strftime('%Y-%m')

        store = None
        if store_id:
            try:
                store = Store.objects.get(id=store_id, is_deleted=False)
            except Store.DoesNotExist:
                return Response({'error': 'Store not found'}, status=status.HTTP_404_NOT_FOUND)

        service = GSTComputationService(store=store, period_key=period_key)
        data = service.compute_gstr1()
        return Response(data)


class GSTR3BSummaryView(APIView):
    """
    Returns monthly GSTR-3B tax liability summary:
    Table 3.1 (Outward supplies) and Table 3.2 (Inter-state unregistered).
    """
    def get(self, request):
        store_id = request.query_params.get('store_id')
        period_key = request.query_params.get('period') or timezone.now().strftime('%Y-%m')

        store = None
        if store_id:
            try:
                store = Store.objects.get(id=store_id, is_deleted=False)
            except Store.DoesNotExist:
                return Response({'error': 'Store not found'}, status=status.HTTP_404_NOT_FOUND)

        service = GSTComputationService(store=store, period_key=period_key)
        data = service.compute_gstr3b()
        return Response(data)


class HSNSummaryView(APIView):
    """
    Returns Table 12 HSN outward summary with quantity, taxable amount, and rate breakup.
    """
    def get(self, request):
        store_id = request.query_params.get('store_id')
        period_key = request.query_params.get('period') or timezone.now().strftime('%Y-%m')

        store = None
        if store_id:
            try:
                store = Store.objects.get(id=store_id, is_deleted=False)
            except Store.DoesNotExist:
                return Response({'error': 'Store not found'}, status=status.HTTP_404_NOT_FOUND)

        service = GSTComputationService(store=store, period_key=period_key)
        data = service.compute_gstr1()
        return Response({
            'period_key': period_key,
            'hsn': data['hsn'],
            'total_items': len(data['hsn']),
            'total_quantity': sum(h['total_quantity'] for h in data['hsn']),
            'total_taxable_value': sum(h['taxable_value'] for h in data['hsn']),
        })


class ExportGSTNJSONView(APIView):
    """
    Exports official offline GSTN JSON formatted file ready for upload to the GST Portal.
    """
    def get(self, request):
        store_id = request.query_params.get('store_id')
        period_key = request.query_params.get('period') or timezone.now().strftime('%Y-%m')
        as_download = request.query_params.get('download', 'false').lower() == 'true'

        store = None
        if store_id:
            try:
                store = Store.objects.get(id=store_id, is_deleted=False)
            except Store.DoesNotExist:
                return Response({'error': 'Store not found'}, status=status.HTTP_404_NOT_FOUND)

        service = GSTComputationService(store=store, period_key=period_key)
        json_payload = service.generate_gstn_json()

        if as_download:
            gstin = json_payload.get('gstin', 'GST')
            fp = json_payload.get('fp', 'PERIOD')
            filename = f"GSTR1_{gstin}_{fp}.json"
            response = HttpResponse(
                json.dumps(json_payload, indent=2),
                content_type='application/json'
            )
            response['Content-Disposition'] = f'attachment; filename="{filename}"'
            return response

        return Response(json_payload)


class GSTFilingPeriodViewSet(viewsets.ModelViewSet):
    """
    Manages statutory GST filing periods, snapshots, and lock status.
    """
    queryset = GSTFilingPeriod.objects.filter(is_deleted=False)
    serializer_class = GSTFilingPeriodSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        store_id = self.request.query_params.get('store_id')
        period_key = self.request.query_params.get('period')
        status_filter = self.request.query_params.get('status')

        if store_id:
            qs = qs.filter(store_id=store_id)
        if period_key:
            qs = qs.filter(period_key=period_key)
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    @action(detail=False, methods=['post'], url_path='generate')
    def generate_period(self, request):
        """
        Generates or refreshes a filing period tax summary and caches GSTN JSON.
        """
        serializer = GSTPeriodActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        store_id = serializer.validated_data['store_id']
        period_key = serializer.validated_data['period_key']
        return_type = serializer.validated_data.get('return_type', GSTReturnType.GSTR1)

        try:
            store = Store.objects.get(id=store_id, is_deleted=False)
        except Store.DoesNotExist:
            return Response({'error': 'Store not found.'}, status=status.HTTP_404_NOT_FOUND)

        service = GSTComputationService(store=store, period_key=period_key)
        gstr1_data = service.compute_gstr1()
        summary = gstr1_data['summary']
        gstn_json = service.generate_gstn_json()

        filing_period, _ = GSTFilingPeriod.objects.update_or_create(
            store_id=store,
            period_key=period_key,
            return_type=return_type,
            defaults={
                'gross_turnover': Decimal(str(summary['gross_turnover'])),
                'taxable_value': Decimal(str(summary['taxable_value'])),
                'cgst_amount': Decimal(str(summary['cgst'])),
                'sgst_amount': Decimal(str(summary['sgst'])),
                'igst_amount': Decimal(str(summary['igst'])),
                'total_tax': Decimal(str(summary['total_tax'])),
                'invoices_count': summary['invoices_count'],
                'credit_notes_count': summary['credit_notes_count'],
                'status': GSTFilingStatus.GENERATED,
                'gstn_json_cache': gstn_json,
            }
        )

        return Response(GSTFilingPeriodSerializer(filing_period).data)

    @action(detail=False, methods=['post'], url_path='mark-filed')
    def mark_filed(self, request):
        """
        Marks filing period as FILED, locks it against alterations, and records ARN.
        """
        serializer = GSTPeriodActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        store_id = serializer.validated_data['store_id']
        period_key = serializer.validated_data['period_key']
        return_type = serializer.validated_data.get('return_type', GSTReturnType.GSTR1)
        arn = serializer.validated_data.get('arn', '')
        notes = serializer.validated_data.get('notes', '')

        try:
            filing_period = GSTFilingPeriod.objects.get(
                store_id_id=store_id,
                period_key=period_key,
                return_type=return_type,
                is_deleted=False
            )
        except GSTFilingPeriod.DoesNotExist:
            return Response({'error': 'Filing period not found. Please generate it first.'}, status=status.HTTP_404_NOT_FOUND)

        filing_period.mark_filed(arn=arn, notes=notes)
        return Response(GSTFilingPeriodSerializer(filing_period).data)

    @action(detail=True, methods=['post'], url_path='toggle-lock')
    def toggle_lock(self, request, pk=None):
        """
        Toggles audit lock on a filing period.
        """
        filing_period = self.get_object()
        filing_period.is_locked = not filing_period.is_locked
        filing_period.save()
        return Response(GSTFilingPeriodSerializer(filing_period).data)
