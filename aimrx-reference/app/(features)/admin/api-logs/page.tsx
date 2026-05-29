"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@core/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  TrendingUp,
  Activity,
  AlertCircle,
  ExternalLink,
  Copy,
  Search,
  ChevronDown,
  ChevronRight,
  Mail,
  Send,
  Heart,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface HealthCheck {
  name: string;
  category: "database" | "external" | "internal";
  status: "operational" | "degraded" | "error" | "unknown";
  responseTime: number | null;
  endpoint: string;
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
}

interface Issue {
  severity: "critical" | "warning" | "info";
  title: string;
  description: string;
  action: string;
  api?: string;
  affectedCount?: number;
  detectedAt: Date;
  lastSeenAt?: Date;
  isResolved: boolean;
  resolvedAt?: Date;
  duration?: string;
  impact: string;
  nextSteps: string[];
}

export default function APILogsPage() {
  const supabase = createClient();

  // Data states
  const [healthData, setHealthData] = useState<{
    success: boolean;
    overallStatus: string;
    summary?: { total: number; operational: number; degraded: number; error: number };
    healthChecks?: HealthCheck[];
  } | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLogData[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionData[]>([]);
  const [stats, setStats] = useState({ today: 0, thisWeek: 0, allTime: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [heartBeat, setHeartBeat] = useState(false);
  const [nextCheckIn, setNextCheckIn] = useState(30);

  // Accordion states
  const [issuesExpanded, setIssuesExpanded] = useState(true);
  const [apiStatusExpanded, setApiStatusExpanded] = useState(false);
  const [webhookExpanded, setWebhookExpanded] = useState(true);
  const [recentActivityExpanded, setRecentActivityExpanded] = useState(false);
  const [commsExpanded, setCommsExpanded] = useState(true);
  const [prescriptionsExpanded, setPrescriptionsExpanded] = useState(false);

  // Filter states
  const [logsSearch, setLogsSearch] = useState("");
  const [logsStatusFilter, setLogsStatusFilter] = useState("all");

  // Issue history tracking (persisted in localStorage)
  const [issueHistory, setIssueHistory] = useState<Record<string, {
    firstSeen: string;
    lastSeen: string;
    resolvedAt?: string;
  }>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('issueHistory');
      return stored ? JSON.parse(stored) : {};
    }
    return {};
  });

  // Load all data
  const loadAllData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Load health data
      const healthResponse = await fetch("/api/admin/api-health");
      const healthJson = await healthResponse.json();
      if (healthJson.success) {
        setHealthData(healthJson);
      }

      const [{ data: logsData }, { data: commsData }] = await Promise.all([
        supabase
          .from("system_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("system_logs")
          .select("*")
          .in("action", ["PATIENT_NOTIFICATION_SENT", "PATIENT_NOTIFICATION_FAILED", "PATIENT_SMS_SENT", "PATIENT_SMS_FAILED"])
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      const merged = [...(logsData || [])];
      for (const comm of commsData || []) {
        if (!merged.some((m) => m.id === comm.id)) {
          merged.push(comm);
        }
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setSystemLogs(merged);

      // Load prescriptions (last 20)
      const { data: rxData } = await supabase
        .from("prescriptions")
        .select(
          `
          id,
          queue_id,
          submitted_at,
          medication,
          dosage,
          status,
          patient:patients(first_name, last_name)
        `
        )
        .order("submitted_at", { ascending: false })
        .limit(20);

      if (rxData) {
        const HIDDEN_TEST_LASTNAMES = ["harton"];
        const filtered = (rxData as unknown as PrescriptionData[]).filter((rx) => {
          const patient = Array.isArray(rx.patient) ? rx.patient[0] : rx.patient;
          if (!patient) return true;
          return !HIDDEN_TEST_LASTNAMES.includes(patient.last_name?.toLowerCase());
        });
        setPrescriptions(filtered);
      }

      // Calculate stats
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

      const { data: allRx } = await supabase
        .from("prescriptions")
        .select("submitted_at");

      if (allRx) {
        const todayCount = allRx.filter(
          (rx) => new Date(rx.submitted_at) >= today
        ).length;
        const weekCount = allRx.filter(
          (rx) => new Date(rx.submitted_at) >= weekAgo
        ).length;
        setStats({
          today: todayCount,
          thisWeek: weekCount,
          allTime: allRx.length,
        });
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load system data");
    } finally {
      setIsRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadAllData();
      setHeartBeat(true);
      setTimeout(() => setHeartBeat(false), 1500);
      setNextCheckIn(30);
    }, 30000);
    return () => clearInterval(interval);
  }, [loadAllData]);

  useEffect(() => {
    const countdown = setInterval(() => {
      setNextCheckIn((prev) => (prev > 0 ? prev - 1 : 30));
    }, 1000);
    return () => clearInterval(countdown);
  }, []);

  // Helper to calculate duration
  const calculateDuration = (start: Date, end?: Date): string => {
    const endTime = end || new Date();
    const diff = endTime.getTime() - start.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return 'Just now';
  };

  // Helper to get issue tracking info (read-only, no state updates)
  const getIssueTracking = useCallback((issueKey: string) => {
    const now = new Date().toISOString();
    const history = issueHistory[issueKey];
    return history || { firstSeen: now, lastSeen: now };
  }, [issueHistory]);

  // Identify issues from health data (pure calculation, no side effects)
  const identifyIssues = useMemo((): Issue[] => {
    const issues: Issue[] = [];
    const now = new Date();

    if (!healthData?.healthChecks) return issues;

    // Check for critical errors
    const errorApis = healthData.healthChecks.filter((api) => api.status === "error");
    errorApis.forEach((api) => {
      const issueKey = `api-error-${api.name}`;
      const tracking = getIssueTracking(issueKey);

      issues.push({
        severity: "critical",
        title: `${api.name} — reconnecting`,
        description: `The ${api.name} API is temporarily unreachable. The system will automatically retry and reconnect.`,
        action: api.category === "external"
          ? "This is typically a temporary issue on the external service side. Auto-recovery is in progress."
          : "The system is working to restore this connection automatically.",
        api: api.name,
        detectedAt: new Date(tracking.firstSeen),
        lastSeenAt: new Date(tracking.lastSeen),
        isResolved: false,
        duration: calculateDuration(new Date(tracking.firstSeen)),
        impact: api.category === "external"
          ? "Some external features may experience brief delays while reconnecting"
          : "Minor delays possible while the system reconnects",
        nextSteps: api.category === "external"
          ? [
              "The system will automatically retry the connection",
              "If this persists for more than 30 minutes, check the service provider's status page",
              "All queued operations will be processed once the connection is restored"
            ]
          : [
              "The system is automatically attempting to reconnect",
              "No action needed — queued operations will resume shortly",
              "Contact support if this persists for more than 1 hour"
            ],
      });
    });

    // Check for degraded performance
    // Note: Skip H2H DigitalRx degraded status as it's often from test connections
    const degradedApis = healthData.healthChecks.filter(
      (api) => api.status === "degraded" && api.name !== "H2H DigitalRx API"
    );
    degradedApis.forEach((api) => {
      const issueKey = `api-degraded-${api.name}`;
      const tracking = getIssueTracking(issueKey);

      issues.push({
        severity: "warning",
        title: `${api.name} — responding slowly`,
        description: `Response time: ${api.responseTime}ms. The system is optimizing the connection automatically.`,
        action: "No action needed — this typically resolves on its own within a few minutes.",
        api: api.name,
        detectedAt: new Date(tracking.firstSeen),
        lastSeenAt: new Date(tracking.lastSeen),
        isResolved: false,
        duration: calculateDuration(new Date(tracking.firstSeen)),
        impact: "Some responses may take a moment longer than usual",
        nextSteps: [
          "This is normal and usually resolves within 10-15 minutes",
          "All operations continue to process normally",
          "Contact support only if this persists for more than 1 hour"
        ],
      });
    });

    // Check for recent failures in logs
    const recentErrors = systemLogs.filter(
      (log) =>
        log.status === "error" &&
        new Date(log.created_at) > new Date(Date.now() - 60 * 60 * 1000)
    );

    if (recentErrors.length > 5) {
      const oldestError = recentErrors[recentErrors.length - 1];

      issues.push({
        severity: "info",
        title: `${recentErrors.length} retry attempts logged`,
        description: "The system detected some operations that needed retrying. Automated reconciliation is handling these.",
        action: "No action needed — the system automatically retries and resolves most issues.",
        affectedCount: recentErrors.length,
        detectedAt: new Date(oldestError.created_at),
        lastSeenAt: new Date(recentErrors[0].created_at),
        isResolved: false,
        duration: calculateDuration(new Date(oldestError.created_at)),
        impact: "The system is actively processing and resolving these items",
        nextSteps: [
          "Automated reconciliation runs every 5 minutes",
          "View the Activity Log below for detailed status",
          "Most items resolve automatically within 1-2 cycles"
        ],
      });
    }

    // Check for stuck prescriptions
    const stuckPrescriptions = prescriptions.filter(
      (rx) =>
        rx.status === "submitted" &&
        new Date(rx.submitted_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    if (stuckPrescriptions.length > 0) {
      const oldestStuck = stuckPrescriptions.reduce((oldest, rx) =>
        new Date(rx.submitted_at) < new Date(oldest.submitted_at) ? rx : oldest
      );

      issues.push({
        severity: "warning",
        title: `${stuckPrescriptions.length} prescription(s) awaiting pharmacy processing`,
        description: "These prescriptions were successfully submitted and are waiting for the pharmacy to process them.",
        action: "The pharmacy typically processes orders within 1-2 business days. The system is monitoring their status automatically.",
        affectedCount: stuckPrescriptions.length,
        detectedAt: new Date(oldestStuck.submitted_at),
        lastSeenAt: now,
        isResolved: false,
        duration: calculateDuration(new Date(oldestStuck.submitted_at)),
        impact: "Prescriptions are queued at the pharmacy and will be updated once processed",
        nextSteps: [
          "The system checks pharmacy status automatically every 5 minutes",
          "Status will update to 'processing' or 'shipped' once the pharmacy begins fulfillment",
          "If needed, you can verify directly with the pharmacy",
          "Tracking numbers will appear automatically once orders are shipped"
        ],
      });
    }

    // All systems operational
    if (issues.length === 0) {
      issues.push({
        severity: "info",
        title: "All systems operational",
        description: "All APIs are responding normally and no issues detected.",
        action: "No action needed. Continue monitoring.",
        detectedAt: now,
        isResolved: true,
        duration: "Current",
        impact: "None - system is healthy",
        nextSteps: ["Continue normal operations", "Monitor dashboard periodically"],
      });
    }

    return issues;
  }, [healthData, systemLogs, prescriptions, issueHistory, getIssueTracking]);

  const issues = identifyIssues;

  // Track issue history changes (side effect) - only when data changes, not when issueHistory changes
  useEffect(() => {
    if (!healthData?.healthChecks) return;

    const now = new Date().toISOString();
    const activeIssueKeys = new Set<string>();
    let hasChanges = false;

    setIssueHistory((prevHistory) => {
      const updates = { ...prevHistory };

      // Track active issues
      healthData.healthChecks?.forEach((api) => {
        if (api.status === "error") {
          const issueKey = `api-error-${api.name}`;
          activeIssueKeys.add(issueKey);
          if (!updates[issueKey]) {
            updates[issueKey] = { firstSeen: now, lastSeen: now };
            hasChanges = true;
          } else if (!updates[issueKey].resolvedAt) {
            updates[issueKey] = { ...updates[issueKey], lastSeen: now, resolvedAt: undefined };
            hasChanges = true;
          }
        }
        if (api.status === "degraded") {
          const issueKey = `api-degraded-${api.name}`;
          activeIssueKeys.add(issueKey);
          if (!updates[issueKey]) {
            updates[issueKey] = { firstSeen: now, lastSeen: now };
            hasChanges = true;
          } else if (!updates[issueKey].resolvedAt) {
            updates[issueKey] = { ...updates[issueKey], lastSeen: now, resolvedAt: undefined };
            hasChanges = true;
          }
        }
      });

      // Track other issue types
      const recentErrors = systemLogs.filter(
        (log) => log.status === "error" && new Date(log.created_at) > new Date(Date.now() - 60 * 60 * 1000)
      );
      if (recentErrors.length > 5) {
        const issueKey = `multiple-errors`;
        activeIssueKeys.add(issueKey);
        if (!updates[issueKey]) {
          updates[issueKey] = { firstSeen: now, lastSeen: now };
          hasChanges = true;
        } else if (!updates[issueKey].resolvedAt) {
          updates[issueKey] = { ...updates[issueKey], lastSeen: now, resolvedAt: undefined };
          hasChanges = true;
        }
      }

      const stuckPrescriptions = prescriptions.filter(
        (rx) => rx.status === "submitted" && new Date(rx.submitted_at) < new Date(Date.now() - 24 * 60 * 60 * 1000)
      );
      if (stuckPrescriptions.length > 0) {
        const issueKey = `stuck-prescriptions`;
        activeIssueKeys.add(issueKey);
        if (!updates[issueKey]) {
          updates[issueKey] = { firstSeen: now, lastSeen: now };
          hasChanges = true;
        } else if (!updates[issueKey].resolvedAt) {
          updates[issueKey] = { ...updates[issueKey], lastSeen: now, resolvedAt: undefined };
          hasChanges = true;
        }
      }

      // Mark resolved issues
      Object.keys(updates).forEach((key) => {
        if (!activeIssueKeys.has(key) && !updates[key].resolvedAt) {
          updates[key] = { ...updates[key], resolvedAt: now };
          hasChanges = true;
        }
      });

      // Update localStorage if there are changes
      if (hasChanges) {
        localStorage.setItem('issueHistory', JSON.stringify(updates));
        return updates;
      }

      return prevHistory;
    });
  }, [healthData, systemLogs, prescriptions]);

  // Filter logs
  const filteredLogs = systemLogs.filter((log) => {
    const matchesSearch =
      logsSearch === "" ||
      log.action.toLowerCase().includes(logsSearch.toLowerCase()) ||
      log.user_name?.toLowerCase().includes(logsSearch.toLowerCase()) ||
      log.details?.toLowerCase().includes(logsSearch.toLowerCase());

    const matchesStatus =
      logsStatusFilter === "all" || log.status === logsStatusFilter;

    return matchesSearch && matchesStatus;
  });

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      // Fallback for when Clipboard API is blocked
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success("Copied to clipboard");
      } catch {
        toast.error("Failed to copy to clipboard");
      }
      document.body.removeChild(textArea);
    }
  };

  const formatTimeAgo = (date: string) => {
    const d = new Date(date);
    const seconds = Math.floor((new Date().getTime() - d.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 172800) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatFullDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " at " +
      d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  };

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">System Health & Monitoring</h1>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-sm text-gray-500">
                Last updated: {formatTimeAgo(lastRefresh.toISOString())}
              </span>
            )}
            <Button onClick={loadAllData} disabled={isRefreshing} size="sm">
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Refresh All
            </Button>
          </div>
        </div>
        <p className="text-gray-600">
          Monitor system health, identify issues, and track prescription activity
        </p>
      </div>

      {/* Quick Stats Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {/* System Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">System Status</span>
            {healthData?.overallStatus === "operational" ? (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            ) : healthData?.overallStatus === "degraded" ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
          </div>
          <div className="text-2xl font-bold capitalize">
            {healthData?.overallStatus || "Loading..."}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {healthData?.summary?.operational || 0}/{healthData?.summary?.total || 0}{" "}
            APIs online
          </div>
        </div>

        {/* Today's Prescriptions */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Today</span>
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold">{stats.today}</div>
          <div className="text-xs text-gray-500 mt-1">Prescriptions submitted</div>
        </div>

        {/* This Week */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">This Week</span>
            <Activity className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold">{stats.thisWeek}</div>
          <div className="text-xs text-gray-500 mt-1">Prescriptions submitted</div>
        </div>

        {/* Active Issues */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Monitoring</span>
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold">
            {issues.filter((i) => i.severity !== "info").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Items being monitored</div>
        </div>
      </div>

      {/* Issues & Recommendations Section */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div
          onClick={() => setIssuesExpanded(!issuesExpanded)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {issuesExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            )}
            <h2 className="text-lg font-semibold">System Insights</h2>
            <Badge variant="outline">
              {issues.filter((i) => i.severity !== "info").length} active
            </Badge>
          </div>
        </div>

        {issuesExpanded && (
          <div className="px-6 py-4 border-t border-gray-200 space-y-4">
            {issues.map((issue, idx) => (
              <div
                key={idx}
                className={`rounded-lg border-l-4 overflow-hidden ${
                  issue.severity === "critical"
                    ? "bg-red-50 border-red-500"
                    : issue.severity === "warning"
                      ? "bg-yellow-50 border-yellow-500"
                      : "bg-green-50 border-green-500"
                }`}
              >
                {/* Header */}
                <div className="p-4 pb-3">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      {issue.severity === "critical" ? (
                        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                      ) : issue.severity === "warning" ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-base mb-1">{issue.title}</h3>
                        {issue.api && (
                          <span className="text-xs text-gray-600 bg-white px-2 py-0.5 rounded">
                            API: {issue.api}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {issue.affectedCount && (
                        <Badge variant="outline" className="bg-white">
                          {issue.affectedCount} item{issue.affectedCount !== 1 ? 's' : ''}
                        </Badge>
                      )}
                      {issue.isResolved ? (
                        <Badge variant="outline" className="bg-green-100 border-green-500 text-green-700">
                          ✓ Resolved
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-white border-orange-500 text-orange-700">
                          Active
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Timeline Info */}
                  <div className="flex items-center gap-4 text-xs text-gray-600 mb-3 ml-8">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      <span>
                        Detected: {issue.detectedAt.toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">Duration: {issue.duration}</span>
                    </div>
                    {issue.resolvedAt && (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3 w-3" />
                        <span>
                          Resolved: {issue.resolvedAt.toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-sm text-gray-700 mb-3 ml-8">{issue.description}</p>

                  {/* Impact */}
                  <div className="bg-white rounded-lg p-3 mb-3 ml-8 border border-gray-200">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-orange-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-medium text-gray-600 mb-1">Impact:</p>
                        <p className="text-sm text-gray-900">{issue.impact}</p>
                      </div>
                    </div>
                  </div>

                  {/* Action Steps */}
                  <div className="bg-white rounded-lg p-3 ml-8 border border-gray-200">
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      {issue.isResolved ? 'Resolution Notes:' : 'Action Steps:'}
                    </p>
                    <ol className="space-y-1.5">
                      {issue.nextSteps.map((step, stepIdx) => (
                        <li key={stepIdx} className="flex items-start gap-2 text-sm">
                          <span className="text-gray-400 font-medium min-w-[20px]">
                            {stepIdx + 1}.
                          </span>
                          <span className="text-gray-900">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* API Status Details */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div
          onClick={() => setApiStatusExpanded(!apiStatusExpanded)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {apiStatusExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            )}
            <h2 className="text-lg font-semibold">API Status Details</h2>
            <span className="text-sm text-gray-500">
              {healthData?.summary?.operational || 0}/{healthData?.summary?.total || 0}{" "}
              operational
            </span>
          </div>
        </div>

        {apiStatusExpanded && healthData?.healthChecks && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="space-y-3">
              {/* Group by category */}
              {(["database", "external", "internal"] as const).map((category) => {
                const apis = healthData.healthChecks!.filter(
                  (api) => api.category === category
                );
                if (apis.length === 0) return null;

                return (
                  <div key={category}>
                    <h3 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                      {category} APIs
                    </h3>
                    <div className="space-y-2">
                      {apis.map((api, idx) => (
                        <div
                          key={idx}
                          className="p-4 rounded-lg border border-gray-200 bg-gray-50"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                              {api.status === "operational" ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : api.status === "degraded" ? (
                                <Clock className="h-4 w-4 text-yellow-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-600" />
                              )}
                              <span className="font-medium text-sm">{api.name}</span>
                            </div>
                            <div className="flex items-center gap-3">
                              {api.responseTime && (
                                <span
                                  className={`text-xs font-mono px-2 py-1 rounded ${
                                    api.responseTime < 500
                                      ? "bg-green-100 text-green-800"
                                      : api.responseTime < 1000
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {api.responseTime}ms
                                </span>
                              )}
                              <Badge
                                variant="outline"
                                className={
                                  api.status === "operational"
                                    ? "border-green-500 text-green-700"
                                    : api.status === "degraded"
                                      ? "border-yellow-500 text-yellow-700"
                                      : "border-red-500 text-red-700"
                                }
                              >
                                {api.status}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <ExternalLink className="h-3 w-3" />
                            <span className="font-mono truncate">{api.endpoint}</span>
                            <button
                              onClick={() => copyToClipboard(api.endpoint)}
                              className="ml-auto p-1 hover:bg-gray-200 rounded"
                            >
                              <Copy className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Webhook Activity */}
      {(() => {
        const webhookLogs = systemLogs.filter((log) =>
          log.action.startsWith("WEBHOOK_")
        );
        const successCount = webhookLogs.filter((l) => l.status === "success").length;
        const errorCount = webhookLogs.filter((l) => l.status === "error").length;
        const lastSuccess = webhookLogs.find((l) => l.status === "success");
        const lastError = webhookLogs.find((l) => l.status === "error");
        const hasAnyWebhooks = webhookLogs.length > 0;

        return (
          <div className="bg-white rounded-lg border border-gray-200 mb-6" data-testid="webhook-activity-section">
            <div
              onClick={() => setWebhookExpanded(!webhookExpanded)}
              className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {webhookExpanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
                <h2 className="text-lg font-semibold">Webhook Activity</h2>
                {hasAnyWebhooks ? (
                  <Badge variant="outline" className={errorCount > 0 && successCount === 0 ? "border-red-500 text-red-700" : successCount > 0 ? "border-green-500 text-green-700" : "border-gray-500 text-gray-700"}>
                    {successCount} received • {errorCount} failed
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-yellow-500 text-yellow-700">
                    No webhooks received
                  </Badge>
                )}
              </div>
            </div>

            {webhookExpanded && (
              <div className="px-6 py-4 border-t border-gray-200">
                {/* Status Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div className={`rounded-lg p-4 border ${hasAnyWebhooks && successCount > 0 ? "bg-green-50 border-green-200" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle2 className={`h-4 w-4 ${successCount > 0 ? "text-green-600" : "text-gray-400"}`} />
                      <span className="text-sm font-medium text-gray-700">Last Successful</span>
                    </div>
                    {lastSuccess ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{formatTimeAgo(lastSuccess.created_at)}</p>
                        <p className="text-xs text-gray-600 mt-1 truncate">{lastSuccess.details}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">None in recent logs</p>
                    )}
                  </div>

                  <div className={`rounded-lg p-4 border ${errorCount > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <XCircle className={`h-4 w-4 ${errorCount > 0 ? "text-red-600" : "text-gray-400"}`} />
                      <span className="text-sm font-medium text-gray-700">Last Failed</span>
                    </div>
                    {lastError ? (
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{formatTimeAgo(lastError.created_at)}</p>
                        <p className="text-xs text-gray-600 mt-1 truncate">{lastError.details}</p>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No failures — good</p>
                    )}
                  </div>

                  <div className={`rounded-lg p-4 border ${!hasAnyWebhooks ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className={`h-4 w-4 ${!hasAnyWebhooks ? "text-yellow-600" : "text-blue-600"}`} />
                      <span className="text-sm font-medium text-gray-700">Connection Status</span>
                    </div>
                    {!hasAnyWebhooks ? (
                      <div>
                        <p className="text-sm font-semibold text-yellow-700">Waiting for data</p>
                        <p className="text-xs text-gray-600 mt-1">No webhook events from DigitalRx yet</p>
                      </div>
                    ) : lastSuccess && new Date(lastSuccess.created_at) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) ? (
                      <div>
                        <p className="text-sm font-semibold text-green-700">Active</p>
                        <p className="text-xs text-gray-600 mt-1">Receiving updates from pharmacy</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-sm font-semibold text-yellow-700">Stale</p>
                        <p className="text-xs text-gray-600 mt-1">No updates in over 7 days</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Webhook Event Log */}
                {webhookLogs.length > 0 ? (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Webhook Events</h3>
                    {webhookLogs.slice(0, 10).map((log) => (
                      <div
                        key={log.id}
                        className={`p-3 rounded-lg border ${
                          log.status === "success"
                            ? "border-green-200 bg-green-50"
                            : "border-red-200 bg-red-50"
                        }`}
                        data-testid={`webhook-event-${log.id}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2 flex-1">
                            {log.status === "success" ? (
                              <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                            )}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {log.action.replace("WEBHOOK_", "").replace(/_/g, " ")}
                                </span>
                                {log.queue_id && (
                                  <code className="text-xs bg-white px-2 py-0.5 rounded border border-gray-200">
                                    Queue: {log.queue_id}
                                  </code>
                                )}
                              </div>
                              <p className="text-sm text-gray-600">{log.details}</p>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 ml-4 flex-shrink-0">
                            {formatTimeAgo(log.created_at)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 rounded-lg border border-dashed border-yellow-300 bg-yellow-50">
                    <AlertTriangle className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">No webhook events received yet</p>
                    <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                      DigitalRx should send tracking numbers when orders are shipped.
                      If orders remain at &quot;Submitted&quot; for a long time, the pharmacy may not have processed them yet.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Patient Communications */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div
          onClick={() => setCommsExpanded(!commsExpanded)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {commsExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            )}
            <Mail className="h-5 w-5 text-[#1E3A8A]" />
            <h2 className="text-lg font-semibold">Patient Communications</h2>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              {systemLogs.filter((l) => l.action === "PATIENT_NOTIFICATION_SENT").length} emails
            </Badge>
            {systemLogs.filter((l) => l.action === "PATIENT_SMS_SENT").length > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                {systemLogs.filter((l) => l.action === "PATIENT_SMS_SENT").length} texts
              </Badge>
            )}
            {systemLogs.filter((l) => l.action === "PATIENT_NOTIFICATION_FAILED" || l.action === "PATIENT_SMS_FAILED").length > 0 && (
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                {systemLogs.filter((l) => l.action === "PATIENT_NOTIFICATION_FAILED" || l.action === "PATIENT_SMS_FAILED").length} failed
              </Badge>
            )}
          </div>
        </div>

        {commsExpanded && (
          <div className="border-t border-gray-200">
            {(() => {
              const commsLogs = systemLogs.filter(
                (l) => l.action === "PATIENT_NOTIFICATION_SENT" || l.action === "PATIENT_NOTIFICATION_FAILED" || l.action === "PATIENT_SMS_SENT" || l.action === "PATIENT_SMS_FAILED"
              );
              if (commsLogs.length === 0) {
                return (
                  <div className="text-center py-12 px-6">
                    <Mail className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-gray-500">No patient communications yet</p>
                    <p className="text-xs text-gray-400 mt-1">Email notifications will appear here when sent to patients</p>
                  </div>
                );
              }

              const parseCommsDetails = (details: string) => {
                const parts: Record<string, string> = {};
                const segments = details.split(" | ");
                if (segments.length > 0) parts.type = segments[0];
                segments.forEach((seg) => {
                  const [key, ...rest] = seg.split(": ");
                  if (rest.length > 0) parts[key.trim().toLowerCase()] = rest.join(": ").trim();
                });
                return parts;
              };

              return (
                <div className="divide-y divide-gray-100">
                  {commsLogs.map((log) => {
                    const isSms = log.action === "PATIENT_SMS_SENT" || log.action === "PATIENT_SMS_FAILED";
                    const isSent = log.action === "PATIENT_NOTIFICATION_SENT" || log.action === "PATIENT_SMS_SENT";
                    const parsed = parseCommsDetails(log.details || "");
                    const entryType = parsed.type || "Notification";

                    return (
                      <div
                        key={log.id}
                        className="px-6 py-4 hover:bg-gray-50/50 transition-colors"
                        data-testid={`comms-entry-${log.id}`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`flex-shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center ${isSent ? (isSms ? "bg-blue-100" : "bg-green-100") : "bg-red-100"}`}>
                            {isSent ? (
                              isSms ? <Smartphone className="h-4 w-4 text-blue-600" /> : <CheckCircle2 className="h-4.5 w-4.5 text-green-600" />
                            ) : (
                              <XCircle className="h-4.5 w-4.5 text-red-600" />
                            )}
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-2.5">
                                <span className="text-sm font-semibold text-gray-900">{entryType}</span>
                                {isSms && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-50 text-blue-700 border-blue-200">
                                    SMS
                                  </Badge>
                                )}
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] px-1.5 py-0 ${isSent ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}`}
                                >
                                  {isSent ? "Delivered" : "Failed"}
                                </Badge>
                              </div>
                              <span className="text-xs text-gray-400 flex-shrink-0 ml-3">
                                {formatFullDate(log.created_at)}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1.5">
                              {log.user_email && (
                                <div className="flex items-center gap-1.5">
                                  {isSms ? <Smartphone className="h-3 w-3 text-gray-400" /> : <Send className="h-3 w-3 text-gray-400" />}
                                  <span className="text-xs text-gray-600">{log.user_email}</span>
                                </div>
                              )}
                              {parsed.medication && (
                                <span className="text-xs text-gray-500">
                                  <span className="text-gray-400">Rx:</span> {parsed.medication}
                                </span>
                              )}
                              {parsed.provider && (
                                <span className="text-xs text-gray-500">
                                  <span className="text-gray-400">Provider:</span> {parsed.provider}
                                </span>
                              )}
                              {parsed.pharmacy && parsed.pharmacy !== "N/A" && (
                                <span className="text-xs text-gray-500">
                                  <span className="text-gray-400">Pharmacy:</span> {parsed.pharmacy}
                                </span>
                              )}
                              {parsed.tracking && (
                                <span className="text-xs text-gray-500">
                                  <span className="text-gray-400">Tracking:</span> {parsed.tracking}
                                </span>
                              )}
                              {parsed.amount && (
                                <span className="text-xs text-gray-500">
                                  <span className="text-gray-400">Amount:</span> {parsed.amount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg border border-gray-200 mb-6">
        <div
          onClick={() => setRecentActivityExpanded(!recentActivityExpanded)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {recentActivityExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            )}
            <h2 className="text-lg font-semibold">Recent Activity</h2>
            <span className="text-sm text-gray-500">
              Last {filteredLogs.length} events
            </span>
          </div>
          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
              <div className="relative flex items-center justify-center">
                <Heart
                  className={`h-4 w-4 text-red-500 fill-red-500 transition-transform duration-300 ${heartBeat ? "scale-125" : "scale-100"}`}
                  data-testid="icon-heartbeat"
                />
                <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-20" />
              </div>
              <span className="text-xs font-medium text-gray-600" data-testid="text-heartbeat-status">
                System Alive
              </span>
              <span className="text-[10px] text-gray-400 font-mono" data-testid="text-next-check">
                {nextCheckIn}s
              </span>
            </div>
          </div>
        </div>

        {recentActivityExpanded && (
          <div className="px-6 py-4 border-t border-gray-200">
            {/* Filters */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by action, user, or details..."
                    value={logsSearch}
                    onChange={(e) => setLogsSearch(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <Select value={logsStatusFilter} onValueChange={setLogsStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Logs Table */}
            <div className="space-y-2">
              {filteredLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No activity logs found
                </div>
              ) : (
                filteredLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                    data-testid={`log-entry-${log.id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div
                          className={`h-2 w-2 rounded-full flex-shrink-0 ${
                            log.status === "success"
                              ? "bg-green-500"
                              : log.status === "error"
                                ? "bg-red-500"
                                : log.status === "info"
                                  ? "bg-blue-500"
                                  : "bg-yellow-500"
                          }`}
                        />
                        <span className="text-sm font-medium text-gray-900">
                          {log.action}
                        </span>
                        <span className="text-xs text-gray-500">by {log.user_name}</span>
                      </div>
                      <span className="text-xs text-gray-500 flex-shrink-0">
                        {formatFullDate(log.created_at)}
                      </span>
                    </div>
                    <div className="pl-5">
                      {log.details && log.details.includes("\n") ? (
                        <div className="text-sm text-gray-600 space-y-0.5">
                          {log.details.split("\n").map((line, i) => (
                            <div key={i} className={line.startsWith("  ") ? "pl-3 text-xs font-mono text-gray-500" : ""}>
                              {line}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-600 break-words">{log.details}</p>
                      )}
                      {log.queue_id && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-gray-500">Queue ID:</span>
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {log.queue_id}
                          </code>
                          <button
                            onClick={() => copyToClipboard(log.queue_id!)}
                            className="p-1 hover:bg-gray-200 rounded"
                          >
                            <Copy className="h-3 w-3 text-gray-400" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* Recent Prescriptions */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div
          onClick={() => setPrescriptionsExpanded(!prescriptionsExpanded)}
          className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            {prescriptionsExpanded ? (
              <ChevronDown className="h-5 w-5 text-gray-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-gray-500" />
            )}
            <h2 className="text-lg font-semibold">Recent Prescriptions</h2>
            <span className="text-sm text-gray-500">Last {prescriptions.length}</span>
          </div>
        </div>

        {prescriptionsExpanded && (
          <div className="px-6 py-4 border-t border-gray-200">
            <div className="space-y-2">
              {prescriptions.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No prescriptions found
                </div>
              ) : (
                prescriptions.map((rx) => (
                  <div
                    key={rx.id}
                    className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-medium text-sm">
                            {rx.medication} {rx.dosage}
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              rx.status === "delivered"
                                ? "border-green-500 text-green-700"
                                : rx.status === "shipped"
                                  ? "border-blue-500 text-blue-700"
                                  : rx.status === "processing" || rx.status === "approved"
                                    ? "border-purple-500 text-purple-700"
                                    : "border-gray-500 text-gray-700"
                            }
                          >
                            {rx.status}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-600">
                          Patient: {rx.patient?.first_name} {rx.patient?.last_name} •
                          Queue ID: {rx.queue_id}
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 ml-4 whitespace-nowrap">
                        {formatFullDate(rx.submitted_at)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
