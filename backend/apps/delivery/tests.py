from decimal import Decimal
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from db.models import (
    Customer,
    Delivery,
    DeliveryStatus,
    DeliveryType,
    FulfillmentType,
    Order,
    OrderItem,
    OrderPaymentStatus,
    OrderStatus,
    Organization,
    Product,
    Store,
)


class DeliveryModelAndAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="Apex Retail Pvt Ltd")
        self.store = Store.objects.create(
            name="Indiranagar Flagship",
            organization_id=self.org,
            address="100 Feet Road, Indiranagar, Bengaluru"
        )
        self.customer = Customer.objects.create(
            name="Vikram Sethi",
            mobile_number="9876543210",
            email="vikram@example.com",
            customer_type="RETAIL"
        )
        self.product = Product.objects.create(
            name="Wireless Earbuds",
            sku="EB-W100",
            base_mrp=Decimal("2999.00"),
            cost_price=Decimal("1500.00"),
            tax_slab=Decimal("18.0"),
            organization_id=self.org
        )

        # Create Home Delivery Order
        self.order = Order.objects.create(
            store_id=self.store,
            customer_id=self.customer,
            order_number="ORD-INDI-20261018-0001",
            fulfillment_type=FulfillmentType.HOME_DELIVERY,
            status=OrderStatus.CONFIRMED,
            payment_status=OrderPaymentStatus.UNPAID,
            customer_name_snapshot="Vikram Sethi",
            customer_phone_snapshot="9876543210",
            delivery_address_line1="Flat 402, Green Glen Layout",
            delivery_city="Bengaluru",
            delivery_state="Karnataka",
            delivery_pincode="560103",
            subtotal=Decimal("2541.53"),
            total_tax=Decimal("457.47"),
            grand_total=Decimal("2999.00"),
        )
        self.order_item = OrderItem.objects.create(
            order_id=self.order,
            product_id=self.product,
            product_name_snapshot="Wireless Earbuds",
            sku_snapshot="EB-W100",
            quantity=1,
            unit_price=Decimal("2541.53"),
            tax_slab=Decimal("18.0"),
            tax_amount=Decimal("457.47"),
            line_total=Decimal("2999.00")
        )

    def test_delivery_model_methods(self):
        """Test model helper methods, status transitions, OTP verification and COD collection."""
        delivery = Delivery.objects.create(
            store_id=self.store,
            order_id=self.order,
            tracking_id="DLV-BLR01-20261018-0001",
            recipient_name="Vikram Sethi",
            recipient_phone="9876543210",
            is_cod=True,
            cod_amount_due=Decimal("2999.00")
        )

        # OTP automatically generated on creation
        self.assertIsNotNone(delivery.otp_code)
        self.assertEqual(len(delivery.otp_code), 4)
        self.assertEqual(delivery.status, DeliveryStatus.PENDING)

        # Assign driver
        delivery.assign_driver(
            driver_name="Ramesh Kumar",
            driver_phone="9811122233",
            vehicle_number="KA03HA1234",
            partner="Store Express",
            delivery_type=DeliveryType.INTERNAL
        )
        self.assertEqual(delivery.status, DeliveryStatus.ASSIGNED)
        self.assertEqual(delivery.driver_name, "Ramesh Kumar")

        # Mark Out for Delivery
        delivery.mark_out_for_delivery()
        self.assertEqual(delivery.status, DeliveryStatus.OUT_FOR_DELIVERY)
        self.assertIsNotNone(delivery.dispatched_at)

        # Invalid OTP verification
        wrong_otp = "0000" if delivery.otp_code != "0000" else "1111"
        self.assertFalse(delivery.verify_and_deliver(wrong_otp))
        self.assertEqual(delivery.status, DeliveryStatus.OUT_FOR_DELIVERY)

        # Valid OTP verification
        self.assertTrue(delivery.verify_and_deliver(
            delivery.otp_code,
            cod_collected=Decimal("2999.00"),
            cod_method="UPI"
        ))
        self.assertEqual(delivery.status, DeliveryStatus.DELIVERED)
        self.assertIsNotNone(delivery.delivered_at)
        self.assertEqual(delivery.cod_amount_collected, Decimal("2999.00"))
        self.assertEqual(delivery.cod_payment_method, "UPI")

    def test_create_delivery_from_order_via_api(self):
        """Test POST /api/deliveries/ creating delivery linked to an order."""
        payload = {
            "order_id": str(self.order.id),
            "delivery_type": "INTERNAL",
            "driver_name": "Suresh Yadav",
            "driver_phone": "9844455566",
            "vehicle_number": "KA01AB9988",
        }
        response = self.client.post("/api/deliveries/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        data = response.data

        self.assertTrue(data['tracking_id'].startswith("DLV-INDI-"))
        self.assertEqual(data['status'], DeliveryStatus.ASSIGNED)
        self.assertEqual(data['recipient_name'], "Vikram Sethi")
        self.assertEqual(data['recipient_phone'], "9876543210")
        self.assertTrue(data['is_cod'])
        self.assertEqual(Decimal(data['cod_amount_due']), Decimal("2999.00"))
        self.assertIn("Flat 402, Green Glen Layout", data['delivery_address'])

    def test_list_and_filter_deliveries(self):
        """Test GET /api/deliveries/ with store, status, and search filters."""
        d1 = Delivery.objects.create(
            store_id=self.store,
            order_id=self.order,
            tracking_id="DLV-BLR01-20261018-0001",
            recipient_name="Vikram Sethi",
            status=DeliveryStatus.PENDING
        )
        d2 = Delivery.objects.create(
            store_id=self.store,
            tracking_id="DLV-BLR01-20261018-0002",
            recipient_name="Ananya Roy",
            status=DeliveryStatus.OUT_FOR_DELIVERY
        )

        # Filter by status
        res = self.client.get(f"/api/deliveries/?store_id={self.store.id}&status=PENDING")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        results = res.data if isinstance(res.data, list) else res.data.get('results', [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['id'], str(d1.id))

        # Search by recipient name
        res_search = self.client.get("/api/deliveries/?search=Ananya")
        self.assertEqual(res_search.status_code, status.HTTP_200_OK)
        results_search = res_search.data if isinstance(res_search.data, list) else res_search.data.get('results', [])
        self.assertEqual(len(results_search), 1)
        self.assertEqual(results_search[0]['id'], str(d2.id))

    def test_assign_driver_endpoint(self):
        """Test POST /api/deliveries/{id}/assign-driver/."""
        delivery = Delivery.objects.create(
            store_id=self.store,
            order_id=self.order,
            tracking_id="DLV-BLR01-20261018-0003",
            recipient_name="Vikram Sethi",
            status=DeliveryStatus.PENDING
        )

        payload = {
            "driver_name": "Mohan Singh",
            "driver_phone": "9812345678",
            "vehicle_number": "KA04XY7788",
            "delivery_partner": "Local Fleet",
            "delivery_type": "INTERNAL",
            "mark_out_for_delivery": True
        }
        res = self.client.post(f"/api/deliveries/{delivery.id}/assign-driver/", payload, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], DeliveryStatus.OUT_FOR_DELIVERY)
        self.assertEqual(res.data['driver_name'], "Mohan Singh")

        # Verify linked order updated to READY_FOR_PICKUP
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.READY_FOR_PICKUP)

    def test_dispatch_package_endpoint(self):
        """Test POST /api/deliveries/{id}/dispatch/."""
        delivery = Delivery.objects.create(
            store_id=self.store,
            order_id=self.order,
            tracking_id="DLV-BLR01-20261018-0004",
            recipient_name="Vikram Sethi",
            driver_name="Sunil",
            driver_phone="9988776655",
            status=DeliveryStatus.ASSIGNED
        )

        res = self.client.post(f"/api/deliveries/{delivery.id}/dispatch/")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['status'], DeliveryStatus.OUT_FOR_DELIVERY)

    def test_verify_otp_and_settle_cod(self):
        """Test POST /api/deliveries/{id}/verify-otp/ and order settlement."""
        delivery = Delivery.objects.create(
            store_id=self.store,
            order_id=self.order,
            tracking_id="DLV-BLR01-20261018-0005",
            recipient_name="Vikram Sethi",
            status=DeliveryStatus.OUT_FOR_DELIVERY,
            is_cod=True,
            cod_amount_due=Decimal("2999.00")
        )

        # Invalid OTP
        res_fail = self.client.post(
            f"/api/deliveries/{delivery.id}/verify-otp/",
            {"otp_code": "0000" if delivery.otp_code != "0000" else "9999"},
            format="json"
        )
        self.assertEqual(res_fail.status_code, status.HTTP_400_BAD_REQUEST)

        # Valid OTP
        res_success = self.client.post(
            f"/api/deliveries/{delivery.id}/verify-otp/",
            {
                "otp_code": delivery.otp_code,
                "cod_amount_collected": "2999.00",
                "cod_payment_method": "CASH"
            },
            format="json"
        )
        self.assertEqual(res_success.status_code, status.HTTP_200_OK)
        self.assertEqual(res_success.data['status'], DeliveryStatus.DELIVERED)
        self.assertEqual(Decimal(res_success.data['cod_amount_collected']), Decimal("2999.00"))

        # Verify linked order marked COMPLETED and PAID
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, OrderStatus.COMPLETED)
        self.assertEqual(self.order.payment_status, OrderPaymentStatus.PAID)

    def test_update_status_failed_and_returned(self):
        """Test POST /api/deliveries/{id}/update-status/."""
        delivery = Delivery.objects.create(
            store_id=self.store,
            tracking_id="DLV-BLR01-20261018-0006",
            recipient_name="Deepak Sharma",
            status=DeliveryStatus.OUT_FOR_DELIVERY
        )

        res_failed = self.client.post(
            f"/api/deliveries/{delivery.id}/update-status/",
            {"status": "FAILED", "reason": "Customer phone switched off"},
            format="json"
        )
        self.assertEqual(res_failed.status_code, status.HTTP_200_OK)
        self.assertEqual(res_failed.data['status'], DeliveryStatus.FAILED)
        self.assertEqual(res_failed.data['failure_reason'], "Customer phone switched off")

    def test_pipeline_summary_endpoint(self):
        """Test GET /api/deliveries/pipeline-summary/."""
        Delivery.objects.create(
            store_id=self.store,
            tracking_id="DLV-BLR01-01",
            status=DeliveryStatus.PENDING
        )
        Delivery.objects.create(
            store_id=self.store,
            tracking_id="DLV-BLR01-02",
            status=DeliveryStatus.OUT_FOR_DELIVERY
        )
        Delivery.objects.create(
            store_id=self.store,
            tracking_id="DLV-BLR01-03",
            status=DeliveryStatus.DELIVERED
        )

        res = self.client.get(f"/api/deliveries/pipeline-summary/?store_id={self.store.id}")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        data = res.data
        self.assertEqual(data['total'], 3)
        self.assertEqual(data['pending'], 1)
        self.assertEqual(data['out_for_delivery'], 1)
        self.assertEqual(data['delivered'], 1)
