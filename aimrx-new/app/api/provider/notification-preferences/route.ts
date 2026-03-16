import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { createAdminClient } from "@core/database/client";

const DEFAULT_PREFERENCES = {
  notify_submitted: true,
  notify_billing: false,
  notify_processing: true,
  notify_shipped: true,
  notify_delivered: true,
};

export async function GET() {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      );
    }

    const adminClient = createAdminClient();
    const { data: setting, error: settingError } = await adminClient
      .from("app_settings")
      .select("value")
      .eq("key", `notification_prefs_${provider.id}`)
      .single();

    if (settingError && settingError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to load preferences" },
        { status: 500 },
      );
    }

    let preferences = DEFAULT_PREFERENCES;
    if (setting?.value) {
      try {
        preferences = { ...DEFAULT_PREFERENCES, ...JSON.parse(setting.value) };
      } catch {
        preferences = DEFAULT_PREFERENCES;
      }
    }

    return NextResponse.json({ success: true, preferences });
  } catch {
    return NextResponse.json(
      { error: "Failed to load preferences" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Provider not found" },
        { status: 404 },
      );
    }

    const body = await request.json();
    const preferences = {
      notify_submitted:
        body.notify_submitted ?? DEFAULT_PREFERENCES.notify_submitted,
      notify_billing:
        body.notify_billing ?? DEFAULT_PREFERENCES.notify_billing,
      notify_processing:
        body.notify_processing ?? DEFAULT_PREFERENCES.notify_processing,
      notify_shipped:
        body.notify_shipped ?? DEFAULT_PREFERENCES.notify_shipped,
      notify_delivered:
        body.notify_delivered ?? DEFAULT_PREFERENCES.notify_delivered,
    };

    const adminClient = createAdminClient();
    const key = `notification_prefs_${provider.id}`;

    const { data: existing, error: checkError } = await adminClient
      .from("app_settings")
      .select("id")
      .eq("key", key)
      .single();

    if (checkError && checkError.code !== "PGRST116") {
      return NextResponse.json(
        { error: "Failed to save preferences" },
        { status: 500 },
      );
    }

    if (existing) {
      const { error: updateError } = await adminClient
        .from("app_settings")
        .update({
          value: JSON.stringify(preferences),
          updated_at: new Date().toISOString(),
        })
        .eq("key", key);

      if (updateError) {
        return NextResponse.json(
          { error: "Failed to save preferences" },
          { status: 500 },
        );
      }
    } else {
      const { error: insertError } = await adminClient
        .from("app_settings")
        .insert({
          key,
          value: JSON.stringify(preferences),
          description: `Notification preferences for provider ${provider.id}`,
          category: "notifications",
        });

      if (insertError) {
        return NextResponse.json(
          { error: "Failed to save preferences" },
          { status: 500 },
        );
      }
    }

    return NextResponse.json({ success: true, preferences });
  } catch {
    return NextResponse.json(
      { error: "Failed to save preferences" },
      { status: 500 },
    );
  }
}
