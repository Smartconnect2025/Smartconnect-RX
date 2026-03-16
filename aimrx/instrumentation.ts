export async function register() {
  // Only run cron jobs in the Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startCronJobs } = await import("@core/cron");
    startCronJobs();
  }
}
