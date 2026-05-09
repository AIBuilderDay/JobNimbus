from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from logger import get_logger
from services.email import send_proposal_email

log = get_logger(__name__)
router = APIRouter(prefix="/api/proposal")


class SendProposalRequest(BaseModel):
    recipient: EmailStr
    cc: EmailStr | None = None
    cover_note: str
    address: str
    total: str
    tone: str
    include_financing: bool = False
    include_esignature: bool = False
    include_drone_photos: bool = False
    include_warranty_pdf: bool = False


class SendProposalResponse(BaseModel):
    email_id: str
    status: str


def _build_html(req: SendProposalRequest) -> str:
    toggles_html = ""
    if req.include_financing:
        toggles_html += '<li style="margin-bottom:4px;">Financing options included</li>'
    if req.include_esignature:
        toggles_html += '<li style="margin-bottom:4px;">E-signature enabled</li>'
    if req.include_drone_photos:
        toggles_html += '<li style="margin-bottom:4px;">Drone photos attached</li>'
    if req.include_warranty_pdf:
        toggles_html += '<li style="margin-bottom:4px;">Warranty PDF included</li>'

    if toggles_html:
        toggles_section = f"""
        <div style="margin-top:24px;padding:16px;background:#f0f4ff;border-radius:8px;">
            <p style="margin:0 0 8px;font-weight:600;color:#152952;">Included with this proposal:</p>
            <ul style="margin:0;padding-left:20px;color:#4a5568;">{toggles_html}</ul>
        </div>"""
    else:
        toggles_section = ""

    cover_note_html = req.cover_note.replace("\n", "<br>")

    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f7f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
    <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
        <div style="background:#152952;color:#fff;padding:24px 32px;border-radius:12px 12px 0 0;">
            <h1 style="margin:0;font-size:20px;font-weight:600;">Holloway Roofing Co.</h1>
            <p style="margin:4px 0 0;font-size:12px;opacity:0.7;">Tampa, FL &middot; License #CCC1331234</p>
        </div>
        <div style="background:#fff;padding:32px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
            <h2 style="margin:0 0 4px;font-size:22px;color:#152952;">Re-roof proposal</h2>
            <p style="margin:0 0 24px;font-size:13px;color:#718096;">{req.address}</p>
            <div style="font-size:14px;line-height:1.7;color:#2d3748;margin-bottom:24px;">
                {cover_note_html}
            </div>
            <div style="background:#f0f4ff;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;">
                <p style="margin:0 0 4px;font-size:13px;color:#718096;">Total due</p>
                <p style="margin:0;font-size:32px;font-weight:700;color:#152952;">{req.total}</p>
                <p style="margin:8px 0 0;font-size:12px;color:#718096;">Pricing locked for 30 days</p>
            </div>
            {toggles_section}
            <div style="margin-top:32px;text-align:center;">
                <p style="font-size:12px;color:#a0aec0;">Holloway Roofing Co. &middot; 1200 N Tampa St, Tampa FL 33602 &middot; (813) 555-0142</p>
            </div>
        </div>
    </div>
</body>
</html>"""


@router.post("/send")
async def send_proposal(req: SendProposalRequest) -> SendProposalResponse:
    log.info("POST /api/proposal/send to=%s address=%s", req.recipient, req.address)

    subject = f"Your roofing proposal for {req.address} — {req.total}"
    html_body = _build_html(req)

    try:
        email_id = await send_proposal_email(
            recipient=req.recipient,
            cc=req.cc,
            subject=subject,
            html_body=html_body,
        )
    except Exception:
        log.exception("proposal send failed to=%s", req.recipient)
        raise HTTPException(status_code=502, detail="Failed to send proposal email")

    return SendProposalResponse(email_id=email_id, status="sent")
