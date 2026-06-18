import { jsPDF } from "jspdf";

interface PrescriptionPdfData {
  patient: {
    firstName: string;
    lastName: string;
    dob: string;
    sex: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  };
  doctor: {
    prefix?: string;
    firstName: string;
    lastName: string;
    npi: string;
    dea?: string;
    spi?: string;
    effective?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    fax?: string;
    companyName?: string;
  };
  rx: {
    drugName: string;
    qty: string;
    dateWritten: string;
    refills: string;
    daysSupply?: string;
    ndc?: string;
    instructions?: string;
    notes?: string;
    daw: string;
    pon?: string;
  };
  signatureUrl?: string;
}

function resolveSignatureBase64(signatureUrl: string): string | null {
  try {
    if (signatureUrl.startsWith("data:")) return signatureUrl;
    return `data:image/png;base64,${signatureUrl}`;
  } catch {
    return null;
  }
}

// jsPDF needs the correct raster format string ("PNG" | "JPEG" | "WEBP").
// Signatures are normally PNG data URLs, but if one was ever saved as JPEG/WEBP
// a hardcoded "PNG" makes addImage throw and the signature silently disappears.
function detectImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  const mime = (dataUrl.match(/^data:([^;,]+)/)?.[1] ?? "").toLowerCase();
  if (mime.includes("jpeg") || mime.includes("jpg")) return "JPEG";
  if (mime.includes("webp")) return "WEBP";
  return "PNG";
}

