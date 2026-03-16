"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";

interface SystemLog {
  id: string;
  created_at: string;
  action: string;
  user_name: string;
  user_email: string;
  details: string | null;
  queue_id: string | null;
  status: string;
}

interface SystemLogsResponse {
  success: boolean;
  logs: SystemLog[];
  total: number;
  limit: number;
  offset: number;
  filters: {
    actions: string[];
    statuses: string[];
  };
}

export function SystemLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit] = useState(50);
  const [availableFilters, setAvailableFilters] = useState<{
    actions: string[];
    statuses: string[];
  }>({ actions: [], statuses: [] });

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (filterAction && filterAction !== "all") params.append("action", filterAction);
      if (filterStatus && filterStatus !== "all") params.append("status", filterStatus);

      const response = await fetch(`/api/admin/system-logs?${params}`);
      const data: SystemLogsResponse = await response.json();

      if (data.success) {
        setLogs(data.logs);
        setTotal(data.total);
        setAvailableFilters(data.filters);
      } else {
        toast.error("Failed to fetch system logs");
      }
    } catch (error) {
      console.error("Error fetching logs:", error);
      toast.error("Failed to fetch system logs");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [offset, filterAction, filterStatus]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "success":
        return "bg-green-100 text-green-800";
      case "error":
        return "bg-red-100 text-red-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const filteredLogs = logs.filter((log) =>
    searchTerm
      ? log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.user_email.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              System Activity Logs
            </CardTitle>
            <CardDescription>
              View all system actions, API calls, and user activities ({total} total logs)
            </CardDescription>
          </div>
          <Button onClick={fetchLogs} disabled={isLoading} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search logs by action, details, or user..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by Action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {availableFilters.actions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {availableFilters.statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(filterAction !== "all" || filterStatus !== "all" || searchTerm) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterAction("all");
                  setFilterStatus("all");
                  setSearchTerm("");
                }}
              >
                Clear Filters
              </Button>
            )}
          </div>
        </div>

        {/* Logs Table */}
        <div className="border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600">No logs found matching your criteria</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      User
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <code className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                          {log.action}
                        </code>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div>
                          <p className="font-medium text-gray-900">{log.user_name}</p>
                          <p className="text-xs text-gray-500">{log.user_email}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-md truncate">
                        {log.details || <span className="text-gray-400 italic">No details</span>}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge className={getStatusColor(log.status)}>{log.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {!isLoading && filteredLogs.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Showing {offset + 1} to {Math.min(offset + limit, total)} of {total} logs
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(Math.max(0, offset - limit))}
                disabled={offset === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOffset(offset + limit)}
                disabled={offset + limit >= total}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
