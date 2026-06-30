"""
OverGrid License & Trial System
- 7-day free trial per device
- $15 lifetime license (early backer)
- License keys bound to max 2 devices (hardware fingerprint)
- Server-side validation + periodic re-check
"""
import os
import uuid
import hashlib
import secrets
import string
import logging
from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional, List, Dict

logger = logging.getLogger(__name__)

license_router = APIRouter(prefix="/license", tags=["licensing"])

# Will be set by server.py on startup
db = None
stripe_api_key = None

TRIAL_DAYS = 7
MAX_DEVICES_PER_LICENSE = 2
LICENSE_PRICE = 15.00
LICENSE_CURRENCY = "usd"


# --- Models ---

class TrialStartRequest(BaseModel):
    device_fingerprint: str = Field(..., min_length=8)

class TrialCheckRequest(BaseModel):
    device_fingerprint: str = Field(..., min_length=8)

class LicenseValidateRequest(BaseModel):
    license_key: str = Field(..., min_length=10)
    device_fingerprint: str = Field(..., min_length=8)

class PurchaseRequest(BaseModel):
    origin_url: str = Field(..., description="Frontend origin URL for redirects")
    email: Optional[str] = None

class ActivateRequest(BaseModel):
    license_key: str
    device_fingerprint: str


# --- Helpers ---

def generate_license_key():
    """Generate a human-readable license key: XXXXX-XXXXX-XXXXX-XXXXX"""
    chars = string.ascii_uppercase + string.digits
    segments = [''.join(secrets.choice(chars) for _ in range(5)) for _ in range(4)]
    return '-'.join(segments)


# --- Trial Endpoints ---

@license_router.post("/trial/start")
async def start_trial(req: TrialStartRequest):
    """Start a 7-day trial for a device. Idempotent — returns existing trial if already started."""
    existing = await db.trials.find_one({"device_fingerprint": req.device_fingerprint})
    if existing:
        expires = existing["expires_at"]
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        now = datetime.now(timezone.utc)
        remaining = (expires - now).total_seconds()
        started = existing["started_at"]
        if started.tzinfo is None:
            started = started.replace(tzinfo=timezone.utc)
        return {
            "status": "active" if remaining > 0 else "expired",
            "started_at": started.isoformat(),
            "expires_at": expires.isoformat(),
            "days_remaining": max(0, round(remaining / 86400, 1)),
        }

    now = datetime.now(timezone.utc)
    trial = {
        "device_fingerprint": req.device_fingerprint,
        "started_at": now,
        "expires_at": now + timedelta(days=TRIAL_DAYS),
    }
    await db.trials.insert_one(trial)
    return {
        "status": "active",
        "started_at": now.isoformat(),
        "expires_at": trial["expires_at"].isoformat(),
        "days_remaining": TRIAL_DAYS,
    }


@license_router.post("/trial/check")
async def check_trial(req: TrialCheckRequest):
    """Check trial status for a device."""
    trial = await db.trials.find_one({"device_fingerprint": req.device_fingerprint})
    if not trial:
        return {"status": "none", "days_remaining": 0}

    now = datetime.now(timezone.utc)
    expires = trial["expires_at"]
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    started = trial["started_at"]
    if started.tzinfo is None:
        started = started.replace(tzinfo=timezone.utc)
    remaining = (expires - now).total_seconds()
    return {
        "status": "active" if remaining > 0 else "expired",
        "started_at": started.isoformat(),
        "expires_at": expires.isoformat(),
        "days_remaining": max(0, round(remaining / 86400, 1)),
    }


# --- License Validation ---

