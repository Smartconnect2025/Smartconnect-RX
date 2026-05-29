"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { AdminDashboardProps } from "./types";
import { cn } from "@/utils/tailwind-utils";
import { Users, Building2, Pill, FolderTree, UserCog, ShieldCheck, TrendingUp, DollarSign, ShoppingCart, LayoutGrid } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { useAdminDashboard } from "./hooks/useAdminDashboard";
import { MetricCard } from "./components/MetricCard";

interface GroupMetric {
  id: string;
  name: string;
  platform_manager_name: string | null;
  provider_count: number;
  active_providers: number;
  order_count: number;
  total_revenue_cents: number;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  className,
}) => {
  const { metrics, isLoading, error } = useAdminDashboard();
  const [groupMetrics, setGroupMetrics] = useState<GroupMetric[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(true);

  useEffect(() => {
    const fetchGroupMetrics = async () => {
      try {
        const response = await fetch("/api/admin/group-metrics");
        if (response.ok) {
          const data = await response.json();
          setGroupMetrics(data.groupMetrics || []);
        }
      } catch (err) {
        console.error("Failed to fetch group metrics:", err);
      } finally {
        setIsLoadingGroups(false);
      }
    };
    fetchGroupMetrics();
  }, []);

  const formatCurrency = (cents: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(cents / 100);
  };

  if (error) {
    return (
      <div className={cn("container mx-auto max-w-7xl py-8 px-4", className)}>
        <div className="mb-8">
          <h1 className="text-3xl font-bold">
            Admin Dashboard
          </h1>
        </div>
        <div className="text-center py-8">
          <p className="text-red-600">Error loading dashboard data: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("container mx-auto max-w-7xl py-8 px-4", className)}>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Platform Owner Dashboard</h1>
      </div>

      {/* Metrics */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mb-8">
        <MetricCard
          title="Total Providers Invited"
          value={metrics?.totalProvidersInvited || 0}
          subtitle={`${metrics?.activeProviders || 0} active, ${metrics?.inactiveProviders || 0} inactive`}
          isLoading={isLoading}
        />
        <MetricCard
          title="Orders (Last 24 Hours)"
          value={metrics?.ordersLast24Hours || 0}
          subtitle="Prescriptions submitted"
          isLoading={isLoading}
        />
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <Link href="/admin/doctors">
            <Card className="py-6 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Users className="h-6 w-6 text-[#1E3A8A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Manage Providers</h3>
                  <p className="text-xs text-muted-foreground mt-1">View and manage all providers</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/pharmacy-management">
            <Card className="py-6 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-[#1E3A8A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Manage Pharmacies</h3>
                  <p className="text-xs text-muted-foreground mt-1">View and manage pharmacies</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/medication-catalog">
            <Card className="py-6 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <Pill className="h-6 w-6 text-[#1E3A8A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Manage Medications</h3>
                  <p className="text-xs text-muted-foreground mt-1">View medication catalog</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/categories">
            <Card className="py-6 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <LayoutGrid className="h-6 w-6 text-[#1E3A8A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Manage Categories</h3>
                  <p className="text-xs text-muted-foreground mt-1">Create and manage product categories</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/groups">
            <Card className="py-6 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <FolderTree className="h-6 w-6 text-[#1E3A8A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Manage Groups</h3>
                  <p className="text-xs text-muted-foreground mt-1">Manage provider groups</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/platform-managers">
            <Card className="py-6 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <UserCog className="h-6 w-6 text-[#1E3A8A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Platform Managers</h3>
                  <p className="text-xs text-muted-foreground mt-1">Manage platform managers</p>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/super-admins">
            <Card className="py-6 hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
                  <ShieldCheck className="h-6 w-6 text-[#1E3A8A]" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Manage Admins</h3>
                  <p className="text-xs text-muted-foreground mt-1">Create and manage super admins</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>

      {/* Group Performance */}
      {(isLoadingGroups || groupMetrics.length > 0) && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Group Performance</h2>
            <Link href="/admin/groups" className="text-sm text-primary hover:underline">
              Manage Groups
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {isLoadingGroups ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="py-5">
                  <CardContent>
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                      <div className="h-8 bg-gray-200 rounded w-1/3"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              groupMetrics.map((group) => (
                <Card key={group.id} className="py-5 hover:shadow-md transition-shadow" data-testid={`card-group-metric-${group.id}`}>
                  <CardContent>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-base">{group.name}</h3>
                        {group.platform_manager_name && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {group.platform_manager_name}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
                      >
                        <Users className="h-3 w-3 mr-1" />
                        {group.provider_count}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center p-2 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-center mb-1">
                          <TrendingUp className="h-3.5 w-3.5 text-green-600" />
                        </div>
                        <div className="text-xs text-muted-foreground">Active</div>
                        <div className="text-lg font-bold text-green-700">{group.active_providers}</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-center mb-1">
                          <ShoppingCart className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <div className="text-xs text-muted-foreground">Orders</div>
                        <div className="text-lg font-bold text-blue-700">{group.order_count}</div>
                      </div>
                      <div className="text-center p-2 rounded-lg bg-gray-50">
                        <div className="flex items-center justify-center mb-1">
                          <DollarSign className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <div className="text-xs text-muted-foreground">Revenue</div>
                        <div className="text-sm font-bold text-emerald-700">{formatCurrency(group.total_revenue_cents)}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
