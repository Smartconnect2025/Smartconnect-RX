"use client";

const STEPS = [
  { label: "Order Created", description: "Saved in system" },
  { label: "Payment", description: "Awaiting payment" },
  { label: "Sent to Pharmacy", description: "Submitted after payment" },
  { label: "Processing", description: "Rx being filled" },
  { label: "Approved", description: "Pharmacist OK" },
  { label: "Shipped", description: "With carrier" },
  { label: "Delivered", description: "Received" },
];

function getStepIndex(status: string, billingStatus?: string): number {
  const normalized = status.trim().toLowerCase().replace(/[\s_-]/g, "");
  const billing = billingStatus?.trim().toLowerCase() || "";

  if (normalized === "delivered" || normalized === "completed") return 6;
  if (normalized === "shipped" || normalized === "pickedup") return 5;
  if (normalized === "approved" || normalized === "providerapproved") return 4;
  if (
    normalized === "packed" ||
    normalized === "processing" ||
    normalized === "pharmacyprocessing" ||
    normalized === "compounding"
  )
    return 3;
  if (normalized === "submitted" && billing !== "pending") return 2;
  if (
    normalized === "paymentreceived" ||
    normalized === "billed" ||
    billing === "paid" ||
    billing === "billed" ||
    billing === "cash"
  )
    return 2;
  if (
    normalized === "billing" ||
    normalized === "paymentpending" ||
    normalized === "pendingpayment" ||
    billing === "pending"
  )
    return 1;
  return 0;
}

function formatCopay(copay?: string): string {
  if (!copay) return "";
  const num = parseFloat(copay);
  if (isNaN(num)) return copay;
  return num.toFixed(2);
}

interface PrintProgressTrackerProps {
  status: string;
  trackingNumber?: string;
  pharmacyName?: string;
  billingStatus?: string;
  patientCopay?: string;
  trackingCarrier?: string;
}

export function PrintProgressTracker({
  status,
  trackingNumber,
  pharmacyName,
  billingStatus,
  patientCopay,
  trackingCarrier,
}: PrintProgressTrackerProps) {
  const currentStepIndex = getStepIndex(status, billingStatus);
  const formattedCopay = formatCopay(patientCopay);
  const billing = billingStatus?.trim().toLowerCase() || "";
  const isPaid =
    billing === "paid" || billing === "billed" || billing === "cash";
  const isPending = billing === "pending";

  return (
    <div
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "8px",
        padding: "12px 16px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
        }}
      >
        <span
          style={{ fontWeight: 600, fontSize: "13px", color: "#111827" }}
        >
          Order Progress
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {(isPaid || isPending) && (
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "9999px",
                border: `1px solid ${isPaid ? "#a7f3d0" : "#fde68a"}`,
                backgroundColor: isPaid ? "#f0fdf4" : "#fffbeb",
                color: isPaid ? "#047857" : "#b45309",
              }}
            >
              {isPaid
                ? formattedCopay
                  ? `Paid · $${formattedCopay}`
                  : "Payment Confirmed"
                : formattedCopay
                  ? `Due · $${formattedCopay}`
                  : "Payment Pending"}
            </span>
          )}
          {pharmacyName && (
            <span
              style={{
                fontSize: "11px",
                color: "#6b7280",
                backgroundColor: "#f3f4f6",
                padding: "2px 8px",
                borderRadius: "9999px",
              }}
            >
              {pharmacyName}
            </span>
          )}
        </div>
      </div>

      {currentStepIndex < 2 && isPending && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            backgroundColor: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: "6px",
            padding: "6px 10px",
            marginBottom: "8px",
            fontSize: "11px",
            fontWeight: 500,
            color: "#92400e",
          }}
        >
          ⚠ Order will NOT be sent to the pharmacy until payment is received.
        </div>
      )}

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "11px",
        }}
      >
        <tbody>
          {STEPS.map((step, index) => {
            const isDone = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;

            let indicator: string;
            let indicatorColor: string;
            let labelColor: string;
            let labelWeight: number;

            if (isDone) {
              indicator = "✓";
              indicatorColor = "#10B981";
              labelColor = "#10B981";
              labelWeight = 600;
            } else if (isCurrent) {
              indicator = "▸";
              indicatorColor = "#1E3A8A";
              labelColor = "#1E3A8A";
              labelWeight = 600;
            } else {
              indicator = "○";
              indicatorColor = "#d1d5db";
              labelColor = "#9CA3AF";
              labelWeight = 400;
            }

            return (
              <tr key={index}>
                <td
                  style={{
                    width: "18px",
                    padding: "3px 6px 3px 0",
                    color: indicatorColor,
                    fontWeight: 700,
                    fontSize: isDone ? "13px" : "11px",
                    verticalAlign: "middle",
                  }}
                >
                  {indicator}
                </td>
                <td
                  style={{
                    padding: "3px 0",
                    fontWeight: labelWeight,
                    color: labelColor,
                    verticalAlign: "middle",
                  }}
                >
                  {step.label}
                  {isCurrent && (
                    <span
                      style={{
                        fontSize: "9px",
                        marginLeft: "6px",
                        color: "#6b7280",
                      }}
                    >
                      ← Current
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {trackingNumber && (
        <div
          style={{
            marginTop: "8px",
            backgroundColor: "#eff6ff",
            border: "1px solid #bfdbfe",
            borderRadius: "6px",
            padding: "6px 10px",
            fontSize: "11px",
          }}
        >
          <div
            style={{
              color: "#6b7280",
              textTransform: "uppercase",
              fontSize: "9px",
              fontWeight: 600,
              letterSpacing: "0.5px",
            }}
          >
            {trackingCarrier || "FedEx"} Tracking
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontWeight: 600,
              color: "#1E3A8A",
              fontSize: "12px",
            }}
          >
            {trackingNumber}
          </div>
        </div>
      )}
    </div>
  );
}
