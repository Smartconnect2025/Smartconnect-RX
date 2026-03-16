"use client";

import { useState, useEffect } from "react";
import {
  getDashboardMetrics,
  DashboardMetrics,
} from "../services/adminService";

/**
 * Hook for managing admin dashboard data
 * Handles loading state and data fetching for dashboard metrics
 */
export function useAdminDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        setIsLoading(true);
        setError(null);
        const data = await getDashboardMetrics();
        setMetrics(data);
      } catch (err) {
        console.error("Failed to fetch dashboard metrics:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard data",
        );
      } finally {
        setIsLoading(false);
      }
    }

    fetchMetrics();
  }, []);

  const refetch = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getDashboardMetrics();
      setMetrics(data);
    } catch (err) {
      console.error("Failed to refetch dashboard metrics:", err);
      setError(
        err instanceof Error ? err.message : "Failed to reload dashboard data",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return {
    metrics,
    isLoading,
    error,
    refetch,
  };
}
