/**
 * Pay-on-Terms Email Settings
 *
 * Manages the recipient list and auto-send schedule for the
 * Payment-on-Terms reconciliation report. Admin/super_admin only.
 */

import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@core/auth";
import { createServerClient } from "@core/supabase/server";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALLOWED_FREQUENCIES = [
  "off",
  "daily",
  "weekly_monday",
  "weekly_friday",
  "monthly_first",
] as const;

async function requireAdmin() {
  const { user, userRole } = await getUser();
  if (!user) return { error: "Authentication required", status: 401 } as const;
  if (!userRole || !["admin", "super_admin"].includes(userRole))
    return { error: "Admin access required", status: 403 } as const;
  return { user, userRole } as const;
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const supabase = await createServerClient();
  const [{ data: recipients }, { data: schedule }] = await Promise.all([
    supabase
      .from("pay_on_terms_email_recipients")
      .select("id, name, email, enabled, created_at")
      .order("created_at", { ascending: true }),
    supabase
      .from("pay_on_terms_email_schedule")
      .select(
        "enabled, frequency, send_hour_utc, last_sent_at, last_window_end, last_status, updated_at",
      )
      .eq("id", 1)
      .maybeSingle(),
  ]);

  return NextResponse.json({
    recipients: recipients || [],
    schedule:
      schedule || {
        enabled: false,
        frequency: "off",
        send_hour_utc: 14,
        last_sent_at: null,
        last_window_end: null,
        last_status: null,
        updated_at: null,
      },
  });
}

interface PostBody {
  action:
    | "add-recipient"
    | "remove-recipient"
    | "toggle-recipient"
    | "update-schedule";
  id?: string;
  name?: string;
  email?: string;
  enabled?: boolean;
  frequency?: string;
  sendHourUtc?: number;
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = (await req.json().catch(() => ({}))) as PostBody;
  const supabase = await createServerClient();

  switch (body.action) {
    case "add-recipient": {
      const name = (body.name || "").trim();
      const email = (body.email || "").trim().toLowerCase();
      if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
      if (!EMAIL_RE.test(email))
        return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
      const { data, error } = await supabase
        .from("pay_on_terms_email_recipients")
        .insert({ name, email, enabled: true })
        .select("id, name, email, enabled, created_at")
        .single();
      if (error) {
        if (String(error.message).toLowerCase().includes("duplicate"))
          return NextResponse.json(
            { error: "A recipient with that email already exists" },
            { status: 409 },
          );
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      return NextResponse.json({ recipient: data });
    }
    case "remove-recipient": {
      if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const { error } = await supabase
        .from("pay_on_terms_email_recipients")
        .delete()
        .eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ removed: true });
    }
    case "toggle-recipient": {
      if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
      const { error } = await supabase
        .from("pay_on_terms_email_recipients")
        .update({ enabled: !!body.enabled })
        .eq("id", body.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ updated: true });
    }
    case "update-schedule": {
      const frequency = body.frequency || "off";
      if (!ALLOWED_FREQUENCIES.includes(frequency as (typeof ALLOWED_FREQUENCIES)[number]))
        return NextResponse.json({ error: "Invalid frequency" }, { status: 400 });
      const sendHourUtc = Number.isFinite(body.sendHourUtc) ? Number(body.sendHourUtc) : 14;
      if (sendHourUtc < 0 || sendHourUtc > 23)
        return NextResponse.json({ error: "send_hour_utc out of range" }, { status: 400 });
      const enabled = !!body.enabled && frequency !== "off";
      const patch = {
        enabled,
        frequency,
        send_hour_utc: sendHourUtc,
        updated_at: new Date().toISOString(),
      };
      const { data: updRows, error } = await supabase
        .from("pay_on_terms_email_schedule")
        .update(patch)
        .eq("id", 1)
        .select("id");
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      // If the singleton row is missing, recreate it so the schedule actually persists.
      if (!updRows || updRows.length === 0) {
        const { error: insErr } = await supabase
          .from("pay_on_terms_email_schedule")
          .insert({ id: 1, ...patch });
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
      }
      return NextResponse.json({ updated: true });
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
