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
    const { goal_id, current_value, notes } = body;

    if (!goal_id || current_value === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: goal_id and current_value" },
        { status: 400 },
      );
    }

    // Verify the goal belongs to the user
    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("id, user_id, target_value")
      .eq("id", goal_id)
      .eq("user_id", user.id)
      .single();

    if (goalError || !goal) {
      return NextResponse.json(
        { error: "Goal not found or unauthorized" },
        { status: 404 },
      );
    }

    // Create goal progress entry
    const { data: progressEntry, error: progressError } = await supabase
      .from("goal_progress")
      .insert({
        goal_id: goal_id,
        current: parseFloat(current_value),
        date: new Date().toISOString().split("T")[0],
        notes: notes || null,
      })
      .select("*")
      .single();

    if (progressError || !progressEntry) {
      console.error("Failed to create goal progress:", progressError);
      return NextResponse.json(
        { error: "Failed to create goal progress" },
        { status: 500 },
      );
    }

    // Update the goal's current_value and progress
    const targetValue = parseFloat(goal.target_value || "0");
    const progressPercentage =
      targetValue > 0
        ? Math.min(100, (parseFloat(current_value) / targetValue) * 100)
        : 0;

    const { error: updateError } = await supabase
      .from("goals")
      .update({
        current_value: current_value.toString(),
        progress: progressPercentage,
        last_updated: new Date().toISOString(),
      })
      .eq("id", goal_id);

    if (updateError) {
      console.error("Failed to update goal:", updateError);
      // Don't fail the request, just log the error
    }

    return NextResponse.json({
      data: progressEntry,
      success: true,
    });
  } catch (error) {
    console.error("Failed to create goal progress:", error);
    return NextResponse.json(
      {
        error: "Failed to create goal progress",
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
    const goal_id = searchParams.get("goal_id");
    const days = parseInt(searchParams.get("days") || "30");

    if (!goal_id) {
      return NextResponse.json(
        { error: "Missing required parameter: goal_id" },
        { status: 400 },
      );
    }

    // Verify the goal belongs to the user
    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("id, user_id")
      .eq("id", goal_id)
      .eq("user_id", user.id)
      .single();

    if (goalError || !goal) {
      return NextResponse.json(
        { error: "Goal not found or unauthorized" },
        { status: 404 },
      );
    }

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days);

    // Get goal progress entries
    const { data: progressEntries, error } = await supabase
      .from("goal_progress")
      .select("*")
      .eq("goal_id", goal_id)
      .gte("date", startDate.toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (error) {
      console.error("Failed to fetch goal progress:", error);
      return NextResponse.json(
        { error: "Failed to fetch goal progress" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: progressEntries || [],
      success: true,
    });
  } catch (error) {
    console.error("Failed to fetch goal progress:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch goal progress",
        success: false,
      },
      { status: 500 },
    );
  }
}