@license_router.post("/validate")
async def validate_license(req: LicenseValidateRequest):
    """Validate a license key and bind to device."""
    lic = await db.licenses.find_one({"license_key": req.license_key})
    if not lic:
        raise HTTPException(status_code=404, detail="Invalid license key")

    if lic.get("revoked"):
        raise HTTPException(status_code=403, detail="License has been revoked")

    devices = lic.get("device_ids", [])

    # Already bound to this device
    if req.device_fingerprint in devices:
        return {
            "valid": True,
            "license_key": lic["license_key"],
            "email": lic.get("email"),
            "devices_used": len(devices),
            "max_devices": MAX_DEVICES_PER_LICENSE,
        }

    # Check device limit
    if len(devices) >= MAX_DEVICES_PER_LICENSE:
        raise HTTPException(
            status_code=403,
            detail=f"License already activated on {MAX_DEVICES_PER_LICENSE} devices. Contact support to transfer."
        )

    # Bind new device
    devices.append(req.device_fingerprint)
    await db.licenses.update_one(
        {"license_key": req.license_key},
        {"$set": {"device_ids": devices, "last_validated": datetime.now(timezone.utc)}}
    )

    return {
        "valid": True,
        "license_key": lic["license_key"],
        "email": lic.get("email"),
        "devices_used": len(devices),
        "max_devices": MAX_DEVICES_PER_LICENSE,
    }


# --- Purchase Flow ---

@license_router.post("/purchase")
async def create_purchase_session(req: PurchaseRequest, http_request: Request):
    """Create a Stripe checkout session for $15 lifetime license."""
    from emergentintegrations.payments.stripe.checkout import (
        StripeCheckout, CheckoutSessionRequest
    )

    api_key = stripe_api_key or os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment system not configured")

    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"

    checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    # Use the origin URL from the frontend for redirects
    origin = req.origin_url.rstrip("/")
    success_url = f"{origin}/license/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/license/cancel"

    metadata = {
        "product": "overgrid_lifetime",
        "email": req.email or "unknown",
    }

    checkout_req = CheckoutSessionRequest(
        amount=LICENSE_PRICE,
        currency=LICENSE_CURRENCY,
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )

    session = await checkout.create_checkout_session(checkout_req)

    # Record pending transaction
    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "amount": LICENSE_PRICE,
        "currency": LICENSE_CURRENCY,
        "email": req.email,
        "status": "pending",
        "payment_status": "initiated",
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc),
    })

    return {"checkout_url": session.url, "session_id": session.session_id}


@license_router.get("/purchase/status/{session_id}")
async def check_purchase_status(session_id: str, http_request: Request):
    """Poll checkout session status and generate license key on success."""
    from emergentintegrations.payments.stripe.checkout import StripeCheckout

    api_key = stripe_api_key or os.environ.get("STRIPE_API_KEY")
    host_url = str(http_request.base_url).rstrip("/")
    webhook_url = f"{host_url}api/webhook/stripe"
    checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)

    status = await checkout.get_checkout_status(session_id)

    # Find existing transaction
    txn = await db.payment_transactions.find_one({"session_id": session_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # If already processed, return existing license
    if txn.get("payment_status") == "paid" and txn.get("license_key"):
        return {
            "status": "paid",
            "license_key": txn["license_key"],
            "message": "Payment already processed. Here is your license key.",
        }

    # Update transaction status
    update_data = {
        "status": status.status,
        "payment_status": status.payment_status,
    }

    # If paid, generate license key (only once)
    if status.payment_status == "paid" and txn.get("payment_status") != "paid":
        license_key = generate_license_key()

        # Create license record
        await db.licenses.insert_one({
            "license_key": license_key,
            "email": txn.get("email") or status.metadata.get("email"),
            "device_ids": [],
            "max_devices": MAX_DEVICES_PER_LICENSE,
            "payment_session_id": session_id,
            "created_at": datetime.now(timezone.utc),
            "revoked": False,
        })

        update_data["license_key"] = license_key
        logger.info(f"License key generated: {license_key} for session {session_id}")

    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": update_data}
    )

    result = {
        "status": status.payment_status,
        "amount": status.amount_total,
        "currency": status.currency,
    }

    if update_data.get("license_key"):
        result["license_key"] = update_data["license_key"]
    elif txn.get("license_key"):
        result["license_key"] = txn["license_key"]

    return result
