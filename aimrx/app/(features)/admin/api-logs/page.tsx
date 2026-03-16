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

  // Accordion states
  const [issuesExpanded, setIssuesExpanded] = useState(true);
  const [apiStatusExpanded, setApiStatusExpanded] = useState(false);
  const [recentActivityExpanded, setRecentActivityExpanded] = useState(false);
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

      // Load system logs (last 50)
      const { data: logsData } = await supabase
        .from("system_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (logsData) {
        setSystemLogs(logsData);
      }

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
        setPrescriptions(rxData as unknown as PrescriptionData[]);
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
    const interval = setInterval(loadAllData, 30000);
    return () => clearInterval(interval);
  }, [loadAllData]);

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
        title: `${api.name} is down`,
        description: `The ${api.name} API is not responding. This may prevent prescription submissions or status updates.`,
        action: api.category === "external"
          ? "Contact the service provider to verify their system status."
          : "Check your network connection and API credentials in settings.",
        api: api.name,
        detectedAt: new Date(tracking.firstSeen),
        lastSeenAt: new Date(tracking.lastSeen),
        isResolved: false,
        duration: calculateDuration(new Date(tracking.firstSeen)),
        impact: api.category === "external"
          ? "Prescription submissions and external integrations may fail"
          : "Internal operations may be affected",
        nextSteps: api.category === "external"
          ? [
              "Check service status page",
              "Verify API credentials are valid",
              "Contact service provider support",
              "Monitor for automatic recovery"
            ]
          : [
              "Check internet connectivity",
              "Verify API keys in environment settings",
              "Review server logs for errors",
              "Restart the application if needed"
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
        title: `${api.name} is slow`,
        description: `Response time: ${api.responseTime}ms. This may cause delays in prescription processing.`,
        action: "Monitor the situation. If it persists, contact support.",
        api: api.name,
        detectedAt: new Date(tracking.firstSeen),
        lastSeenAt: new Date(tracking.lastSeen),
        isResolved: false,
        duration: calculateDuration(new Date(tracking.firstSeen)),
        impact: "Users may experience slower page loads and delayed responses",
        nextSteps: [
          "Monitor response times for 10-15 minutes",
          "Check if issue resolves automatically",
          "If persistent for >30 min, contact support",
          "Consider temporary reduction in API polling frequency"
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
        severity: "warning",
        title: `${recentErrors.length} errors in the last hour`,
        description: "Multiple operations have failed recently. This may indicate a systemic issue.",
        action: "Review the System Activity Logs below to identify patterns.",
        affectedCount: recentErrors.length,
        detectedAt: new Date(oldestError.created_at),
        lastSeenAt: new Date(recentErrors[0].created_at),
        isResolved: false,
        duration: calculateDuration(new Date(oldestError.created_at)),
        impact: "Multiple user operations are failing, affecting system reliability",
        nextSteps: [
          "Expand 'Recent Activity' section below",
          "Look for common patterns in error messages",
          "Check if errors are user-specific or system-wide",
          "Review affected operations and notify users if needed"
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
        title: `${stuckPrescriptions.length} prescription(s) stuck in "submitted" status`,
        description: "These prescriptions have not progressed beyond submission for over 24 hours.",
        action: "Check the DigitalRX system or contact the pharmacy to verify they received the prescriptions.",
        affectedCount: stuckPrescriptions.length,
        detectedAt: new Date(oldestStuck.submitted_at),
        lastSeenAt: now,
        isResolved: false,
        duration: calculateDuration(new Date(oldestStuck.submitted_at)),
        impact: "Patient prescriptions are not being processed, delaying medication delivery",
        nextSteps: [
          "Log into DigitalRX pharmacy system directly",
          "Verify prescriptions appear in their queue",
          "Check for any rejected prescriptions",
          "Contact pharmacy staff to manually process",
          "Consider resubmitting if prescriptions are missing"
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
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
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
            <span className="text-sm font-medium text-gray-600">Active Issues</span>
            <AlertCircle className="h-5 w-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold">
            {issues.filter((i) => i.severity !== "info").length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Requiring attention</div>
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
            <h2 className="text-lg font-semibold">Issues & Recommendations</h2>
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
                          {issue.affectedCount} affected
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
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div
                          className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                            log.status === "success"
                              ? "bg-green-500"
                              : log.status === "error"
                                ? "bg-red-500"
                                : "bg-yellow-500"
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">
                              {log.action}
                            </span>
                            <span className="text-xs text-gray-500">by {log.user_name}</span>
                          </div>
                          <p className="text-sm text-gray-600 truncate">{log.details}</p>
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
                      <span className="text-xs text-gray-500 ml-4 flex-shrink-0">
                        {formatTimeAgo(log.created_at)}
                      </span>
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
                      <span className="text-xs text-gray-500 ml-4">
                        {formatTimeAgo(rx.submitted_at)}
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
