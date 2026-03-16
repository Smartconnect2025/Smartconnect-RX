"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MessageCircle,
  Loader2,
  History,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ProviderAppointment } from "../hooks/useProviderAppointments";

interface PastAppointmentsProps {
  pastAppointments: ProviderAppointment[];
  pastLoading: boolean;
  pastError: string | null;
}

// Helper function to get appointment type icon
const getTypeIcon = (type: string) => {
  switch (type) {
    case "video":
      return <Video className="h-4 w-4" />;
    case "phone":
      return <Phone className="h-4 w-4" />;
    case "chat":
      return <MessageCircle className="h-4 w-4" />;
    default:
      return <Calendar className="h-4 w-4" />;
  }
};

const PastAppointmentCard: React.FC<{
  appointment: ProviderAppointment;
}> = ({ appointment }) => {
  const appointmentDate = parseISO(appointment.datetime);
  const patientName =
    appointment.patient?.first_name && appointment.patient?.last_name
      ? `${appointment.patient.first_name} ${appointment.patient.last_name}`
      : "Patient";

  // Get initials safely
  const getInitials = () => {
    if (appointment.patient?.first_name && appointment.patient?.last_name) {
      return `${appointment.patient.first_name.charAt(
        0,
      )}${appointment.patient.last_name.charAt(0)}`;
    }
    return "P";
  };

  return (
    <Card className="hover:shadow-md transition-shadow py-0">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <Avatar className="h-10 w-10 flex-shrink-0">
              <AvatarFallback>{getInitials()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-sm truncate">{patientName}</h3>
              <div className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span>{format(appointmentDate, "MMM d, yyyy")}</span>
                <span>•</span>
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span>{format(appointmentDate, "h:mm a")}</span>
                <span>•</span>
                <span>{appointment.duration || 30} min</span>
                <span>•</span>
                <div className="flex items-center space-x-1">
                  {getTypeIcon(appointment.type || "consultation")}
                  <span className="capitalize">
                    {appointment.type || "consultation"}
                  </span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                <span className="font-medium">Reason:</span>{" "}
                {appointment.reason || "General consultation"}
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2 flex-shrink-0">
            <Badge variant="secondary" className="w-full sm:w-auto">
              Completed
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const PastAppointments: React.FC<PastAppointmentsProps> = ({
  pastAppointments,
  pastLoading,
  pastError,
}) => {
  if (pastLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (pastError) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <p className="text-red-600 mb-4">
            Error loading past appointments: {pastError}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Past Appointments Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center space-x-2">
          <span>Recent Appointments</span>
        </h2>
      </div>

      {/* Past Appointments List */}
      {pastAppointments.length > 0 ? (
        <div className="grid gap-4">
          {pastAppointments.map((appointment) => (
            <PastAppointmentCard
              key={appointment.id}
              appointment={appointment}
            />
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <CardContent>
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No recent appointments
            </h3>
            <p className="text-muted-foreground mb-4">
              You don&apos;t have any recent appointments.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
