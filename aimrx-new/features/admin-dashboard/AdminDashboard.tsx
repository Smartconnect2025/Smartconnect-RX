"use client";

import React from "react";
import Link from "next/link";
import { AdminDashboardProps } from "./types";
import { cn } from "@/utils/tailwind-utils";
import { Users, Building2, Pill, ShieldCheck, LayoutGrid } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

import { useAdminDashboard } from "./hooks/useAdminDashboard";
import { MetricCard } from "./components/MetricCard";

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  className,
}) => {
  const { metrics, isLoading, error } = useAdminDashboard();

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

    </div>
  );
};
