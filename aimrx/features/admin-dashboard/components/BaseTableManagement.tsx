"use client";

import React, { ReactNode } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Filter } from "lucide-react";

interface BaseTableItem {
  status: "active" | "inactive";
}

interface BaseTableManagementProps<T extends BaseTableItem> {
  title?: string;
  description?: string;
  icon?: ReactNode;
  data: T[];
  isLoading: boolean;
  searchTerm?: string;
  onSearchChange?: (value: string) => void;
  statusFilter?: string;
  onStatusFilterChange?: (value: string) => void;
  onRefresh?: () => void;
  renderTableHeaders: () => ReactNode;
  renderTableRow: (item: T) => ReactNode;
  getItemKey: (item: T) => string;
  searchPlaceholder?: string;
  emptyStateMessage: string;
}

export function BaseTableManagement<T extends BaseTableItem>({
  title,
  description,
  icon,
  data,
  isLoading,
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  onRefresh,
  renderTableHeaders,
  renderTableRow,
  getItemKey,
  searchPlaceholder,
  emptyStateMessage,
}: BaseTableManagementProps<T>) {
  const activeCount = data.filter((item) => item.status === "active").length;
  const inactiveCount = data.filter(
    (item) => item.status === "inactive",
  ).length;

  return (
    <div className="space-y-6">
      <Card className="!pt-1 !pb-5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Search and Filter Controls */}
            {(searchTerm !== undefined ||
              statusFilter !== undefined ||
              onRefresh !== undefined) && (
              <div className="flex flex-col sm:flex-row gap-4">
                {searchTerm !== undefined && onSearchChange && (
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={searchPlaceholder}
                      value={searchTerm}
                      onChange={(e) => onSearchChange(e.target.value)}
                      className="pl-10 rounded-lg"
                    />
                  </div>
                )}
                {statusFilter !== undefined && onStatusFilterChange && (
                  <Select
                    value={statusFilter}
                    onValueChange={onStatusFilterChange}
                  >
                    <SelectTrigger className="w-full sm:w-48">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
                {onRefresh && (
                  <Button
                    onClick={onRefresh}
                    variant="outline"
                    disabled={isLoading}
                  >
                    {isLoading ? "Loading..." : "Refresh"}
                  </Button>
                )}
              </div>
            )}

            {/* Table */}
            <div className="border border-border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {renderTableHeaders()}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32">
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                          <span className="ml-2 text-sm text-muted-foreground">
                            Loading...
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="h-32">
                        <div className="flex flex-col items-center justify-center py-6">
                          <h3 className="mt-4 text-lg font-semibold">
                            No items found
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {searchTerm || statusFilter !== "all"
                              ? "Try adjusting your search or filters"
                              : emptyStateMessage}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map((item) => (
                      <TableRow
                        key={getItemKey(item)}
                        className="hover:bg-muted/50"
                      >
                        {renderTableRow(item)}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Summary Stats */}
            <div className="flex justify-between items-center text-sm text-muted-foreground">
              <span>
                Showing {data.length} of {data.length} items
              </span>
              <div className="flex gap-4">
                <span>Active: {activeCount}</span>
                <span>Inactive: {inactiveCount}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
