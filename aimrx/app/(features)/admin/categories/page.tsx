"use client";

import { useState, useEffect, useRef } from "react";
import { AdminNavigationTabs } from "@/components/layout/AdminNavigationTabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  Pencil,
  Trash2,
  Upload,
  ImageIcon,
  X,
  Loader2,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  Building2,
  Package,
} from "lucide-react";

interface PharmacyCount {
  pharmacy_name: string;
  count: number;
}

interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  color: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
  medication_count: number;
  pharmacy_counts: PharmacyCount[];
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    color: "#1E3A8A",
  });
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editFileInputRef = useRef<HTMLInputElement>(null);

  const loadCategories = async () => {
    try {
      const response = await fetch("/api/admin/categories", {
        credentials: "include",
      });
      const data = await response.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (error) {
      console.error("Error loading categories:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  };

  const handleCreateCategory = async () => {
    if (!newCategory.name.trim()) {
      alert("Please enter a category name");
      return;
    }

    try {
      const response = await fetch("/api/admin/categories", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCategory.name.trim(),
          slug: generateSlug(newCategory.name),
          description: newCategory.description.trim() || null,
          color: newCategory.color || null,
        }),
      });

      const result = await response.json();
      if (response.ok) {
        setShowCreateDialog(false);
        setNewCategory({ name: "", description: "", color: "#1E3A8A" });
        await loadCategories();
      } else {
        alert(result.error || "Failed to create category");
      }
    } catch (error) {
      console.error("Error creating category:", error);
      alert("Failed to create category");
    }
  };

  const handleUpdateCategory = async (category: Category, updates: Partial<Category>) => {
    setSavingId(category.id);
    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        setCategories((prev) =>
          prev.map((c) => (c.id === category.id ? { ...c, ...updates } : c)),
        );
        if (editingCategory?.id === category.id) {
          setEditingCategory({ ...editingCategory, ...updates });
        }
      } else {
        const data = await response.json();
        alert(data.error || "Failed to update category");
      }
    } catch (error) {
      console.error("Error updating category:", error);
      alert("Failed to update category");
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteCategory = async (category: Category) => {
    if (
      !confirm(
        `Delete "${category.name}"? This will unlink all products from this category. This cannot be undone.`,
      )
    )
      return;

    try {
      const response = await fetch(`/api/admin/categories/${category.id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (response.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== category.id));
        if (editingCategory?.id === category.id) setEditingCategory(null);
        if (expandedId === category.id) setExpandedId(null);
      } else {
        alert("Failed to delete category");
      }
    } catch (error) {
      console.error("Error deleting category:", error);
      alert("Failed to delete category");
    }
  };

  const handleImageUpload = async (file: File, category: Category) => {
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      alert("Invalid file type. Please use JPG, PNG, or WebP images only.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert(
        `File is too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is 3MB.`,
      );
      return;
    }

    setUploadingId(category.id);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "category");
      formData.append("entityId", String(category.id));
      formData.append("entityName", category.name);

      const response = await fetch("/api/admin/upload", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const result = await response.json();
      if (result.success) {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === category.id ? { ...c, image_url: result.url } : c,
          ),
        );
        if (editingCategory?.id === category.id) {
          setEditingCategory({ ...editingCategory, image_url: result.url });
        }
      } else {
        alert(result.error || "Upload failed");
      }
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload image");
    } finally {
      setUploadingId(null);
    }
  };

  const handleRemoveImage = async (category: Category) => {
    if (!confirm(`Remove image from "${category.name}"?`)) return;
    await handleUpdateCategory(category, { image_url: null });
  };

  const handleMoveCategory = async (category: Category, direction: "up" | "down") => {
    const sorted = [...categories].sort((a, b) => a.display_order - b.display_order);
    const idx = sorted.findIndex((c) => c.id === category.id);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const other = sorted[swapIdx];
    const tempOrder = category.display_order;

    setCategories((prev) =>
      prev.map((c) => {
        if (c.id === category.id) return { ...c, display_order: other.display_order };
        if (c.id === other.id) return { ...c, display_order: tempOrder };
        return c;
      }),
    );

    try {
      const r1 = await fetch(`/api/admin/categories/${category.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_order: other.display_order }),
      });
      const r2 = await fetch(`/api/admin/categories/${other.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_order: tempOrder }),
      });

      if (!r1.ok || !r2.ok) {
        await loadCategories();
      }
    } catch {
      await loadCategories();
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCategory) return;
    const original = categories.find((c) => c.id === editingCategory.id);
    if (!original) return;

    const updates: Record<string, unknown> = {};
    if (editingCategory.name !== original.name) updates.name = editingCategory.name;
    if (editingCategory.description !== original.description) updates.description = editingCategory.description;
    if (editingCategory.color !== original.color) updates.color = editingCategory.color;
    if (editingCategory.is_active !== original.is_active) updates.is_active = editingCategory.is_active;

    if (editingCategory.name !== original.name) {
      updates.slug = generateSlug(editingCategory.name);
    }

    if (Object.keys(updates).length > 0) {
      await handleUpdateCategory(original, updates);
    }
    setEditingCategory(null);
  };

  const sorted = [...categories].sort((a, b) => a.display_order - b.display_order);

  return (
    <>
      <AdminNavigationTabs />
      <div className="container mx-auto max-w-7xl py-8 px-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" data-testid="text-categories-title">
              Manage Categories
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Create and manage product categories. Upload images, set display order, and see pharmacy medication counts.
            </p>
          </div>
          <Button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-2"
            data-testid="button-add-category"
          >
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400 mb-3" />
            <p className="text-muted-foreground">Loading categories...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 bg-white border border-border rounded-lg">
            <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No categories yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first category to organize medications in the catalog.
            </p>
            <Button onClick={() => setShowCreateDialog(true)} data-testid="button-add-category-empty">
              <Plus className="h-4 w-4 mr-2" />
              Add Category
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((category, index) => (
              <div
                key={category.id}
                className="bg-white border border-border rounded-lg overflow-hidden"
                data-testid={`category-row-${category.id}`}
              >
                <div className="flex items-center gap-4 p-4">
                  {/* Reorder arrows */}
                  <div className="flex flex-col gap-0.5 flex-shrink-0">
                    <button
                      onClick={() => handleMoveCategory(category, "up")}
                      disabled={index === 0}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      data-testid={`button-move-up-${category.id}`}
                    >
                      <ChevronUp className="h-4 w-4 text-gray-500" />
                    </button>
                    <button
                      onClick={() => handleMoveCategory(category, "down")}
                      disabled={index === sorted.length - 1}
                      className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed"
                      data-testid={`button-move-down-${category.id}`}
                    >
                      <ChevronDown className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>

                  {/* Image */}
                  <div className="flex-shrink-0 relative group">
                    {category.image_url ? (
                      <>
                        <img
                          src={category.image_url}
                          alt={category.name}
                          className="w-20 h-14 rounded-lg object-cover border border-gray-200"
                          data-testid={`img-category-${category.id}`}
                        />
                        <button
                          onClick={() => handleRemoveImage(category)}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          data-testid={`button-remove-image-${category.id}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div
                        className="w-20 h-14 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
                        onClick={() => {
                          fileInputRef.current?.setAttribute("data-category-id", String(category.id));
                          fileInputRef.current?.click();
                        }}
                        data-testid={`placeholder-image-${category.id}`}
                      >
                        <ImageIcon className="h-5 w-5 text-gray-300" />
                      </div>
                    )}
                    {uploadingId === category.id && (
                      <div className="absolute inset-0 bg-white/80 rounded-lg flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      </div>
                    )}
                  </div>

                  {/* Category info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {category.color && (
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: category.color }}
                        />
                      )}
                      <h3 className="font-medium text-gray-900 truncate" data-testid={`text-category-name-${category.id}`}>
                        {category.name}
                      </h3>
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                          category.is_active
                            ? "bg-green-50 text-green-700"
                            : "bg-gray-100 text-gray-500"
                        }`}
                        data-testid={`badge-status-${category.id}`}
                      >
                        {category.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    {category.description && (
                      <p className="text-sm text-muted-foreground truncate mt-0.5">
                        {category.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="h-3 w-3" />
                        {category.medication_count} medication{category.medication_count !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {category.pharmacy_counts.length} pharmac{category.pharmacy_counts.length !== 1 ? "ies" : "y"}
                      </span>
                      <span className="text-gray-300">Order: {category.display_order}</span>
                    </div>
                  </div>

                  {/* Upload button */}
                  <label
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors flex-shrink-0 ${
                      uploadingId === category.id
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                    }`}
                    data-testid={`button-upload-${category.id}`}
                  >
                    {uploadingId === category.id ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Uploading
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        {category.image_url ? "Change" : "Upload"}
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploadingId === category.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImageUpload(file, category);
                        e.target.value = "";
                      }}
                    />
                  </label>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleUpdateCategory(category, { is_active: !category.is_active })}
                      title={category.is_active ? "Deactivate" : "Activate"}
                      data-testid={`button-toggle-${category.id}`}
                    >
                      {category.is_active ? (
                        <Eye className="h-4 w-4 text-green-600" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingCategory({ ...category })}
                      title="Edit"
                      data-testid={`button-edit-${category.id}`}
                    >
                      <Pencil className="h-4 w-4 text-gray-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteCategory(category)}
                      title="Delete"
                      data-testid={`button-delete-${category.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setExpandedId(expandedId === category.id ? null : category.id)}
                      title="Show pharmacy details"
                      data-testid={`button-expand-${category.id}`}
                    >
                      {expandedId === category.id ? (
                        <ChevronUp className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      )}
                    </Button>
                  </div>
                </div>

                {/* Expanded pharmacy details */}
                {expandedId === category.id && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Medications by Pharmacy
                    </h4>
                    {category.pharmacy_counts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No pharmacies have medications in this category yet.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {category.pharmacy_counts.map((pc, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between px-3 py-2 bg-white rounded-lg border border-gray-200"
                          >
                            <span className="text-sm font-medium text-gray-700 truncate">
                              {pc.pharmacy_name}
                            </span>
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium ml-2 flex-shrink-0">
                              {pc.count}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Hidden file input for placeholder click */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            const catId = fileInputRef.current?.getAttribute("data-category-id");
            if (file && catId) {
              const cat = categories.find((c) => c.id === parseInt(catId));
              if (cat) handleImageUpload(file, cat);
            }
            e.target.value = "";
          }}
        />
      </div>

      {/* Create Category Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add New Category</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cat-name">Category Name *</Label>
              <Input
                id="cat-name"
                placeholder="e.g. Weight Loss (GLP-1)"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                data-testid="input-category-name"
              />
              {newCategory.name && (
                <p className="text-xs text-muted-foreground">
                  Slug: {generateSlug(newCategory.name)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea
                id="cat-desc"
                placeholder="Brief description of this category"
                value={newCategory.description}
                onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                rows={2}
                data-testid="input-category-description"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cat-color">Color</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  id="cat-color"
                  value={newCategory.color}
                  onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                  className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                  data-testid="input-category-color"
                />
                <span className="text-sm text-muted-foreground">{newCategory.color}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCategory} data-testid="button-save-category">
              Create Category
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Category</DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Category Name *</Label>
                <Input
                  value={editingCategory.name}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, name: e.target.value })
                  }
                  data-testid="input-edit-category-name"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  value={editingCategory.description || ""}
                  onChange={(e) =>
                    setEditingCategory({ ...editingCategory, description: e.target.value })
                  }
                  rows={2}
                  data-testid="input-edit-category-description"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editingCategory.color || "#1E3A8A"}
                    onChange={(e) =>
                      setEditingCategory({ ...editingCategory, color: e.target.value })
                    }
                    className="w-10 h-10 rounded border border-gray-300 cursor-pointer"
                    data-testid="input-edit-category-color"
                  />
                  <span className="text-sm text-muted-foreground">
                    {editingCategory.color || "#1E3A8A"}
                  </span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Category Image</Label>
                <p className="text-xs text-muted-foreground">
                  Recommended: 800×600px, JPG/PNG/WebP, max 3MB
                </p>
                <div className="flex items-start gap-4 mt-2">
                  {editingCategory.image_url ? (
                    <div className="relative group">
                      <img
                        src={editingCategory.image_url}
                        alt={editingCategory.name}
                        className="w-28 h-20 rounded-lg object-cover border border-gray-200"
                        data-testid="img-edit-category"
                      />
                      <button
                        onClick={() => handleRemoveImage(editingCategory)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="w-28 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center bg-gray-50">
                      <ImageIcon className="h-8 w-8 text-gray-300" />
                    </div>
                  )}
                  <label
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors ${
                      uploadingId === editingCategory.id
                        ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                        : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200"
                    }`}
                  >
                    {uploadingId === editingCategory.id ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        {editingCategory.image_url ? "Change Image" : "Upload Image"}
                      </>
                    )}
                    <input
                      ref={editFileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      disabled={uploadingId === editingCategory.id}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file && editingCategory) handleImageUpload(file, editingCategory);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Label>Status</Label>
                <button
                  onClick={() =>
                    setEditingCategory({
                      ...editingCategory,
                      is_active: !editingCategory.is_active,
                    })
                  }
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    editingCategory.is_active ? "bg-green-500" : "bg-gray-300"
                  }`}
                  data-testid="toggle-edit-category-active"
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      editingCategory.is_active ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
                <span className="text-sm text-muted-foreground">
                  {editingCategory.is_active ? "Active" : "Inactive"}
                </span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingCategory(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={savingId === editingCategory?.id} data-testid="button-save-edit-category">
              {savingId === editingCategory?.id ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
