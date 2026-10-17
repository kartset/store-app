import re
from decimal import Decimal

from rest_framework import serializers

from apps.user.serializers import UserSerializer
from db.models import Customer, CustomerType, StoreCustomer
from utils.serializers import BaseModelSerializer


class CustomerStoreMappingSummarySerializer(serializers.ModelSerializer):
    """Summarized store loyalty and visit statistics for a customer."""
    store_name = serializers.CharField(source='store_id.name', read_only=True)

    class Meta:
        model = StoreCustomer
        fields = (
            'id',
            'store_id',
            'store_name',
            'loyalty_points',
            'store_credit_balance',
            'credit_limit',
            'outstanding_balance',
            'total_visits',
            'last_visit',
            'first_visit',
        )
        read_only_fields = fields


class CustomerSerializer(BaseModelSerializer):
    user = UserSerializer(source='user_id', read_only=True)
    store_mappings = CustomerStoreMappingSummarySerializer(many=True, read_only=True)
    total_loyalty_points = serializers.SerializerMethodField()
    customer_type_display = serializers.CharField(source='get_customer_type_display', read_only=True)

    class Meta:
        model = Customer
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'user_id',
            'mobile_number',
            'name',
            'email',
            'customer_type',
            'customer_type_display',
            'gstin',
            'pan_number',
            'address_line1',
            'address_line2',
            'city',
            'state',
            'pincode',
            'date_of_birth',
            'anniversary_date',
            'notes',
            'is_active',
            'user',
            'store_mappings',
            'total_loyalty_points',
        )
        read_only_fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'total_loyalty_points',
            'customer_type_display',
        )

    def get_total_loyalty_points(self, obj) -> int:
        """Aggregates all loyalty points accrued across all retail store branches."""
        if hasattr(obj, 'store_mappings'):
            return sum(sc.loyalty_points for sc in obj.store_mappings.all())
        return 0

    def validate_mobile_number(self, value):
        if not value:
            raise serializers.ValidationError("Mobile number is required.")

        # Normalize phone number by removing spaces, dashes, brackets, and prefixes
        cleaned = re.sub(r'[\s\-\(\)\+]', '', str(value))
        if cleaned.startswith('91') and len(cleaned) == 12:
            cleaned = cleaned[2:]
        elif cleaned.startswith('0') and len(cleaned) == 11:
            cleaned = cleaned[1:]

        # Validate format: 10-digit number or international standard digits
        if not re.match(r'^[6-9]\d{9}$', cleaned) and not re.match(r'^\d{10,15}$', cleaned):
            raise serializers.ValidationError(
                "Invalid mobile number format. Please provide a valid 10-digit mobile number."
            )

        # Check uniqueness against active non-deleted customers
        instance = getattr(self, 'instance', None)
        qs = Customer.objects.filter(mobile_number=cleaned, is_deleted=False)
        if instance:
            qs = qs.exclude(pk=instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                f"Customer with mobile number '{cleaned}' already exists."
            )

        return cleaned

    def validate_gstin(self, value):
        if not value:
            return value

        cleaned = value.strip().upper()
        gstin_regex = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
        if not re.match(gstin_regex, cleaned):
            raise serializers.ValidationError(
                "Invalid GSTIN format. Expected 15 characters (e.g. 07AAAAA0000A1Z5)."
            )
        return cleaned

    def validate(self, attrs):
        # Auto-extract PAN from GSTIN if not explicitly provided
        gstin = attrs.get('gstin')
        if gstin and not attrs.get('pan_number'):
            attrs['pan_number'] = gstin[2:12]

        # If GSTIN is provided, auto-set customer_type to B2B if not specified
        if gstin and not attrs.get('customer_type'):
            attrs['customer_type'] = CustomerType.B2B

        return attrs


class CustomerLookupResponseSerializer(serializers.Serializer):
    """Payload for instant POS customer identification by mobile number."""
    found = serializers.BooleanField()
    customer = CustomerSerializer(allow_null=True)
    store_loyalty_points = serializers.IntegerField(default=0)
    store_credit_limit = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    store_outstanding_balance = serializers.DecimalField(max_digits=12, decimal_places=2, default=Decimal('0.00'))
    store_visits = serializers.IntegerField(default=0)
