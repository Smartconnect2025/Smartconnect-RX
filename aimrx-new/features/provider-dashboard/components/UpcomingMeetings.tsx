"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Clock,
  Video,
  Phone,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { format, parseISO, isToday, isTomorrow } from "date-fns";
import { ProviderAppointment } from "../hooks/useProviderAppointments";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface UpcomingMeetingsProps {
  appointments: ProviderAppointment[];
  loading: boolean;
  error: string | null;
  cancelAppointment: (appointmentId: string) => Promise<boolean>;
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

const formatAppointmentDate = (dateString: string) => {
  const date = parseISO(dateString);

  if (isToday(date)) {
    return "Today";
  } else if (isTomorrow(date)) {
    return "Tomorrow";
  } else {
    return format(date, "MMM d, yyyy");
  }
};

const AppointmentCard: React.FC<{
  appointment: ProviderAppointment;
  onCancel: (id: string) => void;
}> = ({ appointment, onCancel }) => {
  const handleCancelAppointment = () => {
    onCancel(appointment.id);
  };

  const handleJoinAppointment = () => {
    // Navigate to the appointment page using the video call URL format
    window.location.href = `/appointment/${appointment.id}`;
  };

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
            <Button
              size="sm"
              variant="outline"
              onClick={handleJoinAppointment}
              className="border border-border w-full sm:w-auto"
            >
              Join
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel Appointment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to cancel the appointment with{" "}
                    {patientName} scheduled for{" "}
                    {format(appointmentDate, "h:mm a")}? This action cannot be
                    undone and the patient will be notified.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="border border-border">
                    Keep Appointment
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancelAppointment}
                    className="bg-destructive hover:bg-destructive/90"
                  >
                    Cancel Appointment
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const UpcomingMeetings: React.FC<UpcomingMeetingsProps> = ({
  appointments,
  loading,
  error,
  cancelAppointment,
}) => {
  const handleCancelAppointment = async (appointmentId: string) => {
    const success = await cancelAppointment(appointmentId);
    if (success) {
      toast.success("Appointment cancelled successfully");
    } else {
      toast.error("Failed to cancel appointment");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <p className="text-red-600 mb-4">
            Error loading appointments: {error}
          </p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  // Group appointments by date
  const groupedAppointments = appointments.reduce(
    (groups, appointment) => {
      const dateKey = formatAppointmentDate(appointment.datetime);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(appointment);
      return groups;
    },
    {} as Record<string, ProviderAppointment[]>,
  );

  // Sort appointments within each group by time
  Object.keys(groupedAppointments).forEach((dateKey) => {
    groupedAppointments[dateKey].sort((a, b) => {
      const timeA = parseISO(a.datetime).getTime();
      const timeB = parseISO(b.datetime).getTime();
      return timeA - timeB;
    });
  });

  const todayAppointments = groupedAppointments["Today"] || [];
  const upcomingAppointments = Object.entries(groupedAppointments)
    .filter(([date]) => date !== "Today")
    .sort(([dateA], [dateB]) => {
      // Sort by actual date
      const appointmentA = appointments.find(
        (a) => formatAppointmentDate(a.datetime) === dateA,
      );
      const appointmentB = appointments.find(
        (a) => formatAppointmentDate(a.datetime) === dateB,
      );

      if (!appointmentA || !appointmentB) return 0;

      return (
        parseISO(appointmentA.datetime).getTime() -
        parseISO(appointmentB.datetime).getTime()
      );
    });

  return (
    <div className="space-y-6">
      {/* Today's Appointments */}
      {todayAppointments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              <span>Today&apos;s Appointments</span>
              <Badge variant="secondary">{todayAppointments.length}</Badge>
            </h2>
          </div>
          <div className="grid gap-4">
            {todayAppointments.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                onCancel={handleCancelAppointment}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming Appointments */}
      {upcomingAppointments.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold flex items-center space-x-2">
              <Clock className="h-5 w-5 text-green-600" />
              <span>Appointments</span>
            </h2>
          </div>
          <div className="space-y-6">
            {upcomingAppointments.map(([date, appointments]) => (
              <div key={date}>
                <h3 className="text-lg font-medium mb-3 text-muted-foreground">
                  {date}
                </h3>
                <div className="grid gap-4">
                  {appointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onCancel={handleCancelAppointment}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {todayAppointments.length === 0 && upcomingAppointments.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">
              No upcoming appointments
            </h3>
            <p className="text-muted-foreground mb-4">
              You don&apos;t have any scheduled appointments at the moment.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
