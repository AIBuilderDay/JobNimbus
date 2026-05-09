import html2canvas from "html2canvas-pro";
import jsPDF from "jspdf";

export async function renderElementToPdfBase64(
  el: HTMLElement,
): Promise<string> {
  await document.fonts.ready;
  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
  });
  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF({
    unit: "in",
    format: "letter",
    orientation: "portrait",
  });
  pdf.addImage(imgData, "PNG", 0, 0, 8.5, 11);
  return pdf.output("datauristring").split(",")[1];
}
