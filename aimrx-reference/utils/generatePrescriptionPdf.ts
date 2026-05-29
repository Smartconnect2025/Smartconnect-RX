import { jsPDF } from "jspdf";
import { formatDrugNameWithPrefix } from "@core/utils/digitalrx-format";

/**
 * PrescriptionPdfData
 *
 * Field-to-source mapping (per Greenwich Electronic Rx template,
 * Task #37 plan):
 *
 *   Top-right header:
 *     NPI       <- providers.npi_number              (required, validated upstream)
 *     SPI       <- doctor.spi                        (NOT in DB; renders blank)
 *     DEA       <- providers.dea_number              (optional; renders blank)
 *     Effective <- doctor.effective                  (NOT in DB; renders blank)
 *
 *   Top-left header:
 *     Phone     <- providers.phone_number
 *     Fax       <- doctor.fax                        (NOT in DB; renders blank)
 *
 *   Patient block:
 *     Patient Name    <- patients.first_name + last_name
 *     Rx Date         <- prescriptions.dateWritten (caller-supplied YYYY-MM-DD)
 *     Patient Address <- patients.physical_address
 *     Phone           <- patients.phone
 *     DOB             <- patients.date_of_birth
 *
 *   Rx box:
 *     Drug Name     <- catalog name via formatDrugNameWithPrefix when
 *                       useGreenwichFormat=true; otherwise rx.drugName
 *     NDC           <- pharmacy_medications.ndc (optional; renders empty label)
 *     SIG           <- prescriptions.sig
 *     Refills       <- prescriptions.refills
 *     QTY           <- prescriptions.quantity
 *     DAYS SUPPLY   <- caller-supplied (optional; renders empty)
 *
 *   Footer row:
 *     Generic Substitution / Sub. Allowed
 *                  <- prescriptions.dispense_as_written
 *                     ("Y" => Sub Allowed: "No"; "N" => "Yes")
 *     Notes        <- prescriptions.pharmacy_notes (typically "Bill to ...")
 *     Signed by    <- providers.signature_url image + provider name
 *     PON          <- caller-supplied (we pass prescription.id last 8 chars)
 */
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
    /** providers.dea_number (optional). Renders blank if missing. */
    dea?: string;
    /** SPI not stored in DB. Renders blank. */
    spi?: string;
    /** Effective date not stored in DB. Renders blank. */
    effective?: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
    /** Fax not stored in DB. Renders blank. */
    fax?: string;
    /** providers.company_name. Used as the printed footer name when present. */
    companyName?: string;
  };
  rx: {
    drugName: string;
    /** When true AND catalogDrugName is provided, the rendered PDF uses
     *  formatDrugNameWithPrefix(catalogDrugName) — same string the
     *  Greenwich API payload sends. Keeps the visible PDF and the API
     *  payload in sync. */
    useGreenwichFormat?: boolean;
    /** Canonical drug name from pharmacy_medications.name (Option B source). */
    catalogDrugName?: string;
    qty: string;
    dateWritten: string;
    refills: string;
    /** Days supply (caller-supplied). Renders empty when absent. */
    daysSupply?: string;
    ndc?: string;
    instructions?: string;
    notes?: string;
    daw: string;
    /** Pharmacy Order Number. Caller passes prescription.id last 8 chars. */
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

  // Underline beneath title (full width inside frame)
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

  // Vertical separator and underline
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

  // Big "Rx" symbol (italic Times bold)
  doc.setFont("times", "bolditalic");
  doc.setFontSize(28);
  doc.text("Rx", contentLeft + 6, rxBoxTop + 14);

  // Drug name + NDC at top of box (right of Rx symbol)
  let displayDrugName = data.rx.drugName;
  if (data.rx.useGreenwichFormat && data.rx.catalogDrugName) {
    try {
      displayDrugName = formatDrugNameWithPrefix(data.rx.catalogDrugName);
    } catch (err) {
      console.error(
        "[generatePrescriptionPdf] Greenwich drug-name format failed; falling back to legacy drugName:",
        {
          hasCatalogName: !!data.rx.catalogDrugName,
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      );
    }
  }

  const drugX = contentLeft + 28;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(displayDrugName || "", drugX, rxBoxTop + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (data.rx.ndc) {
    doc.text(`NDC: ${data.rx.ndc}`, drugX, rxBoxTop + 16);
  } else {
    doc.text("NDC", drugX, rxBoxTop + 16);
  }

  // SIG (instructions) — wrapped to fit inside the box.
  // Clip to a fixed line count so an unusually long Sig cannot overlap the
  // refills/QTY/DAYS SUPPLY row at the bottom of the fixed-height Rx frame.
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
        ? [...allLines.slice(0, MAX_SIG_LINES - 1), `${allLines[MAX_SIG_LINES - 1]}…`]
        : allLines;
    doc.text(sigLines, drugX, rxBoxTop + 28);
  }

  // Bottom row inside the box: 0 Refills | QTY: | DAYS SUPPLY:
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
  let subY = rxBoxBottom + 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Generic Substitution", contentLeft, subY);
  doc.text("Sub. Allowed", contentLeft + 50, subY);
  doc.setFontSize(10);
  // DAW: "Y" = dispense as written (no substitution); "N" = generic OK.
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

  if (data.signatureUrl) {
    const sigBase64 = resolveSignatureBase64(data.signatureUrl);
    if (sigBase64) {
      try {
        // Place signature image just to the right of the label, sitting on
        // the footer baseline.
        doc.addImage(sigBase64, "PNG", contentLeft + 42, footerY - 10, 40, 12);
      } catch {
        doc.setFont("helvetica", "italic");
        doc.text(printedName, contentLeft + 42, footerY);
      }
    } else {
      doc.setFont("helvetica", "italic");
      doc.text(printedName, contentLeft + 42, footerY);
    }
  } else {
    doc.setFont("helvetica", "italic");
    doc.text(printedName, contentLeft + 42, footerY);
  }

  // PON (right column)
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
