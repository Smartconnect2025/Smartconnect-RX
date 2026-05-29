"use client";

import {
  AlertTriangle,
  Calendar,
  Edit,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
} from "lucide-react";

import { Patient } from "../types";

interface PatientSidebarProps {
  patient: Patient;
  onEditPatient: () => void;
}

export function PatientSidebar({
  patient,
  onEditPatient,
}: PatientSidebarProps) {
  const getPatientInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="w-full lg:w-80 bg-white border-r border-gray-200 flex flex-col hidden lg:flex">
      {/* Patient Header */}
      <div className="p-4 sm:p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3 sm:space-x-4 mb-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary rounded-full flex items-center justify-center text-white font-semibold text-base sm:text-lg">
            {getPatientInitials(patient.firstName, patient.lastName)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900 truncate">
                {patient.firstName} {patient.lastName}
              </h2>
              <Edit
                className="h-4 w-4 text-gray-400 cursor-pointer hover:text-gray-600 flex-shrink-0"
                onClick={onEditPatient}
              />
            </div>
          </div>
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center space-x-2 text-gray-600">
            <Calendar className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              DOB: {formatDate(patient.dateOfBirth)}
            </span>
          </div>
          {patient.phone && (
            <div className="flex items-center space-x-2 text-gray-600">
              <Phone className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{patient.phone}</span>
            </div>
          )}
          {patient.email && (
            <div className="flex items-center space-x-2 text-gray-600">
              <Mail className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{patient.email}</span>
            </div>
          )}
          {patient.address && (
            <div className="flex items-center space-x-2 text-gray-600">
              <MapPin className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">
                {patient.address.street}, {patient.address.city},{" "}
                {patient.address.state} {patient.address.zipCode}
              </span>
            </div>
          )}
        </div>

        {/* Allergies banner — high-visibility safety info */}
        <div className="mt-4">
          {patient.allergies && patient.allergies.trim().length > 0 ? (
            <div
              className="rounded-lg border border-red-300 bg-red-50 p-3"
              data-testid="banner-patient-allergies"
            >
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
                <span className="text-xs font-bold uppercase tracking-wide text-red-700">
                  Allergies
                </span>
              </div>
              <p
                className="text-sm text-red-900 whitespace-pre-wrap break-words leading-snug"
                data-testid="text-patient-allergies"
              >
                {patient.allergies}
              </p>
              <button
                type="button"
                onClick={onEditPatient}
                className="mt-2 text-xs font-medium text-red-700 hover:text-red-800 underline underline-offset-2"
                data-testid="button-edit-allergies"
              >
                Edit allergies
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onEditPatient}
              className="w-full rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 transition-colors p-3 text-left"
              data-testid="banner-patient-no-allergies"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <ShieldCheck className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-600">
                  Allergies
                </span>
              </div>
              <p className="text-sm text-gray-600">
                No known allergies on file.{" "}
                <span className="text-primary font-medium">
                  Add allergies →
                </span>
              </p>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
