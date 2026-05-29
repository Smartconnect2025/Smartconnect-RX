"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Edit,
  Key,
  Power,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@core/supabase";
import { toast } from "sonner";
import { formatPhoneNumber } from "@/core/utils/phone";
import { AdminNavigationTabs } from "@/components/layout/AdminNavigationTabs";

interface Doctor {
  id: string;
  user_id: string;
  prefix?: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string | null;
  company_name: string | null;
  npi_number: string | null;
  physical_address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  } | null;
  billing_address: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  } | null;
  tax_id: string | null;
  payment_details: {
    bank_name?: string;
    account_holder_name?: string;
    account_number?: string;
    routing_number?: string;
    account_type?: string;
    swift_code?: string;
  } | null;
  payment_method: string | null;
  payment_schedule: string | null;
  tier_level: string | null;
  tier_code: string | null;
  medical_licenses: Array<{
    licenseNumber: string;
    state: string;
  }> | null;
  created_at: string;
  is_active: boolean;
}

interface AccessRequestFormData {
  prefix?: string;
  npiNumber?: string;
  medicalLicense?: string;
  licenseState?: string;
  specialty?: string;
  practiceName?: string;
  practiceAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  yearsInPractice?: string;
  patientsPerMonth?: string;
  interestedIn?: string;
  hearAboutUs?: string;
  additionalInfo?: string;
  companyName?: string;
}

interface AccessRequest {
  id: string;
  type: string;
  status: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  form_data: AccessRequestFormData;
  created_at: string;
}

