"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Pill, ArrowRight } from "lucide-react";
import type { PatientPrescription } from "../types";

interface MyPrescriptionsCardProps {
  prescriptions: PatientPrescription[];
  isLoading: boolean;
}

const getStatusColor = (status: string) => {
  switch (status.toLowerCase()) {
    case "submitted":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "billing":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "approved":
      return "bg-green-100 text-green-800 border-green-200";
    case "processing":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "shipped":
      return "bg-indigo-100 text-indigo-800 border-indigo-200";
    case "delivered":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export function MyPrescriptionsCard({
  prescriptions,
  isLoading,
}: MyPrescriptionsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-[#1E3A8A]" />
            My Prescriptions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Pill className="h-5 w-5 text-[#1E3A8A]" />
          My Prescriptions
        </CardTitle>
        {prescriptions.length > 0 && (
          <Link href="/prescriptions">
            <Button variant="ghost" size="sm" className="text-[#1E3A8A]">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        )}
      </CardHeader>
      <CardContent>
        {prescriptions.length === 0 ? (
          <div className="text-center py-6">
            <Pill className="mx-auto h-10 w-10 text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              No prescriptions yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {prescriptions.map((rx) => (
              <div
                key={rx.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <h4 className="font-medium text-sm truncate">{rx.medication}</h4>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <span>{formatDate(rx.submitted_at)}</span>
                    {rx.dosage && (
                      <>
                        <span>-</span>
                        <span>{rx.dosage}</span>
                      </>
                    )}
                  </div>
                  {rx.pharmacy_name && (
                    <p
                      className="text-xs mt-1 font-medium"
                      style={{ color: rx.pharmacy_color || "#1E3A8A" }}
                    >
                      {rx.pharmacy_name}
                    </p>
                  )}
                </div>
                <Badge
                  variant="outline"
                  className={`${getStatusColor(rx.status)} text-xs shrink-0 ml-2`}
                >
                  {rx.status.charAt(0).toUpperCase() + rx.status.slice(1)}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