export async function generatePrescriptionPdf(
  data: PrescriptionPdfData,
): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // ---- Layout constants (mm) ----
  const frameLeft = 18;
  const frameRight = pageWidth - 18;
  const frameTop = 22;
  const frameBottom = 270;
  const contentLeft = frameLeft + 6;
  const contentRight = frameRight - 6;
  const contentWidth = contentRight - contentLeft;
  const splitX = contentLeft + contentWidth * 0.65;

  // ---- Outer frame ----
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.4);
  doc.rect(frameLeft, frameTop, frameRight - frameLeft, frameBottom - frameTop);

  // ---- Top-right header block: NPI / SPI / DEA / Effective ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const headerLabelX = contentRight - 38;
  const headerValueX = contentRight - 22;
  let headerY = frameTop + 6;
  const headerRows: [string, string][] = [
    ["NPI:", data.doctor.npi || ""],
    ["SPI:", data.doctor.spi || ""],
    ["DEA:", data.doctor.dea || ""],
    ["Effective:", data.doctor.effective || ""],
  ];
  for (const [label, value] of headerRows) {
    doc.text(label, headerLabelX, headerY);
    if (value) doc.text(value, headerValueX, headerY);
    headerY += 4.5;
  }

  // ---- Top-left: Phone / Fax ----
  let leftHeaderY = frameTop + 14;
  doc.text("Phone:", contentLeft, leftHeaderY);
  if (data.doctor.phone) doc.text(data.doctor.phone, contentLeft + 14, leftHeaderY);
  leftHeaderY += 4.5;
  doc.text("Fax:", contentLeft, leftHeaderY);
  if (data.doctor.fax) doc.text(data.doctor.fax, contentLeft + 14, leftHeaderY);

  // ---- Title: Electronic Rx ----
  const titleY = frameTop + 24;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("Electronic Rx", pageWidth / 2, titleY, { align: "center" });
  doc.setLineWidth(0.4);
  doc.line(contentLeft, titleY + 2, contentRight, titleY + 2);

  // ---- Patient Name | Rx Date row ----
  let rowY = titleY + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Patient Name", contentLeft, rowY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const patientName = `${data.patient.firstName} ${data.patient.lastName}`.trim();
  doc.text(patientName, contentLeft, rowY + 5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Rx Date", splitX + 2, rowY);
  doc.setFontSize(10);
  doc.text(data.rx.dateWritten || "", splitX + 2, rowY + 5);
  doc.setLineWidth(0.2);
  doc.line(splitX, rowY - 3, splitX, rowY + 7);
  doc.line(contentLeft, rowY + 7, contentRight, rowY + 7);

  // ---- Patient Address ----
  rowY += 12;
  doc.setFontSize(9);
  doc.text("Patient Address", contentLeft, rowY);
  const addrLine = [
    data.patient.street,
    [data.patient.city, data.patient.state, data.patient.zip]
      .filter(Boolean)
      .join(", "),
  ]
    .filter(Boolean)
    .join("  ");
  doc.setFontSize(10);
  doc.text(addrLine || "", contentLeft, rowY + 5);
  doc.line(contentLeft, rowY + 7, contentRight, rowY + 7);

  // ---- Phone (patient) | DOB ----
  rowY += 12;
  doc.setFontSize(9);
  doc.text("Phone:", contentLeft, rowY);
  doc.setFontSize(10);
  doc.text(data.patient.phone || "", contentLeft + 14, rowY);
  doc.setFontSize(9);
  doc.text("DOB:", splitX + 2, rowY);
  doc.setFontSize(10);
  doc.text(data.patient.dob || "", splitX + 14, rowY);
  doc.setLineWidth(0.2);
  doc.line(splitX, rowY - 3, splitX, rowY + 3);
  doc.line(contentLeft, rowY + 3, contentRight, rowY + 3);

  // ---- Rx framed box ----
  const rxBoxTop = rowY + 8;
  const rxBoxHeight = 95;
  const rxBoxBottom = rxBoxTop + rxBoxHeight;
  doc.setLineWidth(0.4);
  doc.rect(contentLeft, rxBoxTop, contentRight - contentLeft, rxBoxHeight);

  // Big "Rx" symbol
  doc.setFont("times", "bolditalic");
  doc.setFontSize(28);
  doc.text("Rx", contentLeft + 6, rxBoxTop + 14);

  // Drug name + NDC
  const displayDrugName = data.rx.drugName;
  const drugX = contentLeft + 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(displayDrugName || "", drugX, rxBoxTop + 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(data.rx.ndc ? `NDC: ${data.rx.ndc}` : "NDC", drugX, rxBoxTop + 16);

  // SIG — wrapped and clipped to 12 lines so it can't overlap the bottom row
  if (data.rx.instructions) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    const allLines = doc.splitTextToSize(
      data.rx.instructions,
      contentRight - drugX - 6,
    ) as string[];
    const MAX_SIG_LINES = 12;
    const sigLines =
      allLines.length > MAX_SIG_LINES
        ? [
            ...allLines.slice(0, MAX_SIG_LINES - 1),
            `${allLines[MAX_SIG_LINES - 1]}…`,
          ]
        : allLines;
    doc.text(sigLines, drugX, rxBoxTop + 28);
  }

  // Bottom row: N Refills | QTY: | DAYS SUPPLY:
  const refillBottomY = rxBoxBottom - 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const refillsLabel = `${data.rx.refills || "0"} Refills`;
  const qtyLabel = data.rx.qty ? `QTY:  ${data.rx.qty}` : "QTY:";
  const daysLabel = data.rx.daysSupply
    ? `DAYS SUPPLY:  ${data.rx.daysSupply}`
    : "DAYS SUPPLY:";
  const boxInnerWidth = contentRight - contentLeft - 12;
  const col1X = contentLeft + 12;
  const col2X = contentLeft + 12 + boxInnerWidth * 0.32;
  const col3X = contentLeft + 12 + boxInnerWidth * 0.62;
  doc.text(refillsLabel, col1X, refillBottomY);
  doc.text(qtyLabel, col2X, refillBottomY);
  doc.text(daysLabel, col3X, refillBottomY);

  // ---- Generic Substitution | Sub. Allowed | Notes ----
  const subY = rxBoxBottom + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Generic Substitution", contentLeft, subY);
  doc.text("Sub. Allowed", contentLeft + 50, subY);
  doc.setFontSize(10);
  doc.text(data.rx.daw === "Y" ? "No" : "Yes", contentLeft + 50, subY + 5);
  doc.setFontSize(9);
  doc.text("Notes:", splitX + 2, subY);
  doc.setFontSize(10);
  if (data.rx.notes) {
    const noteLines = doc.splitTextToSize(
      data.rx.notes,
      contentRight - splitX - 4,
    );
    doc.text(noteLines, splitX + 2, subY + 5);
  }
  doc.setLineWidth(0.2);
  doc.line(splitX, subY - 3, splitX, subY + 10);
  doc.line(contentLeft, subY + 10, contentRight, subY + 10);

  // ---- Footer: Signed electronically by | PON ----
  const footerY = frameBottom - 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Signed electronically by :", contentLeft, footerY);
  const printedName = (
    data.doctor.companyName?.trim() ||
    `${data.doctor.prefix || "Dr."} ${data.doctor.firstName} ${data.doctor.lastName}`
  ).trim();
  let signatureRendered = false;
  if (data.signatureUrl) {
    const sigBase64 = resolveSignatureBase64(data.signatureUrl);
    if (sigBase64) {
      try {
        doc.addImage(
          sigBase64,
          detectImageFormat(sigBase64),
          contentLeft + 42,
          footerY - 10,
          40,
          12,
        );
        signatureRendered = true;
      } catch (err) {
        console.error("Signature image failed to render in Rx PDF:", err);
        signatureRendered = false;
      }
    }
  }
  if (!signatureRendered) {
    doc.setFont("helvetica", "italic");
    doc.text(printedName, contentLeft + 42, footerY);
  }
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("PON :", splitX + 2, footerY);
  if (data.rx.pon) {
    doc.setFontSize(10);
    doc.text(data.rx.pon, splitX + 14, footerY);
  }

  // ---- Output ----
  const blob = doc.output("blob");
  const filename = `prescription-${data.patient.lastName || "rx"}-${Date.now()}.pdf`;
  return { blob, filename };
}
