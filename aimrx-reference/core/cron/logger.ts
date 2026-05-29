import { createCronClient } from "./supabase";

/**
 * Logs cron job execution to the cron_job_runs table.
 * Returns helpers to track per-item results and mark the run as success/error.
 */
export async function logCronRun(jobName: string) {
  const supabase = createCronClient();
  const startedAt = new Date();

  const processed: Record<string, unknown>[] = [];
  const failed: Record<string, unknown>[] = [];

  const { data } = await supabase
    .from("cron_job_runs")
    .insert({
      job_name: jobName,
      status: "running",
      started_at: startedAt.toISOString(),
    })
    .select("id")
    .single();

  const runId = data?.id;

  const getDetails = () =>
    processed.length || failed.length
      ? { processed, failed }
      : undefined;

  return {
    /** Track a successfully processed item */
    trackSuccess(item: Record<string, unknown>) {
      processed.push(item);
    },
    /** Track a failed item with step and error info */
    trackFailure(item: Record<string, unknown>) {
      failed.push(item);
    },
    async success(recordsProcessed = 0) {
      if (!runId) return;
      const finishedAt = new Date();
      await supabase
        .from("cron_job_runs")
        .update({
          status: failed.length > 0 ? "partial" : "success",
          records_processed: recordsProcessed,
          details: getDetails(),
          finished_at: finishedAt.toISOString(),
          duration_ms: finishedAt.getTime() - startedAt.getTime(),
        })
        .eq("id", runId);
    },
    async error(message: string) {
      if (!runId) return;
      const finishedAt = new Date();
      await supabase
        .from("cron_job_runs")
        .update({
          status: "error",
          error_message: message,
          details: getDetails(),
          finished_at: finishedAt.toISOString(),
          duration_ms: finishedAt.getTime() - startedAt.getTime(),
        })
        .eq("id", runId);
    },
  };
}
