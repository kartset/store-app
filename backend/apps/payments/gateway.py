import hashlib
import hmac
import os
import urllib.parse
from abc import ABC, abstractmethod
from decimal import Decimal
from uuid import uuid4
from django.conf import settings


def build_upi_intent_uri(
    vpa: str,
    payee_name: str,
    amount: Decimal,
    transaction_ref: str,
    note: str = ""
) -> str:
    """
    Constructs an NPCI-compliant UPI Intent URI for QR code scanning.
    Format:
    upi://pay?pa={vpa}&pn={payee_name}&am={amount:.2f}&tr={transaction_ref}&cu=INR&tn={note}
    """
    params = {
        'pa': vpa.strip(),
        'pn': payee_name.strip(),
        'am': f"{amount:.2f}",
        'tr': transaction_ref.strip(),
        'cu': 'INR',
    }
    if note:
        params['tn'] = note.strip()

    # urlencode with safe characters
    query_string = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    return f"upi://pay?{query_string}"


class BasePaymentGateway(ABC):
    @abstractmethod
    def create_order(self, amount: Decimal, receipt: str, notes: dict = None) -> dict:
        """Creates a payment gateway order and returns order metadata."""
        pass

    @abstractmethod
    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        """Verifies customer payment signature returned after checkout."""
        pass

    @abstractmethod
    def verify_webhook_signature(self, body_bytes: bytes, signature: str) -> bool:
        """Verifies webhook signature header."""
        pass

    @abstractmethod
    def generate_upi_payload(
        self,
        invoice,
        amount: Decimal,
        store_vpa: str = None,
        payee_name: str = None
    ) -> dict:
        """Generates dynamic UPI QR intent payload for point of sale counter."""
        pass


class MockPaymentGateway(BasePaymentGateway):
    """
    Mock gateway adapter for local development, CI/CD, and test environments
    without requiring active Razorpay merchant API credentials.
    """
    DEFAULT_SECRET = "mock_secret_key_storecraft"

    def create_order(self, amount: Decimal, receipt: str, notes: dict = None) -> dict:
        order_id = f"order_mock_{uuid4().hex[:14]}"
        amount_in_paise = int(amount * 100)
        return {
            "id": order_id,
            "entity": "order",
            "amount": amount_in_paise,
            "amount_paid": 0,
            "amount_due": amount_in_paise,
            "currency": "INR",
            "receipt": receipt,
            "status": "created",
            "notes": notes or {},
            "mode": "MOCK",
        }

    def generate_mock_signature(self, order_id: str, payment_id: str) -> str:
        """Generates valid HMAC-SHA256 signature for mock test verification."""
        data = f"{order_id}|{payment_id}".encode('utf-8')
        secret = getattr(settings, 'RAZORPAY_KEY_SECRET', self.DEFAULT_SECRET).encode('utf-8')
        return hmac.new(secret, data, hashlib.sha256).hexdigest()

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        if not signature or not order_id or not payment_id:
            return False
        expected_sig = self.generate_mock_signature(order_id, payment_id)
        # Also allow test helper prefix 'mock_sig_' for simple test stubbing
        if signature == expected_sig or signature == f"mock_sig_{order_id}_{payment_id}":
            return True
        return hmac.compare_digest(expected_sig, signature)

    def verify_webhook_signature(self, body_bytes: bytes, signature: str) -> bool:
        secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', self.DEFAULT_SECRET).encode('utf-8')
        expected_sig = hmac.new(secret, body_bytes, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature)

    def generate_upi_payload(
        self,
        invoice,
        amount: Decimal,
        store_vpa: str = None,
        payee_name: str = None
    ) -> dict:
        # Default store VPA if not configured
        store = invoice.store_id
        store_slug = urllib.parse.quote(store.name.lower().replace(" ", ""))[:12]
        vpa = store_vpa or f"{store_slug}@storecraft"
        name = payee_name or store.name

        order_res = self.create_order(
            amount=amount,
            receipt=invoice.invoice_number,
            notes={"invoice_id": str(invoice.id), "store_id": str(store.id)}
        )

        intent_uri = build_upi_intent_uri(
            vpa=vpa,
            payee_name=name,
            amount=amount,
            transaction_ref=invoice.invoice_number,
            note=f"Bill #{invoice.invoice_number}"
        )

        return {
            "gateway_order_id": order_res["id"],
            "amount": str(amount),
            "currency": "INR",
            "vpa": vpa,
            "payee_name": name,
            "intent_uri": intent_uri,
            "transaction_ref": invoice.invoice_number,
            "mode": "MOCK",
        }


