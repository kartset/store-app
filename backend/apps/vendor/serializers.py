import re

from rest_framework import serializers

from apps.organisation.serializers import OrganizationSerializer
from db.models import Vendor
from utils.serializers import BaseModelSerializer

GSTIN_REGEX = re.compile(r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$')
PAN_REGEX = re.compile(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$')


class VendorSerializer(BaseModelSerializer):
    organization = OrganizationSerializer(source='organization_id', read_only=True)

    class Meta:
        model = Vendor
        fields = (
            'id',
            'created_at',
            'updated_at',
            'deleted_at',
            'created_by',
            'updated_by',
            'deleted_by',
            'is_deleted',
            'organization_id',
            'organization',
            'name',
            'trade_name',
            'vendor_code',
            'gstin',
            'pan_number',
            'gst_number',
            'contact_person',
            'phone',
            'email',
            'contact_info',
            'billing_address',
            'city',
            'state',
            'state_code',
            'pincode',
            'payment_terms',
            'credit_limit',
            'bank_name',
            'bank_account_number',
            'bank_ifsc',
            'notes',
            'is_active',
        )

    def validate_gstin(self, value):
        if not value:
            return value
        cleaned = value.strip().upper()
        if not GSTIN_REGEX.match(cleaned):
            raise serializers.ValidationError(
                "Invalid GSTIN format. Expected 15-character alphanumeric GSTIN (e.g., '27AAPFU0939F1ZV')."
            )
        return cleaned

    def validate_pan_number(self, value):
        if not value:
            return value
        cleaned = value.strip().upper()
        if not PAN_REGEX.match(cleaned):
            raise serializers.ValidationError(
                "Invalid PAN format. Expected 10-character alphanumeric PAN (e.g., 'AAPFU0939F')."
            )
        return cleaned

    def validate_vendor_code(self, value):
        if not value:
            return value
        return value.strip()

    def validate(self, attrs):
        attrs = super().validate(attrs)

        gstin = attrs.get('gstin') or (self.instance.gstin if self.instance else None)
        if gstin:
            # Auto-extract 2-digit state code if not provided
            if not attrs.get('state_code') and (not self.instance or not self.instance.state_code):
                attrs['state_code'] = gstin[:2]

            # Auto-extract 10-character PAN from GSTIN if not provided
            if not attrs.get('pan_number') and (not self.instance or not self.instance.pan_number):
                attrs['pan_number'] = gstin[2:12]

            # Sync legacy gst_number field
            attrs['gst_number'] = gstin

        # Check vendor_code uniqueness per organization
        vendor_code = attrs.get('vendor_code') or (self.instance.vendor_code if self.instance else None)
        org = attrs.get('organization_id') or (self.instance.organization_id if self.instance else None)

        if vendor_code and org:
            qs = Vendor.objects.filter(
                organization_id=org,
                vendor_code__iexact=vendor_code,
                is_deleted=False
            )
            if self.instance:
                qs = qs.exclude(id=self.instance.id)

            if qs.exists():
                raise serializers.ValidationError({
                    'vendor_code': f"Vendor code '{vendor_code}' already exists in this organization."
                })

        return attrs
