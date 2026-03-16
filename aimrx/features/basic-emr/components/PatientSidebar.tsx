"use client";

import {
  Calendar,
  Edit,
  Mail,
  MapPin,
  Phone,
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
      </div>
    </div>
  );
}
