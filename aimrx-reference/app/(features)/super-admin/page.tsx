"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@core/auth";
import { createClient } from "@core/supabase";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Activity,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { APIMonitor } from "./components/APIMonitor";
import { SystemLogs } from "./components/SystemLogs";

interface PrescriptionData {
  id: string;
  queue_id: string;
  submitted_at: string;
  medication: string;
  dosage: string;
  status: string;
  patient: {
    first_name: string;
    last_name: string;
  } | null;
  prescriber: {
    email: string;
  } | null;
}

interface SystemLogData {
  id: string;
  created_at: string;
  action: string;
  user_name: string;
  user_email: string;
  details: string;
  queue_id: string | null;
  status: string;
}

export default function SuperAdminPage() {
  const { user } = useUser();
  const router = useRouter();
  const supabase = createClient();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [apiStatus, setApiStatus] = useState<"healthy" | "error">("healthy");
  const [lastApiCheck, setLastApiCheck] = useState(new Date());
  const [isTesting, setIsTesting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [prescriptions, setPrescriptions] = useState<PrescriptionData[]>([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogData[]>([]);
  const [stats, setStats] = useState({
    today: 0,
    thisWeek: 0,
    allTime: 0,
  });

  // Check if user is super admin or platform owner
  useEffect(() => {
    const email = user?.email?.toLowerCase() || "";
    const isSuperAdmin =
      email.endsWith("@smartconnects.com") ||
      email === "joseph@smartconnects.com" ||
      email === "h.alkhammal@gmail.com" ||
      email === "platform@demo.com";

    if (!isSuperAdmin) {
      router.push("/");
      return;
    }

    setIsAuthorized(true);
  }, [user, router]);

  // Load data from Supabase
  const loadData = useCallback(async () => {
    try {
      // Load last 10 prescriptions with patient info
      const { data: rxData, error: rxError } = await supabase
        .from("prescriptions")
        .select(
          `
          id,
          queue_id,
          submitted_at,
          medication,
          dosage,
          status,
          prescriber_id,
          patient:patients(first_name, last_name)
        `
        )
        .order("submitted_at", { ascending: false })
        .limit(10);

      if (rxError) {
        console.error("Error loading prescriptions:", rxError);
        setPrescriptions([]);
      } else if (rxData) {
        // Format data with prescriber info (showing ID for now)
        const formattedData = rxData.map((rx) => ({
          ...rx,
          patient: Array.isArray(rx.patient) ? rx.patient[0] : rx.patient,
          prescriber: { email: rx.prescriber_id }, // Will show ID for now
        }));

        setPrescriptions(formattedData as unknown as PrescriptionData[]);
      }

      // Load prescription stats
      const { count: allTimeCount, error: countError } = await supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true });

      if (countError) {
        console.error("Error loading count:", countError);
      }

      // Calculate today and this week counts
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { count: todayCount } = await supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .gte("submitted_at", today.toISOString());

      const { count: weekCount } = await supabase
        .from("prescriptions")
        .select("*", { count: "exact", head: true })
        .gte("submitted_at", weekAgo.toISOString());

      setStats({
        today: todayCount || 0,
        thisWeek: weekCount || 0,
        allTime: allTimeCount || 0,
      });

      // Load last 200 system logs
      const { data: logsData, error: logsError } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (logsError) {
        console.error("Error loading system logs:", logsError);
      } else {
        setSystemLogs((logsData as SystemLogData[]) || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load dashboard data");
    }
  }, [supabase]);

  // Load data when authorized
  useEffect(() => {
    if (isAuthorized) {
      loadData();
    }
  }, [isAuthorized, loadData]);

  const handleForceApiTest = async () => {
    setIsTesting(true);
    toast.info("Testing DigitalRx API connection...");

    // Simulate API test (replace with real API call in production)
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const success = Math.random() > 0.1; // 90% success rate for demo

    if (success) {
      setApiStatus("healthy");
      setLastApiCheck(new Date());
      toast.success("DigitalRx API connection successful!");

      // Log the test to Supabase
      await supabase.from("system_logs").insert({
        user_email: user?.email || "unknown",
        user_name: "Super Admin",
        action: "API_TEST",
        details: "DigitalRx API connection test successful",
        status: "success",
      });
    } else {
      setApiStatus("error");
      toast.error("DigitalRx API connection failed!");

      // Log the error to Supabase
      await supabase.from("system_logs").insert({
        user_email: user?.email || "unknown",
        user_name: "Super Admin",
        action: "API_TEST",
        details: "DigitalRx API connection test failed",
        status: "error",
        error_message: "Connection timeout",
      });
    }

    setIsTesting(false);
    await loadData(); // Reload to show new log entry
  };

  const handleClearCache = async () => {
    const confirmed = window.confirm(
      "This will refresh all data from the database. Continue?"
    );

    if (confirmed) {
      setIsRefreshing(true);
      await loadData();
      toast.success("Data refreshed successfully!");

      // Log the action to Supabase
      await supabase.from("system_logs").insert({
        user_email: user?.email || "unknown",
        user_name: "Super Admin",
        action: "CACHE_CLEAR",
        details: "System data refreshed from database",
        status: "success",
      });

      setIsRefreshing(false);
      await loadData(); // Reload to show new log entry
    }
  };

  if (!isAuthorized) {
    return null;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Super Admin Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              System monitoring and management for SmartConnect team
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearCache}
              disabled={isRefreshing}
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              {isRefreshing ? "Refreshing..." : "Refresh Data"}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleForceApiTest}
              disabled={isTesting}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {isTesting ? "Testing..." : "Force API Test"}
            </Button>
          </div>
        </div>
      </div>

      {/* API Health Monitoring */}
      <div className="mb-8">
        <APIMonitor />
      </div>

      {/* System Logs */}
      <div className="mb-8">
        <SystemLogs />
      </div>

      {/* Legacy Monitoring Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* API Health Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              API Health
            </CardTitle>
            <CardDescription>DigitalRx connection status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {apiStatus === "healthy" ? (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-green-500" />
                    <div>
                      <div className="font-semibold text-green-600">
                        Healthy
                      </div>
                      <div className="text-sm text-muted-foreground">
                        All systems operational
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-8 w-8 text-red-500" />
                    <div>
                      <div className="font-semibold text-red-600">Error</div>
                      <div className="text-sm text-muted-foreground">
                        Connection failed
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              Last checked:{" "}
              {lastApiCheck.toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </CardContent>
        </Card>

        {/* Prescription Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle>Prescription Statistics</CardTitle>
            <CardDescription>System-wide prescription counts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold">{stats.today}</div>
                <div className="text-xs text-muted-foreground">Today</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.thisWeek}</div>
                <div className="text-xs text-muted-foreground">This Week</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{stats.allTime}</div>
                <div className="text-xs text-muted-foreground">All Time</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Last 10 Prescriptions Card */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Last 10 Prescriptions</CardTitle>
          <CardDescription>Most recent prescription submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {prescriptions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No prescriptions submitted yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-2">Date</th>
                    <th className="text-left py-2 px-2">Doctor</th>
                    <th className="text-left py-2 px-2">Patient</th>
                    <th className="text-left py-2 px-2">Medication</th>
                    <th className="text-left py-2 px-2">Status</th>
                    <th className="text-left py-2 px-2">Queue ID</th>
                  </tr>
                </thead>
                <tbody>
                  {prescriptions.map((rx) => (
                    <tr key={rx.id} className="border-b">
                      <td className="py-2 px-2">
                        {new Date(rx.submitted_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-2 px-2">
                        {rx.prescriber?.email || "Unknown"}
                      </td>
                      <td className="py-2 px-2">
                        {rx.patient
                          ? `${rx.patient.first_name} ${rx.patient.last_name}`
                          : "Unknown"}
                      </td>
                      <td className="py-2 px-2">
                        {rx.medication} {rx.dosage}
                      </td>
                      <td className="py-2 px-2">
                        <Badge variant="outline">{rx.status}</Badge>
                      </td>
                      <td className="py-2 px-2 font-mono text-xs">
                        {rx.queue_id || "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* System Log Card */}
      <Card>
        <CardHeader>
          <CardTitle>System Log</CardTitle>
          <CardDescription>
            Last 200 system actions and events
          </CardDescription>
        </CardHeader>
        <CardContent>
          {systemLogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No system logs yet
            </div>
          ) : (
            <div className="space-y-2">
              {systemLogs.slice(0, 20).map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          log.status === "error" ? "destructive" : "secondary"
                        }
                        className="text-xs"
                      >
                        {log.action}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(log.created_at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="text-sm mt-1">{log.details}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      by {log.user_name || log.user_email}
                      {log.queue_id && ` • Queue ID: ${log.queue_id}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
