"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, AlertCircle, CheckCircle2, RefreshCw, ExternalLink, Database, Zap } from "lucide-react";
import { toast } from "sonner";

interface HealthCheck {
  name: string;
  category: "database" | "external" | "internal";
  status: "operational" | "degraded" | "error" | "unknown";
  responseTime: number | null;
  lastChecked: string;
  error: string | null;
  endpoint: string;
}

interface APIHealthResponse {
  success: boolean;
  overallStatus: "operational" | "degraded" | "critical";
  timestamp: string;
  healthChecks: HealthCheck[];
  summary: {
    total: number;
    operational: number;
    degraded: number;
    error: number;
  };
}

export function APIMonitor() {
  const [healthData, setHealthData] = useState<APIHealthResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchHealthStatus = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/api-health");
      const data = await response.json();

      if (data.success) {
        setHealthData(data);
        setLastRefresh(new Date());

        // Show toast if any services are down
        if (data.overallStatus === "critical") {
          toast.error("Critical: Some APIs are down!");
        } else if (data.overallStatus === "degraded") {
          toast.warning("Warning: Some APIs are degraded");
        }
      } else {
        toast.error("Failed to fetch API health status");
      }
    } catch (error) {
      console.error("Error fetching API health:", error);
      toast.error("Failed to check API health");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchHealthStatus();
    // Auto-refresh every 2 minutes
    const interval = setInterval(fetchHealthStatus, 120000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-100 text-green-800 border-green-200";
      case "degraded":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "error":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "operational":
        return <CheckCircle2 className="h-5 w-5 text-green-600" />;
      case "degraded":
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "database":
        return <Database className="h-4 w-4" />;
      case "external":
        return <ExternalLink className="h-4 w-4" />;
      case "internal":
        return <Zap className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  if (isLoading && !healthData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 animate-pulse" />
            API Health Monitor
          </CardTitle>
          <CardDescription>Checking system status...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                API Health Monitor
              </CardTitle>
              <CardDescription>Real-time monitoring of all system APIs</CardDescription>
            </div>
            <Button onClick={fetchHealthStatus} disabled={isLoading} variant="outline" size="sm">
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {healthData && (
            <div className="space-y-4">
              {/* Overall Status */}
              <div className="flex items-center justify-between p-4 border rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50">
                <div className="flex items-center gap-3">
                  {getStatusIcon(healthData.overallStatus)}
                  <div>
                    <p className="font-semibold text-lg">
                      System Status:{" "}
                      <span className="capitalize">{healthData.overallStatus}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Last checked: {new Date(lastRefresh).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <Badge
                  className={`${getStatusColor(healthData.overallStatus)} px-4 py-2 text-sm font-bold`}
                >
                  {healthData.overallStatus.toUpperCase()}
                </Badge>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 border rounded-lg text-center">
                  <p className="text-2xl font-bold text-gray-900">{healthData.summary.total}</p>
                  <p className="text-xs text-gray-600 mt-1">Total APIs</p>
                </div>
                <div className="p-4 border rounded-lg text-center bg-green-50">
                  <p className="text-2xl font-bold text-green-700">{healthData.summary.operational}</p>
                  <p className="text-xs text-gray-600 mt-1">Operational</p>
                </div>
                <div className="p-4 border rounded-lg text-center bg-yellow-50">
                  <p className="text-2xl font-bold text-yellow-700">{healthData.summary.degraded}</p>
                  <p className="text-xs text-gray-600 mt-1">Degraded</p>
                </div>
                <div className="p-4 border rounded-lg text-center bg-red-50">
                  <p className="text-2xl font-bold text-red-700">{healthData.summary.error}</p>
                  <p className="text-xs text-gray-600 mt-1">Errors</p>
                </div>
              </div>

              {/* Individual API Status */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">
                  API Status Details
                </h3>

                {/* Group by category */}
                {["database", "external", "internal"].map((category) => {
                  const categoryAPIs = healthData.healthChecks.filter((api) => api.category === category);
                  if (categoryAPIs.length === 0) return null;

                  return (
                    <div key={category} className="space-y-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        {getCategoryIcon(category)}
                        {category} APIs
                      </p>
                      {categoryAPIs.map((api, index) => (
                        <div
                          key={index}
                          className={`p-3 border rounded-lg ${getStatusColor(api.status)} bg-opacity-50`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(api.status)}
                              <div className="flex-1">
                                <p className="font-medium text-sm">{api.name}</p>
                                <p className="text-xs text-gray-600 font-mono">{api.endpoint}</p>
                                {api.error && (
                                  <p className="text-xs text-red-600 mt-1">Error: {api.error}</p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <Badge variant="outline" className="text-xs">
                                {api.status}
                              </Badge>
                              {api.responseTime && (
                                <p className="text-xs text-gray-500 mt-1">
                                  {api.responseTime}ms
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
