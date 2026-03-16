"use client";

import { useState } from "react";
import { DollarSign, Tag } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useProviderFinancialData } from "./hooks/useProviderFinancialData";
import type { MonthFilter } from "./types";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const getPaymentStatusStyle = (status: string | null) => {
  switch (status) {
    case "paid":
      return "bg-green-100 text-green-800 border-green-200";
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "unpaid":
      return "bg-gray-100 text-gray-800 border-gray-200";
    case "failed":
      return "bg-red-100 text-red-800 border-red-200";
    case "refunded":
      return "bg-purple-100 text-purple-800 border-purple-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const formatCentsToDollars = (cents: number | null) => {
  if (cents == null) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
};

export function ProviderFinancialDashboard() {
  const now = new Date();
  const [monthFilter, setMonthFilter] = useState<MonthFilter>({
    year: now.getFullYear(),
    month: now.getMonth(),
  });

  const {
    prescriptions,
    totalProfitCents,
    totalDiscountCents,
    tierInfo,
    isLoading,
    error,
  } = useProviderFinancialData(monthFilter);

  // Generate year options (current year and 2 previous)
  const currentYear = now.getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear];

  const hasDiscount = tierInfo.discountPercentage > 0;

  return (
    <div className="container max-w-7xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">
          Financial Dashboard
        </h1>

        {/* Month/Year Filter */}
        <div className="flex items-center gap-2">
          <select
            value={monthFilter.month}
            onChange={(e) =>
              setMonthFilter((prev) => ({
                ...prev,
                month: Number(e.target.value),
              }))
            }
            className="h-[40px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {MONTH_NAMES.map((name, index) => (
              <option key={index} value={index}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={monthFilter.year}
            onChange={(e) =>
              setMonthFilter((prev) => ({
                ...prev,
                year: Number(e.target.value),
              }))
            }
            className="h-[40px] rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tier Info Banner */}
      {hasDiscount && (
        <div className="bg-blue-50 rounded-lg px-4 py-3 border border-blue-200">
          <p className="text-sm text-blue-800">
            Your pricing tier:{" "}
            <span className="font-semibold">{tierInfo.tierName}</span> —{" "}
            {tierInfo.discountPercentage}% discount on medications
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Oversight Fees */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
              <DollarSign className="h-6 w-6 text-green-700" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Total Consultation Fees — {MONTH_NAMES[monthFilter.month]}{" "}
                {monthFilter.year}
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {formatCentsToDollars(totalProfitCents)}
              </p>
            </div>
          </div>
        </div>

        {/* Total Tier Discount */}
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center">
              <Tag className="h-6 w-6 text-blue-700" />
            </div>
            <div>
              <p className="text-sm text-gray-500">
                Total Tier Discount — {MONTH_NAMES[monthFilter.month]}{" "}
                {monthFilter.year}
              </p>
              <p className="text-3xl font-bold text-blue-700">
                {hasDiscount
                  ? `-${formatCentsToDollars(totalDiscountCents)}`
                  : "$0.00"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Prescriptions Table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-x-auto">
        {isLoading ? (
          <div className="p-12 text-center text-gray-500">Loading...</div>
        ) : error ? (
          <div className="p-12 text-center text-red-600">{error}</div>
        ) : prescriptions.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            No prescriptions found for {MONTH_NAMES[monthFilter.month]}{" "}
            {monthFilter.year}.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Medication</TableHead>
                <TableHead>Payment Status</TableHead>
                <TableHead className="text-right">Medication Price</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Oversight Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prescriptions.map((rx) => {
                const basePrice =
                  rx.medication_data?.aimrx_site_pricing_cents ?? null;
                const discountCents =
                  basePrice != null && hasDiscount
                    ? Math.round(
                        basePrice * (tierInfo.discountPercentage / 100),
                      )
                    : null;

                return (
                  <TableRow key={rx.id}>
                    <TableCell className="text-sm text-gray-600">
                      {new Date(rx.submitted_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {rx.patient
                        ? `${rx.patient.first_name} ${rx.patient.last_name}`
                        : "—"}
                    </TableCell>
                    <TableCell>{rx.medication}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={`${getPaymentStatusStyle(rx.payment_status)} text-xs px-2 py-1`}
                      >
                        {rx.payment_status
                          ? rx.payment_status.charAt(0).toUpperCase() +
                            rx.payment_status.slice(1)
                          : "Unknown"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {basePrice != null
                        ? formatCentsToDollars(basePrice)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right text-sm text-green-700 font-medium">
                      {discountCents != null && discountCents > 0
                        ? `-${formatCentsToDollars(discountCents)}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCentsToDollars(rx.profit_cents)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
