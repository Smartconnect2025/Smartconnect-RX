/**
 * Renders a sample PDF using the new Greenwich Electronic Rx generator.
 *
 * Usage:  node scripts/render-sample-pdf.mjs
 * Output: .local/pdf-inspection/sample-greenwich-rx.pdf
 *
 * This script avoids importing the TypeScript generator directly; instead,
 * it inlines the same jsPDF layout calls so we can render a representative
 * sample WITHOUT pulling in the @core path alias from a Node script.
 *
 * Whenever utils/generatePrescriptionPdf.ts changes, mirror the layout
 * here OR (preferred) regenerate the PDF via a real wizard run in the app.
 */
import { jsPDF } from "jspdf";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputDir = join(__dirname, "..", ".local", "pdf-inspection");

// Sample data (representative of a real Greenwich submission).
const data = {
  patient: {
    firstName: "Jane",
    lastName: "Patient",
    dob: "1985-07-12",
    sex: "F",
    street: "123 Wellness Way",
    city: "Greenwich",
    state: "CT",
    zip: "06830",
    phone: "(203) 555-0142",
  },
  doctor: {
    prefix: "Dr.",
    firstName: "Maria",
    lastName: "Rahmany",
    npi: "1234567890",
    dea: "AR1234563",
    spi: "",
    effective: "",
    street: "100 Doctor Lane",
    city: "Greenwich",
    state: "CT",
    zip: "06830",
    phone: "(203) 555-0100",
    fax: "",
    companyName: "AIM Rx Clinic",
  },
  rx: {
    drugName: "AIM  Sermorelin/Ipamorelin Acetate Injection 5mg/3mg",
    qty: "1",
    dateWritten: new Date().toISOString().split("T")[0],
    refills: "0",
    daysSupply: "30",
    ndc: "12345-6789-01",
    instructions:
      "Inject 0.25 mL subcutaneously once daily at bedtime. Rotate sites. " +
      "Discard 30 days after first puncture.",
    notes: "Bill to AIM Rx Clinic",
    daw: "N",
    pon: "ABC12345",
  },
  signatureUrl: undefined,
};

// ---- Inline render (mirrors utils/generatePrescriptionPdf.ts) ----
const doc = new jsPDF({ unit: "mm", format: "a4" });
const pageWidth = doc.internal.pageSize.getWidth();

const frameLeft = 18;
const frameRight = pageWidth - 18;
const frameTop = 22;
const frameBottom = 270;
const contentLeft = frameLeft + 6;
const contentRight = frameRight - 6;
const contentWidth = contentRight - contentLeft;
const splitX = contentLeft + contentWidth * 0.65;

doc.setDrawColor(0, 0, 0);
doc.setLineWidth(0.4);
doc.rect(frameLeft, frameTop, frameRight - frameLeft, frameBottom - frameTop);

