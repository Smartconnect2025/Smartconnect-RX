import { NextResponse } from "next/server";
import { createServerClient } from "@core/supabase/server";
import { getUser } from "@core/auth";
import { createAdminClient } from "@core/database/client";

/**
 * Get all orders/prescriptions for the pharmacy admin's pharmacy
 * Platform admins (no pharmacy link) see ALL orders across all pharmacies
 * GET /api/admin/pharmacy-orders
 */
export async function GET() {
  try {
    const { user, userRole } = await getUser();

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!userRole || !["admin", "super_admin"].includes(userRole)) {
      return NextResponse.json(
        { success: false, error: "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = createAdminClient();

    const { data: adminLink } = await supabase
      .from("pharmacy_admins")
      .select("pharmacy_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const pharmacyId = adminLink?.pharmacy_id || null;

    let query = supabase
      .from("prescriptions")
      .select(`
        *,
        patient:patients(
          id,
          first_name,
          last_name,
          email,
          phone,
          date_of_birth
        ),
        prescriber:prescriber_id(
          id,
          email,
          raw_user_meta_data
        ),
        medication:pharmacy_medications(
          id,
          name,
          strength,
          form,
          category
        )
      `)
      .order("submitted_at", { ascending: false });

    if (pharmacyId) {
      query = query.eq("pharmacy_id", pharmacyId);
    }

    const { data: prescriptions, error } = await query;

    if (error) {
      console.error("Error fetching pharmacy orders:", error);
      return NextResponse.json(
        { success: false, error: "Failed to fetch orders" },
        { status: 500 }
      );
    }

    // Calculate analytics
    const totalOrders = prescriptions?.length || 0;
    const totalRevenue = prescriptions?.reduce((sum, p) => sum + (p.total_paid_cents || 0), 0) || 0;
    const totalProfit = prescriptions?.reduce((sum, p) => sum + (p.profit_cents || 0), 0) || 0;

    // Orders by status
    const ordersByStatus = prescriptions?.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>) || {};

    // Orders by month (last 6 months)
    const ordersByMonth: Record<string, number> = {};
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      ordersByMonth[key] = 0;
    }

    prescriptions?.forEach((p) => {
      const date = new Date(p.submitted_at);
      const key = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      if (ordersByMonth[key] !== undefined) {
        ordersByMonth[key]++;
      }
    });

    // Best-selling medications
    const medicationSales: Record<string, { count: number; revenue: number }> = {};
    prescriptions?.forEach((p) => {
      const medName = p.medication || 'Unknown';
      if (!medicationSales[medName]) {
        medicationSales[medName] = { count: 0, revenue: 0 };
      }
      medicationSales[medName].count++;
      medicationSales[medName].revenue += (p.total_paid_cents || 0) / 100;
    });

    const topMedications = Object.entries(medicationSales)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([name, data]) => ({ name, ...data }));

    // Doctor payment breakdown
    const doctorStats: Record<string, { name: string; orders: number; revenue: number; profit: number }> = {};
    prescriptions?.forEach((p) => {
      const doctorId = p.prescriber_id;
      const prescriberData = p.prescriber as { id: string; email: string; raw_user_meta_data?: { full_name?: string } } | null;
      const doctorName = prescriberData?.raw_user_meta_data?.full_name || prescriberData?.email || 'Unknown';

      if (!doctorStats[doctorId]) {
        doctorStats[doctorId] = { name: doctorName, orders: 0, revenue: 0, profit: 0 };
      }
      doctorStats[doctorId].orders++;
      doctorStats[doctorId].revenue += (p.total_paid_cents || 0) / 100;
      doctorStats[doctorId].profit += (p.profit_cents || 0) / 100;
    });

    const doctorBreakdown = Object.values(doctorStats)
      .sort((a, b) => b.revenue - a.revenue);

    // Get total unique doctors count
    const uniqueDoctors = new Set(prescriptions?.map(p => p.prescriber_id) || []).size;

    return NextResponse.json({
      success: true,
      orders: prescriptions,
      analytics: {
        totalOrders,
        totalRevenue: totalRevenue / 100, // Convert cents to dollars
        totalProfit: totalProfit / 100, // Convert cents to dollars
        ordersByStatus,
        ordersByMonth,
        topMedications,
        doctorBreakdown,
        totalDoctors: uniqueDoctors,
      },
    });
  } catch (error) {
    console.error("Error in get pharmacy orders:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch pharmacy orders",
      },
      { status: 500 }
    );
  }
}
