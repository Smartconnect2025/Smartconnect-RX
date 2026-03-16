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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Search,
  Edit,
  Eye,
  EyeOff,
  Info,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AdminNavigationTabs } from "@/components/layout/AdminNavigationTabs";

interface Pharmacy {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  tagline: string | null;
  address: string | null;
  npi: string | null;
  dea_number: string | null;
  ncpdp_number: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

interface PharmacyBackend {
  id: string;
  pharmacy_id: string;
  system_type: string;
  api_url: string | null;
  api_key_encrypted: string;
  store_id: string;
  location_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  pharmacy: {
    id: string;
    name: string;
    slug: string;
  };
}

interface PharmacyAdmin {
  user_id: string;
  email: string;
  pharmacy_id: string;
  full_name: string | null;
  created_at: string;
  pharmacy: {
    name: string;
    slug: string;
  };
}

interface AccessRequest {
  id: string;
  type: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  form_data: {
    pharmacyName?: string;
    ownerName?: string;
    phone?: string;
    licenseNumber?: string;
    licenseState?: string;
    deaNumber?: string;
    ncpdpNumber?: string;
    pharmacyAddress?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    currentSystem?: string;
    systemVersion?: string;
    integrationType?: string;
    yearsInBusiness?: string;
    compoundingExperience?: string;
    monthlyCapacity?: string;
    specializations?: string;
    accreditations?: string;
    hearAboutUs?: string;
    additionalInfo?: string;
  };
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export default function PharmacyManagementPage() {
  const [activeTab, setActiveTab] = useState<
    "pharmacies" | "administrators" | "integrations" | "pending"
  >("pharmacies");

  // Access requests states
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [filteredAccessRequests, setFilteredAccessRequests] = useState<
    AccessRequest[]
  >([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [approvedRequestIds, setApprovedRequestIds] = useState<Set<string>>(
    new Set(),
  );
  const [approvingRequestId, setApprovingRequestId] = useState<string | null>(
    null,
  );
  const [isApproveModalOpen, setIsApproveModalOpen] = useState(false);
  const [requestToApprove, setRequestToApprove] =
    useState<AccessRequest | null>(null);
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [requestToReject, setRequestToReject] = useState<AccessRequest | null>(
    null,
  );
  const [isViewRequestDetailsOpen, setIsViewRequestDetailsOpen] =
    useState(false);
  const [viewingRequest, setViewingRequest] = useState<AccessRequest | null>(
    null,
  );

  // Approval form state (for creating pharmacy from access request)
  const [approvalForm, setApprovalForm] = useState({
    name: "",
    slug: "",
    phone: "",
    npi: "",
    dea_number: "",
    ncpdp_number: "",
    address: "",
    system_type: "DigitalRx",
    store_id: "",
    api_url: "",
    api_key: "",
    location_id: "",
    primary_color: "#00AEEF",
    tagline: "",
  });

  // Data states
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [filteredPharmacies, setFilteredPharmacies] = useState<Pharmacy[]>([]);
  const [backends, setBackends] = useState<PharmacyBackend[]>([]);
  const [filteredBackends, setFilteredBackends] = useState<PharmacyBackend[]>(
    [],
  );
  const [admins, setAdmins] = useState<PharmacyAdmin[]>([]);
  const [filteredAdmins, setFilteredAdmins] = useState<PharmacyAdmin[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and filter states
  const [pharmacySearchQuery, setPharmacySearchQuery] = useState("");
  const [pharmacyStatusFilter, setPharmacyStatusFilter] = useState("active");
  const [adminSearchQuery, setAdminSearchQuery] = useState("");
  const [adminPharmacyFilter, setAdminPharmacyFilter] = useState("all");
  const [integrationSearchQuery, setIntegrationSearchQuery] = useState("");

  // Pharmacy wizard states
  const [isPharmacyWizardOpen, setIsPharmacyWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [editingPharmacy, setEditingPharmacy] = useState<Pharmacy | null>(null);
  const [pharmacyForm, setPharmacyForm] = useState({
    name: "",
    slug: "",
    primary_color: "#00AEEF",
    tagline: "",
    phone: "",
    npi: "",
    dea_number: "",
    ncpdp_number: "",
    address: "",
    system_type: "DigitalRx",
    store_id: "",
    api_url: "",
    api_key: "",
    location_id: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Admin modal states
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({
    email: "",
    password: "",
    full_name: "",
    pharmacy_id: "",
  });
  const [showPassword, setShowPassword] = useState(false);

  // View details modal
  const [isViewDetailsOpen, setIsViewDetailsOpen] = useState(false);
  const [viewingPharmacy, setViewingPharmacy] = useState<Pharmacy | null>(null);

  // Delete confirmation modal for pharmacy
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pharmacyToDelete, setPharmacyToDelete] = useState<Pharmacy | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  // Delete confirmation modal for admin
  const [isDeleteAdminDialogOpen, setIsDeleteAdminDialogOpen] = useState(false);
  const [adminToDelete, setAdminToDelete] = useState<PharmacyAdmin | null>(
    null,
  );
  const [isDeletingAdmin, setIsDeletingAdmin] = useState(false);

  // API key visibility
  const [visibleApiKeys, setVisibleApiKeys] = useState<Record<string, boolean>>(
    {},
  );

  // Load all data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pharmaciesRes, backendsRes, adminsRes] = await Promise.all([
        fetch("/api/admin/pharmacies"),
        fetch("/api/admin/pharmacy-backends"),
        fetch("/api/admin/pharmacy-admins"),
      ]);

      const [pharmaciesData, backendsData, adminsData] = await Promise.all([
        pharmaciesRes.json(),
        backendsRes.json(),
        adminsRes.json(),
      ]);

      if (pharmaciesData.success) {
        setPharmacies(pharmaciesData.pharmacies || []);
        setFilteredPharmacies(pharmaciesData.pharmacies || []);
      }
      if (backendsData.success) {
        setBackends(backendsData.backends || []);
        setFilteredBackends(backendsData.backends || []);
      }
      if (adminsData.success) {
        setAdmins(adminsData.admins || []);
        setFilteredAdmins(adminsData.admins || []);
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  // Load access requests
  const loadAccessRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const response = await fetch(
        "/api/access-requests?type=pharmacy&status=pending",
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

  useEffect(() => {
    loadData();
    loadAccessRequests();
  }, [loadData, loadAccessRequests]);

  // Filter pharmacies
  useEffect(() => {
    let filtered = pharmacies;

    if (pharmacySearchQuery) {
      filtered = filtered.filter(
        (pharmacy) =>
          pharmacy.name
            .toLowerCase()
            .includes(pharmacySearchQuery.toLowerCase()) ||
          pharmacy.slug
            .toLowerCase()
            .includes(pharmacySearchQuery.toLowerCase()) ||
          pharmacy.phone
            ?.toLowerCase()
            .includes(pharmacySearchQuery.toLowerCase()),
      );
    }

    if (pharmacyStatusFilter === "active") {
      filtered = filtered.filter((p) => p.is_active);
    } else if (pharmacyStatusFilter === "inactive") {
      filtered = filtered.filter((p) => !p.is_active);
    }

    setFilteredPharmacies(filtered);
  }, [pharmacySearchQuery, pharmacyStatusFilter, pharmacies]);

  // Filter admins
  useEffect(() => {
    let filtered = admins;

    if (adminSearchQuery) {
      filtered = filtered.filter(
        (admin) =>
          admin.email.toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
          admin.full_name
            ?.toLowerCase()
            .includes(adminSearchQuery.toLowerCase()),
      );
    }

    if (adminPharmacyFilter !== "all") {
      filtered = filtered.filter(
        (admin) => admin.pharmacy_id === adminPharmacyFilter,
      );
    }

    setFilteredAdmins(filtered);
  }, [adminSearchQuery, adminPharmacyFilter, admins]);

  // Filter integrations
  useEffect(() => {
    let filtered = backends;

    if (integrationSearchQuery) {
      filtered = filtered.filter(
        (backend) =>
          backend.pharmacy.name
            .toLowerCase()
            .includes(integrationSearchQuery.toLowerCase()) ||
          backend.system_type
            .toLowerCase()
            .includes(integrationSearchQuery.toLowerCase()) ||
          backend.store_id
            .toLowerCase()
            .includes(integrationSearchQuery.toLowerCase()),
      );
    }

    setFilteredBackends(filtered);
  }, [integrationSearchQuery, backends]);

  // Filter access requests
  useEffect(() => {
    let filtered = accessRequests;

    if (pendingSearchQuery) {
      filtered = filtered.filter(
        (request) =>
          request.form_data?.pharmacyName
            ?.toLowerCase()
            .includes(pendingSearchQuery.toLowerCase()) ||
          request.form_data?.ownerName
            ?.toLowerCase()
            .includes(pendingSearchQuery.toLowerCase()) ||
          request.email
            ?.toLowerCase()
            .includes(pendingSearchQuery.toLowerCase()),
      );
    }

    setFilteredAccessRequests(filtered);
  }, [pendingSearchQuery, accessRequests]);

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleNameChange = (name: string) => {
    setPharmacyForm({
      ...pharmacyForm,
      name,
      slug: generateSlug(name),
    });
  };

  const openPharmacyWizard = () => {
    setEditingPharmacy(null);
    setPharmacyForm({
      name: "",
      slug: "",
      primary_color: "#00AEEF",
      tagline: "",
      phone: "",
      npi: "",
      dea_number: "",
      ncpdp_number: "",
      address: "",
      system_type: "DigitalRx",
      store_id: "",
      api_url: "",
      api_key: "",
      location_id: "",
    });
    setWizardStep(1);
    setIsPharmacyWizardOpen(true);
  };

  const handleEditPharmacy = async (pharmacy: Pharmacy) => {
    // Load backend data for this pharmacy
    const backend = backends.find((b) => b.pharmacy_id === pharmacy.id);

    setEditingPharmacy(pharmacy);
    setPharmacyForm({
      name: pharmacy.name,
      slug: pharmacy.slug,
      primary_color: pharmacy.primary_color,
      tagline: pharmacy.tagline || "",
      phone: pharmacy.phone || "",
      npi: pharmacy.npi || "",
      dea_number: pharmacy.dea_number || "",
      ncpdp_number: pharmacy.ncpdp_number || "",
      address: pharmacy.address || "",
      system_type: backend?.system_type || "DigitalRx",
      store_id: backend?.store_id || "",
      api_url: backend?.api_url || "",
      api_key: "", // Don't pre-fill API key for security
      location_id: backend?.location_id || "",
    });
    setWizardStep(1);
    setIsPharmacyWizardOpen(true);
  };

  const handleViewDetails = (pharmacy: Pharmacy) => {
    setViewingPharmacy(pharmacy);
    setIsViewDetailsOpen(true);
  };

  const handleDeletePharmacy = async () => {
    if (!pharmacyToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/admin/pharmacies/${pharmacyToDelete.id}`,
        {
          method: "DELETE",
        },
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to deactivate pharmacy");
      }

      toast.success("Pharmacy deactivated successfully");
      setIsDeleteDialogOpen(false);
      setPharmacyToDelete(null);
      await loadData();
    } catch (error) {
      console.error("Error deactivating pharmacy:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to deactivate pharmacy",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!adminToDelete) return;

    setIsDeletingAdmin(true);
    try {
      const response = await fetch("/api/admin/pharmacy-admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: adminToDelete.user_id,
          pharmacy_id: adminToDelete.pharmacy_id,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete admin");
      }

      toast.success("Administrator removed successfully");
      setIsDeleteAdminDialogOpen(false);
      setAdminToDelete(null);
      await loadData();
    } catch (error) {
      console.error("Error deleting admin:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to delete admin",
      );
    } finally {
      setIsDeletingAdmin(false);
    }
  };

  const handleCreateOrUpdatePharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = editingPharmacy
        ? `/api/admin/pharmacies/${editingPharmacy.id}`
        : "/api/admin/pharmacies";

      const method = editingPharmacy ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pharmacyForm),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save pharmacy");
      }

      toast.success(
        editingPharmacy
          ? "Pharmacy updated successfully"
          : "Pharmacy created successfully",
      );
      setIsPharmacyWizardOpen(false);
      setWizardStep(1);
      await loadData();
    } catch (error) {
      console.error("Error saving pharmacy:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save pharmacy",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/pharmacy-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(adminForm),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create admin");
      }

      toast.success("Admin created successfully");
      setIsAdminModalOpen(false);
      setAdminForm({
        email: "",
        password: "",
        full_name: "",
        pharmacy_id: "",
      });
      await loadData();
    } catch (error) {
      console.error("Error creating admin:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create admin",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleApiKeyVisibility = (backendId: string) => {
    setVisibleApiKeys({
      ...visibleApiKeys,
      [backendId]: !visibleApiKeys[backendId],
    });
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return "••••••••";
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
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

    setAdminForm({
      ...adminForm,
      password: password,
    });
  };

  const getStatusCount = (status: string) => {
    if (status === "all") return pharmacies.length;
    if (status === "active")
      return pharmacies.filter((p) => p.is_active).length;
    if (status === "inactive")
      return pharmacies.filter((p) => !p.is_active).length;
    return 0;
  };

  // Handle approve pharmacy request - opens modal with prefilled data
  const handleApprovePharmacyRequest = (request: AccessRequest) => {
    setRequestToApprove(request);
    setApprovingRequestId(request.id);

    // Build address from components
    const addressParts = [
      request.form_data?.pharmacyAddress,
      request.form_data?.city,
      request.form_data?.state,
      request.form_data?.zipCode,
    ].filter(Boolean);
    const fullAddress = addressParts.join(", ");

    // Prefill the form with data from the access request
    setApprovalForm({
      name: request.form_data?.pharmacyName || "",
      slug: generateSlug(request.form_data?.pharmacyName || ""),
      phone: request.form_data?.phone || request.phone || "",
      npi: "", // Not in access request form
      dea_number: request.form_data?.deaNumber || "",
      ncpdp_number: request.form_data?.ncpdpNumber || "",
      address: fullAddress,
      system_type: "DigitalRx", // Default, admin selects
      store_id: "",
      api_url: "",
      api_key: "",
      location_id: "",
      primary_color: "#00AEEF",
      tagline: "",
    });

    setIsApproveModalOpen(true);
  };

  // Handle creating pharmacy from approved request
  const handleCreatePharmacyFromRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Create the pharmacy using the existing endpoint
      const response = await fetch("/api/admin/pharmacies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(approvalForm),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.error || data.details || "Failed to create pharmacy",
        );
      }

      // Mark the access request as approved
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
          }
        } catch (error) {
          console.error("Error updating access request:", error);
        }
      }

      // Mark as approved in UI
      setApprovedRequestIds((prev) => {
        const newSet = new Set(prev);
        if (approvingRequestId) newSet.add(approvingRequestId);
        return newSet;
      });

      toast.success(`Pharmacy "${approvalForm.name}" created successfully!`);
      setIsApproveModalOpen(false);
      setRequestToApprove(null);
      setApprovingRequestId(null);

      // Switch to pharmacies tab and reload data
      setActiveTab("pharmacies");
      await loadData();
      await loadAccessRequests();
    } catch (error) {
      console.error("Error creating pharmacy:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create pharmacy",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle reject pharmacy request
  const handleRejectPharmacyRequest = (request: AccessRequest) => {
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

  // View request details
  const handleViewRequestDetails = (request: AccessRequest) => {
    setViewingRequest(request);
    setIsViewRequestDetailsOpen(true);
  };

  return (
    <>
      {/* Global Admin Navigation */}
      <AdminNavigationTabs />

      <div className="container mx-auto max-w-7xl py-8 px-4">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Pharmacy Management
          </h1>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsAdminModalOpen(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Add Admin
            </Button>
            <Button
              onClick={openPharmacyWizard}
              className="bg-[#1E3A8A] hover:bg-[#1E3A8A]/90 text-white"
              size="lg"
            >
              <Plus className="mr-2 h-5 w-5" />
              Add Pharmacy
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab("pharmacies")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "pharmacies"
                ? "text-[#1E3A8A] border-b-2 border-[#1E3A8A]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Pharmacies ({pharmacies.length})
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
          <button
            onClick={() => setActiveTab("administrators")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "administrators"
                ? "text-[#1E3A8A] border-b-2 border-[#1E3A8A]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Administrators ({admins.length})
          </button>
          <button
            onClick={() => setActiveTab("integrations")}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === "integrations"
                ? "text-[#1E3A8A] border-b-2 border-[#1E3A8A]"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            API Integrations ({backends.length})
          </button>
        </div>

        {/* Pharmacies Tab */}
        {activeTab === "pharmacies" && (
          <>
            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, slug, or phone..."
                  value={pharmacySearchQuery}
                  onChange={(e) => setPharmacySearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="w-64">
                <Select
                  value={pharmacyStatusFilter}
                  onValueChange={setPharmacyStatusFilter}
                >
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

            {/* Pharmacies Table */}
            <div className="bg-white border border-border rounded-lg overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">
                      Loading pharmacies...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">
                          Pharmacy Name
                        </TableHead>
                        <TableHead className="font-semibold">Slug</TableHead>
                        <TableHead className="font-semibold">Phone</TableHead>
                        <TableHead className="font-semibold">System</TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPharmacies.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={5}
                            className="text-center text-muted-foreground py-8"
                          >
                            No pharmacies found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPharmacies.map((pharmacy) => {
                          const backend = backends.find(
                            (b) => b.pharmacy_id === pharmacy.id,
                          );
                          return (
                            <TableRow
                              key={pharmacy.id}
                              className="hover:bg-gray-50"
                            >
                              <TableCell className="font-medium">
                                {pharmacy.name}
                              </TableCell>
                              <TableCell>
                                <code className="px-2 py-1 bg-gray-100 rounded text-sm">
                                  {pharmacy.slug}
                                </code>
                              </TableCell>
                              <TableCell className="text-sm">
                                {pharmacy.phone || "—"}
                              </TableCell>
                              <TableCell>
                                {backend ? (
                                  <Badge variant="secondary">
                                    {backend.system_type}
                                  </Badge>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleViewDetails(pharmacy)}
                                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 p-2"
                                    title="View Details"
                                  >
                                    <Info className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEditPharmacy(pharmacy)}
                                    className="text-gray-600 hover:text-gray-700 hover:bg-gray-100 p-2"
                                    title="Edit Pharmacy"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setPharmacyToDelete(pharmacy);
                                      setIsDeleteDialogOpen(true);
                                    }}
                                    className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
                                    title="Deactivate Pharmacy"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })
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
            {/* Search */}
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by pharmacy name, owner, or email..."
                  value={pendingSearchQuery}
                  onChange={(e) => setPendingSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Pending Requests Table */}
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
                        <TableHead className="font-semibold">
                          Pharmacy Name
                        </TableHead>
                        <TableHead className="font-semibold">Owner</TableHead>
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">Phone</TableHead>
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
                              {request.form_data?.pharmacyName || "N/A"}
                              {isApproved && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-600 text-white">
                                  Approved
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              {request.form_data?.ownerName || "N/A"}
                            </TableCell>
                            <TableCell>{request.email}</TableCell>
                            <TableCell>
                              {request.form_data?.phone ||
                                request.phone ||
                                "N/A"}
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
                                  onClick={() =>
                                    handleViewRequestDetails(request)
                                  }
                                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  disabled={isApproved}
                                >
                                  View
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleApprovePharmacyRequest(request)
                                  }
                                  className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                                  disabled={isApproved}
                                >
                                  Approve
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    handleRejectPharmacyRequest(request)
                                  }
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

        {/* Administrators Tab */}
        {activeTab === "administrators" && (
          <>
            {/* Filters */}
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or email..."
                  value={adminSearchQuery}
                  onChange={(e) => setAdminSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              <div className="w-64">
                <Select
                  value={adminPharmacyFilter}
                  onValueChange={setAdminPharmacyFilter}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by pharmacy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Pharmacies</SelectItem>
                    {pharmacies.map((pharmacy) => (
                      <SelectItem key={pharmacy.id} value={pharmacy.id}>
                        {pharmacy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Admins Table */}
            <div className="bg-white border border-border rounded-lg overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">
                      Loading administrators...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">Email</TableHead>
                        <TableHead className="font-semibold">
                          Full Name
                        </TableHead>
                        <TableHead className="font-semibold">
                          Pharmacy
                        </TableHead>
                        <TableHead className="font-semibold">User ID</TableHead>
                        <TableHead className="font-semibold">
                          Date Added
                        </TableHead>
                        <TableHead className="font-semibold">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAdmins.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground py-8"
                          >
                            No administrators found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAdmins.map((admin) => (
                          <TableRow
                            key={`${admin.user_id}-${admin.pharmacy_id}`}
                            className="hover:bg-gray-50"
                          >
                            <TableCell className="font-medium">
                              {admin.email}
                            </TableCell>
                            <TableCell>{admin.full_name || "—"}</TableCell>
                            <TableCell>{admin.pharmacy.name}</TableCell>
                            <TableCell className="text-xs text-gray-500 font-mono">
                              {admin.user_id.slice(0, 8)}...
                            </TableCell>
                            <TableCell>
                              {new Date(admin.created_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setAdminToDelete(admin);
                                  setIsDeleteAdminDialogOpen(true);
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 p-2"
                                title="Remove Administrator"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
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

        {/* API Integrations Tab */}
        {activeTab === "integrations" && (
          <>
            {/* Search */}
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by pharmacy, system, or store ID..."
                  value={integrationSearchQuery}
                  onChange={(e) => setIntegrationSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Integrations Table */}
            <div className="bg-white border border-border rounded-lg overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">
                      Loading integrations...
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold">
                          Pharmacy
                        </TableHead>
                        <TableHead className="font-semibold">
                          System Type
                        </TableHead>
                        <TableHead className="font-semibold">
                          Store ID
                        </TableHead>
                        <TableHead className="font-semibold">API URL</TableHead>
                        <TableHead className="font-semibold">API Key</TableHead>
                        <TableHead className="font-semibold">
                          Last Updated
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBackends.length === 0 ? (
                        <TableRow>
                          <TableCell
                            colSpan={6}
                            className="text-center text-muted-foreground py-8"
                          >
                            No integrations found
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredBackends.map((backend) => (
                          <TableRow
                            key={backend.id}
                            className="hover:bg-gray-50"
                          >
                            <TableCell className="font-medium">
                              {backend.pharmacy.name}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {backend.system_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <code className="px-2 py-1 bg-gray-100 rounded text-sm">
                                {backend.store_id}
                              </code>
                            </TableCell>
                            <TableCell className="text-sm text-blue-600">
                              {backend.api_url || "—"}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <code className="px-2 py-1 bg-gray-100 rounded text-xs font-mono">
                                  {visibleApiKeys[backend.id]
                                    ? backend.api_key_encrypted
                                    : maskApiKey(backend.api_key_encrypted)}
                                </code>
                                <button
                                  onClick={() =>
                                    toggleApiKeyVisibility(backend.id)
                                  }
                                  className="p-1 hover:bg-gray-100 rounded"
                                >
                                  {visibleApiKeys[backend.id] ? (
                                    <EyeOff className="h-4 w-4 text-gray-600" />
                                  ) : (
                                    <Eye className="h-4 w-4 text-gray-600" />
                                  )}
                                </button>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm">
                              {new Date(backend.updated_at).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                },
                              )}
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

        {/* Pharmacy Wizard Modal */}
        <Dialog
          open={isPharmacyWizardOpen}
          onOpenChange={setIsPharmacyWizardOpen}
        >
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>
                {editingPharmacy ? "Edit Pharmacy" : "Add New Pharmacy"} - Step{" "}
                {wizardStep} of 2
              </DialogTitle>
              <DialogDescription>
                {wizardStep === 1
                  ? "Enter basic pharmacy information"
                  : "Configure backend system integration"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateOrUpdatePharmacy}>
              {wizardStep === 1 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-name">Pharmacy Name *</Label>
                    <Input
                      id="pharmacy-name"
                      value={pharmacyForm.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      placeholder="e.g., Smith's Pharmacy"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-slug">Slug *</Label>
                    <Input
                      id="pharmacy-slug"
                      value={pharmacyForm.slug}
                      onChange={(e) =>
                        setPharmacyForm({
                          ...pharmacyForm,
                          slug: e.target.value.toLowerCase(),
                        })
                      }
                      placeholder="e.g., smiths-pharmacy"
                      required
                    />
                    <p className="text-xs text-gray-500">
                      Auto-generated from name, can be edited
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-phone">Phone</Label>
                    <Input
                      id="pharmacy-phone"
                      value={pharmacyForm.phone}
                      onChange={(e) =>
                        setPharmacyForm({
                          ...pharmacyForm,
                          phone: e.target.value,
                        })
                      }
                      placeholder="e.g., (555) 123-4567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-npi">NPI Number</Label>
                    <Input
                      id="pharmacy-npi"
                      value={pharmacyForm.npi}
                      onChange={(e) =>
                        setPharmacyForm({
                          ...pharmacyForm,
                          npi: e.target.value,
                        })
                      }
                      placeholder="e.g., 1234567890"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-dea">DEA Number</Label>
                    <Input
                      id="pharmacy-dea"
                      value={pharmacyForm.dea_number}
                      onChange={(e) =>
                        setPharmacyForm({
                          ...pharmacyForm,
                          dea_number: e.target.value,
                        })
                      }
                      placeholder="e.g., AB1234567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-ncpdp">NCPDP Number</Label>
                    <Input
                      id="pharmacy-ncpdp"
                      value={pharmacyForm.ncpdp_number}
                      onChange={(e) =>
                        setPharmacyForm({
                          ...pharmacyForm,
                          ncpdp_number: e.target.value,
                        })
                      }
                      placeholder="e.g., 1234567"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-address">Address</Label>
                    <Input
                      id="pharmacy-address"
                      value={pharmacyForm.address}
                      onChange={(e) =>
                        setPharmacyForm({
                          ...pharmacyForm,
                          address: e.target.value,
                        })
                      }
                      placeholder="e.g., 123 Main St, City, ST 12345"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsPharmacyWizardOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setWizardStep(2);
                      }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-system">Pharmacy System *</Label>
                    <Select
                      value={pharmacyForm.system_type}
                      onValueChange={(value) =>
                        setPharmacyForm({ ...pharmacyForm, system_type: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DigitalRx">DigitalRx</SelectItem>
                        <SelectItem value="PioneerRx">PioneerRx</SelectItem>
                        <SelectItem value="QS1">QS1</SelectItem>
                        <SelectItem value="Liberty">Liberty</SelectItem>
                        <SelectItem value="BestRx">BestRx</SelectItem>
                        <SelectItem value="Custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-store-id">Store ID *</Label>
                    <Input
                      id="pharmacy-store-id"
                      value={pharmacyForm.store_id}
                      onChange={(e) =>
                        setPharmacyForm({
                          ...pharmacyForm,
                          store_id: e.target.value,
                        })
                      }
                      placeholder="e.g., STORE123"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-api-url">API URL</Label>
                    <Input
                      id="pharmacy-api-url"
                      value={pharmacyForm.api_url}
                      onChange={(e) =>
                        setPharmacyForm({
                          ...pharmacyForm,
                          api_url: e.target.value,
                        })
                      }
                      placeholder="e.g., https://api.example.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-api-key">API Key *</Label>
                    <Input
                      id="pharmacy-api-key"
                      type="password"
                      value={pharmacyForm.api_key}
                      onChange={(e) =>
                        setPharmacyForm({
                          ...pharmacyForm,
                          api_key: e.target.value,
                        })
                      }
                      placeholder="Enter API key"
                      required={!editingPharmacy}
                    />
                    <p className="text-xs text-gray-500">
                      {editingPharmacy
                        ? "Leave blank to keep existing key"
                        : "Will be encrypted when stored"}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pharmacy-location-id">
                      Location ID (Optional)
                    </Label>
                    <Input
                      id="pharmacy-location-id"
                      value={pharmacyForm.location_id}
                      onChange={(e) =>
                        setPharmacyForm({
                          ...pharmacyForm,
                          location_id: e.target.value,
                        })
                      }
                      placeholder="e.g., LOC001"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setWizardStep(1)}
                    >
                      Back
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting
                        ? "Saving..."
                        : editingPharmacy
                          ? "Update Pharmacy"
                          : "Create Pharmacy"}
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </DialogContent>
        </Dialog>

        {/* Admin Creation Modal */}
        <Dialog open={isAdminModalOpen} onOpenChange={setIsAdminModalOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add Pharmacy Administrator</DialogTitle>
              <DialogDescription>
                Create a new admin user for a pharmacy
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleCreateAdmin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email *</Label>
                <Input
                  id="admin-email"
                  type="email"
                  value={adminForm.email}
                  onChange={(e) =>
                    setAdminForm({ ...adminForm, email: e.target.value })
                  }
                  placeholder="admin@pharmacy.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password">Password *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="admin-password"
                      type={showPassword ? "text" : "password"}
                      value={adminForm.password}
                      onChange={(e) =>
                        setAdminForm({ ...adminForm, password: e.target.value })
                      }
                      placeholder="Enter password"
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-500" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-500" />
                      )}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={generatePassword}
                    className="px-4"
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Generate
                  </Button>
                </div>
                <p className="text-xs text-gray-500">Minimum 8 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-full-name">Full Name</Label>
                <Input
                  id="admin-full-name"
                  value={adminForm.full_name}
                  onChange={(e) =>
                    setAdminForm({ ...adminForm, full_name: e.target.value })
                  }
                  placeholder="John Smith"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-pharmacy">Pharmacy *</Label>
                <Select
                  value={adminForm.pharmacy_id}
                  onValueChange={(value) =>
                    setAdminForm({ ...adminForm, pharmacy_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a pharmacy..." />
                  </SelectTrigger>
                  <SelectContent>
                    {pharmacies.map((pharmacy) => (
                      <SelectItem key={pharmacy.id} value={pharmacy.id}>
                        {pharmacy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAdminModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting || pharmacies.length === 0}
                >
                  {isSubmitting ? "Creating..." : "Create Admin"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Details Modal */}
        <Dialog open={isViewDetailsOpen} onOpenChange={setIsViewDetailsOpen}>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Pharmacy Details</DialogTitle>
            </DialogHeader>

            {viewingPharmacy && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">
                      Pharmacy Name
                    </Label>
                    <p className="text-sm font-semibold mt-1">
                      {viewingPharmacy.name}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">
                      Slug
                    </Label>
                    <div className="text-sm mt-1">
                      <code className="px-2 py-1 bg-gray-100 rounded">
                        {viewingPharmacy.slug}
                      </code>
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Phone
                  </Label>
                  <p className="text-sm mt-1">{viewingPharmacy.phone || "—"}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    NPI Number
                  </Label>
                  <p className="text-sm mt-1">{viewingPharmacy.npi || "—"}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    DEA Number
                  </Label>
                  <p className="text-sm mt-1">{viewingPharmacy.dea_number || "—"}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    NCPDP Number
                  </Label>
                  <p className="text-sm mt-1">{viewingPharmacy.ncpdp_number || "—"}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Address
                  </Label>
                  <p className="text-sm mt-1">
                    {viewingPharmacy.address || "—"}
                  </p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">
                    Created
                  </Label>
                  <p className="text-sm mt-1">
                    {new Date(viewingPharmacy.created_at).toLocaleDateString(
                      "en-US",
                      {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsViewDetailsOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setIsViewDetailsOpen(false);
                      handleEditPharmacy(viewingPharmacy);
                    }}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Pharmacy
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Deactivate Pharmacy</DialogTitle>
              <DialogDescription>
                Are you sure you want to deactivate this pharmacy? It will no longer appear in pharmacy dropdowns or be available for new prescriptions.
              </DialogDescription>
            </DialogHeader>

            {pharmacyToDelete && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900">
                    Pharmacy: {pharmacyToDelete.name}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Slug: {pharmacyToDelete.slug}
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs text-amber-900">
                    <strong>Note:</strong> Deactivating this pharmacy will:
                  </p>
                  <ul className="text-xs text-amber-800 mt-2 ml-4 list-disc">
                    <li>Hide the pharmacy from prescription dropdowns</li>
                    <li>Hide the pharmacy from the default admin view</li>
                    <li>Existing prescriptions will not be affected</li>
                  </ul>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDeleteDialogOpen(false);
                      setPharmacyToDelete(null);
                    }}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeletePharmacy}
                    disabled={isDeleting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isDeleting ? "Deactivating..." : "Deactivate Pharmacy"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete Admin Confirmation Dialog */}
        <Dialog
          open={isDeleteAdminDialogOpen}
          onOpenChange={setIsDeleteAdminDialogOpen}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Remove Administrator</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this administrator? This action
                cannot be undone.
              </DialogDescription>
            </DialogHeader>

            {adminToDelete && (
              <div className="space-y-4">
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-red-900">
                    {adminToDelete.full_name || adminToDelete.email}
                  </p>
                  <p className="text-xs text-red-700 mt-1">
                    Email: {adminToDelete.email}
                  </p>
                  <p className="text-xs text-red-700">
                    Pharmacy: {adminToDelete.pharmacy.name}
                  </p>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-xs text-amber-900">
                    <strong>Warning:</strong> This will:
                  </p>
                  <ul className="text-xs text-amber-800 mt-2 ml-4 list-disc">
                    <li>
                      Remove admin access to {adminToDelete.pharmacy.name}
                    </li>
                    <li>
                      Delete the user account if they have no other pharmacy
                      associations
                    </li>
                  </ul>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDeleteAdminDialogOpen(false);
                      setAdminToDelete(null);
                    }}
                    disabled={isDeletingAdmin}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDeleteAdmin}
                    disabled={isDeletingAdmin}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {isDeletingAdmin ? "Removing..." : "Remove Administrator"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Approve Pharmacy Request Modal */}
        <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Approve Pharmacy Request</DialogTitle>
              <DialogDescription>
                Complete the pharmacy setup. Fields marked with * are required.
              </DialogDescription>
            </DialogHeader>

            <form
              onSubmit={handleCreatePharmacyFromRequest}
              className="space-y-4"
            >
              {/* Request Info Banner */}
              {requestToApprove && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                  <p className="font-medium text-blue-900">
                    Request from:{" "}
                    {requestToApprove.form_data?.ownerName ||
                      requestToApprove.email}
                  </p>
                  <p className="text-blue-700 text-xs mt-1">
                    Submitted:{" "}
                    {new Date(requestToApprove.created_at).toLocaleDateString()}
                  </p>
                </div>
              )}

              {/* Basic Info */}
              <div className="space-y-2">
                <Label htmlFor="approve-name">Pharmacy Name *</Label>
                <Input
                  id="approve-name"
                  value={approvalForm.name}
                  onChange={(e) => {
                    setApprovalForm({
                      ...approvalForm,
                      name: e.target.value,
                      slug: generateSlug(e.target.value),
                    });
                  }}
                  placeholder="e.g., Smith's Pharmacy"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="approve-slug">Slug *</Label>
                <Input
                  id="approve-slug"
                  value={approvalForm.slug}
                  onChange={(e) =>
                    setApprovalForm({
                      ...approvalForm,
                      slug: e.target.value.toLowerCase(),
                    })
                  }
                  placeholder="e.g., smiths-pharmacy"
                  required
                />
                <p className="text-xs text-gray-500">
                  Auto-generated from name, can be edited
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="approve-phone">Phone</Label>
                  <Input
                    id="approve-phone"
                    value={approvalForm.phone}
                    onChange={(e) =>
                      setApprovalForm({
                        ...approvalForm,
                        phone: e.target.value,
                      })
                    }
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approve-npi">NPI Number</Label>
                  <Input
                    id="approve-npi"
                    value={approvalForm.npi}
                    onChange={(e) =>
                      setApprovalForm({ ...approvalForm, npi: e.target.value })
                    }
                    placeholder="1234567890"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approve-dea">DEA Number</Label>
                  <Input
                    id="approve-dea"
                    value={approvalForm.dea_number}
                    onChange={(e) =>
                      setApprovalForm({ ...approvalForm, dea_number: e.target.value })
                    }
                    placeholder="AB1234567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approve-ncpdp">NCPDP Number</Label>
                  <Input
                    id="approve-ncpdp"
                    value={approvalForm.ncpdp_number}
                    onChange={(e) =>
                      setApprovalForm({ ...approvalForm, ncpdp_number: e.target.value })
                    }
                    placeholder="1234567"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="approve-address">Address</Label>
                <Input
                  id="approve-address"
                  value={approvalForm.address}
                  onChange={(e) =>
                    setApprovalForm({
                      ...approvalForm,
                      address: e.target.value,
                    })
                  }
                  placeholder="123 Main St, City, ST 12345"
                />
              </div>

              {/* System Integration */}
              <div className="border-t pt-4 mt-4">
                <h4 className="font-medium mb-3">Backend Integration *</h4>

                <div className="space-y-2">
                  <Label htmlFor="approve-system">Pharmacy System *</Label>
                  <Select
                    value={approvalForm.system_type}
                    onValueChange={(value) =>
                      setApprovalForm({ ...approvalForm, system_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DigitalRx">DigitalRx</SelectItem>
                      <SelectItem value="PioneerRx">PioneerRx</SelectItem>
                      <SelectItem value="QS1">QS1</SelectItem>
                      <SelectItem value="Liberty">Liberty</SelectItem>
                      <SelectItem value="BestRx">BestRx</SelectItem>
                      <SelectItem value="Custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                  {requestToApprove?.form_data?.currentSystem && (
                    <p className="text-xs text-gray-500">
                      Requested system:{" "}
                      {requestToApprove.form_data.currentSystem}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2">
                    <Label htmlFor="approve-store-id">Store ID *</Label>
                    <Input
                      id="approve-store-id"
                      value={approvalForm.store_id}
                      onChange={(e) =>
                        setApprovalForm({
                          ...approvalForm,
                          store_id: e.target.value,
                        })
                      }
                      placeholder="STORE123"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="approve-location-id">Location ID</Label>
                    <Input
                      id="approve-location-id"
                      value={approvalForm.location_id}
                      onChange={(e) =>
                        setApprovalForm({
                          ...approvalForm,
                          location_id: e.target.value,
                        })
                      }
                      placeholder="LOC001"
                    />
                  </div>
                </div>

                <div className="space-y-2 mt-4">
                  <Label htmlFor="approve-api-url">API URL</Label>
                  <Input
                    id="approve-api-url"
                    value={approvalForm.api_url}
                    onChange={(e) =>
                      setApprovalForm({
                        ...approvalForm,
                        api_url: e.target.value,
                      })
                    }
                    placeholder="https://api.example.com"
                  />
                </div>

                <div className="space-y-2 mt-4">
                  <Label htmlFor="approve-api-key">API Key *</Label>
                  <Input
                    id="approve-api-key"
                    type="password"
                    value={approvalForm.api_key}
                    onChange={(e) =>
                      setApprovalForm({
                        ...approvalForm,
                        api_key: e.target.value,
                      })
                    }
                    placeholder="Enter API key"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsApproveModalOpen(false);
                    setRequestToApprove(null);
                    setApprovingRequestId(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {isSubmitting ? "Creating..." : "Create Pharmacy"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Request Details Modal */}
        <Dialog
          open={isViewRequestDetailsOpen}
          onOpenChange={setIsViewRequestDetailsOpen}
        >
          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Access Request Details</DialogTitle>
            </DialogHeader>

            {viewingRequest && (
              <div className="space-y-4">
                {/* Pharmacy Information */}
                <div>
                  <h4 className="font-medium text-sm text-gray-500 mb-2">
                    Pharmacy Information
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">
                          Pharmacy Name
                        </Label>
                        <p className="text-sm font-medium">
                          {viewingRequest.form_data?.pharmacyName || "N/A"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          Owner Name
                        </Label>
                        <p className="text-sm font-medium">
                          {viewingRequest.form_data?.ownerName || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">Email</Label>
                        <p className="text-sm">{viewingRequest.email}</p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">Phone</Label>
                        <p className="text-sm">
                          {viewingRequest.form_data?.phone ||
                            viewingRequest.phone ||
                            "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Licensing & Credentials */}
                <div>
                  <h4 className="font-medium text-sm text-gray-500 mb-2">
                    Licensing & Credentials
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">
                          License Number
                        </Label>
                        <p className="text-sm">
                          {viewingRequest.form_data?.licenseNumber || "N/A"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          License State
                        </Label>
                        <p className="text-sm">
                          {viewingRequest.form_data?.licenseState || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">
                          DEA Number
                        </Label>
                        <p className="text-sm">
                          {viewingRequest.form_data?.deaNumber || "N/A"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          NCPDP Number
                        </Label>
                        <p className="text-sm">
                          {viewingRequest.form_data?.ncpdpNumber || "N/A"}
                        </p>
                      </div>
                    </div>
                    {viewingRequest.form_data?.accreditations && (
                      <div>
                        <Label className="text-xs text-gray-500">
                          Accreditations
                        </Label>
                        <p className="text-sm">
                          {viewingRequest.form_data.accreditations}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Location */}
                <div>
                  <h4 className="font-medium text-sm text-gray-500 mb-2">
                    Location
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm">
                      {[
                        viewingRequest.form_data?.pharmacyAddress,
                        viewingRequest.form_data?.city,
                        viewingRequest.form_data?.state,
                        viewingRequest.form_data?.zipCode,
                      ]
                        .filter(Boolean)
                        .join(", ") || "N/A"}
                    </p>
                  </div>
                </div>

                {/* System Information */}
                <div>
                  <h4 className="font-medium text-sm text-gray-500 mb-2">
                    System Information
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label className="text-xs text-gray-500">
                          Current System
                        </Label>
                        <p className="text-sm">
                          {viewingRequest.form_data?.currentSystem || "N/A"}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-gray-500">
                          System Version
                        </Label>
                        <p className="text-sm">
                          {viewingRequest.form_data?.systemVersion || "N/A"}
                        </p>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">
                        Integration Type
                      </Label>
                      <p className="text-sm">
                        {viewingRequest.form_data?.integrationType || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Compounding Capabilities */}
                {(viewingRequest.form_data?.yearsInBusiness ||
                  viewingRequest.form_data?.compoundingExperience ||
                  viewingRequest.form_data?.monthlyCapacity ||
                  viewingRequest.form_data?.specializations) && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-500 mb-2">
                      Compounding Capabilities
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-gray-500">
                            Years in Business
                          </Label>
                          <p className="text-sm">
                            {viewingRequest.form_data?.yearsInBusiness || "N/A"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">
                            Compounding Experience
                          </Label>
                          <p className="text-sm">
                            {viewingRequest.form_data?.compoundingExperience ||
                              "N/A"}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-gray-500">
                            Monthly Capacity
                          </Label>
                          <p className="text-sm">
                            {viewingRequest.form_data?.monthlyCapacity || "N/A"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-gray-500">
                            Specializations
                          </Label>
                          <p className="text-sm">
                            {viewingRequest.form_data?.specializations || "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Additional Info */}
                {viewingRequest.form_data?.additionalInfo && (
                  <div>
                    <h4 className="font-medium text-sm text-gray-500 mb-2">
                      Additional Information
                    </h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <p className="text-sm whitespace-pre-wrap">
                        {viewingRequest.form_data.additionalInfo}
                      </p>
                    </div>
                  </div>
                )}

                {/* Submission Info */}
                <div className="text-xs text-gray-500 pt-2 border-t">
                  <p>
                    Submitted:{" "}
                    {new Date(viewingRequest.created_at).toLocaleString()}
                  </p>
                  {viewingRequest.form_data?.hearAboutUs && (
                    <p>
                      How they heard about us:{" "}
                      {viewingRequest.form_data.hearAboutUs}
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsViewRequestDetailsOpen(false)}
                  >
                    Close
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setIsViewRequestDetailsOpen(false);
                      handleApprovePharmacyRequest(viewingRequest);
                    }}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Approve Request
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Reject Confirmation Dialog */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Reject Access Request</DialogTitle>
              <DialogDescription>
                Are you sure you want to reject this pharmacy access request?
              </DialogDescription>
            </DialogHeader>

            {requestToReject && (
              <div className="space-y-4">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <p className="text-sm font-medium">
                    Pharmacy: {requestToReject.form_data?.pharmacyName || "N/A"}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    Owner: {requestToReject.form_data?.ownerName || "N/A"}
                  </p>
                  <p className="text-xs text-gray-600">
                    Email: {requestToReject.email}
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsRejectDialogOpen(false);
                      setRequestToReject(null);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={confirmRejectRequest}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    Reject Request
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
