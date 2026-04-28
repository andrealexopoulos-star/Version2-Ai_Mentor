from fastapi import APIRouter
from pydantic import BaseModel, EmailStr
from typing import Optional
import json
import urllib.request
import urllib.error

from routes.auth import verify_recaptcha_token
from routes.deps import logger

router = APIRouter()

HUBSPOT_ENDPOINT = "https://api.hsforms.com/submissions/v3/integration/submit/443060578/76c1062d-7be8-4765-b8da-4e4c87dd15b1"
SUCCESS_MESSAGE = "Thanks — a BIQc advisor will contact you within 1 business hour."
FAILURE_MESSAGE = "Something went wrong. Please try again."

ALLOWED_URGENCY = {
    "ASAP within 1 business hour",
    "ASAP (within 1 business hour)",
    "Schedule a time",
}

ALLOWED_LEAD_SOURCES = {"demo_marketing", "signup_dropoff"}


class HubspotLeadRequest(BaseModel):
    firstname: str
    lastname: str
    email: EmailStr
    phone: Optional[str] = ""
    message: str
    urgency: str
    preferred_time: Optional[str] = ""
    biqc_lead_source: str
    captcha_token: str


def _required(value: Optional[str]) -> bool:
    return bool(str(value or "").strip())


def _compose_message(message: str, urgency: str, preferred_time: str, lead_source: str) -> str:
    parts = [
        str(message or "").strip(),
        "",
        f"Lead source: {str(lead_source or '').strip()}",
        f"Urgency: {urgency}",
    ]
    if str(urgency).strip() == "Schedule a time":
        parts.append(f"Preferred time: {str(preferred_time or '').strip()}")
    return "\n".join([line for line in parts if line is not None])


def _submit_to_hubspot(payload: dict) -> None:
    last_error = None
    body = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    for _ in range(2):
        try:
            req = urllib.request.Request(HUBSPOT_ENDPOINT, data=body, method="POST", headers=headers)
            with urllib.request.urlopen(req, timeout=12) as resp:
                status = int(getattr(resp, "status", 0) or 0)
                if status < 200 or status >= 300:
                    raise RuntimeError(f"HubSpot status {status}")
            return
        except urllib.error.HTTPError as exc:
            try:
                err_body = exc.read().decode("utf-8")
            except Exception:
                err_body = str(exc)
            last_error = RuntimeError(f"HubSpot HTTPError {exc.code}: {err_body[:240]}")
        except Exception as exc:
            last_error = exc
    raise last_error or RuntimeError("HubSpot submission failed")


@router.post("/hubspot/submit-lead")
async def submit_hubspot_lead(request: HubspotLeadRequest):
    if not _required(request.firstname):
        return {"success": False, "message": FAILURE_MESSAGE}
    if not _required(request.lastname):
        return {"success": False, "message": FAILURE_MESSAGE}
    if not _required(request.email):
        return {"success": False, "message": FAILURE_MESSAGE}
    if not _required(request.message):
        return {"success": False, "message": FAILURE_MESSAGE}
    if not _required(request.urgency):
        return {"success": False, "message": FAILURE_MESSAGE}
    if not _required(request.captcha_token):
        return {"success": False, "message": FAILURE_MESSAGE}
    if request.urgency not in ALLOWED_URGENCY:
        return {"success": False, "message": FAILURE_MESSAGE}
    if request.urgency == "Schedule a time" and not _required(request.preferred_time):
        return {"success": False, "message": FAILURE_MESSAGE}
    lead_source = (request.biqc_lead_source or "").strip()
    if lead_source not in ALLOWED_LEAD_SOURCES:
        return {"success": False, "message": FAILURE_MESSAGE}

    try:
        captcha_result = await verify_recaptcha_token(
            token=request.captcha_token.strip(),
            expected_action="book_demo",
        )
    except Exception as exc:
        logger.warning(f"[hubspot submit lead] captcha verify exception: {exc}")
        return {"success": False, "message": FAILURE_MESSAGE}

    if not captcha_result.get("ok"):
        return {"success": False, "message": FAILURE_MESSAGE}
    if captcha_result.get("skipped") or captcha_result.get("unavailable"):
        return {"success": False, "message": FAILURE_MESSAGE}

    composed_message = _compose_message(
        request.message,
        request.urgency,
        request.preferred_time or "",
        lead_source,
    )

    hubspot_payload = {
        "fields": [
            {"name": "email", "value": request.email.strip()},
            {"name": "firstname", "value": request.firstname.strip()},
            {"name": "lastname", "value": request.lastname.strip()},
            {"name": "phone", "value": (request.phone or "").strip()},
            {"name": "message", "value": composed_message},
        ]
    }

    try:
        _submit_to_hubspot(hubspot_payload)
        return {"success": True, "message": SUCCESS_MESSAGE}
    except Exception as exc:
        logger.error(f"[hubspot submit lead] failed after retry: {exc}")
        return {"success": False, "message": FAILURE_MESSAGE}
