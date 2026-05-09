import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from logger import get_logger
from services.email import send_proposal_email

log = get_logger(__name__)
router = APIRouter(prefix="/api/proposal", tags=["proposal"])


class SendProposalRequest(BaseModel):
    recipient: EmailStr
    cc: EmailStr | None = None
    cover_note: str
    address: str
    total: str
    tone: str
    include_financing: bool
    include_esignature: bool
    include_drone_photos: bool
    include_warranty_pdf: bool
    pdf_base64: str


class SendProposalResponse(BaseModel):
    email_id: str
    status: str


@router.post("/send", response_model=SendProposalResponse)
async def send_proposal(req: SendProposalRequest) -> SendProposalResponse:
    log.info(
        "send_proposal recipient=%s address=%s",
        req.recipient,
        req.address,
    )
    subject = f"Your re-roof proposal — {req.address}"
    html_body = (
        f"<p>{req.cover_note.replace(chr(10), '<br>')}</p>"
        f"<p><strong>Total: {req.total}</strong></p>"
        f"<p>The interactive proposal is attached as a PDF.</p>"
    )
    try:
        email_id = await send_proposal_email(
            recipient=req.recipient,
            cc=req.cc,
            subject=subject,
            html_body=html_body,
            pdf_base64=req.pdf_base64,
            pdf_filename="proposal.pdf",
        )
    except httpx.HTTPError as e:
        log.exception("resend send failed recipient=%s", req.recipient)
        raise HTTPException(
            status_code=502, detail="Email provider failed"
        ) from e
    return SendProposalResponse(email_id=email_id, status="sent")