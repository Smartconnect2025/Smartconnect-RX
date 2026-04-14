import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@core/auth";
import sgMail from "@sendgrid/mail";
import {
  emailWrapper,
  emailHeader,
  emailFooterSimple,
  detailsCard,
  detailRow,
  GRADIENTS,
  APP_NAME,
} from "@core/services/email/emailTemplates";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "SmartConnect RX";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

function escHtml(str: string | undefined | null): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function formatAddress(addr: Record<string, string | undefined> | null): string {
  if (!addr) return "Not provided";
  const parts = [addr.street, addr.city, addr.state, addr.zipCode || addr.zip].filter(Boolean);
  return parts.join(", ") || "Not provided";
}

function formatTimestampCST(): string {
  return new Date().toLocaleString("en-US", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }) + " CST";
}

function addressUpdateEmailHtml(options: {
  patientName: string;
  medication: string;
  queueId: string;
  newAddress: string;
  previousAddress: string;
  updatedBy: string;
  updatedAt: string;
}): string {
  return emailWrapper(
    emailHeader({
      gradient: GRADIENTS.navyBlue,
      heading: "Shipping Address Updated",
      subtext: `Order ${options.queueId}`,
    }) +
    `<tr>
      <td style="padding: 36px 40px;">
        <p style="font-size: 15px; color: #334155; margin: 0 0 20px;">
          A shipping address has been updated for the following order. Please use the new address for fulfillment.
        </p>
        ${detailsCard("Order Details",
          detailRow("Patient", `<strong>${options.patientName}</strong>`) +
          detailRow("Medication", options.medication) +
          detailRow("Queue ID", `<code style="font-family: monospace; font-size: 14px;">${options.queueId}</code>`)
        )}
        <div style="background-color: #f0fdf4; border: 2px solid #86efac; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <p style="margin: 0 0 8px; font-size: 12px; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">New Shipping Address</p>
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #14532d;">${options.newAddress}</p>
        </div>
        ${options.previousAddress !== "Not provided" ? `
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 0 0 8px; font-size: 12px; color: #991b1b; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 700;">Previous Address</p>
          <p style="margin: 0; font-size: 14px; color: #7f1d1d; text-decoration: line-through;">${options.previousAddress}</p>
        </div>` : ""}
        <div style="background-color: #f8fafc; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 20px 0;">
          <p style="margin: 0 0 4px; font-size: 13px; color: #475569;"><strong>Updated by:</strong> ${options.updatedBy}</p>
          <p style="margin: 0; font-size: 13px; color: #475569;"><strong>Updated at:</strong> ${options.updatedAt}</p>
        </div>
      </td>
    </tr>` +
    emailFooterSimple()
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    if (!userRole || !["provider", "admin", "super_admin"].includes(userRole)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const { custom_address } = body;

    if (!custom_address || !custom_address.street || !custom_address.city || !custom_address.state || !(custom_address.zipCode || custom_address.zip)) {
      return NextResponse.json({ error: "Complete address required (street, city, state, zip)" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: prescription, error: findErr } = await supabase
      .from("prescriptions")
      .select("id, queue_id, medication, custom_address, has_custom_address, pharmacy_id, patients(first_name, last_name)")
      .eq("id", id)
      .single();

    if (findErr || !prescription) {
      return NextResponse.json({ error: "Prescription not found" }, { status: 404 });
    }

    const previousAddress = prescription.custom_address as Record<string, string> | null;

    const { error: updateErr } = await supabase
      .from("prescriptions")
      .update({
        custom_address,
        has_custom_address: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("[update-address] Update failed:", updateErr.message);
      return NextResponse.json({ error: "Failed to update address" }, { status: 500 });
    }

    const patient = prescription.patients as { first_name?: string; last_name?: string } | null;
    const patientName = patient ? `${patient.first_name || ""} ${patient.last_name || ""}`.trim() : "Patient";

    let updaterName = "System";
    if (userRole === "provider") {
      const { data: provider } = await supabase
        .from("providers")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .single();
      if (provider) {
        updaterName = `Dr. ${provider.first_name || ""} ${provider.last_name || ""}`.trim();
      }
    } else {
      const { data: authUser } = await supabase.auth.admin.getUserById(user.id);
      updaterName = authUser?.user?.user_metadata?.full_name
        || `${authUser?.user?.user_metadata?.first_name || ""} ${authUser?.user?.user_metadata?.last_name || ""}`.trim()
        || "Admin";
    }

    await supabase.from("system_logs").insert({
      user_id: user.id,
      user_email: user.email || "",
      user_name: updaterName,
      action: "ADDRESS_UPDATED",
      details: `Shipping address updated for prescription ${prescription.queue_id || id}. Patient: ${patientName}`,
      queue_id: prescription.queue_id,
      status: "success",
    });

    if (SENDGRID_API_KEY && prescription.pharmacy_id) {
      try {
        const { data: pharmacy } = await supabase
          .from("pharmacies")
          .select("name, email")
          .eq("id", prescription.pharmacy_id)
          .single();

        const recipientEmails: string[] = [];
        if (pharmacy?.email) recipientEmails.push(pharmacy.email);

        const fallbackEmails = process.env.PHARMACY_NOTIFICATION_EMAILS;
        if (fallbackEmails) {
          fallbackEmails.split(",").map(e => e.trim()).filter(Boolean).forEach(e => {
            if (!recipientEmails.includes(e)) recipientEmails.push(e);
          });
        }

        if (recipientEmails.length > 0) {
          const queueId = prescription.queue_id || id;
          const htmlContent = addressUpdateEmailHtml({
            patientName: escHtml(patientName),
            medication: escHtml(prescription.medication || "Prescription"),
            queueId: escHtml(queueId),
            newAddress: escHtml(formatAddress(custom_address)),
            previousAddress: escHtml(formatAddress(previousAddress)),
            updatedBy: escHtml(updaterName),
            updatedAt: formatTimestampCST(),
          });

          const msg = {
            to: recipientEmails,
            from: { email: FROM_EMAIL, name: FROM_NAME },
            subject: `Shipping Address Update — Order ${queueId} — ${patientName}`,
            html: htmlContent,
          };

          await sgMail.send(msg);
          console.log(`[update-address] Pharmacy notification sent to ${recipientEmails.join(", ")} for order ${queueId}`);
        }
      } catch (emailErr) {
        console.error("[update-address] Pharmacy notification email failed:", emailErr);
      }
    }

    return NextResponse.json({ success: true, message: "Address updated successfully" });
  } catch (error) {
    console.error("[update-address] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
