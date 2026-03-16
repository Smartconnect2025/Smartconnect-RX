import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      type,
      vital_type,
      target_value,
      timeframe,
      description,
      start_date,
      end_date,
      user_id,
    } = body;

    // Validate vital_type is supported
    if (!["weight", "blood_pressure"].includes(vital_type)) {
      return NextResponse.json(
        { error: "Only weight and blood_pressure vitals are supported" },
        { status: 400 },
      );
    }

    // Check if this is a provider creating a goal for a patient
    const isProviderCreating = user_id && user_id !== user.id;

    if (isProviderCreating) {
      // Verify the user is a provider
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!userRole || userRole.role !== "provider") {
        return NextResponse.json(
          { error: "Only providers can create goals for patients" },
          { status: 403 },
        );
      }

      // Verify the target user exists as a patient
      const { data: patient } = await supabase
        .from("patients")
        .select("id")
        .eq("user_id", user_id)
        .single();

      if (!patient) {
        return NextResponse.json(
          { error: "Patient not found" },
          { status: 404 },
        );
      }
    }

    // Ensure provider goals can only be created by providers
    if (type === "provider") {
      // Check if the current user is a provider
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!userRole || userRole.role !== "provider") {
        return NextResponse.json(
          { error: "Only providers can create provider goals" },
          { status: 403 },
        );
      }
    }

    const targetUserId = user_id || user.id;

    const goalData = {
      user_id: targetUserId,
      metric: vital_type, // Store vital type as metric
      description: description || "",
      target_value: target_value.toString(),
      current_value: "0",
      unit: vital_type === "weight" ? "lbs" : "mmHg",
      type: type || "patient",
      category: "vital_signs",
      custom_goal: null,
      progress: 0,
      status: "not-started",
      tracking_source: "manual",
      timeframe,
      start_date: start_date
        ? new Date(start_date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      end_date: end_date
        ? new Date(end_date).toISOString().split("T")[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0],
    };

    const { data: result, error } = await supabase
      .from("goals")
      .insert(goalData)
      .select()
      .single();

    if (error) {
      console.error("Failed to create goal:", error);
      return NextResponse.json(
        { error: "Failed to create goal" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("Failed to create vitals goal:", error);
    return NextResponse.json(
      {
        error: "Failed to create goal",
        success: false,
      },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const targetUserId = searchParams.get("user_id") || user.id;

    // If requesting another user's goals, verify permission
    if (targetUserId !== user.id) {
      const { data: userRole } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();

      if (!userRole || userRole.role !== "provider") {
        return NextResponse.json(
          { error: "Unauthorized to view other users' goals" },
          { status: 403 },
        );
      }
    }

    // Get vitals-based goals only
    const { data: vitalsGoals, error } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", targetUserId)
      .eq("category", "vital_signs")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch goals:", error);
      return NextResponse.json(
        { error: "Failed to fetch goals" },
        { status: 500 },
      );
    }

    // Transform to match VitalsGoal interface
    const transformedGoals =
      vitalsGoals?.map((goal: Record<string, unknown>) => ({
        id: goal.id as string,
        user_id: goal.user_id as string,
        type: goal.type as "patient" | "provider",
        vital_type: goal.metric as "weight" | "blood_pressure",
        target_value: goal.target_value as string,
        timeframe: goal.timeframe as "daily" | "weekly" | "monthly" | "custom",
        start_date: new Date(goal.start_date as string),
        end_date: new Date(goal.end_date as string),
        description: goal.description as string,
        status: goal.status as
          | "on-track"
          | "behind"
          | "achieved"
          | "not-started",
        created_by: goal.type === "provider" ? "provider" : undefined,
        created_at: new Date(goal.created_at as string),
        last_updated: new Date(goal.last_updated as string),
      })) || [];

    return NextResponse.json({
      data: transformedGoals,
      success: true,
    });
  } catch (error) {
    console.error("Failed to fetch vitals goals:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch goals",
        success: false,
      },
      { status: 500 },
    );
  }
}