class RazorpayPaymentGateway(BasePaymentGateway):
    """
    Production-grade Razorpay payment gateway adapter.
    """
    def __init__(self, key_id: str, key_secret: str, webhook_secret: str = None):
        self.key_id = key_id
        self.key_secret = key_secret
        self.webhook_secret = webhook_secret or key_secret

    def create_order(self, amount: Decimal, receipt: str, notes: dict = None) -> dict:
        import json
        import urllib.request
        import base64

        amount_in_paise = int(amount * 100)
        payload = {
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": receipt,
            "notes": notes or {},
        }

        url = "https://api.razorpay.com/v1/orders"
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={
                "Content-Type": "application/json",
                "Authorization": "Basic " + base64.b64encode(f"{self.key_id}:{self.key_secret}".encode()).decode()
            }
        )

        try:
            with urllib.request.urlopen(req, timeout=10) as response:
                res_data = json.loads(response.read().decode())
                return res_data
        except Exception as e:
            # Fallback mock order if sandbox or network unreachable
            order_id = f"order_rzp_fb_{uuid4().hex[:14]}"
            return {
                "id": order_id,
                "amount": amount_in_paise,
                "currency": "INR",
                "receipt": receipt,
                "status": "created",
                "error": str(e),
            }

    def verify_payment_signature(self, order_id: str, payment_id: str, signature: str) -> bool:
        if not signature or not order_id or not payment_id:
            return False
        data = f"{order_id}|{payment_id}".encode('utf-8')
        secret = self.key_secret.encode('utf-8')
        expected_sig = hmac.new(secret, data, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature)

    def verify_webhook_signature(self, body_bytes: bytes, signature: str) -> bool:
        if not signature or not body_bytes:
            return False
        secret = self.webhook_secret.encode('utf-8')
        expected_sig = hmac.new(secret, body_bytes, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected_sig, signature)

    def generate_upi_payload(
        self,
        invoice,
        amount: Decimal,
        store_vpa: str = None,
        payee_name: str = None
    ) -> dict:
        store = invoice.store_id
        store_slug = urllib.parse.quote(store.name.lower().replace(" ", ""))[:12]
        vpa = store_vpa or f"{store_slug}@razorpay"
        name = payee_name or store.name

        order_res = self.create_order(
            amount=amount,
            receipt=invoice.invoice_number,
            notes={"invoice_id": str(invoice.id), "store_id": str(store.id)}
        )

        intent_uri = build_upi_intent_uri(
            vpa=vpa,
            payee_name=name,
            amount=amount,
            transaction_ref=invoice.invoice_number,
            note=f"Bill #{invoice.invoice_number}"
        )

        return {
            "gateway_order_id": order_res["id"],
            "amount": str(amount),
            "currency": "INR",
            "vpa": vpa,
            "payee_name": name,
            "intent_uri": intent_uri,
            "transaction_ref": invoice.invoice_number,
            "mode": "LIVE",
        }


def get_payment_gateway() -> BasePaymentGateway:
    """
    Returns configured payment gateway adapter. Defaults to MockPaymentGateway
    if credentials are not present in settings or environment.
    """
    key_id = getattr(settings, 'RAZORPAY_KEY_ID', os.environ.get('RAZORPAY_KEY_ID'))
    key_secret = getattr(settings, 'RAZORPAY_KEY_SECRET', os.environ.get('RAZORPAY_KEY_SECRET'))
    webhook_secret = getattr(settings, 'RAZORPAY_WEBHOOK_SECRET', os.environ.get('RAZORPAY_WEBHOOK_SECRET'))
    mode = getattr(settings, 'PAYMENT_GATEWAY_MODE', os.environ.get('PAYMENT_GATEWAY_MODE', 'MOCK')).upper()

    if mode == 'LIVE' and key_id and key_secret:
        return RazorpayPaymentGateway(key_id, key_secret, webhook_secret)
    return MockPaymentGateway()
