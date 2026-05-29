import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Get the goal to check ownership
    const { data: existingGoal, error: fetchError } = await supabase
      .from("goals")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Check if user can update this goal
    const canUpdate =
      existingGoal.user_id === user.id ||
      (existingGoal.type === "provider" &&
        (await isProvider(user.id, supabase)));

    if (!canUpdate) {
      return NextResponse.json(
        { error: "Unauthorized to update this goal" },
        { status: 403 },
      );
    }

    // Update the goal
    const updates: Record<string, unknown> = {};
    if (body.target_value) updates.target_value = body.target_value.toString();
    if (body.timeframe) updates.timeframe = body.timeframe;
    if (body.description !== undefined) updates.description = body.description;
    if (body.start_date)
      updates.start_date = new Date(body.start_date)
        .toISOString()
        .split("T")[0];
    if (body.end_date)
      updates.end_date = new Date(body.end_date).toISOString().split("T")[0];
    if (body.status) updates.status = body.status;

    updates.last_updated = new Date().toISOString();

    const { data: result, error } = await supabase
      .from("goals")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("Failed to update goal:", error);
      return NextResponse.json(
        { error: "Failed to update goal" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      data: result,
      success: true,
    });
  } catch (error) {
    console.error("Failed to update goal:", error);
    return NextResponse.json(
      {
        error: "Failed to update goal",
        success: false,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Get the goal to check ownership
    const { data: existingGoal, error: fetchError } = await supabase
      .from("goals")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingGoal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // Check if user can delete this goal
    const canDelete =
      existingGoal.user_id === user.id ||
      (existingGoal.type === "provider" &&
        (await isProvider(user.id, supabase)));

    if (!canDelete) {
      return NextResponse.json(
        { error: "Unauthorized to delete this goal" },
        { status: 403 },
      );
    }

    const { error } = await supabase.from("goals").delete().eq("id", id);

    if (error) {
      console.error("Failed to delete goal:", error);
      return NextResponse.json(
        { error: "Failed to delete goal" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error("Failed to delete goal:", error);
    return NextResponse.json(
      {
        error: "Failed to delete goal",
        success: false,
      },
      { status: 500 },
    );
  }
}

async function isProvider(
  userId: string,
  supabase: Awaited<ReturnType<typeof createServerClient>>,
): Promise<boolean> {
  const { data: userRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .single();

  return userRole?.role === "provider";
}