doc.setFont("helvetica", "normal");
doc.setFontSize(9);
const headerLabelX = contentRight - 38;
const headerValueX = contentRight - 22;
let headerY = frameTop + 6;
const headerRows = [
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

let leftHeaderY = frameTop + 14;
doc.text("Phone:", contentLeft, leftHeaderY);
if (data.doctor.phone) doc.text(data.doctor.phone, contentLeft + 14, leftHeaderY);
leftHeaderY += 4.5;
doc.text("Fax:", contentLeft, leftHeaderY);
if (data.doctor.fax) doc.text(data.doctor.fax, contentLeft + 14, leftHeaderY);

const titleY = frameTop + 24;
doc.setFont("helvetica", "bold");
doc.setFontSize(13);
doc.text("Electronic Rx", pageWidth / 2, titleY, { align: "center" });
doc.setLineWidth(0.4);
doc.line(contentLeft, titleY + 2, contentRight, titleY + 2);

let rowY = titleY + 8;
doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.text("Patient Name", contentLeft, rowY);
doc.setFont("helvetica", "bold");
doc.setFontSize(10);
doc.text(`${data.patient.firstName} ${data.patient.lastName}`.trim(), contentLeft, rowY + 5);

doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.text("Rx Date", splitX + 2, rowY);
doc.setFontSize(10);
doc.text(data.rx.dateWritten, splitX + 2, rowY + 5);

doc.setLineWidth(0.2);
doc.line(splitX, rowY - 3, splitX, rowY + 7);
doc.line(contentLeft, rowY + 7, contentRight, rowY + 7);

rowY += 12;
doc.setFontSize(9);
doc.text("Patient Address", contentLeft, rowY);
const addrLine = [
  data.patient.street,
  [data.patient.city, data.patient.state, data.patient.zip].filter(Boolean).join(", "),
].filter(Boolean).join("  ");
doc.setFontSize(10);
doc.text(addrLine, contentLeft, rowY + 5);
doc.line(contentLeft, rowY + 7, contentRight, rowY + 7);

rowY += 12;
doc.setFontSize(9);
doc.text("Phone:", contentLeft, rowY);
doc.setFontSize(10);
doc.text(data.patient.phone || "", contentLeft + 14, rowY);
doc.setFontSize(9);
doc.text("DOB:", splitX + 2, rowY);
doc.setFontSize(10);
doc.text(data.patient.dob, splitX + 14, rowY);
doc.setLineWidth(0.2);
doc.line(splitX, rowY - 3, splitX, rowY + 3);
doc.line(contentLeft, rowY + 3, contentRight, rowY + 3);

const rxBoxTop = rowY + 8;
const rxBoxHeight = 95;
const rxBoxBottom = rxBoxTop + rxBoxHeight;
doc.setLineWidth(0.4);
doc.rect(contentLeft, rxBoxTop, contentRight - contentLeft, rxBoxHeight);

doc.setFont("times", "bolditalic");
doc.setFontSize(28);
doc.text("Rx", contentLeft + 6, rxBoxTop + 14);

const drugX = contentLeft + 28;
doc.setFont("helvetica", "bold");
doc.setFontSize(11);
doc.text(data.rx.drugName, drugX, rxBoxTop + 10);
doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.text(data.rx.ndc ? `NDC: ${data.rx.ndc}` : "NDC", drugX, rxBoxTop + 16);

doc.setFont("helvetica", "normal");
doc.setFontSize(10);
const sigLines = doc.splitTextToSize(data.rx.instructions, contentRight - drugX - 6);
doc.text(sigLines, drugX, rxBoxTop + 28);

const refillBottomY = rxBoxBottom - 8;
doc.setFontSize(10);
const refillsLabel = `${data.rx.refills} Refills`;
const qtyLabel = `QTY:  ${data.rx.qty}`;
const daysLabel = `DAYS SUPPLY:  ${data.rx.daysSupply}`;
const boxInnerWidth = contentRight - contentLeft - 12;
doc.text(refillsLabel, contentLeft + 12, refillBottomY);
doc.text(qtyLabel, contentLeft + 12 + boxInnerWidth * 0.32, refillBottomY);
doc.text(daysLabel, contentLeft + 12 + boxInnerWidth * 0.62, refillBottomY);

let subY = rxBoxBottom + 8;
doc.setFontSize(9);
doc.text("Generic Substitution", contentLeft, subY);
doc.text("Sub. Allowed", contentLeft + 50, subY);
doc.setFontSize(10);
doc.text(data.rx.daw === "Y" ? "No" : "Yes", contentLeft + 50, subY + 5);
doc.setFontSize(9);
doc.text("Notes:", splitX + 2, subY);
doc.setFontSize(10);
const noteLines = doc.splitTextToSize(data.rx.notes, contentRight - splitX - 4);
doc.text(noteLines, splitX + 2, subY + 5);
doc.setLineWidth(0.2);
doc.line(splitX, subY - 3, splitX, subY + 10);
doc.line(contentLeft, subY + 10, contentRight, subY + 10);

const footerY = frameBottom - 10;
doc.setFontSize(9);
doc.text("Signed electronically by :", contentLeft, footerY);
const printedName = data.doctor.companyName?.trim() ||
  `${data.doctor.prefix} ${data.doctor.firstName} ${data.doctor.lastName}`;
doc.setFont("helvetica", "italic");
doc.text(printedName, contentLeft + 42, footerY);
doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.text("PON :", splitX + 2, footerY);
doc.setFontSize(10);
doc.text(data.rx.pon, splitX + 14, footerY);

if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
const out = join(outputDir, "sample-greenwich-rx.pdf");
const buf = Buffer.from(doc.output("arraybuffer"));
writeFileSync(out, buf);
console.log(`Wrote ${out} (${buf.length} bytes)`);
