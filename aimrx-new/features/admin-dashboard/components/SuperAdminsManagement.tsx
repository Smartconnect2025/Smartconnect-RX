"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  RefreshCw,
  ShieldCheck,
  Eye,
  EyeOff,
  Pencil,
  Search,
  KeyRound,
  Building2,
  Users,
  Copy,
  Check,
  Globe,
  Info,
} from "lucide-react";
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
  DialogFooter,
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SuperAdmin {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in: string | null;
  email_confirmed: boolean;
  is_current_user: boolean;
  pharmacies: Array<{
    pharmacy_id: string;
    pharmacies: { id: string; name: string; slug: string } | null;
  }>;
}

interface Pharmacy {
  id: string;
  name: string;
  slug: string;
}

export const SuperAdminsManagement: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [admins, setAdmins] = useState<SuperAdmin[]>([]);
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<SuperAdmin | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [resetPasswordAdmin, setResetPasswordAdmin] = useState<SuperAdmin | null>(null);
  const [deletingAdmin, setDeletingAdmin] = useState<SuperAdmin | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "platform" | "pharmacy">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    full_name: "",
    pharmacy_ids: [] as string[],
  });
  const [showPassword, setShowPassword] = useState(false);

  const [editFormData, setEditFormData] = useState({
    full_name: "",
    pharmacy_ids: [] as string[],
  });

  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const fetchAdmins = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/super-admins");
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.admins || []);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to fetch admins");
      }
    } catch (error) {
      console.error("Error fetching admins:", error);
      toast.error("Failed to fetch admins");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPharmacies = async () => {
    try {
      const response = await fetch("/api/admin/pharmacies-list");
      if (response.ok) {
        const data = await response.json();
        setPharmacies(data.pharmacies || []);
      }
    } catch (error) {
      console.error("Error fetching pharmacies:", error);
    }
  };

  useEffect(() => {
    fetchAdmins();
    fetchPharmacies();
  }, []);

  const filteredAdmins = useMemo(() => {
    let result = admins;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (a) =>
          a.email.toLowerCase().includes(q) ||
          (a.full_name && a.full_name.toLowerCase().includes(q))
      );
    }

    if (filterType === "platform") {
      result = result.filter((a) => a.pharmacies.length === 0);
    } else if (filterType === "pharmacy") {
      result = result.filter((a) => a.pharmacies.length > 0);
    }

    return result;
  }, [admins, searchQuery, filterType]);

  const stats = useMemo(() => {
    const total = admins.length;
    const recentlyActive = admins.filter((a) => {
      if (!a.last_sign_in) return false;
      const diff = Date.now() - new Date(a.last_sign_in).getTime();
      return diff < 30 * 24 * 60 * 60 * 1000;
    }).length;
    const neverLoggedIn = admins.filter((a) => !a.last_sign_in).length;
    const superAdminCount = admins.filter((a) => a.pharmacies.length === 0).length;
    const pharmacyAdminCount = admins.filter((a) => a.pharmacies.length > 0).length;
    return { total, recentlyActive, neverLoggedIn, superAdminCount, pharmacyAdminCount };
  }, [admins]);

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const special = "!@#$%&*";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pwd += special.charAt(Math.floor(Math.random() * special.length));
    pwd += Math.floor(Math.random() * 10);
    return pwd;
  };

  const handleGeneratePassword = () => {
    setFormData((prev) => ({ ...prev, password: generatePassword() }));
    setShowPassword(true);
  };

  const handleGenerateNewPassword = () => {
    setNewPassword(generatePassword());
    setShowNewPassword(true);
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleCreate = async () => {
    if (!formData.email || !formData.password) {
      toast.error("Email and password are required");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/super-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (response.ok) {
        const roleLabel = formData.pharmacy_ids.length === 0 ? "Super Admin" : "Pharmacy Admin";
        toast.success(`${roleLabel} created successfully`);
        setIsFormOpen(false);
        setFormData({ email: "", password: "", full_name: "", pharmacy_ids: [] });
        fetchAdmins();
      } else {
        toast.error(result.error || "Failed to create admin");
      }
    } catch (error) {
      console.error("Error creating admin:", error);
      toast.error("Failed to create admin");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async () => {
    if (!editingAdmin) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/super-admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: editingAdmin.user_id,
          full_name: editFormData.full_name,
          pharmacy_ids: editFormData.pharmacy_ids,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        const roleLabel = editFormData.pharmacy_ids.length === 0 ? "Super Admin" : "Pharmacy Admin";
        toast.success(`${roleLabel} updated successfully`);
        setIsEditOpen(false);
        setEditingAdmin(null);
        fetchAdmins();
      } else {
        toast.error(result.error || "Failed to update admin");
      }
    } catch (error) {
      console.error("Error updating admin:", error);
      toast.error("Failed to update admin");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordAdmin || !newPassword) return;

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/admin/super-admins", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: resetPasswordAdmin.user_id,
          new_password: newPassword,
        }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Password reset successfully");
        setIsResetPasswordOpen(false);
        setResetPasswordAdmin(null);
        setNewPassword("");
      } else {
        toast.error(result.error || "Failed to reset password");
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      toast.error("Failed to reset password");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingAdmin) return;

    try {
      const response = await fetch("/api/admin/super-admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: deletingAdmin.user_id }),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success("Admin access removed");
        setDeletingAdmin(null);
        fetchAdmins();
      } else {
        toast.error(result.error || "Failed to remove admin");
      }
    } catch (error) {
      console.error("Error removing admin:", error);
      toast.error("Failed to remove admin");
    }
  };

  const openEditDialog = (admin: SuperAdmin) => {
    setEditingAdmin(admin);
    setEditFormData({
      full_name: admin.full_name || "",
      pharmacy_ids: admin.pharmacies.map((p) => p.pharmacy_id),
    });
    setIsEditOpen(true);
  };

  const openResetPasswordDialog = (admin: SuperAdmin) => {
    setResetPasswordAdmin(admin);
    setNewPassword("");
    setShowNewPassword(false);
    setIsResetPasswordOpen(true);
  };

  const togglePharmacy = (pharmacyId: string, setter: (fn: (prev: string[]) => string[]) => void) => {
    setter((prev: string[]) =>
      prev.includes(pharmacyId)
        ? prev.filter((id: string) => id !== pharmacyId)
        : [...prev, pharmacyId]
    );
  };

  return (
    <>
      <div className="container max-w-6xl mx-auto py-6 space-y-6 px-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
              Admin Management
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage all platform administrators and their pharmacy access levels
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => { fetchAdmins(); fetchPharmacies(); }}
              variant="outline"
              className="border border-border"
              data-testid="button-refresh"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => {
                setFormData({ email: "", password: "", full_name: "", pharmacy_ids: [] });
                setShowPassword(false);
                setIsFormOpen(true);
              }}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-create-admin"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Admin
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-semibold text-blue-900">How admin roles work:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <Badge className="bg-[#1D4E89] text-white shrink-0 mt-0.5">Super Admin</Badge>
                  <span className="text-blue-800">Has full access to <strong>all pharmacies</strong> and platform settings. Not linked to any specific pharmacy.</span>
                </div>
                <div className="flex items-start gap-2">
                  <Badge className="bg-emerald-600 text-white shrink-0 mt-0.5">Pharmacy Admin</Badge>
                  <span className="text-blue-800">Can only manage their <strong>assigned pharmacy</strong>. Linked to one or more specific pharmacies.</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg border border-border p-4" data-testid="stat-total">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-[#1D4E89]" />
              <span className="text-sm text-muted-foreground">Total Admins</span>
            </div>
            <p className="text-2xl font-bold">{stats.total}</p>
          </div>
          <div className="bg-white rounded-lg border border-border p-4" data-testid="stat-super-admins">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="h-4 w-4 text-[#1D4E89]" />
              <span className="text-sm text-muted-foreground">Super Admins</span>
            </div>
            <p className="text-2xl font-bold">{stats.superAdminCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-border p-4" data-testid="stat-pharmacy-admins">
            <div className="flex items-center gap-2 mb-1">
              <Building2 className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-muted-foreground">Pharmacy Admins</span>
            </div>
            <p className="text-2xl font-bold">{stats.pharmacyAdminCount}</p>
          </div>
          <div className="bg-white rounded-lg border border-border p-4" data-testid="stat-active">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm text-muted-foreground">Active (30d)</span>
            </div>
            <p className="text-2xl font-bold">{stats.recentlyActive}</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search"
            />
          </div>
          <Select value={filterType} onValueChange={(val) => setFilterType(val as typeof filterType)}>
            <SelectTrigger className="w-full sm:w-[220px]" data-testid="select-filter">
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Admins</SelectItem>
              <SelectItem value="platform">Super Admins Only</SelectItem>
              <SelectItem value="pharmacy">Pharmacy Admins Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="bg-white rounded-lg border border-border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Admin</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Pharmacy Access</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : filteredAdmins.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {searchQuery || filterType !== "all"
                      ? "No admins match your search/filter."
                      : "No admins found."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredAdmins.map((admin) => {
                  const isSuperAdmin = admin.pharmacies.length === 0;
                  return (
                    <TableRow key={admin.user_id} data-testid={`row-admin-${admin.user_id}`}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${isSuperAdmin ? "bg-[#1D4E89]/10" : "bg-emerald-50"}`}>
                            {isSuperAdmin
                              ? <Globe className="h-4 w-4 text-[#1D4E89]" />
                              : <Building2 className="h-4 w-4 text-emerald-600" />
                            }
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium truncate" data-testid={`text-admin-email-${admin.user_id}`}>
                                {admin.email}
                              </span>
                              {admin.is_current_user && (
                                <Badge variant="outline" className="text-xs shrink-0 border-blue-300 text-blue-700">
                                  You
                                </Badge>
                              )}
                            </div>
                            {admin.full_name && (
                              <div className="text-sm text-muted-foreground truncate">{admin.full_name}</div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {isSuperAdmin ? (
                          <Badge className="bg-[#1D4E89] text-white hover:bg-[#1D4E89]/90 text-xs">
                            Super Admin
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white hover:bg-emerald-600/90 text-xs">
                            Pharmacy Admin
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {isSuperAdmin ? (
                            <span className="text-sm font-medium text-[#1D4E89]">All Pharmacies</span>
                          ) : (
                            admin.pharmacies.map((p, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {(p.pharmacies as { name: string } | null)?.name || "Unknown"}
                              </Badge>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {admin.last_sign_in
                            ? new Date(admin.last_sign_in).toLocaleDateString()
                            : "Never"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(admin)}
                            className="border border-border"
                            title="Edit admin"
                            data-testid={`button-edit-admin-${admin.user_id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openResetPasswordDialog(admin)}
                            className="border border-border"
                            title="Reset password"
                            data-testid={`button-reset-password-${admin.user_id}`}
                          >
                            <KeyRound className="h-4 w-4" />
                          </Button>
                          {!admin.is_current_user && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingAdmin(admin)}
                              className="border border-border text-destructive hover:text-destructive"
                              title="Remove admin"
                              data-testid={`button-delete-admin-${admin.user_id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {filteredAdmins.length > 0 && (
          <p className="text-sm text-muted-foreground text-center" data-testid="text-result-count">
            Showing {filteredAdmins.length} of {admins.length} admin{admins.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="bg-white border border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create New Admin</DialogTitle>
            <DialogDescription>
              Add a new administrator. Their role is determined by pharmacy assignment below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                placeholder="e.g., John Smith"
                value={formData.full_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                data-testid="input-full-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={formData.email}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                data-testid="input-email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Strong password"
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    data-testid="input-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword(!showPassword)}
                    data-testid="button-toggle-password"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePassword}
                  className="border border-border whitespace-nowrap"
                  data-testid="button-generate-password"
                >
                  Generate
                </Button>
              </div>
            </div>
            {pharmacies.length > 0 && (
              <div className="space-y-2">
                <Label>Assign to Pharmacies</Label>
                <div className={`rounded-md border p-3 text-xs mb-2 ${formData.pharmacy_ids.length === 0 ? "border-[#1D4E89]/30 bg-[#1D4E89]/5 text-[#1D4E89]" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}>
                  {formData.pharmacy_ids.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span><strong>Super Admin</strong> — No pharmacies selected. This admin will have access to ALL pharmacies.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span><strong>Pharmacy Admin</strong> — This admin will only manage the {formData.pharmacy_ids.length} selected {formData.pharmacy_ids.length === 1 ? "pharmacy" : "pharmacies"}.</span>
                    </div>
                  )}
                </div>
                <div className="border border-border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
                  {pharmacies.map((pharmacy) => (
                    <label key={pharmacy.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={formData.pharmacy_ids.includes(pharmacy.id)}
                        onChange={() =>
                          setFormData((prev) => ({
                            ...prev,
                            pharmacy_ids: prev.pharmacy_ids.includes(pharmacy.id)
                              ? prev.pharmacy_ids.filter((id) => id !== pharmacy.id)
                              : [...prev.pharmacy_ids, pharmacy.id],
                          }))
                        }
                        className="rounded border-gray-300"
                        data-testid={`checkbox-pharmacy-${pharmacy.id}`}
                      />
                      <span className="text-sm">{pharmacy.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsFormOpen(false)}
              className="border border-border"
              data-testid="button-cancel"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={isSubmitting || !formData.email || !formData.password}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-submit-create"
            >
              {isSubmitting ? "Creating..." : formData.pharmacy_ids.length === 0 ? "Create Super Admin" : "Create Pharmacy Admin"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingAdmin(null); }}>
        <DialogContent className="bg-white border border-border sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Admin</DialogTitle>
            <DialogDescription>
              Update details for {editingAdmin?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
            <div className="space-y-2">
              <Label htmlFor="edit_email">Email</Label>
              <Input
                id="edit_email"
                value={editingAdmin?.email || ""}
                disabled
                className="bg-gray-50"
                data-testid="input-edit-email"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed for security reasons.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit_full_name">Full Name</Label>
              <Input
                id="edit_full_name"
                placeholder="e.g., John Smith"
                value={editFormData.full_name}
                onChange={(e) => setEditFormData((prev) => ({ ...prev, full_name: e.target.value }))}
                data-testid="input-edit-full-name"
              />
            </div>
            {pharmacies.length > 0 && (
              <div className="space-y-2">
                <Label>Assign to Pharmacies</Label>
                <div className={`rounded-md border p-3 text-xs mb-2 ${editFormData.pharmacy_ids.length === 0 ? "border-[#1D4E89]/30 bg-[#1D4E89]/5 text-[#1D4E89]" : "border-emerald-300 bg-emerald-50 text-emerald-700"}`}>
                  {editFormData.pharmacy_ids.length === 0 ? (
                    <div className="flex items-center gap-2">
                      <Globe className="h-3.5 w-3.5 shrink-0" />
                      <span><strong>Super Admin</strong> — No pharmacies selected. This admin has access to ALL pharmacies.</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-3.5 w-3.5 shrink-0" />
                      <span><strong>Pharmacy Admin</strong> — This admin only manages the {editFormData.pharmacy_ids.length} selected {editFormData.pharmacy_ids.length === 1 ? "pharmacy" : "pharmacies"}.</span>
                    </div>
                  )}
                </div>
                <div className="border border-border rounded-md p-3 space-y-2 max-h-32 overflow-y-auto">
                  {pharmacies.map((pharmacy) => (
                    <label key={pharmacy.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-1 rounded">
                      <input
                        type="checkbox"
                        checked={editFormData.pharmacy_ids.includes(pharmacy.id)}
                        onChange={() =>
                          togglePharmacy(pharmacy.id, (fn) =>
                            setEditFormData((prev) => ({ ...prev, pharmacy_ids: fn(prev.pharmacy_ids) }))
                          )
                        }
                        className="rounded border-gray-300"
                        data-testid={`checkbox-edit-pharmacy-${pharmacy.id}`}
                      />
                      <span className="text-sm">{pharmacy.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsEditOpen(false); setEditingAdmin(null); }}
              className="border border-border"
              data-testid="button-cancel-edit"
            >
              Cancel
            </Button>
            <Button
              onClick={handleEdit}
              disabled={isSubmitting}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-submit-edit"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isResetPasswordOpen} onOpenChange={(open) => { setIsResetPasswordOpen(open); if (!open) setResetPasswordAdmin(null); }}>
        <DialogContent className="bg-white border border-border sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {resetPasswordAdmin?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="new_password">New Password *</Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="new_password"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    data-testid="input-new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    data-testid="button-toggle-new-password"
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGenerateNewPassword}
                  className="border border-border whitespace-nowrap"
                  data-testid="button-generate-new-password"
                >
                  Generate
                </Button>
              </div>
            </div>
            {newPassword && showNewPassword && (
              <div className="bg-gray-50 border border-border rounded-md p-3 flex items-center justify-between">
                <code className="text-sm font-mono">{newPassword}</code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(newPassword, "new-password")}
                  data-testid="button-copy-password"
                >
                  {copiedId === "new-password" ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3">
              <p className="text-sm text-amber-800">
                The admin will need to use this new password on their next login. Make sure to share it securely.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setIsResetPasswordOpen(false); setResetPasswordAdmin(null); }}
              className="border border-border"
              data-testid="button-cancel-reset"
            >
              Cancel
            </Button>
            <Button
              onClick={handleResetPassword}
              disabled={isSubmitting || !newPassword}
              className="bg-primary hover:bg-primary/90"
              data-testid="button-submit-reset"
            >
              {isSubmitting ? "Resetting..." : "Reset Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingAdmin} onOpenChange={() => setDeletingAdmin(null)}>
        <AlertDialogContent className="bg-white border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Admin Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove admin access for{" "}
              <strong>{deletingAdmin?.email}</strong>?
              {deletingAdmin?.full_name && <> ({deletingAdmin.full_name})</>}
              <br /><br />
              This will revoke their platform-level admin privileges and unlink them from any pharmacies.
              They will no longer be able to access the admin dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border border-border">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              Remove Access
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
