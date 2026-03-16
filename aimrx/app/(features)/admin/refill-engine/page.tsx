"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@core/supabase";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  Activity,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface CronJobRun {
  id: string;
  job_name: string;
  status: string;
  error_message: string | null;
  records_processed: number;
  details: {
    processed: Array<{ rxId: string; refillId?: string; [key: string]: unknown }>;
    failed: Array<{ rxId: string; step?: string; error?: string; [key: string]: unknown }>;
  } | null;
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  success: { label: "Success", color: "border-green-500 text-green-700 bg-green-50", icon: CheckCircle2 },
  partial: { label: "Partial", color: "border-yellow-500 text-yellow-700 bg-yellow-50", icon: AlertTriangle },
  error: { label: "Error", color: "border-red-500 text-red-700 bg-red-50", icon: XCircle },
  running: { label: "Running", color: "border-blue-500 text-blue-700 bg-blue-50", icon: Loader2 },
};

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds}s`;
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatTimeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function truncateId(id: string): string {
  return id.length > 8 ? `${id.substring(0, 8)}…` : id;
}

export default function RefillEnginePage() {
  const supabase = createClient();
  const [runs, setRuns] = useState<CronJobRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadRuns = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const { data, error } = await supabase
        .from("cron_job_runs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) {
        console.error("Error loading cron runs:", error);
        toast.error("Failed to load cron job runs");
        return;
      }

      setRuns((data as CronJobRun[]) || []);
      setLastRefresh(new Date());
    } catch (err) {
      console.error("Error loading cron runs:", err);
      toast.error("Failed to load cron job runs");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Summary stats
  const totalRuns = runs.length;
  const successRuns = runs.filter((r) => r.status === "success").length;
  const partialRuns = runs.filter((r) => r.status === "partial").length;
  const errorRuns = runs.filter((r) => r.status === "error").length;
  const totalProcessed = runs.reduce((sum, r) => sum + (r.records_processed || 0), 0);
  const lastRun = runs[0];

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">Refill Engine</h1>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-sm text-gray-500">
                Updated: {formatTimeAgo(lastRefresh.toISOString())}
              </span>
            )}
            <Button onClick={loadRuns} disabled={isRefreshing} size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </div>
        <p className="text-gray-600">
          Monitor automated refill cron job executions and track successes and failures.
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Runs</span>
            <Activity className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-2xl font-bold">{totalRuns}</div>
          <div className="text-xs text-gray-500 mt-1">Last 50 executions</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Success Rate</span>
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div className="text-2xl font-bold">
            {totalRuns > 0 ? Math.round((successRuns / totalRuns) * 100) : 0}%
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {successRuns} success · {partialRuns} partial · {errorRuns} error
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Total Processed</span>
            <Activity className="h-5 w-5 text-purple-600" />
          </div>
          <div className="text-2xl font-bold">{totalProcessed}</div>
          <div className="text-xs text-gray-500 mt-1">Refills created across all runs</div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Last Run</span>
            <Clock className="h-5 w-5 text-orange-600" />
          </div>
          <div className="text-2xl font-bold">
            {lastRun ? formatTimeAgo(lastRun.started_at) : "—"}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {lastRun ? formatDuration(lastRun.duration_ms) : "No runs yet"}
          </div>
        </div>
      </div>

      {/* Cron Job Runs List */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold">Execution History</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            <span className="ml-2 text-gray-500">Loading runs…</span>
          </div>
        ) : runs.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            No cron job runs found yet.
          </div>
        ) : (
          <Accordion type="multiple" className="px-6 pb-4">
            {runs.map((run) => {
              const config = statusConfig[run.status] || statusConfig.running;
              const StatusIcon = config.icon;
              const processed = run.details?.processed || [];
              const failed = run.details?.failed || [];

              return (
                <AccordionItem key={run.id} value={run.id}>
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-4 flex-1 text-left">
                      <StatusIcon
                        className={`h-5 w-5 flex-shrink-0 ${
                          run.status === "success"
                            ? "text-green-600"
                            : run.status === "partial"
                              ? "text-yellow-600"
                              : run.status === "error"
                                ? "text-red-600"
                                : "text-blue-600 animate-spin"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <span className="font-medium text-sm">
                            {formatDateTime(run.started_at)}
                          </span>
                          <Badge variant="outline" className={config.color}>
                            {config.label}
                          </Badge>
                          <span className="text-xs text-gray-500">
                            {run.records_processed} processed
                          </span>
                          {run.duration_ms !== null && (
                            <span className="text-xs text-gray-400 font-mono">
                              {formatDuration(run.duration_ms)}
                            </span>
                          )}
                          {failed.length > 0 && (
                            <Badge variant="outline" className="border-red-300 text-red-600 bg-red-50">
                              {failed.length} failed
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="pl-9 space-y-4">
                      {/* Global error message */}
                      {run.error_message && (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                          <div className="flex items-start gap-2">
                            <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-red-800 mb-1">Error</p>
                              <p className="text-sm text-red-700 font-mono">{run.error_message}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Successes */}
                      {processed.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Successful ({processed.length})
                          </p>
                          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                            <div className="flex flex-wrap gap-2">
                              {processed.map((item, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center gap-1 text-xs bg-white border border-green-200 rounded px-2 py-1 font-mono"
                                  title={`Rx: ${item.rxId}${item.refillId ? ` → Refill: ${item.refillId}` : ""}`}
                                >
                                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                                  {truncateId(item.rxId as string)}
                                  {item.refillId && (
                                    <>
                                      <span className="text-gray-400">→</span>
                                      {truncateId(item.refillId as string)}
                                    </>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Failures */}
                      {failed.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                            Failed ({failed.length})
                          </p>
                          <div className="space-y-2">
                            {failed.map((item, idx) => (
                              <div
                                key={idx}
                                className="rounded-lg border border-red-200 bg-red-50 p-3"
                              >
                                <div className="flex items-start gap-2">
                                  <XCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="text-xs font-mono font-medium text-red-800">
                                        Rx: {item.rxId}
                                      </span>
                                      {item.step && (
                                        <Badge
                                          variant="outline"
                                          className="border-red-300 text-red-600 text-[10px] px-1.5 py-0"
                                        >
                                          Step: {item.step}
                                        </Badge>
                                      )}
                                    </div>
                                    {item.error && (
                                      <p className="text-xs text-red-700 font-mono break-all">
                                        {item.error}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No details */}
                      {!run.details && !run.error_message && (
                        <p className="text-sm text-gray-400 italic">
                          No details recorded for this run.
                        </p>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}
