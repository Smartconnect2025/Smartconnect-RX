"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useUser } from "@core/auth";
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
  Heart,
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
  check_key: string;
  service_name: string;
  category: "database" | "external" | "internal";
  status: "operational" | "degraded" | "error" | "unknown";
  severity: "info" | "warning" | "critical";
  response_time_ms: number | null;
  last_error: string | null;
  pharmacy_id: string | null;
  backend_id: string | null;
  metadata: Record<string, unknown> | null;
  checked_at?: string;
  consecutive_failures?: number;
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

interface Pharmacy {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export default function APILogsPage() {
  const { userRole } = useUser();
  const isSuperAdmin = userRole === "super_admin";

  const [healthData, setHealthData] = useState<{
    success: boolean;
    overallStatus: string;
    summary?: { total: number; operational: number; degraded: number; error: number; unknown: number };
    healthChecks?: HealthCheck[];
    cached?: boolean;
    fromSnapshot?: boolean;
  } | null>(null);
  const [systemLogs, setSystemLogs] = useState<SystemLogData[]>([]);
  const [prescriptions, setPrescriptions] = useState<PrescriptionData[]>([]);
  const [stats, setStats] = useState({ today: 0, thisWeek: 0, allTime: 0 });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [pharmacyFilter, setPharmacyFilter] = useState<string>("all");
  const pharmacyFilterRef = useRef(pharmacyFilter);
  const requestIdRef = useRef(0);

  const [issuesExpanded, setIssuesExpanded] = useState(true);
  const [apiStatusExpanded, setApiStatusExpanded] = useState(false);
  const [recentActivityExpanded, setRecentActivityExpanded] = useState(false);
  const [prescriptionsExpanded, setPrescriptionsExpanded] = useState(false);

  const [logsSearch, setLogsSearch] = useState("");
  const [logsStatusFilter, setLogsStatusFilter] = useState("all");

  const HEARTBEAT_INTERVAL = 30;
  const [heartbeatCountdown, setHeartbeatCountdown] = useState(HEARTBEAT_INTERVAL);
  const [heartbeatActive, setHeartbeatActive] = useState(true);

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

