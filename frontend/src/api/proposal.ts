interface SendProposalParams {
  recipient: string;
  cc: string;
  coverNote: string;
  address: string;
  total: string;
  tone: string;
  includeFinancing: boolean;
  includeEsignature: boolean;
  includeDronePhotos: boolean;
  includeWarrantyPdf: boolean;
}

interface SendProposalResult {
  email_id: string;
  status: string;
}

export async function sendProposal(
  params: SendProposalParams,
): Promise<SendProposalResult> {
  const res = await fetch("/api/proposal/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: params.recipient,
      cc: params.cc || null,
      cover_note: params.coverNote,
      address: params.address,
      total: params.total,
      tone: params.tone,
      include_financing: params.includeFinancing,
      include_esignature: params.includeEsignature,
      include_drone_photos: params.includeDronePhotos,
      include_warranty_pdf: params.includeWarrantyPdf,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(
      res.status === 422
        ? "Invalid email address. Please check and try again."
        : `Failed to send proposal: ${res.status}${detail ? ` — ${detail}` : ""}`,
    );
  }

  return res.json();
}
