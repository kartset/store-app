from rest_framework import serializers
from db.models import GSTFilingPeriod, Store
from utils.serializers import BaseModelSerializer


class GSTStoreSnapshotSerializer(serializers.ModelSerializer):
    class Meta:
        model = Store
        fields = ('id', 'name', 'gst_number', 'address')


class GSTFilingPeriodSerializer(BaseModelSerializer):
    store = GSTStoreSnapshotSerializer(source='store_id', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    return_type_display = serializers.CharField(source='get_return_type_display', read_only=True)

    class Meta:
        model = GSTFilingPeriod
        fields = (
            'id',
            'store_id',
            'period_key',
            'return_type',
            'return_type_display',
            'status',
            'status_display',
            'is_locked',
            'gross_turnover',
            'taxable_value',
            'cgst_amount',
            'sgst_amount',
            'igst_amount',
            'total_tax',
            'invoices_count',
            'credit_notes_count',
            'filed_at',
            'acknowledged_ref_number',
            'gstn_json_cache',
            'notes',
            'created_at',
            'updated_at',
            'store',
        )


class GSTPeriodActionSerializer(serializers.Serializer):
    store_id = serializers.UUIDField(required=True)
    period_key = serializers.CharField(max_length=20, required=True)
    return_type = serializers.ChoiceField(choices=['GSTR1', 'GSTR3B'], default='GSTR1')
    arn = serializers.CharField(max_length=100, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)
