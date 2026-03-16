"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, Video, User } from "lucide-react";

interface AppointmentDetailsTabProps {
  encounter: {
    id: string;
    date: string;
    status: string;
    businessType: string;
    title: string;
    providerName?: string;
    providerNotes?: string;
    finalizedAt?: string | null;
    finalizedBy?: string;
    appointment_id?: string;
  };
  appointment?: {
    id: string;
    datetime: string;
    duration: number;
    type: string;
    reason: string;
    provider_id: string;
    patient_id: string;
    provider?: {
      id: string;
      first_name: string;
      last_name: string;
      specialty?: string;
      avatar_url?: string;
    };
  };
  onJoinCall?: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
}

export function AppointmentDetailsTab({
  encounter,
  appointment,
  onJoinCall,
  onReschedule,
  onCancel,
}: AppointmentDetailsTabProps) {
  if (!appointment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Appointment Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No appointment scheduled for this encounter.
            </p>
            {encounter.businessType === "order_based_sync" && (
              <p className="text-sm text-muted-foreground mt-2">
                This order requires an appointment for consultation.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  const appointmentDate = new Date(appointment.datetime);
  const isUpcoming = appointmentDate > new Date();
  const isCompleted = encounter.status === "completed";

  return (
    <div className="space-y-6">
      {/* Appointment Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Appointment Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Date & Time</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {appointmentDate.toLocaleDateString("en-US", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </p>
              <p className="text-sm text-muted-foreground">
                {appointmentDate.toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Duration</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {appointment.duration} minutes
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Video className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Type</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {appointment.type}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Provider</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {appointment.provider?.first_name &&
                appointment.provider?.last_name
                  ? `${appointment.provider.first_name} ${appointment.provider.last_name}`
                  : "Dr. Provider"}
              </p>
              {appointment.provider?.specialty && (
                <p className="text-xs text-muted-foreground">
                  {appointment.provider.specialty}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Reason for Visit</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {appointment.reason}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Status:</span>
            <Badge
              variant={
                isCompleted ? "default" : isUpcoming ? "secondary" : "outline"
              }
            >
              {isCompleted ? "Completed" : isUpcoming ? "Upcoming" : "Past"}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Video Call Information */}
      {isUpcoming && !isCompleted && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Video Call Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <Video className="h-5 w-5 text-blue-600 mt-0.5" />
                <div className="space-y-2">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">
                    Telehealth Appointment
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    This is a video consultation. You&apos;ll receive a link to
                    join the call 15 minutes before your appointment time.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Before Your Appointment:</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Test your camera and microphone</li>
                <li>• Ensure you have a stable internet connection</li>
                <li>• Find a quiet, private location</li>
                <li>• Have your ID ready for verification</li>
              </ul>
            </div>

            <div className="flex gap-2">
              <Button onClick={onJoinCall} className="flex-1">
                <Video className="h-4 w-4 mr-2" />
                Join Call
              </Button>
              <Button
                variant="outline"
                onClick={onReschedule}
                className="border-border"
              >
                Reschedule
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Appointment Actions */}
      {!isCompleted && (
        <Card>
          <CardHeader>
            <CardTitle>Appointment Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              {isUpcoming && (
                <>
                  <Button
                    variant="outline"
                    onClick={onReschedule}
                    className="border-border"
                  >
                    Reschedule
                  </Button>
                  <Button variant="destructive" onClick={onCancel}>
                    Cancel
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
