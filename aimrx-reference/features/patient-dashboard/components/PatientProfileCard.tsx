"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Mail, Phone, MapPin, Calendar } from "lucide-react";
import type { PatientProfile } from "../types";
import { formatDate } from "@/utils/format-date";

interface PatientProfileCardProps {
  patient: PatientProfile | null;
  isLoading: boolean;
}

export function PatientProfileCard({ patient, isLoading }: PatientProfileCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-[#1E3A8A]" />
            My Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (!patient) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-[#1E3A8A]" />
            My Profile
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No profile information available. Complete your intake to add your information.
          </p>
        </CardContent>
      </Card>
    );
  }

  const intakeData = patient.data || {};
  const address = patient.physical_address;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5 text-[#1E3A8A]" />
          My Profile
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-[#1E3A8A]">Basic Information</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{patient.first_name} {patient.last_name}</span>
            </div>
            {patient.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{patient.email}</span>
              </div>
            )}
            {patient.phone && (
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{patient.phone}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span>DOB: {formatDate(patient.date_of_birth)}</span>
            </div>
            {intakeData.gender && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>Gender: {intakeData.gender}</span>
              </div>
            )}
          </div>
        </div>

        {/* Location */}
        {address && (address.city || address.state) && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-semibold text-[#1E3A8A]">Location</h4>
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span>
                {[address.city, address.state].filter(Boolean).join(", ")}
              </span>
            </div>
          </div>
        )}

        {/* Medical Info */}
        {(intakeData.height || intakeData.weight || intakeData.blood_type ||
          intakeData.allergies?.length || intakeData.medications?.length ||
          intakeData.medical_conditions?.length) && (
          <div className="space-y-2 pt-2 border-t">
            <h4 className="text-sm font-semibold text-[#1E3A8A]">Medical Information</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              {intakeData.height && (
                <div>
                  <span className="text-muted-foreground">Height:</span> {intakeData.height}
                </div>
              )}
              {intakeData.weight && (
                <div>
                  <span className="text-muted-foreground">Weight:</span> {intakeData.weight}
                </div>
              )}
              {intakeData.blood_type && (
                <div>
                  <span className="text-muted-foreground">Blood Type:</span> {intakeData.blood_type}
                </div>
              )}
            </div>

            {intakeData.allergies && intakeData.allergies.length > 0 && (
              <div className="mt-2">
                <span className="text-muted-foreground text-sm">Allergies:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {intakeData.allergies.map((allergy, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-red-50 text-red-700 text-xs rounded-full"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {intakeData.medications && intakeData.medications.length > 0 && (
              <div className="mt-2">
                <span className="text-muted-foreground text-sm">Current Medications:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {intakeData.medications.map((med, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full"
                    >
                      {med}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {intakeData.medical_conditions && intakeData.medical_conditions.length > 0 && (
              <div className="mt-2">
                <span className="text-muted-foreground text-sm">Medical Conditions:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {intakeData.medical_conditions.map((condition, index) => (
                    <span
                      key={index}
                      className="px-2 py-0.5 bg-yellow-50 text-yellow-700 text-xs rounded-full"
                    >
                      {condition}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
