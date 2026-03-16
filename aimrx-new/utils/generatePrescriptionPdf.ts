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
    firstName: string;
    lastName: string;
    npi: string;
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    phone?: string;
  };
  rx: {
    drugName: string;
    qty: string;
    dateWritten: string;
    refills: string;
    ndc?: string;
    instructions?: string;
    notes?: string;
    daw: string;
  };
  signatureUrl?: string;
}

function resolveSignatureBase64(signatureUrl: string): string | null {
  try {
    // Already a data URL (data:image/...)
    if (signatureUrl.startsWith("data:")) {
      return signatureUrl;
    }
    // Raw base64 string — wrap it as a PNG data URL
    return `data:image/png;base64,${signatureUrl}`;
  } catch {
    return null;
  }
}

export async function generatePrescriptionPdf(
  data: PrescriptionPdfData,
): Promise<{ blob: Blob; filename: string }> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;

  // --- Header ---
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PRESCRIPTION", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // --- Doctor Info ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Prescriber", margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Dr. ${data.doctor.firstName} ${data.doctor.lastName}`,
    margin,
    y,
  );
  y += 5;
  doc.text(`NPI: ${data.doctor.npi}`, margin, y);
  y += 5;

  const doctorAddress = [
    data.doctor.street,
    data.doctor.city,
    data.doctor.state,
    data.doctor.zip,
  ]
    .filter(Boolean)
    .join(", ");
  if (doctorAddress) {
    doc.text(doctorAddress, margin, y);
    y += 5;
  }
  if (data.doctor.phone) {
    doc.text(`Phone: ${data.doctor.phone}`, margin, y);
    y += 5;
  }

  // Date written on the right
  doc.text(`Date: ${data.rx.dateWritten}`, pageWidth - margin, y - 5, {
    align: "right",
  });

  y += 5;
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // --- Patient Info ---
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Patient", margin, y);
  y += 6;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${data.patient.firstName} ${data.patient.lastName}`,
    margin,
    y,
  );
  y += 5;
  doc.text(`DOB: ${data.patient.dob}    Sex: ${data.patient.sex}`, margin, y);
  y += 5;

  const patientAddress = [
    data.patient.street,
    data.patient.city,
    data.patient.state,
    data.patient.zip,
  ]
    .filter(Boolean)
    .join(", ");
  if (patientAddress) {
    doc.text(patientAddress, margin, y);
    y += 5;
  }
  if (data.patient.phone) {
    doc.text(`Phone: ${data.patient.phone}`, margin, y);
    y += 5;
  }

  y += 5;
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  // --- Rx Details ---
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Rx", margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const rxFields: [string, string | undefined][] = [
    ["Drug Name", data.rx.drugName],
    ["NDC", data.rx.ndc],
    ["Quantity", data.rx.qty],
    ["Refills", data.rx.refills],
    ["Dispense as Written", data.rx.daw === "Y" ? "Yes" : "No"],
  ];

  for (const [label, value] of rxFields) {
    if (value) {
      doc.setFont("helvetica", "bold");
      doc.text(`${label}: `, margin, y);
      const labelWidth = doc.getTextWidth(`${label}: `);
      doc.setFont("helvetica", "normal");
      doc.text(value, margin + labelWidth, y);
      y += 6;
    }
  }

  // Instructions (SIG) - may be multiline
  if (data.rx.instructions) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("SIG:", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const sigLines = doc.splitTextToSize(
      data.rx.instructions,
      pageWidth - margin * 2,
    );
    doc.text(sigLines, margin, y);
    y += sigLines.length * 5 + 2;
  }

  // Notes
  if (data.rx.notes) {
    y += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Notes:", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(
      data.rx.notes,
      pageWidth - margin * 2,
    );
    doc.text(noteLines, margin, y);
    y += noteLines.length * 5 + 2;
  }

  // --- Signature ---
  y += 10;
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  y += 8;

  if (data.signatureUrl) {
    const sigBase64 = resolveSignatureBase64(data.signatureUrl);
    if (sigBase64) {
      try {
        doc.addImage(sigBase64, "PNG", margin, y, 60, 20);
        y += 22;
      } catch {
        doc.setFont("helvetica", "italic");
        doc.text("[Signature on file]", margin, y);
        y += 6;
      }
    } else {
      doc.setFont("helvetica", "italic");
      doc.text("[Signature on file]", margin, y);
      y += 6;
    }
  }

  doc.setFont("helvetica", "normal");
  doc.text(
    `Dr. ${data.doctor.firstName} ${data.doctor.lastName}`,
    margin,
    y,
  );
  y += 5;
  doc.line(margin, y, margin + 60, y);

  const blob = doc.output("blob");
  const filename = `prescription-${data.patient.lastName}-${Date.now()}.pdf`;

  return { blob, filename };
}
