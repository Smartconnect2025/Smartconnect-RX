import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@core/database/client";
import { getUser } from "@/core/auth/get-user";
import sgMail from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || "support@aimrx.com";
const FROM_NAME = process.env.SENDGRID_FROM_NAME || "AIM RX Portal";
const DEFAULT_NOTIFICATION_EMAILS = process.env.PHARMACY_NOTIFICATION_EMAILS || "";

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface AddressData {
  street?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
}

interface UpdateAddressRequest {
  address: AddressData;
  saveToPatient?: boolean;
}

function buildRecipientList(pharmacyContactEmail?: string | null, pharmacyNotificationEmails?: string | null): string[] {
  const recipients: string[] = [];

  if (DEFAULT_NOTIFICATION_EMAILS) {
    const defaults = DEFAULT_NOTIFICATION_EMAILS.split(",").map(e => e.trim()).filter(e => e && e.includes("@"));
    for (const email of defaults) {
      if (!recipients.includes(email)) recipients.push(email);
    }
  }

  if (pharmacyContactEmail) {
    const email = pharmacyContactEmail.trim();
    if (email && email.includes("@") && !recipients.includes(email)) recipients.push(email);
  }

  if (pharmacyNotificationEmails) {
    const extras = pharmacyNotificationEmails.split(",").map(e => e.trim()).filter(e => e && e.includes("@"));
    for (const email of extras) {
      if (!recipients.includes(email)) recipients.push(email);
    }
  }

  return recipients;
}

