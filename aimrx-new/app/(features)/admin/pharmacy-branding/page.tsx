"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@core/supabase";
import { useUser } from "@core/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Upload,
  Palette,
  Building2,
  Phone,
  MapPin,
  Quote,
  Mail,
  ImageIcon,
  X,
} from "lucide-react";

const PRESET_COLORS = [
  { name: "Ocean Blue", hex: "#00AEEF" },
  { name: "Navy", hex: "#1E3A8A" },
  { name: "Teal", hex: "#0D9488" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Forest Green", hex: "#166534" },
  { name: "Royal Purple", hex: "#7C3AED" },
  { name: "Berry", hex: "#BE185D" },
  { name: "Crimson Red", hex: "#DC2626" },
  { name: "Warm Orange", hex: "#EA580C" },
  { name: "Slate", hex: "#475569" },
  { name: "Charcoal", hex: "#1F2937" },
  { name: "Deep Indigo", hex: "#3730A3" },
];

interface PharmacyData {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  tagline: string | null;
  phone: string | null;
  address: string | null;
}

export default function PharmacyBrandingPage() {
  const { user } = useUser();
  const supabase = createClient();

  const [pharmacy, setPharmacy] = useState<PharmacyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#00AEEF");
  const [tagline, setTagline] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPharmacy = useCallback(async () => {
    if (!user?.id) return;

    try {
      const { data: adminRecord } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!adminRecord?.pharmacy_id) {
        setLoading(false);
        return;
      }

      const { data: pharmacyData } = await supabase
        .from("pharmacies")
        .select("id, name, logo_url, primary_color, tagline, phone, address")
        .eq("id", adminRecord.pharmacy_id)
        .single();

      if (pharmacyData) {
        setPharmacy(pharmacyData);
        setLogoUrl(pharmacyData.logo_url || "");
        setPrimaryColor(pharmacyData.primary_color || "#00AEEF");
        setTagline(pharmacyData.tagline || "");
        setPhone(pharmacyData.phone || "");
        setAddress(pharmacyData.address || "");
      }
    } catch (err) {
      console.error("Failed to load pharmacy:", err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, supabase]);

  useEffect(() => {
    loadPharmacy();
  }, [loadPharmacy]);

  const handleSave = async () => {
    if (!pharmacy) return;
    setSaving(true);
    setSaveStatus("idle");
    setErrorMessage("");

    try {
      const res = await fetch(`/api/admin/pharmacies/${pharmacy.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logo_url: logoUrl || null,
          primary_color: primaryColor,
          tagline: tagline || null,
          phone: phone || null,
          address: address || null,
        }),
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Failed to save");
      }

      setSaveStatus("success");
      setTimeout(() => setSaveStatus("idle"), 3000);
    } catch (err) {
      setSaveStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pharmacy) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setErrorMessage("Invalid file type. Use JPG, PNG, or WebP.");
      setSaveStatus("error");
      return;
    }

    if (file.size > 3 * 1024 * 1024) {
      setErrorMessage("File too large. Maximum 3MB.");
      setSaveStatus("error");
      return;
    }

    setUploading(true);
    setErrorMessage("");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "pharmacy-logo");
      formData.append("entityId", pharmacy.id);
      formData.append("entityName", pharmacy.name);

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok || !result.success) {
        throw new Error(result.error || "Upload failed");
      }

      setLogoUrl(result.url);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Upload failed");
      setSaveStatus("error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = () => {
    setLogoUrl("");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!pharmacy) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="h-5 w-5" />
              <p>No pharmacy found for your account. Please contact support.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="h-6 w-6 text-blue-600" />
          Pharmacy Branding
        </h1>
        <p className="text-gray-500 mt-1">
          Customize how your pharmacy appears to patients in emails, payment pages, and more.
        </p>
      </div>

      {saveStatus === "success" && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          Branding saved successfully!
        </div>
      )}
      {saveStatus === "error" && errorMessage && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <ImageIcon className="h-5 w-5 text-blue-600" />
                Pharmacy Logo
              </CardTitle>
              <CardDescription>
                Upload your pharmacy logo. Appears in emails and patient-facing pages. Max 3MB, JPG/PNG/WebP.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {logoUrl ? (
                <div className="relative inline-block">
                  <div className="border rounded-lg p-4 bg-gray-50 flex items-center justify-center min-h-[100px]">
                    <img
                      src={logoUrl}
                      alt={pharmacy.name}
                      className="max-h-24 max-w-[250px] object-contain"
                    />
                  </div>
                  <button
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    title="Remove logo"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <ImageIcon className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No logo uploaded</p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                  />
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="w-full"
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {uploading ? "Uploading..." : "Upload Logo"}
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="logo-url" className="text-xs text-gray-500">
                  Or paste a logo URL
                </Label>
                <Input
                  id="logo-url"
                  placeholder="https://example.com/logo.png"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Palette className="h-5 w-5 text-blue-600" />
                Brand Color
              </CardTitle>
              <CardDescription>
                Choose your pharmacy&apos;s brand color. Used in email headers, buttons, and accents.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-6 gap-2">
                {PRESET_COLORS.map((preset) => (
                  <button
                    key={preset.hex}
                    onClick={() => setPrimaryColor(preset.hex)}
                    className={`relative w-full aspect-square rounded-lg border-2 transition-all ${
                      primaryColor.toLowerCase() === preset.hex.toLowerCase()
                        ? "border-gray-900 ring-2 ring-offset-2 ring-gray-400 scale-110"
                        : "border-transparent hover:border-gray-300 hover:scale-105"
                    }`}
                    style={{ backgroundColor: preset.hex }}
                    title={preset.name}
                  >
                    {primaryColor.toLowerCase() === preset.hex.toLowerCase() && (
                      <CheckCircle2 className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-lg" />
                    )}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1">
                  <Label htmlFor="custom-color" className="text-sm whitespace-nowrap">
                    Custom:
                  </Label>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="w-10 h-10 rounded cursor-pointer border border-gray-300"
                    />
                    <Input
                      id="custom-color"
                      placeholder="#00AEEF"
                      value={primaryColor}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "" || /^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                          setPrimaryColor(val);
                        }
                      }}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
                Pharmacy Details
              </CardTitle>
              <CardDescription>
                Your pharmacy&apos;s contact information shown to patients.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="tagline" className="flex items-center gap-1.5">
                  <Quote className="h-3.5 w-3.5" />
                  Tagline
                </Label>
                <Input
                  id="tagline"
                  placeholder="Your trusted neighborhood pharmacy"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  maxLength={100}
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">{tagline.length}/100</p>
              </div>
              <div>
                <Label htmlFor="phone" className="flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" />
                  Phone Number
                </Label>
                <Input
                  id="phone"
                  placeholder="(555) 123-4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  maxLength={20}
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="address" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Address
                </Label>
                <Input
                  id="address"
                  placeholder="123 Main St, City, State 12345"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  maxLength={200}
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">{address.length}/200</p>
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleSave}
            disabled={saving || uploading}
            className="w-full h-12 text-base font-medium"
            style={{ backgroundColor: primaryColor || "#00AEEF" }}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Saving...
              </>
            ) : uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Upload in progress...
              </>
            ) : (
              "Save Branding"
            )}
          </Button>
        </div>

        <div className="space-y-6">
          <Card className="sticky top-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-blue-600" />
                Email Preview
              </CardTitle>
              <CardDescription>
                Live preview of how your branding appears in patient emails.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="border rounded-lg overflow-hidden shadow-sm">
                <div
                  className="p-6 text-center"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor || "#00AEEF"} 0%, #1E3A8A 100%)`,
                  }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={pharmacy.name}
                      className="max-h-12 max-w-[200px] mx-auto mb-3 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  ) : null}
                  <h2 className="text-xl font-semibold text-white">Payment Request</h2>
                  <p className="text-white/80 text-sm mt-1">from {pharmacy.name}</p>
                </div>

                <div className="p-5 bg-white">
                  <p className="text-sm text-gray-700 mb-3">Hi John,</p>
                  <p className="text-sm text-gray-700 mb-4">
                    Your prescription for <strong>Medication Name</strong> is ready for payment.
                  </p>

                  <div
                    className="rounded p-4 mb-4"
                    style={{
                      backgroundColor: "#f8f9fa",
                      borderLeft: `4px solid ${primaryColor || "#00AEEF"}`,
                    }}
                  >
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-500">Prescribed by:</span>
                        <p className="font-semibold text-[#1E3A8A]">Dr. Jane Smith</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Pharmacy:</span>
                        <p className="font-semibold text-gray-800">{pharmacy.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Amount Due:</span>
                        <p className="font-bold text-xl" style={{ color: primaryColor || "#00AEEF" }}>
                          $49.99
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="text-center mb-4">
                    <div
                      className="inline-block px-8 py-3 rounded-md text-white font-semibold text-sm"
                      style={{ backgroundColor: primaryColor || "#00AEEF" }}
                    >
                      Pay Now — $49.99
                    </div>
                  </div>

                  <p className="text-xs text-gray-400 text-center">
                    This link expires in 7 days.
                  </p>
                </div>

                <div
                  className="p-4 text-center text-xs text-white/80"
                  style={{ backgroundColor: primaryColor || "#00AEEF" }}
                >
                  <p className="font-medium text-white">{pharmacy.name}</p>
                  {tagline && <p className="mt-0.5 italic">{tagline}</p>}
                  {phone && <p className="mt-1">{phone}</p>}
                  {address && <p>{address}</p>}
                  <p className="mt-2 text-white/60">
                    &copy; {new Date().getFullYear()} {pharmacy.name}. All rights reserved.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
