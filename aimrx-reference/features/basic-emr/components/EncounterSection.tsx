"use client";

import { AlertCircle, CheckCircle, Circle, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { Encounter } from "../types";

interface EncounterSectionProps {
  title: string;
  encounters: Encounter[];
  onViewEncounter?: (encounterId: string) => void;
  onStartCall?: (encounterId: string) => void;
  onEditEncounter?: (encounterId: string) => void;
  onDeleteEncounter?: (encounterId: string) => void;

  patientId?: string;
}

export function EncounterSection({
  title,
  encounters,
  onViewEncounter,
  onStartCall,
  onEditEncounter,
  onDeleteEncounter,

  patientId,
}: EncounterSectionProps) {
  const router = useRouter();
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const getEncounterIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "in_progress":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Circle className="h-4 w-4 text-gray-400" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString("en-US", {
        weekday: "short",
        month: "2-digit",
        day: "2-digit",
        year: "numeric",
      }),
      time: date.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
      }),
    };
  };

  const handleView = (encounterId: string) => {
    if (patientId) {
      // All encounters use the same route - EncounterView handles different layouts
      router.push(`/basic-emr/patients/${patientId}/encounters/${encounterId}`);
    } else if (onViewEncounter) {
      onViewEncounter(encounterId);
    }
    setOpenDropdownId(null);
  };

  const handleEdit = (encounterId: string) => {
    onEditEncounter?.(encounterId);
    setOpenDropdownId(null);
  };

  const handleDelete = (encounterId: string) => {
    onDeleteEncounter?.(encounterId);
    setOpenDropdownId(null);
  };

  if (encounters.length === 0) {
    return (
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-6">{title}</h2>
        <p className="text-gray-600">
          {title.includes("Upcoming")
            ? "No upcoming encounters"
            : "No past encounters"}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900 mb-6">{title}</h2>
      <div className="space-y-3">
        {encounters.map((encounter) => {
          const dateTime = formatDateTime(encounter.date);
          return (
            <div
              key={encounter.id}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border border-gray-200 rounded-lg gap-4"
            >
              <div className="flex items-center justify-between flex-1 min-w-0">
                <div className="flex items-center space-x-3 flex-1 min-w-0">
                  {getEncounterIcon(encounter.status)}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">
                      {encounter.title}
                    </div>
                    <div className="text-sm text-gray-600">
                      <div className="flex flex-wrap items-center gap-1">
                        <span>{dateTime.date}</span>
                        <span>•</span>
                        <span>{dateTime.time}</span>
                        {encounter.businessType === "appointment_based" &&
                          encounter.appointmentId && (
                            <>
                              <span>•</span>
                              <span className="text-blue-600">
                                Appointment #
                                {encounter.appointmentId.slice(0, 8)}
                              </span>
                            </>
                          )}
                        {encounter.businessType === "coaching" && (
                          <span className="ml-2 text-purple-600">
                            • Coaching Session
                          </span>
                        )}
                        {(encounter.businessType === "order_based" ||
                          encounter.businessType === "order_based_async" ||
                          encounter.businessType === "order_based_sync") &&
                          encounter.orderId && (
                            <>
                              <span>•</span>
                              <span className="text-green-600">
                                Order #{encounter.orderId.slice(0, 8)}
                              </span>
                            </>
                          )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {encounter.status === "upcoming" &&
                onStartCall &&
                encounter.businessType !== "order_based" &&
                encounter.businessType !== "order_based_async" ? (
                  <Button
                    variant="default"
                    onClick={() => onStartCall(encounter.id)}
                  >
                    Start Call
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleView(encounter.id)}
                    className="border-border"
                  >
                    {encounter.businessType === "order_based" ||
                    encounter.businessType === "order_based_async" ||
                    encounter.businessType === "order_based_sync"
                      ? "Review"
                      : "View"}
                  </Button>
                )}

                {/* Three-dot menu for upcoming encounters (not for order-based or async orders) */}
                {encounter.status === "upcoming" &&
                  encounter.businessType !== "order_based" &&
                  encounter.businessType !== "order_based_async" && (
                    <DropdownMenu
                      open={openDropdownId === encounter.id}
                      onOpenChange={(open) =>
                        setOpenDropdownId(open ? encounter.id : null)
                      }
                    >
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 p-0 hover:bg-gray-100 flex-shrink-0"
                        >
                          <MoreHorizontal className="h-4 w-4 rotate-90" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => handleView(encounter.id)}
                        >
                          View
                        </DropdownMenuItem>

                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => handleEdit(encounter.id)}
                        >
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer"
                          onClick={() => handleDelete(encounter.id)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