function buildEmailHtml(params: {
  orderId: string;
  patientName: string;
  medication: string;
  addressLine: string;
  addressParts: AddressData;
  updatedBy: string;
  updatedAt: string;
  previousAddress?: string;
}): string {
  const { orderId, patientName, medication, addressParts, updatedBy, updatedAt, previousAddress } = params;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <div style="max-width: 620px; margin: 0 auto; padding: 24px 16px;">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #00AEEF 0%, #0088cc 100%); padding: 28px 32px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700; letter-spacing: -0.3px;">
        Shipping Address Update
      </h1>
      <p style="margin: 8px 0 0; color: rgba(255,255,255,0.85); font-size: 14px;">
        Action Required — Please update your records
      </p>
    </div>

    <!-- Body -->
    <div style="background: #ffffff; padding: 32px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
      
      <p style="margin: 0 0 20px; color: #374151; font-size: 15px; line-height: 1.6;">
        A shipping address has been updated for a prescription order. Please ensure the updated address is used for fulfillment and shipping.
      </p>

      <!-- Order Details -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 14px; color: #1e293b; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
          Order Details
        </h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 130px; vertical-align: top;">Order / Queue ID</td>
            <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${orderId}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 13px; vertical-align: top;">Patient Name</td>
            <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${patientName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #64748b; font-size: 13px; vertical-align: top;">Medication</td>
            <td style="padding: 8px 0; color: #0f172a; font-size: 14px; font-weight: 500;">${medication}</td>
          </tr>
        </table>
      </div>

      <!-- New Address -->
      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 10px; color: #065f46; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
          ✅ Updated Shipping Address
        </h3>
        <p style="margin: 0; color: #064e3b; font-size: 16px; font-weight: 600; line-height: 1.5;">
          ${addressParts.street || ""}<br>
          ${addressParts.city || ""}${addressParts.state ? `, ${addressParts.state}` : ""} ${addressParts.zipCode || ""}<br>
          ${addressParts.country && addressParts.country !== "US" ? addressParts.country : "United States"}
        </p>
      </div>

      ${previousAddress ? `
      <!-- Previous Address -->
      <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
        <h3 style="margin: 0 0 8px; color: #991b1b; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">
          Previous Address
        </h3>
        <p style="margin: 0; color: #7f1d1d; font-size: 14px; text-decoration: line-through;">
          ${previousAddress}
        </p>
      </div>
      ` : ""}

      <!-- Updated By -->
      <div style="border-top: 1px solid #e5e7eb; padding-top: 16px; margin-top: 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-size: 13px; width: 130px;">Updated By</td>
            <td style="padding: 4px 0; color: #374151; font-size: 13px; font-weight: 500;">${updatedBy}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; color: #64748b; font-size: 13px;">Date &amp; Time</td>
            <td style="padding: 4px 0; color: #374151; font-size: 13px;">${updatedAt}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 20px 16px 0;">
      <p style="margin: 0 0 4px; color: #9ca3af; font-size: 12px;">
        This is an automated notification from the AIM RX Portal.
      </p>
      <p style="margin: 0; color: #9ca3af; font-size: 12px;">
        Questions? Contact <a href="mailto:support@aimrx.com" style="color: #00AEEF; text-decoration: none;">support@aimrx.com</a> or call (769) 304-1830
      </p>
      <p style="margin: 12px 0 0; color: #d1d5db; font-size: 11px;">
        &copy; ${new Date().getFullYear()} AIM RX &mdash; All rights reserved
      </p>
    </div>
  </div>
</body>
</html>`;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { user, userRole } = await getUser();
    if (!user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const { id: prescriptionId } = await params;
    const body: UpdateAddressRequest = await request.json();

    if (!body.address || (!body.address.street && !body.address.city)) {
      return NextResponse.json(
        { success: false, error: "Address is required (at least street and city)" },
        { status: 400 },
      );
    }

    const supabaseAdmin = createAdminClient();

    const { data: prescription, error } = await supabaseAdmin
      .from("prescriptions")
      .select(`
        id, prescriber_id, status, queue_id, medication, patient_id, pharmacy_id,
        custom_address, has_custom_address,
        patients (first_name, last_name, email, physical_address)
      `)
      .eq("id", prescriptionId)
      .single();

    if (error || !prescription) {
      return NextResponse.json(
        { success: false, error: "Prescription not found" },
        { status: 404 },
      );
    }

    const isAdmin = userRole === "admin" || userRole === "super_admin";
    if (!isAdmin && prescription.prescriber_id !== user.id) {
      return NextResponse.json(
        { success: false, error: "Forbidden" },
        { status: 403 },
      );
    }

    const oldAddr = prescription.has_custom_address && prescription.custom_address
      ? prescription.custom_address as AddressData
      : (Array.isArray(prescription.patients) ? prescription.patients[0] : prescription.patients)?.physical_address as AddressData | null;
    const previousAddress = oldAddr && (oldAddr.street || oldAddr.city)
      ? [oldAddr.street, oldAddr.city, oldAddr.state, oldAddr.zipCode].filter(Boolean).join(", ")
      : null;

    const { error: updateError } = await supabaseAdmin
      .from("prescriptions")
      .update({
        has_custom_address: true,
        custom_address: body.address,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prescriptionId);

    if (updateError) {
      console.error("Error updating prescription address:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update address" },
        { status: 500 },
      );
    }

    if (body.saveToPatient && prescription.patient_id) {
      const { error: patientErr } = await supabaseAdmin
        .from("patients")
        .update({ physical_address: body.address })
        .eq("id", prescription.patient_id);
      if (patientErr) {
        console.error("Warning: Failed to update patient address:", patientErr);
      }
    }

    let pharmacyNotified = false;

    let pharmacyContactEmail: string | null = null;
    let pharmacyNotificationEmails: string | null = null;
    let pharmacyName = "Pharmacy";

    if (prescription.pharmacy_id) {
      const { data: pharmacy } = await supabaseAdmin
        .from("pharmacies")
        .select("name, contact_email, notification_emails")
        .eq("id", prescription.pharmacy_id)
        .single();

      if (pharmacy) {
        pharmacyName = pharmacy.name || "Pharmacy";
        pharmacyContactEmail = pharmacy.contact_email;
        pharmacyNotificationEmails = pharmacy.notification_emails;
      }
    }

    const allRecipients = buildRecipientList(pharmacyContactEmail, pharmacyNotificationEmails);

    if (allRecipients.length > 0 && SENDGRID_API_KEY) {
      const patient = Array.isArray(prescription.patients) ? prescription.patients[0] : prescription.patients;
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : "Unknown Patient";

      let updatedByName = "AIM RX System";
      if (isAdmin) {
        updatedByName = "AIM RX Admin";
      } else {
        const { data: provider } = await supabaseAdmin
          .from("providers")
          .select("prefix, first_name, last_name")
          .eq("user_id", user.id)
          .single();
        if (provider) {
          updatedByName = `${(provider as { prefix?: string | null }).prefix || "Dr."} ${provider.first_name} ${provider.last_name}`;
        }
      }

      const addressLine = [body.address.street, body.address.city, body.address.state, body.address.zipCode].filter(Boolean).join(", ");
      const orderId = prescription.queue_id || prescriptionId.slice(0, 8).toUpperCase();
      const updatedAt = new Date().toLocaleString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "America/Chicago",
      }) + " CST";

      try {
        await sgMail.send({
          to: allRecipients,
          from: { email: FROM_EMAIL, name: FROM_NAME },
          subject: `Shipping Address Update — Order ${orderId} — ${patientName}`,
          html: buildEmailHtml({
            orderId,
            patientName,
            medication: prescription.medication,
            addressLine,
            addressParts: body.address,
            updatedBy: updatedByName,
            updatedAt,
            previousAddress: previousAddress || undefined,
          }),
        });
        pharmacyNotified = true;
        console.log(`✅ [update-address] Notification sent to ${allRecipients.join(", ")} for prescription ${prescriptionId}`);

        await supabaseAdmin.from("system_logs").insert({
          event_type: "address_update_notification",
          details: `Address updated|${patientName}|${prescription.medication}|${orderId}|Sent to: ${allRecipients.join(", ")}|New: ${addressLine}${previousAddress ? `|Old: ${previousAddress}` : ""}|By: ${updatedByName}`,
          created_at: new Date().toISOString(),
        });
      } catch (emailErr) {
        console.error("⚠️ [update-address] Failed to send notification email:", emailErr);
      }
    } else if (allRecipients.length === 0) {
      console.warn(`⚠️ [update-address] No notification recipients configured for prescription ${prescriptionId}`);
    }

    return NextResponse.json({
      success: true,
      pharmacyNotified,
      notifiedRecipients: pharmacyNotified ? allRecipients : [],
      message: pharmacyNotified
        ? "Address updated and pharmacy has been notified"
        : "Address updated",
    });
  } catch (error) {
    console.error("Unexpected error updating prescription address:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