  const loadPharmacies = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/pharmacies");
      const data = await response.json();
      if (data.success) {
        const activePharmacies = data.pharmacies.filter(
          (p: Pharmacy) => p.is_active,
        );
        setPharmacies(activePharmacies);

        if (!isSuperAdmin && activePharmacies.length === 1) {
          const singleId = activePharmacies[0].id;
          pharmacyFilterRef.current = singleId;
          setPharmacyFilter(singleId);
        }
      }
    } catch (err) {
      console.error("Error loading pharmacies:", err);
    }
  }, [isSuperAdmin]);

  const loadAllData = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setIsRefreshing(true);
    try {
      const currentFilter = pharmacyFilterRef.current;
      const params = new URLSearchParams();
      if (currentFilter && currentFilter !== "all") {
        params.set("pharmacyId", currentFilter);
      }

      const [healthResponse, logsResponse] = await Promise.all([
        fetch("/api/admin/api-health"),
        fetch(`/api/admin/api-logs?${params.toString()}`),
      ]);

      if (currentRequestId !== requestIdRef.current) return;

      const healthJson = await healthResponse.json();
      if (healthJson.success) {
        setHealthData(healthJson);
      }

      if (!logsResponse.ok) {
        const errorData = await logsResponse.json().catch(() => ({}));
        console.error("Error loading logs data:", errorData);
        toast.error(errorData.error || "Failed to load system data");
        return;
      }

      const logsJson = await logsResponse.json();

      if (currentRequestId !== requestIdRef.current) return;

      setSystemLogs(logsJson.systemLogs || []);
      setPrescriptions((logsJson.prescriptions || []) as PrescriptionData[]);
      setStats(logsJson.stats || { today: 0, thisWeek: 0, allTime: 0 });
      setLastRefresh(new Date());
    } catch (error) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error("Error loading data:", error);
      toast.error("Failed to load system data");
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    loadPharmacies();
  }, [loadPharmacies]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData, pharmacyFilter]);

  useEffect(() => {
    if (!heartbeatActive) return;
    const tick = setInterval(() => {
      setHeartbeatCountdown((prev) => {
        if (prev <= 1) {
          loadAllData();
          return HEARTBEAT_INTERVAL;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [loadAllData, heartbeatActive]);

  const handlePharmacyFilterChange = useCallback(
    (value: string) => {
      pharmacyFilterRef.current = value;
      setPharmacyFilter(value);
    },
    [],
  );

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

    const errorApis = healthData.healthChecks.filter((api) => api.status === "error");
    errorApis.forEach((api) => {
      const issueKey = `api-error-${api.check_key}`;
      const tracking = getIssueTracking(issueKey);

      issues.push({
        severity: "critical",
        title: `${api.service_name} is down`,
        description: `The ${api.service_name} is not responding.${api.last_error ? ` Error: ${api.last_error}` : ""} This may prevent prescription submissions or status updates.`,
        action: api.category === "external"
          ? "Contact the service provider to verify their system status."
          : "Check your network connection and API credentials in settings.",
        api: api.service_name,
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

    const degradedApis = healthData.healthChecks.filter(
      (api) => api.status === "degraded"
    );
    degradedApis.forEach((api) => {
      const issueKey = `api-degraded-${api.check_key}`;
      const tracking = getIssueTracking(issueKey);

      issues.push({
        severity: "warning",
        title: `${api.service_name} is slow`,
        description: `Response time: ${api.response_time_ms}ms.${api.last_error ? ` Note: ${api.last_error}` : ""} This may cause delays in processing.`,
        action: "Monitor the situation. If it persists, contact support.",
        api: api.service_name,
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

      healthData.healthChecks?.forEach((api) => {
        if (api.status === "error") {
          const issueKey = `api-error-${api.check_key}`;
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
          const issueKey = `api-degraded-${api.check_key}`;
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
            <button
              onClick={() => setHeartbeatActive(!heartbeatActive)}
              className="flex items-center gap-1.5 group cursor-pointer"
              title={heartbeatActive ? "Click to pause auto-refresh" : "Click to resume auto-refresh"}
            >
              <Heart
                className={`h-4 w-4 transition-all ${
                  heartbeatActive
                    ? "text-red-500 fill-red-500 animate-pulse"
                    : "text-gray-400"
                }`}
              />
              <span className={`text-xs font-mono tabular-nums ${heartbeatActive ? "text-red-500" : "text-gray-400"}`}>
                {heartbeatActive ? `${heartbeatCountdown}s` : "paused"}
              </span>
            </button>
            <div className="w-px h-5 bg-gray-300" />
            {lastRefresh && (
              <span className="text-sm text-gray-500">
                Last updated: {formatTimeAgo(lastRefresh.toISOString())}
              </span>
            )}
            <Button onClick={() => { loadAllData(); setHeartbeatCountdown(HEARTBEAT_INTERVAL); }} disabled={isRefreshing} size="sm">
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

      {/* Pharmacy Filter */}
      {isSuperAdmin && pharmacies.length > 0 && (
        <div className="mb-6 flex items-center gap-3">
          <label htmlFor="pharmacy-filter" className="text-sm font-medium text-gray-700">
            Filter by Pharmacy:
          </label>
          <select
            id="pharmacy-filter"
            value={pharmacyFilter}
            onChange={(e) => handlePharmacyFilterChange(e.target.value)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Pharmacies</option>
            {pharmacies.map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {pharmacy.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
          <div className="flex items-center gap-2">
            {healthData?.cached && (
              <span className="text-xs text-gray-400">cached</span>
            )}
            <Button
              onClick={async (e) => {
                e.stopPropagation();
                setIsRefreshing(true);
                try {
                  const response = await fetch("/api/admin/api-health?runNow=true");
                  const data = await response.json();
                  if (data.success) {
                    setHealthData(data);
                    toast.success("Health check completed");
                  }
                } catch {
                  toast.error("Failed to run health check");
                } finally {
                  setIsRefreshing(false);
                }
              }}
              disabled={isRefreshing}
              size="sm"
              variant="outline"
              className="text-xs h-7"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
              Run Now
            </Button>
          </div>
        </div>

        {apiStatusExpanded && healthData?.healthChecks && (() => {
          const globalChecks = healthData.healthChecks!.filter(
            (api) => !api.pharmacy_id
          );
          const pharmacyChecks = healthData.healthChecks!.filter(
            (api) => !!api.pharmacy_id
          );
          const pharmacyGroups = new Map<string, { name: string; checks: HealthCheck[] }>();
          pharmacyChecks.forEach((api) => {
            const pid = api.pharmacy_id || "unknown";
            const meta = api.metadata as Record<string, unknown> | null;
            const name = (meta?.pharmacyName as string) || api.service_name.split(" — ")[1] || "Unknown Pharmacy";
            if (!pharmacyGroups.has(pid)) pharmacyGroups.set(pid, { name, checks: [] });
            pharmacyGroups.get(pid)!.checks.push(api);
          });

          const renderCard = (api: HealthCheck, idx: number) => (
            <div
              key={idx}
              className={`p-4 rounded-lg border-2 ${
                api.status === "operational"
                  ? "border-green-200 bg-green-50/50"
                  : api.status === "degraded"
                    ? "border-yellow-200 bg-yellow-50/50"
                    : api.status === "unknown"
                      ? "border-gray-200 bg-gray-50/50"
                      : "border-red-200 bg-red-50/50"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {api.status === "operational" ? (
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                  ) : api.status === "degraded" ? (
                    <Clock className="h-4 w-4 text-yellow-600" />
                  ) : api.status === "unknown" ? (
                    <AlertCircle className="h-4 w-4 text-gray-400" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-600" />
                  )}
                  <span className="font-medium text-sm">{api.service_name}</span>
                </div>
                <Badge
                  variant="outline"
                  className={
                    api.status === "operational"
                      ? "border-green-500 text-green-700 bg-green-100"
                      : api.status === "degraded"
                        ? "border-yellow-500 text-yellow-700 bg-yellow-100"
                        : api.status === "unknown"
                          ? "border-gray-400 text-gray-600 bg-gray-100"
                          : "border-red-500 text-red-700 bg-red-100"
                  }
                >
                  {api.status}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-600">
                <div className="flex items-center gap-3">
                  {api.response_time_ms !== null && (
                    <span
                      className={`font-mono px-2 py-0.5 rounded ${
                        api.response_time_ms < 500
                          ? "bg-green-100 text-green-800"
                          : api.response_time_ms < 2000
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                      }`}
                    >
                      {api.response_time_ms}ms
                    </span>
                  )}
                  {(api.consecutive_failures ?? 0) > 0 && (
                    <span className="text-red-600 font-medium">
                      {api.consecutive_failures} consecutive failure{api.consecutive_failures > 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                {api.checked_at && (
                  <span className="text-gray-400">
                    {formatTimeAgo(api.checked_at)}
                  </span>
                )}
              </div>
              {api.last_error && (
                <div className="mt-2 text-xs text-red-600 bg-red-50 px-2 py-1 rounded truncate">
                  {api.last_error}
                </div>
              )}
              {api.metadata && typeof (api.metadata as Record<string, unknown>).endpoint === "string" && (
                <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
                  <ExternalLink className="h-3 w-3" />
                  <span className="font-mono truncate">{String((api.metadata as Record<string, unknown>).endpoint)}</span>
                  <button
                    onClick={() => copyToClipboard(String((api.metadata as Record<string, unknown>)?.endpoint || ""))}
                    className="ml-auto p-0.5 hover:bg-gray-200 rounded"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          );

          return (
            <div className="px-6 py-4 border-t border-gray-200">
              <div className="space-y-5">
                {healthData?.fromSnapshot && (
                  <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-lg">
                    <Activity className="h-3 w-3" />
                    <span>Showing saved snapshot data. Click &quot;Run Now&quot; for live checks.</span>
                  </div>
                )}

                {globalChecks.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      Global Services
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {globalChecks.map((api, idx) => renderCard(api, idx))}
                    </div>
                  </div>
                )}

                {pharmacyGroups.size > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
                      Per-Pharmacy Backends
                    </h3>
                    <div className="space-y-4">
                      {Array.from(pharmacyGroups.entries()).map(([pid, group]) => {
                        const allOk = group.checks.every((c) => c.status === "operational");
                        const hasError = group.checks.some((c) => c.status === "error");
                        return (
                          <div key={pid} className={`rounded-lg border ${hasError ? "border-red-200" : allOk ? "border-green-200" : "border-yellow-200"} p-4`}>
                            <div className="flex items-center gap-2 mb-3">
                              {allOk ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : hasError ? (
                                <XCircle className="h-4 w-4 text-red-600" />
                              ) : (
                                <AlertTriangle className="h-4 w-4 text-yellow-600" />
                              )}
                              <span className="font-semibold text-sm">{group.name}</span>
                              <span className="text-xs text-gray-400">
                                {group.checks.filter((c) => c.status === "operational").length}/{group.checks.length} operational
                              </span>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              {group.checks.map((api, idx) => renderCard(api, idx))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}
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