export default function ManageDoctorsPage() {
  const supabase = createClient();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [filteredDoctors, setFilteredDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"providers" | "pending">(
    "providers",
  );

  // Access Requests (Pending Approval)
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [filteredAccessRequests, setFilteredAccessRequests] = useState<
    AccessRequest[]
  >([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");

  // View Details Modal
  const [isViewDetailsModalOpen, setIsViewDetailsModalOpen] = useState(false);
  const [viewingRequest, setViewingRequest] = useState<AccessRequest | null>(
    null,
  );
  const [accessRequestNpiStatus, setAccessRequestNpiStatus] = useState<{
    isVerifying: boolean;
    result: "valid" | "invalid" | null;
    providerName?: string;
    message?: string;
  }>({ isVerifying: false, result: null });

  // Invite Modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(
    null,
  );
  const [approvedRequestIds, setApprovedRequestIds] = useState<Set<string>>(
    new Set(),
  );
  const [tiers, setTiers] = useState<
    Array<{
      id: string;
      tier_name: string;
      tier_code: string;
      discount_percentage: string;
    }>
  >([]);
  const [existingCompanies, setExistingCompanies] = useState<string[]>([]);
  const [inviteCompanyMode, setInviteCompanyMode] = useState<"select" | "new">("select");
  const [editCompanyMode, setEditCompanyMode] = useState<"select" | "new">("select");
  const [inviteFormData, setInviteFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    password: "",
    tierLevel: "",
    npiNumber: "",
    medicalLicense: "",
    licenseState: "",
    practiceAddress: "",
    city: "",
    state: "",
    zipCode: "",
  });

  // Edit Modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [editFormData, setEditFormData] = useState({
    prefix: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    companyName: "",
    tierLevel: "",
    payOnTerms: false,
  });

  // Fetch tiers and groups when either modal opens
  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const response = await fetch("/api/admin/tiers");
        if (response.ok) {
          const data = await response.json();
          setTiers(data.tiers || []);
          // Set default tier level to first tier if available and form is empty
          if (
            data.tiers &&
            data.tiers.length > 0 &&
            !inviteFormData.tierLevel
          ) {
            setInviteFormData((prev) => ({
              ...prev,
              tierLevel: data.tiers[0].tier_code,
            }));
          }
        } else {
          console.error("Failed to fetch tiers:", response.status);
        }
      } catch (error) {
        console.error("Error fetching tiers:", error);
      }
    };

    const fetchCompanies = async () => {
      try {
        const response = await fetch("/api/admin/providers");
        if (response.ok) {
          const data = await response.json();
          const companies = new Set<string>();
          (data.providers || []).forEach((p: { company_name?: string | null }) => {
            if (p.company_name && p.company_name.trim()) {
              companies.add(p.company_name.trim());
            }
          });
          setExistingCompanies(Array.from(companies).sort((a, b) => a.localeCompare(b)));
        }
      } catch (error) {
        console.error("Error fetching companies:", error);
      }
    };

    if (isInviteModalOpen || isEditModalOpen) {
      fetchTiers();
      fetchCompanies();
    }
  }, [isInviteModalOpen, isEditModalOpen, inviteFormData.tierLevel]);

  const resetInviteForm = () => {
    setInviteFormData({
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      companyName: "",
      password: "",
      tierLevel: tiers.length > 0 ? tiers[0].tier_code : "",
      npiNumber: "",
      medicalLicense: "",
      licenseState: "",
      practiceAddress: "",
      city: "",
      state: "",
      zipCode: "",
    });
    setShowPassword(false);
    setApprovingRequestId(null);
    setInviteCompanyMode("select");
  };

  // Delete Dialog
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);

  // Reset Password Dialog
  const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] =
    useState(false);
  const [doctorToResetPassword, setDoctorToResetPassword] =
    useState<Doctor | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Reject Dialog
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<AccessRequest | null>(
    null,
  );

  // NPI Verification
  const [npiVerificationStatus, setNpiVerificationStatus] = useState<{
    isVerifying: boolean;
    result: "valid" | "invalid" | null;
    providerName?: string;
    message?: string;
  }>({ isVerifying: false, result: null });

  // Activation Modal
  const [isActivationModalOpen, setIsActivationModalOpen] = useState(false);
  const [doctorToToggle, setDoctorToToggle] = useState<Doctor | null>(null);
  const [activationNpiStatus, setActivationNpiStatus] = useState<{
    isVerifying: boolean;
    result: "valid" | "invalid" | null;
    providerName?: string;
    message?: string;
  }>({ isVerifying: false, result: null });

  // Load doctors from Supabase and merge with tier information
  const loadDoctors = useCallback(async () => {
    setLoading(true);

    try {
      // Fetch providers with tier info from API endpoint
      const response = await fetch("/api/admin/providers");

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        console.error("API Error Response:", errorData);
        throw new Error(
          errorData.error || "Failed to fetch providers from API",
        );
      }

      const data = await response.json();

      if (data.providers) {
        // The API already includes tier_level and tier_code from mock store
        setDoctors(data.providers);
        setFilteredDoctors(data.providers);
      } else {
        setDoctors([]);
        setFilteredDoctors([]);
      }
    } catch (error) {
      console.error("Error loading doctors:", error);
      toast.error("Failed to load doctors");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load access requests
  const loadAccessRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const response = await fetch(
        "/api/access-requests?type=doctor&status=pending",
      );
      const data = await response.json();

      if (data.success) {
        setAccessRequests(data.requests || []);
        setFilteredAccessRequests(data.requests || []);
      } else {
        toast.error("Failed to load access requests");
      }
    } catch (error) {
      console.error("Error loading access requests:", error);
      toast.error("Failed to load access requests");
    } finally {
      setLoadingRequests(false);
    }
  }, []);

  // Filter doctors
  useEffect(() => {
    let filtered = doctors;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(
        (doctor) =>
          doctor.first_name
            ?.toLowerCase()
            .includes(searchQuery.toLowerCase()) ||
          doctor.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          doctor.email?.toLowerCase().includes(searchQuery.toLowerCase()),
      );
    }

    // Apply status filter
    if (statusFilter === "active") {
      filtered = filtered.filter((doctor) => doctor.is_active);
    } else if (statusFilter === "inactive") {
      filtered = filtered.filter((doctor) => !doctor.is_active);
    }

    setFilteredDoctors(filtered);
  }, [searchQuery, statusFilter, doctors]);

  // Filter pending access requests
  useEffect(() => {
    let filtered = accessRequests;

    // Apply search filter
    if (pendingSearchQuery) {
      filtered = filtered.filter(
        (request) =>
          request.first_name
            ?.toLowerCase()
            .includes(pendingSearchQuery.toLowerCase()) ||
          request.last_name
            ?.toLowerCase()
            .includes(pendingSearchQuery.toLowerCase()) ||
          request.email
            ?.toLowerCase()
            .includes(pendingSearchQuery.toLowerCase()),
      );
    }

    // Note: All pending requests have the same status, so no status filter needed
    // But we keep the filter UI for consistency
    setFilteredAccessRequests(filtered);
  }, [pendingSearchQuery, accessRequests]);

  // Invite new doctor
  const handleInviteDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    if (!inviteFormData.companyName?.trim()) {
      toast.error("Company name is required. Every provider must be assigned to a clinic.");
      setIsSubmitting(false);
      return;
    }

    try {
      const response = await fetch("/api/admin/invite-doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: inviteFormData.firstName,
          lastName: inviteFormData.lastName,
          email: inviteFormData.email,
          phone: inviteFormData.phone || null,
          companyName: inviteFormData.companyName.trim(),
          password: inviteFormData.password,
          tierLevel: inviteFormData.tierLevel,
          npiNumber: inviteFormData.npiNumber || null,
          medicalLicense: inviteFormData.medicalLicense || null,
          licenseState: inviteFormData.licenseState || null,
          physicalAddress: {
            street: inviteFormData.practiceAddress || null,
            city: inviteFormData.city || null,
            state: inviteFormData.state || null,
            zipCode: inviteFormData.zipCode || null,
            country: "USA",
          },
          billingAddress: {
            street: inviteFormData.practiceAddress || null,
            city: inviteFormData.city || null,
            state: inviteFormData.state || null,
            zipCode: inviteFormData.zipCode || null,
            country: "USA",
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMsg = data.details
          ? `${data.error}: ${data.details}`
          : data.error || "Failed to invite provider";
        console.error("Failed to invite provider:", errorMsg);
        throw new Error(errorMsg);
      }

      // If this invitation came from approving an access request, mark it as approved
      if (approvingRequestId) {
        try {
          const approveResponse = await fetch(
            `/api/access-requests/${approvingRequestId}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "approve" }),
            },
          );

          if (!approveResponse.ok) {
            console.error("Failed to update access request status");
            toast.success(
              `Doctor invited! Credentials sent to ${inviteFormData.email}`,
            );
          } else {
            toast.success(
              `Access request approved! Provider created and credentials sent to ${inviteFormData.email}`,
            );
          }
        } catch (error) {
          console.error("Error updating access request:", error);
          toast.success(
            `Doctor invited! Credentials sent to ${inviteFormData.email}`,
          );
        }

        // Switch to providers tab to show the newly approved provider
        setActiveTab("providers");
      } else {
        toast.success(
          `Doctor invited! Credentials sent to ${inviteFormData.email}`,
        );
      }

      resetInviteForm();
      setIsInviteModalOpen(false);

      // Reload both lists
      await loadDoctors();
      await loadAccessRequests();
    } catch (error) {
      console.error("Error inviting doctor:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to invite doctor",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit doctor
  const handleEditDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;

    setIsSubmitting(true);

    try {
      const updateResponse = await fetch(`/api/admin/providers/${editingDoctor.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prefix: editFormData.prefix || "Dr.",
          first_name: editFormData.firstName,
          last_name: editFormData.lastName,
          phone_number: editFormData.phone || null,
          company_name: editFormData.companyName || null,
          pay_on_terms: editFormData.payOnTerms,
        }),
      });

      if (!updateResponse.ok) {
        const errData = await updateResponse.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to update provider");
      }

      // Update tier level in mock store (temporary until database migration)
      if (editFormData.tierLevel) {
        // Save to mock tier store
        const response = await fetch("/api/admin/providers/tier-assignment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            providerId: editingDoctor.id,
            tierCode: editFormData.tierLevel,
          }),
        });

        if (!response.ok) {
          console.error("Failed to update tier assignment");
          toast.warning("Provider updated but tier assignment may have failed");
        } else {
        }
      }

      // Fetch fresh data from database to update the modal
      const { data: freshProviderData, error: fetchError } = await supabase
        .from("providers")
        .select("*")
        .eq("id", editingDoctor.id)
        .single();

      if (!fetchError && freshProviderData) {
        // Get tier info from the providers API
        const tiersApiResponse = await fetch("/api/admin/providers");
        let tierCodeForProvider = editFormData.tierLevel;

        if (tiersApiResponse.ok) {
          const providersData = await tiersApiResponse.json();
          const matchingProvider = providersData.providers?.find(
            (p: { id: string }) => p.id === editingDoctor.id,
          );
          tierCodeForProvider =
            matchingProvider?.tier_code || editFormData.tierLevel;
        }

        setEditingDoctor(freshProviderData);
        setEditFormData({
          prefix: freshProviderData.prefix || "",
          firstName: freshProviderData.first_name || "",
          lastName: freshProviderData.last_name || "",
          email: freshProviderData.email || "",
          phone: freshProviderData.phone_number || "",
          companyName: freshProviderData.company_name || "",
          tierLevel: tierCodeForProvider,
          payOnTerms: !!freshProviderData.pay_on_terms,
        });
      }

      toast.success("Provider updated successfully");
      await loadDoctors();
      setIsEditModalOpen(false);
      setEditingDoctor(null);
      setEditCompanyMode("select");
    } catch (error) {
      console.error("Error updating provider:", error);
      toast.error("Failed to update provider");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit modal - fetch fresh data from database
  const openEditModal = async (doctor: Doctor) => {
    try {
      // Fetch fresh provider data from database AND tier info from API
      const [providerResponse, tiersApiResponse] = await Promise.all([
        supabase.from("providers").select("*").eq("id", doctor.id).single(),
        fetch("/api/admin/providers"),
      ]);

      if (providerResponse.error) {
        console.error("Error fetching provider data:", providerResponse.error);
        toast.error("Failed to load provider data");
        return;
      }

      const freshData = providerResponse.data;

      // Get tier info from the providers API (which includes tier_code)
      let tierCodeForProvider = "";
      if (tiersApiResponse.ok) {
        const providersData = await tiersApiResponse.json();
        const matchingProvider = providersData.providers?.find(
          (p: { id: string }) => p.id === doctor.id,
        );
        tierCodeForProvider = matchingProvider?.tier_code || "";
      } else {
        console.error(
          "Failed to fetch providers API:",
          tiersApiResponse.status,
        );
      }

      setEditingDoctor(freshData);
      setEditFormData({
        prefix: (freshData as { prefix?: string | null }).prefix || "",
        firstName: freshData.first_name || "",
        lastName: freshData.last_name || "",
        email: freshData.email || "",
        phone: freshData.phone_number || "",
        companyName: freshData.company_name || "",
        tierLevel:
          tierCodeForProvider || (tiers.length > 0 ? tiers[0].tier_code : ""),
        payOnTerms: !!(freshData as { pay_on_terms?: boolean }).pay_on_terms,
      });

      setNpiVerificationStatus({ isVerifying: false, result: null });
      setEditCompanyMode("select");
      setIsEditModalOpen(true);
    } catch (error) {
      console.error("Error opening edit modal:", error);
      toast.error("Failed to load provider data");
    }
  };

  // Open reset password dialog
  const openResetPasswordDialog = (doctor: Doctor) => {
    setDoctorToResetPassword(doctor);
    setNewPassword("");
    setShowNewPassword(false);
    setIsResetPasswordDialogOpen(true);
  };

  // Generate password for reset dialog
  const generateResetPassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = "";
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    password = password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
    setNewPassword(password);
    setShowNewPassword(true);
    toast.success("Secure password generated!");
  };

  // Reset password
  const handleResetPassword = async () => {
    if (!doctorToResetPassword || !newPassword) return;

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    try {
      const response = await fetch("/api/admin/reset-provider-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: doctorToResetPassword.email,
          newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      toast.success(data.message || "Password reset successfully");
      setIsResetPasswordDialogOpen(false);
      setDoctorToResetPassword(null);
      setNewPassword("");
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reset password",
      );
    }
  };

  // Open activation modal instead of directly toggling
  const handleToggleActive = (doctor: Doctor) => {
    setDoctorToToggle(doctor);
    setActivationNpiStatus({ isVerifying: false, result: null });
    setIsActivationModalOpen(true);

    // If activating (currently inactive), auto-verify NPI
    if (!doctor.is_active && doctor.npi_number) {
      verifyNpiForActivation(doctor.npi_number);
    }
  };

  // Verify NPI specifically for activation flow
  const verifyNpiForActivation = async (npiNumber: string) => {
    if (!npiNumber || npiNumber.length !== 10) {
      setActivationNpiStatus({
        isVerifying: false,
        result: "invalid",
        message: "NPI must be exactly 10 digits",
      });
      return;
    }

    setActivationNpiStatus({ isVerifying: true, result: null });

    try {
      const response = await fetch(`/api/admin/verify-npi?npi=${npiNumber}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify NPI");
      }

      setActivationNpiStatus({
        isVerifying: false,
        result: data.valid ? "valid" : "invalid",
        providerName: data.providerName,
        message: data.message,
      });
    } catch (error) {
      console.error("Error verifying NPI for activation:", error);
      setActivationNpiStatus({
        isVerifying: false,
        result: "invalid",
        message: "Failed to verify NPI",
      });
    }
  };

  // Confirm and execute the toggle
  const confirmToggleActive = async () => {
    if (!doctorToToggle) return;

    try {
      const { error } = await supabase
        .from("providers")
        .update({ is_active: !doctorToToggle.is_active })
        .eq("id", doctorToToggle.id);

      if (error) throw error;

      toast.success(
        `Provider ${!doctorToToggle.is_active ? "activated" : "deactivated"} successfully`,
      );
      await loadDoctors();
    } catch (error) {
      console.error("Error toggling provider status:", error);
      toast.error("Failed to update provider status");
    } finally {
      setIsActivationModalOpen(false);
      setDoctorToToggle(null);
      setActivationNpiStatus({ isVerifying: false, result: null });
    }
  };

  // Verify NPI using server-side API (avoids CORS issues)
  const handleVerifyNPI = async (npiNumber: string) => {
    if (!npiNumber || npiNumber.length !== 10) {
      setNpiVerificationStatus({
        isVerifying: false,
        result: "invalid",
        message: "NPI must be exactly 10 digits",
      });
      return;
    }

    setNpiVerificationStatus({ isVerifying: true, result: null });

    try {
      const response = await fetch(`/api/admin/verify-npi?npi=${npiNumber}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify NPI");
      }

      if (data.valid) {
        setNpiVerificationStatus({
          isVerifying: false,
          result: "valid",
          providerName: data.providerName || undefined,
          message: data.message,
        });
        if (data.cmsVerified === false) {
          toast.info(data.message);
        } else {
          toast.success(`NPI verified successfully: ${data.providerName}`);
        }
      } else {
        setNpiVerificationStatus({
          isVerifying: false,
          result: "invalid",
          message: data.message,
        });
        toast.error(data.message);
      }
    } catch (error) {
      console.error("Error verifying NPI:", error);
      setNpiVerificationStatus({
        isVerifying: false,
        result: "invalid",
        message: "Failed to verify NPI - API error",
      });
      toast.error("Failed to verify NPI - please try again");
    }
  };

  // Delete doctor
  const handleDeleteDoctor = async () => {
    if (!doctorToDelete) return;

    try {
      if (!doctorToDelete.email) {
        throw new Error("Provider email is required for deletion");
      }

      const response = await fetch(
        `/api/admin/delete-provider?email=${encodeURIComponent(doctorToDelete.email)}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) {
        const data = await response.json();
        console.error("Delete API error response:", data);
        throw new Error(
          data.details || data.error || "Failed to delete provider",
        );
      }

      toast.success("Provider deleted successfully");
      setIsDeleteDialogOpen(false);
      setDoctorToDelete(null);
      await loadDoctors();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to delete provider";
      console.error("Error deleting provider:", errorMessage);
      toast.error(errorMessage);
    }
  };

  useEffect(() => {
    loadDoctors();
    loadAccessRequests();
  }, [loadDoctors, loadAccessRequests]);

  // Handle access request approval - prefill invite form
  const handleApproveRequest = (request: AccessRequest) => {
    // Mark as approved immediately
    setApprovedRequestIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(request.id);
      return newSet;
    });

    // Store the request ID so we can approve it after successful invitation
    setApprovingRequestId(request.id);

    // Generate a secure password automatically
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const allChars = uppercase + lowercase + numbers + symbols;

    let autoPassword = "";
    // Ensure at least one of each type
    autoPassword += uppercase[Math.floor(Math.random() * uppercase.length)];
    autoPassword += lowercase[Math.floor(Math.random() * lowercase.length)];
    autoPassword += numbers[Math.floor(Math.random() * numbers.length)];
    autoPassword += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill rest with random characters (total length: 12)
    for (let i = 4; i < 12; i++) {
      autoPassword += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    autoPassword = autoPassword
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");

    // Prefill the invite form with data from the access request
    setInviteFormData({
      firstName: request.first_name || "",
      lastName: request.last_name || "",
      email: request.email || "",
      phone: request.phone || "",
      companyName: request.form_data?.companyName || "",
      password: autoPassword, // Auto-generated secure password
      tierLevel: tiers.length > 0 ? tiers[0].tier_code : "",
      npiNumber: request.form_data?.npiNumber || "",
      medicalLicense: request.form_data?.medicalLicense || "",
      licenseState: request.form_data?.licenseState || "",
      practiceAddress: request.form_data?.practiceAddress || "",
      city: request.form_data?.city || "",
      state: request.form_data?.state || "",
      zipCode: request.form_data?.zipCode || "",
    });

    // Show the password so admin can see it
    setShowPassword(true);

    // Open invite modal (stay on current tab)
    setIsInviteModalOpen(true);
  };

  // Verify NPI for access request
  const verifyAccessRequestNpi = async (npiNumber: string) => {
    if (!npiNumber || !/^\d{10}$/.test(npiNumber)) {
      setAccessRequestNpiStatus({
        isVerifying: false,
        result: "invalid",
        message: "NPI must be exactly 10 digits",
      });
      return;
    }

    setAccessRequestNpiStatus({ isVerifying: true, result: null });

    try {
      const response = await fetch(`/api/admin/verify-npi?npi=${npiNumber}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify NPI");
      }

      setAccessRequestNpiStatus({
        isVerifying: false,
        result: data.valid ? "valid" : "invalid",
        providerName: data.providerName,
        message: data.message,
      });
    } catch {
      setAccessRequestNpiStatus({
        isVerifying: false,
        result: "invalid",
        message: "Failed to verify NPI",
      });
    }
  };

  // Open view details modal
  const handleViewDetails = (request: AccessRequest) => {
    setViewingRequest(request);
    setAccessRequestNpiStatus({ isVerifying: false, result: null });
    setIsViewDetailsModalOpen(true);

    // Auto-verify NPI if present
    const npiNumber = request.form_data?.npiNumber;
    if (npiNumber) {
      verifyAccessRequestNpi(npiNumber);
    }
  };

  // Handle access request rejection - open confirmation dialog
  const handleRejectRequest = (request: AccessRequest) => {
    setRequestToReject(request);
    setIsRejectDialogOpen(true);
  };

  // Confirm rejection
  const confirmRejectRequest = async () => {
    if (!requestToReject) return;

    try {
      const response = await fetch(
        `/api/access-requests/${requestToReject.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "reject", rejectionReason: null }),
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to reject request");
      }

      toast.success("Request rejected");
      setIsRejectDialogOpen(false);
      setRequestToReject(null);
      await loadAccessRequests();
    } catch (error) {
      console.error("Error rejecting request:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to reject request",
      );
    }
  };

  const getStatusCount = (status: string) => {
    if (status === "all") return doctors.length;
    if (status === "active") return doctors.filter((d) => d.is_active).length;
    if (status === "inactive")
      return doctors.filter((d) => !d.is_active).length;
    return 0;
  };

  // Generate secure random password
  const generatePassword = () => {
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*";
    const allChars = uppercase + lowercase + numbers + symbols;

    let password = "";
    // Ensure at least one of each type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Fill rest with random characters (total length: 12)
    for (let i = 4; i < 12; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password
    password = password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");

    setInviteFormData({
      ...inviteFormData,
      password: password,
    });
    setShowPassword(true);
    toast.success("Secure password generated!");
  };

  return (
    <>
      {/* Global Admin Navigation */}
      <AdminNavigationTabs />

      <div className="container mx-auto max-w-7xl py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Manage Providers
          </h1>
          <Button
            onClick={() => {
              resetInviteForm();
              setIsInviteModalOpen(true);
            }}
            className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white"
            size="lg"
          >
            <Plus className="mr-2 h-5 w-5" />
            Invite New Provider
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab("providers")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "providers"
                ? "text-[#1E3A8A] border-b-2 border-[#1E3A8A]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Providers ({doctors.length})
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "pending"
                ? "text-[#1E3A8A] border-b-2 border-[#1E3A8A]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Pending Approval ({accessRequests.length})
          </button>
        </div>

        {activeTab === "providers" && (
          <>
            {/* Filters */}
            <div className="flex gap-4 mb-6">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter */}
              <div className="w-64">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All ({getStatusCount("all")})
                    </SelectItem>
                    <SelectItem value="active">
                      Active ({getStatusCount("active")})
                    </SelectItem>
                    <SelectItem value="inactive">
                      Inactive ({getStatusCount("inactive")})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Doctors Table */}
            <div className="bg-white border border-border rounded-lg overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading doctors...</p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Provider</TableHead>
                        <TableHead className="font-semibold">Contact</TableHead>
                        <TableHead className="font-semibold">Tier / Company</TableHead>
                        <TableHead className="font-semibold">Status</TableHead>
                        <TableHead className="font-semibold text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredDoctors.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-muted-foreground py-8"
                          >
                            No doctors found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredDoctors.map((doctor) => (
                          <TableRow
                            key={doctor.id}
                            className="hover:bg-gray-50"
                          >
                            <TableCell>
                              <div className="font-medium">
                                {doctor.prefix || "Dr."} {doctor.first_name} {doctor.last_name}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                Added {new Date(doctor.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{doctor.email || "N/A"}</div>
                              <div className="text-xs text-muted-foreground">{doctor.phone_number || "No phone"}</div>
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                {doctor.tier_level ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 text-blue-700 border-blue-200 capitalize w-fit text-xs"
                                  >
                                    {doctor.tier_level.replace(/_/g, " ")}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">No tier</span>
                                )}
                                {doctor.company_name ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-indigo-50 text-indigo-700 border-indigo-200 text-xs w-fit"
                                    data-testid={`badge-company-${doctor.id}`}
                                  >
                                    {doctor.company_name}
                                  </Badge>
                                ) : (
                                  <span className="text-xs text-muted-foreground">Unassigned</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  doctor.is_active
                                    ? "bg-green-100 text-green-800 border-green-200"
                                    : "bg-gray-100 text-gray-800 border-gray-200"
                                }
                              >
                                {doctor.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openEditModal(doctor)}
                                  className="bg-blue-50 hover:bg-blue-100 text-blue-700 hover:text-blue-700 border-blue-200 hover:border-blue-300 h-7 px-2 text-xs"
                                  title="Edit"
                                  data-testid={`btn-edit-${doctor.id}`}
                                >
                                  <Edit className="h-3 w-3 mr-1" />
                                  Edit
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    openResetPasswordDialog(doctor)
                                  }
                                  className="bg-purple-50 hover:bg-purple-100 text-purple-700 hover:text-purple-700 border-purple-200 hover:border-purple-300 h-7 w-7 p-0"
                                  title="Reset Password"
                                >
                                  <Key className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleActive(doctor)}
                                  className={`h-7 w-7 p-0 ${
                                    doctor.is_active
                                      ? "bg-yellow-50 hover:bg-yellow-100 text-yellow-700 hover:text-yellow-700 border-yellow-200 hover:border-yellow-300"
                                      : "bg-green-50 hover:bg-green-100 text-green-700 hover:text-green-700 border-green-200 hover:border-green-300"
                                  }`}
                                  title={doctor.is_active ? "Deactivate" : "Activate"}
                                >
                                  <Power className="h-3 w-3" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setDoctorToDelete(doctor);
                                    setIsDeleteDialogOpen(true);
                                  }}
                                  className="bg-red-50 hover:bg-red-100 text-red-700 hover:text-red-700 border-red-200 hover:border-red-300 h-7 w-7 p-0"
                                  title="Delete"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Pending Approval Tab */}
        {activeTab === "pending" && (
          <>
            {/* Filters */}
            <div className="flex gap-4 mb-6">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={pendingSearchQuery}
                  onChange={(e) => setPendingSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Status Filter - Disabled for pending tab but kept for UI consistency */}
              <div className="w-64">
                <Select value="pending" disabled>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      Pending ({accessRequests.length})
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="bg-white border border-border rounded-lg overflow-hidden">
              {loadingRequests ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Loading requests...</p>
                  </div>
                </div>
              ) : filteredAccessRequests.length === 0 ? (
                <div className="flex items-center justify-center py-12">
                  <p className="text-muted-foreground">
                    {accessRequests.length === 0
                      ? "No pending access requests"
                      : "No requests found"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Name</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Phone</TableHead>
                        <TableHead className="font-semibold">
                          NPI Number
                        </TableHead>
                        <TableHead className="font-semibold">
                          Submitted
                        </TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAccessRequests.map((request) => {
                        const isApproved = approvedRequestIds.has(request.id);
                        return (
                          <TableRow
                            key={request.id}
                            className={`hover:bg-gray-50 ${isApproved ? "bg-green-50" : ""}`}
                          >
                            <TableCell className="font-medium">
                              {request.form_data?.prefix || "Dr."} {request.first_name} {request.last_name}
                              {isApproved && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-600 text-white">
                                  ✓ Approved
                                </span>
                              )}
                            </TableCell>
                            <TableCell>{request.email}</TableCell>
                            <TableCell>{request.phone || "N/A"}</TableCell>
                            <TableCell className="font-mono">
                              {request.form_data?.npiNumber || "N/A"}
                            </TableCell>
                            <TableCell>
                              {new Date(request.created_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleViewDetails(request)}
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  disabled={isApproved}
                                >
                                  View
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleApproveRequest(request)}
                                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                  disabled={isApproved}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRejectRequest(request)}
                                  className="bg-red-50 hover:bg-red-100 text-red-700 border-red-200"
                                  disabled={isApproved}
                                >
                                  Reject
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Invite Provider Modal */}
        <Dialog
          open={isInviteModalOpen}
          onOpenChange={(open) => {
            setIsInviteModalOpen(open);
            if (!open) {
              resetInviteForm();
            }
          }}
        >
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>
                {approvingRequestId
                  ? "Approve Access Request"
                  : "Invite New Provider"}
              </DialogTitle>
              <DialogDescription>
                {approvingRequestId
                  ? "Review and complete the invitation for this access request. A secure password has been generated automatically."
                  : "Add a new provider to the platform. They will receive login credentials via email."}
              </DialogDescription>
            </DialogHeader>

            {approvingRequestId && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 -mt-2">
                <p className="text-sm text-green-800">
                  <strong>Approving Access Request:</strong> The form has been
                  pre-filled with the applicant&apos;s information. Review the
                  details, adjust the tier level if needed, and click
                  &quot;Invite Doctor&quot; to complete the approval.
                </p>
              </div>
            )}

            <form
              onSubmit={handleInviteDoctor}
              className="space-y-4 overflow-y-auto pr-2"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="firstName">First Name *</Label>
                  <Input
                    id="firstName"
                    value={inviteFormData.firstName}
                    onChange={(e) =>
                      setInviteFormData({
                        ...inviteFormData,
                        firstName: e.target.value,
                      })
                    }
                    required
                    placeholder="John"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName">Last Name *</Label>
                  <Input
                    id="lastName"
                    value={inviteFormData.lastName}
                    onChange={(e) =>
                      setInviteFormData({
                        ...inviteFormData,
                        lastName: e.target.value,
                      })
                    }
                    required
                    placeholder="Doe"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteFormData.email}
                    onChange={(e) =>
                      setInviteFormData({
                        ...inviteFormData,
                        email: e.target.value,
                      })
                    }
                    required
                    placeholder="doctor@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone (Optional)</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={inviteFormData.phone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      setInviteFormData({
                        ...inviteFormData,
                        phone: formatted,
                      });
                    }}
                    placeholder="(555) 123-4567"
                    maxLength={14}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Must be exactly 10 digits
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="companyName">Company Name *</Label>
                  <button
                    type="button"
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                    onClick={() => {
                      setInviteCompanyMode(inviteCompanyMode === "select" ? "new" : "select");
                      setInviteFormData({ ...inviteFormData, companyName: "" });
                    }}
                  >
                    {inviteCompanyMode === "select" ? "Type new" : "Select existing"}
                  </button>
                </div>
                {inviteCompanyMode === "select" ? (
                  <Select
                    value={inviteFormData.companyName}
                    onValueChange={(value) =>
                      setInviteFormData({ ...inviteFormData, companyName: value })
                    }
                  >
                    <SelectTrigger id="companyName" className="bg-white border-gray-300 text-gray-900 h-10">
                      <SelectValue placeholder="-- Select a company --" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {existingCompanies.length > 0 ? (
                        existingCompanies.map((name) => (
                          <SelectItem key={name} value={name} className="py-2.5 text-sm cursor-pointer">
                            {name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No companies yet — click &quot;Type new&quot; to add one
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="companyName"
                    type="text"
                    value={inviteFormData.companyName}
                    onChange={(e) =>
                      setInviteFormData({
                        ...inviteFormData,
                        companyName: e.target.value,
                      })
                    }
                    placeholder="Enter new company name"
                    className="bg-white border-gray-300 text-gray-900 h-10"
                  />
                )}
                <p className="text-xs text-blue-600 mt-1">
                  Providers in the same company share patient access
                </p>
              </div>

              <div>
                <Label htmlFor="password">Password *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={inviteFormData.password}
                      onChange={(e) =>
                        setInviteFormData({
                          ...inviteFormData,
                          password: e.target.value,
                        })
                      }
                      required
                      placeholder="Create a strong password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generatePassword}
                    className="px-3"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="tierLevel">Tier Level *</Label>
                <Select
                  value={inviteFormData.tierLevel}
                  onValueChange={(value) =>
                    setInviteFormData({ ...inviteFormData, tierLevel: value })
                  }
                >
                  <SelectTrigger id="tierLevel">
                    <SelectValue
                      placeholder={
                        tiers.length === 0
                          ? "Loading tiers..."
                          : "Select tier level"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.length === 0 ? (
                      <SelectItem value="no-tiers" disabled>
                        No tiers available. Create tiers in Manage Tiers first.
                      </SelectItem>
                    ) : (
                      tiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.tier_code}>
                          {tier.tier_name} - {tier.discount_percentage}%
                          discount
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Tier levels are managed in the &quot;Manage Tiers&quot;
                  section
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> The provider will receive a welcome
                  email with their login credentials. They can then log in and
                  complete their profile by adding payment information,
                  addresses, and other details.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    resetInviteForm();
                    setIsInviteModalOpen(false);
                  }}
                  disabled={isSubmitting}
                  className="h-9"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="bg-green-600 hover:bg-green-700 h-9"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Inviting..." : "Invite Provider"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Provider Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={(open) => {
          setIsEditModalOpen(open);
          if (!open) {
            setEditCompanyMode("select");
          }
        }}>
          <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Edit Provider</DialogTitle>
              <DialogDescription>
                Update provider information.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleEditDoctor}
              className="space-y-4 overflow-y-auto pr-2 flex-1"
            >
              <div>
                <Label htmlFor="editPrefix">Prefix / Title</Label>
                <Select
                  value={editFormData.prefix || "Dr."}
                  onValueChange={(value) =>
                    setEditFormData({
                      ...editFormData,
                      prefix: value === "Dr." ? "" : value,
                    })
                  }
                >
                  <SelectTrigger id="editPrefix" data-testid="select-edit-prefix">
                    <SelectValue placeholder="Select prefix" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Dr.">Dr.</SelectItem>
                    <SelectItem value="NP">NP (Nurse Practitioner)</SelectItem>
                    <SelectItem value="PA">PA (Physician Assistant)</SelectItem>
                    <SelectItem value="RN">RN (Registered Nurse)</SelectItem>
                    <SelectItem value="DO">DO (Doctor of Osteopathy)</SelectItem>
                    <SelectItem value="DDS">DDS (Dentist)</SelectItem>
                    <SelectItem value="DPM">DPM (Podiatrist)</SelectItem>
                    <SelectItem value="OD">OD (Optometrist)</SelectItem>
                    <SelectItem value="DC">DC (Chiropractor)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Shown wherever this provider's name appears (admin pages, patient emails, EMR, audit logs).
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editFirstName">First Name *</Label>
                  <Input
                    id="editFirstName"
                    value={editFormData.firstName}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        firstName: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="editLastName">Last Name *</Label>
                  <Input
                    id="editLastName"
                    value={editFormData.lastName}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        lastName: e.target.value,
                      })
                    }
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="editEmail">Email *</Label>
                  <Input
                    id="editEmail"
                    type="email"
                    value={editFormData.email}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        email: e.target.value,
                      })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="editPhone">Phone</Label>
                  <Input
                    id="editPhone"
                    type="tel"
                    value={editFormData.phone}
                    onChange={(e) => {
                      const formatted = formatPhoneNumber(e.target.value);
                      setEditFormData({ ...editFormData, phone: formatted });
                    }}
                    placeholder="(555) 123-4567"
                    maxLength={14}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Must be exactly 10 digits
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label htmlFor="editCompanyName">Company Name</Label>
                  <button
                    type="button"
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                    onClick={() => {
                      setEditCompanyMode(editCompanyMode === "select" ? "new" : "select");
                      setEditFormData({ ...editFormData, companyName: "" });
                    }}
                  >
                    {editCompanyMode === "select" ? "Type new" : "Select existing"}
                  </button>
                </div>
                {editCompanyMode === "select" ? (
                  <Select
                    value={editFormData.companyName}
                    onValueChange={(value) =>
                      setEditFormData({ ...editFormData, companyName: value })
                    }
                  >
                    <SelectTrigger id="editCompanyName" className="bg-white border-gray-300 text-gray-900 h-10">
                      <SelectValue placeholder="-- Select a company --" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px] overflow-y-auto">
                      {existingCompanies.length > 0 ? (
                        existingCompanies.map((name) => (
                          <SelectItem key={name} value={name} className="py-2.5 text-sm cursor-pointer">
                            {name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="none" disabled>
                          No companies yet — click &quot;Type new&quot; to add one
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="editCompanyName"
                    value={editFormData.companyName}
                    onChange={(e) =>
                      setEditFormData({
                        ...editFormData,
                        companyName: e.target.value,
                      })
                    }
                    placeholder="Enter new company name"
                    className="bg-white border-gray-300 text-gray-900 h-10"
                  />
                )}
                <p className="text-xs text-blue-600 mt-1">
                  Providers in the same company share patient access
                </p>
              </div>

              <div>
                <Label htmlFor="editTierLevel">Tier Level *</Label>
                <Select
                  value={editFormData.tierLevel}
                  onValueChange={(value) =>
                    setEditFormData({ ...editFormData, tierLevel: value })
                  }
                >
                  <SelectTrigger id="editTierLevel">
                    <SelectValue
                      placeholder={
                        tiers.length === 0
                          ? "Loading tiers..."
                          : "Select tier level"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {tiers.length === 0 ? (
                      <SelectItem value="no-tiers" disabled>
                        No tiers available. Create tiers in Manage Tiers first.
                      </SelectItem>
                    ) : (
                      tiers.map((tier) => (
                        <SelectItem key={tier.id} value={tier.tier_code}>
                          {tier.tier_name} - {tier.discount_percentage}%
                          discount
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Tier levels are managed in the &quot;Manage Tiers&quot;
                  section
                </p>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editFormData.payOnTerms}
                    onChange={(e) =>
                      setEditFormData({ ...editFormData, payOnTerms: e.target.checked })
                    }
                    data-testid="checkbox-pay-on-terms"
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                  />
                  <div>
                    <div className="text-sm font-semibold text-gray-900">
                      Mark orders Paid on Terms
                    </div>
                    <p className="text-xs text-gray-700 mt-1">
                      When enabled, this provider&apos;s orders bypass the patient
                      payment flow entirely — they are automatically marked as
                      paid and submitted straight to the pharmacy.{" "}
                      <span className="font-semibold">
                        No payment receipts, payment links, or billing
                        emails/SMS are sent to the patient.
                      </span>{" "}
                      Use for providers billed on terms (one card on file,
                      monthly invoice, etc.).
                    </p>
                    {editFormData.payOnTerms && (
                      <div
                        data-testid="notice-pay-on-terms-no-receipt"
                        className="mt-2 rounded border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs text-emerald-900"
                      >
                        <span className="font-semibold">Confirmed:</span> the
                        patient will <span className="font-semibold">not</span>{" "}
                        receive a payment link, payment receipt, or any billing
                        email/SMS for this provider&apos;s orders.
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Professional Credentials - Read Only */}
              {editingDoctor && (
                <div className="space-y-4 mt-6 pt-6 border-t">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Professional Credentials (Read-Only)
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">
                    This information is managed by the provider and can only be
                    updated by them through their profile.
                  </p>

                  {/* NPI Number - Always show */}
                  <div
                    className={
                      editingDoctor.npi_number
                        ? "bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3"
                        : "bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3"
                    }
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p
                        className={
                          editingDoctor.npi_number
                            ? "text-xs text-orange-700 font-medium"
                            : "text-xs text-gray-600 font-medium"
                        }
                      >
                        National Provider Identifier (NPI)
                      </p>
                      {editingDoctor.npi_number && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            handleVerifyNPI(editingDoctor.npi_number!)
                          }
                          disabled={npiVerificationStatus.isVerifying}
                          className="h-7 text-xs"
                        >
                          {npiVerificationStatus.isVerifying
                            ? "Verifying..."
                            : "Verify NPI"}
                        </Button>
                      )}
                    </div>
                    {editingDoctor.npi_number ? (
                      <>
                        <p className="text-sm font-mono font-bold text-orange-900 mb-2">
                          {editingDoctor.npi_number}
                        </p>
                        {/* Verification Result */}
                        {npiVerificationStatus.result && (
                          <div
                            className={`mt-2 p-2 rounded-md ${npiVerificationStatus.result === "valid" ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
                          >
                            <div className="flex items-center gap-2">
                              {npiVerificationStatus.result === "valid" ? (
                                <>
                                  <svg
                                    className="h-4 w-4 text-green-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                  <div>
                                    <p className="text-xs font-semibold text-green-800">
                                      Valid NPI
                                    </p>
                                    {npiVerificationStatus.providerName && (
                                      <p className="text-xs text-green-700">
                                        Registry Name:{" "}
                                        {npiVerificationStatus.providerName}
                                      </p>
                                    )}
                                  </div>
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="h-4 w-4 text-red-600"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M6 18L18 6M6 6l12 12"
                                    />
                                  </svg>
                                  <div>
                                    <p className="text-xs font-semibold text-red-800">
                                      Invalid NPI
                                    </p>
                                    <p className="text-xs text-red-700">
                                      {npiVerificationStatus.message}
                                    </p>
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-gray-500 italic">
                        Not provided yet
                      </p>
                    )}
                  </div>

                  {/* Medical Licenses */}
                  {editingDoctor.medical_licenses &&
                    editingDoctor.medical_licenses.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-xs font-medium text-gray-700 mb-2">
                          Medical Licenses
                        </p>
                        <div className="space-y-3">
                          {editingDoctor.medical_licenses.map(
                            (license, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between border-b border-gray-200 pb-2 last:border-b-0 last:pb-0"
                              >
                                <div>
                                  <p className="text-xs text-gray-600">
                                    License Number
                                  </p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {license.licenseNumber}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-600">State</p>
                                  <p className="text-sm font-medium text-gray-900">
                                    {license.state}
                                  </p>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      </div>
                    )}
                </div>
              )}

              {/* Address Information - Read Only */}
              {editingDoctor &&
                ((editingDoctor.physical_address &&
                  Object.values(editingDoctor.physical_address).some(
                    (v) => v && v !== "",
                  )) ||
                  (editingDoctor.billing_address &&
                    Object.values(editingDoctor.billing_address).some(
                      (v) => v && v !== "",
                    ))) && (
                  <div className="space-y-4 mt-6 pt-6 border-t">
                    <h3 className="text-sm font-semibold text-gray-900">
                      Address Information (Read-Only)
                    </h3>
                    <p className="text-xs text-gray-600 mb-4">
                      This information is managed by the provider and can only
                      be updated by them through their profile.
                    </p>

                    {/* Physical Address */}
                    {editingDoctor.physical_address &&
                      Object.values(editingDoctor.physical_address).some(
                        (v) => v && v !== "",
                      ) && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h4 className="text-xs font-medium text-gray-700 mb-2">
                            Physical Address
                          </h4>
                          <p className="text-sm text-gray-900">
                            {editingDoctor.physical_address.street && (
                              <>
                                {editingDoctor.physical_address.street}
                                <br />
                              </>
                            )}
                            {(editingDoctor.physical_address.city ||
                              editingDoctor.physical_address.state ||
                              editingDoctor.physical_address.zipCode) && (
                              <>
                                {editingDoctor.physical_address.city &&
                                  editingDoctor.physical_address.city}
                                {editingDoctor.physical_address.state &&
                                  `, ${editingDoctor.physical_address.state}`}
                                {editingDoctor.physical_address.zipCode &&
                                  ` ${editingDoctor.physical_address.zipCode}`}
                                <br />
                              </>
                            )}
                            {editingDoctor.physical_address.country && (
                              <>{editingDoctor.physical_address.country}</>
                            )}
                          </p>
                        </div>
                      )}

                    {/* Billing Address */}
                    {editingDoctor.billing_address &&
                      Object.values(editingDoctor.billing_address).some(
                        (v) => v && v !== "",
                      ) && (
                        <div className="bg-gray-50 rounded-lg p-3">
                          <h4 className="text-xs font-medium text-gray-700 mb-2">
                            Billing Address
                          </h4>
                          <p className="text-sm text-gray-900">
                            {editingDoctor.billing_address.street && (
                              <>
                                {editingDoctor.billing_address.street}
                                <br />
                              </>
                            )}
                            {(editingDoctor.billing_address.city ||
                              editingDoctor.billing_address.state ||
                              editingDoctor.billing_address.zipCode) && (
                              <>
                                {editingDoctor.billing_address.city &&
                                  editingDoctor.billing_address.city}
                                {editingDoctor.billing_address.state &&
                                  `, ${editingDoctor.billing_address.state}`}
                                {editingDoctor.billing_address.zipCode &&
                                  ` ${editingDoctor.billing_address.zipCode}`}
                                <br />
                              </>
                            )}
                            {editingDoctor.billing_address.country && (
                              <>{editingDoctor.billing_address.country}</>
                            )}
                          </p>
                          {editingDoctor.tax_id && (
                            <p className="text-xs text-gray-600 mt-2">
                              <strong>Tax ID/EIN:</strong>{" "}
                              {editingDoctor.tax_id}
                            </p>
                          )}
                        </div>
                      )}
                  </div>
                )}

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditCompanyMode("select");
                  }}
                  disabled={isSubmitting}
                  className="h-9"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="h-9">
                  {isSubmitting ? "Updating..." : "Update Provider"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={isDeleteDialogOpen}
          onOpenChange={setIsDeleteDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Doctor</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {doctorToDelete?.prefix || "Dr."} {doctorToDelete?.first_name}{" "}
                {doctorToDelete?.last_name}? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteDoctor}
                className="bg-red-600 hover:bg-red-700"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reject Confirmation Dialog */}
        <AlertDialog
          open={isRejectDialogOpen}
          onOpenChange={setIsRejectDialogOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reject Access Request</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to reject the access request from{" "}
                {requestToReject?.form_data?.prefix || "Dr."}{" "}
                {requestToReject?.first_name} {requestToReject?.last_name}? This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmRejectRequest}
                className="bg-red-600 hover:bg-red-700"
              >
                Reject
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Activation/Deactivation Confirmation Modal */}
        <AlertDialog
          open={isActivationModalOpen}
          onOpenChange={setIsActivationModalOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {doctorToToggle?.is_active
                  ? "Deactivate Provider"
                  : "Activate Provider"}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  {/* For Deactivation - Simple confirmation */}
                  {doctorToToggle?.is_active ? (
                    <p>
                      Are you sure you want to deactivate {doctorToToggle?.prefix || "Dr."}{" "}
                      {doctorToToggle?.first_name} {doctorToToggle?.last_name}?
                      They will not be able to create prescriptions while
                      inactive.
                    </p>
                  ) : (
                    /* For Activation - Show NPI verification */
                    <>
                      <p>
                        Verify NPI before activating {doctorToToggle?.prefix || "Dr."}{" "}
                        {doctorToToggle?.first_name} {doctorToToggle?.last_name}
                        .
                      </p>

                      {/* NPI Display and Verification Status */}
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700">
                            NPI Number:
                          </span>
                          <span className="font-mono text-sm">
                            {doctorToToggle?.npi_number || "Not provided"}
                          </span>
                        </div>

                        {/* Verification Status */}
                        {!doctorToToggle?.npi_number ? (
                          <div className="flex items-center gap-2 text-amber-600 bg-amber-50 p-2 rounded">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="text-sm">
                              No NPI number on file. Provider should complete
                              their profile first.
                            </span>
                          </div>
                        ) : activationNpiStatus.isVerifying ? (
                          <div className="flex items-center gap-2 text-blue-600 bg-blue-50 p-2 rounded">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span className="text-sm">
                              Verifying NPI with CMS registry...
                            </span>
                          </div>
                        ) : activationNpiStatus.result === "valid" ? (
                          <div className="flex items-center gap-2 text-green-600 bg-green-50 p-2 rounded">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">
                              Valid NPI - {activationNpiStatus.providerName}
                            </span>
                          </div>
                        ) : activationNpiStatus.result === "invalid" ? (
                          <div className="flex items-center gap-2 text-red-600 bg-red-50 p-2 rounded">
                            <XCircle className="h-4 w-4" />
                            <span className="text-sm">
                              {activationNpiStatus.message}
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel
                onClick={() => {
                  setDoctorToToggle(null);
                  setActivationNpiStatus({ isVerifying: false, result: null });
                }}
              >
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmToggleActive}
                disabled={
                  // Disable if activating and (no NPI, verifying, or invalid NPI)
                  !doctorToToggle?.is_active &&
                  (!doctorToToggle?.npi_number ||
                    activationNpiStatus.isVerifying ||
                    activationNpiStatus.result === "invalid")
                }
                className={
                  doctorToToggle?.is_active
                    ? "bg-yellow-600 hover:bg-yellow-700"
                    : "bg-green-600 hover:bg-green-700"
                }
              >
                {doctorToToggle?.is_active ? "Deactivate" : "Activate"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reset Password Dialog */}
        <Dialog
          open={isResetPasswordDialogOpen}
          onOpenChange={setIsResetPasswordDialogOpen}
        >
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                Set a new password for {doctorToResetPassword?.prefix || "Dr."} {doctorToResetPassword?.first_name}{" "}
                {doctorToResetPassword?.last_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generateResetPassword}
                    className="px-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  Password must be at least 6 characters long
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsResetPasswordDialogOpen(false);
                  setDoctorToResetPassword(null);
                  setNewPassword("");
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={!newPassword || newPassword.length < 6}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Reset Password
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* View Access Request Details Modal */}
        <Dialog
          open={isViewDetailsModalOpen}
          onOpenChange={(open) => {
            setIsViewDetailsModalOpen(open);
            if (!open) {
              setAccessRequestNpiStatus({ isVerifying: false, result: null });
            }
          }}
        >
          <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>Access Request Details</DialogTitle>
              <DialogDescription>
                Review the provider access request information
              </DialogDescription>
            </DialogHeader>

            {viewingRequest && (
              <div className="space-y-6 py-4 overflow-y-auto pr-2">
                {/* Personal Information */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 border-b pb-2">
                    Personal Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-600">
                        First Name
                      </Label>
                      <p className="text-sm font-medium">
                        {viewingRequest.first_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Last Name</Label>
                      <p className="text-sm font-medium">
                        {viewingRequest.last_name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Email</Label>
                      <p className="text-sm font-medium">
                        {viewingRequest.email}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">Phone</Label>
                      <p className="text-sm font-medium">
                        {viewingRequest.phone || "N/A"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-600">
                        Company Name
                      </Label>
                      <p className="text-sm font-medium">
                        {viewingRequest.form_data?.companyName || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Medical Credentials */}
                {viewingRequest.form_data && (
                  <>
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 border-b pb-2">
                        Medical Credentials
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-gray-600">
                            NPI Number
                          </Label>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-medium">
                              {viewingRequest.form_data.npiNumber || "N/A"}
                            </p>
                            {viewingRequest.form_data.npiNumber && (
                              <>
                                {accessRequestNpiStatus.isVerifying && (
                                  <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
                                )}
                                {accessRequestNpiStatus.result === "valid" && (
                                  <div className="flex items-center gap-1 text-green-600">
                                    <CheckCircle className="h-4 w-4" />
                                    <span className="text-xs">
                                      {accessRequestNpiStatus.providerName}
                                    </span>
                                  </div>
                                )}
                                {accessRequestNpiStatus.result ===
                                  "invalid" && (
                                  <div className="flex items-center gap-1 text-red-600">
                                    <XCircle className="h-4 w-4" />
                                    <span className="text-xs">
                                      {accessRequestNpiStatus.message}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">
                            Medical License
                          </Label>
                          <p className="text-sm font-medium">
                            {viewingRequest.form_data.medicalLicense || "N/A"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">
                            License State
                          </Label>
                          <p className="text-sm font-medium">
                            {viewingRequest.form_data.licenseState || "N/A"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">
                            Specialty
                          </Label>
                          <p className="text-sm font-medium">
                            {viewingRequest.form_data.specialty || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Practice Information */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-3 border-b pb-2">
                        Practice Information
                      </h3>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <Label className="text-xs text-gray-600">
                            Practice Address
                          </Label>
                          <p className="text-sm font-medium">
                            {viewingRequest.form_data.practiceAddress || "N/A"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">City</Label>
                          <p className="text-sm font-medium">
                            {viewingRequest.form_data.city || "N/A"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">State</Label>
                          <p className="text-sm font-medium">
                            {viewingRequest.form_data.state || "N/A"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">
                            ZIP Code
                          </Label>
                          <p className="text-sm font-medium">
                            {viewingRequest.form_data.zipCode || "N/A"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-600">
                            Years in Practice
                          </Label>
                          <p className="text-sm font-medium">
                            {viewingRequest.form_data.yearsInPractice || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Additional Information */}
                    {(viewingRequest.form_data.patientsPerMonth ||
                      viewingRequest.form_data.interestedIn ||
                      viewingRequest.form_data.hearAboutUs ||
                      viewingRequest.form_data.additionalInfo) && (
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 mb-3 border-b pb-2">
                          Additional Information
                        </h3>
                        <div className="space-y-3">
                          {viewingRequest.form_data.patientsPerMonth && (
                            <div>
                              <Label className="text-xs text-gray-600">
                                Patients Per Month
                              </Label>
                              <p className="text-sm font-medium">
                                {viewingRequest.form_data.patientsPerMonth}
                              </p>
                            </div>
                          )}
                          {viewingRequest.form_data.interestedIn && (
                            <div>
                              <Label className="text-xs text-gray-600">
                                Interested In
                              </Label>
                              <p className="text-sm font-medium">
                                {viewingRequest.form_data.interestedIn}
                              </p>
                            </div>
                          )}
                          {viewingRequest.form_data.hearAboutUs && (
                            <div>
                              <Label className="text-xs text-gray-600">
                                How They Heard About Us
                              </Label>
                              <p className="text-sm font-medium">
                                {viewingRequest.form_data.hearAboutUs}
                              </p>
                            </div>
                          )}
                          {viewingRequest.form_data.additionalInfo && (
                            <div>
                              <Label className="text-xs text-gray-600">
                                Additional Information
                              </Label>
                              <p className="text-sm font-medium whitespace-pre-wrap">
                                {viewingRequest.form_data.additionalInfo}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Submission Date */}
                <div className="pt-4 border-t">
                  <Label className="text-xs text-gray-600">Submitted On</Label>
                  <p className="text-sm font-medium">
                    {new Date(viewingRequest.created_at).toLocaleString(
                      "en-US",
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsViewDetailsModalOpen(false)}
              >
                Close
              </Button>
              {viewingRequest && (
                <Button
                  onClick={() => {
                    setIsViewDetailsModalOpen(false);
                    handleApproveRequest(viewingRequest);
                  }}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Approve & Invite
                </Button>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
