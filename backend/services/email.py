import httpx

from logger import get_logger
from settings import settings

log = get_logger(__name__)

RESEND_API_URL = "https://api.resend.com/emails"
FROM_ADDRESS = "Holloway Roofing <proposals@hollowayroofing.com>"


async def send_proposal_email(
    recipient: str,
    cc: str | None,
    subject: str,
    html_body: str,
) -> str:
    log.info("sending proposal email to=%s cc=%s", recipient, cc)

    payload: dict = {
        "from": FROM_ADDRESS,
        "to": [recipient],
        "subject": subject,
        "html": html_body,
    }
    if cc:
        payload["cc"] = [cc]

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                RESEND_API_URL,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        resp.raise_for_status()
    except httpx.HTTPError:
        log.exception("resend API call failed to=%s", recipient)
        raise

    data = resp.json()
    email_id = data.get("id", "unknown")
    log.info("proposal email sent id=%s to=%s", email_id, recipient)
    return email_id
