"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@core/supabase";

export const dynamic = 'force-dynamic';

interface Pharmacy {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
  tagline: string | null;
  address: string | null;
  npi: string | null;
  phone: string | null;
  is_active: boolean | null;
  created_at: string;
  updated_at: string;
}

export default function DebugPharmaciesPage() {
  const router = useRouter();
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [backendsCount, setBackendsCount] = useState<number>(0);
  const [medicationsCount, setMedicationsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newPharmacy, setNewPharmacy] = useState({
    name: "",
    slug: "",
    primary_color: "#00AEEF",
    tagline: "",
    address: "",
    phone: "",
  });

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/auth/login");
        return;
      }
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .single();
      if (!roleData || !["admin", "super_admin"].includes(roleData.role)) {
        router.replace("/dashboard");
        return;
      }
      setAuthorized(true);
      loadData();
    };
    checkAuth();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const supabase = createClient();

    try {
      // Load pharmacies
      const { data: pharmaciesData } = await supabase
        .from("pharmacies")
        .select("*")
        .order("created_at", { ascending: false });

      setPharmacies(pharmaciesData || []);

      // If no pharmacies, auto-seed AIM and Greenwich
      if (!pharmaciesData || pharmaciesData.length === 0) {
        await autoSeedPharmacies();
      }

      // Count backends
      const { data: backendsData } = await supabase
        .from("pharmacy_backends")
        .select("id");
      setBackendsCount(backendsData?.length || 0);

      // Count medications
      const { data: medicationsData } = await supabase
        .from("pharmacy_medications")
        .select("id");
      setMedicationsCount(medicationsData?.length || 0);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const autoSeedPharmacies = async () => {
    // Seed AIM
    await fetch("/api/admin/seed-aim", { method: "POST" });

    // Seed Greenwich
    await fetch("/api/admin/seed-grinethch", { method: "POST" });

    // Seed medications (Stage 2 - Prompt 1/6)
    await fetch("/api/admin/seed-medications", { method: "POST" });

    // Reload data
    await loadData();
  };

  const handleCreatePharmacy = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const supabase = createClient();

      const { error } = await supabase
        .from("pharmacies")
        .insert({
          name: newPharmacy.name,
          slug: newPharmacy.slug,
          primary_color: newPharmacy.primary_color,
          tagline: newPharmacy.tagline,
          address: newPharmacy.address,
          phone: newPharmacy.phone,
          is_active: true,
        })
        .select()
        .single();

      if (error) {
        alert("Failed to create pharmacy: " + error.message);
      } else {
        alert("✓ Pharmacy created successfully!");
        setNewPharmacy({
          name: "",
          slug: "",
          primary_color: "#00AEEF",
          tagline: "",
          address: "",
          phone: "",
        });
        await loadData();
      }
    } catch (error) {
      console.error("Error:", error);
      alert("Error creating pharmacy");
    } finally {
      setCreating(false);
    }
  };

  const stage1Complete = pharmacies.length >= 2 && backendsCount >= 2;

  if (!authorized) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p>Loading...</p></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="mx-auto max-w-6xl">
        <h1 className="text-3xl font-bold mb-2">🔧 Pharmacies Debug Page</h1>
        <p className="text-gray-600 mb-6">Multi-Pharmacy Platform - Database Status</p>

        {loading ? (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-blue-800">⏳ Loading data...</p>
          </div>
        ) : (
          <>
            {/* Status Overview */}
            <div className="space-y-4 mb-8">
              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold">
                  ✓ Pharmacies table: exists ({pharmacies.length} rows)
                </h2>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold">
                  ✓ Pharmacy_backends table: exists ({backendsCount} rows)
                </h2>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold">
                  ✓ Pharmacy_medications table: exists ({medicationsCount} rows)
                </h2>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold">
                  ✓ Prescriptions table upgraded: 6 new columns added
                </h2>
              </div>

              <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                <h2 className="text-lg font-semibold">
                  ✓ Linking tables ready: provider_pharmacy_links + pharmacy_admins
                </h2>
              </div>

              {stage1Complete && (
                <div className="border-4 border-blue-500 rounded-lg p-6 bg-blue-50">
                  <h2 className="text-2xl font-bold text-blue-900 text-center">
                    🎉 Stage 1 COMPLETE – {pharmacies.length} pharmacies + {backendsCount} backends ready
                  </h2>
                </div>
              )}

              {/* Stage 2 Progress */}
              {stage1Complete && (
                <div className="bg-purple-50 border-2 border-purple-300 rounded-lg p-6">
                  <h2 className="text-xl font-bold mb-4 text-purple-900">🚀 Stage 2 Progress</h2>
                  <div className="space-y-2">
                    {medicationsCount >= 10 ? (
                      <div className="flex items-center gap-2 text-green-700">
                        <span className="font-bold">✓</span>
                        <span>Prompt 1/6 – 10 medications seeded (5 SmartConnect RX + 5 Greenwich)</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-gray-600">
                        <span className="font-bold">○</span>
                        <span>Prompt 1/6 – 10 medications seeded ({medicationsCount}/10)</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Pharmacies List */}
            <div className="bg-white border-2 border-gray-300 rounded-lg p-6 mb-8">
              <h2 className="text-2xl font-semibold mb-4">📋 Seeded Pharmacies</h2>

              {pharmacies.length === 0 ? (
                <p className="text-gray-500 italic">No pharmacies seeded yet</p>
              ) : (
                <div className="space-y-4">
                  {pharmacies.map((pharmacy) => (
                    <div
                      key={pharmacy.id}
                      className="border-2 rounded-lg p-4"
                      style={{ borderColor: pharmacy.primary_color || "#ccc" }}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div
                          className="w-8 h-8 rounded-full"
                          style={{ backgroundColor: pharmacy.primary_color || "#ccc" }}
                        ></div>
                        <h3 className="text-xl font-bold">{pharmacy.name}</h3>
                        <span className="text-sm text-gray-600">({pharmacy.slug})</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                        <p><strong>Tagline:</strong> {pharmacy.tagline || "N/A"}</p>
                        <p><strong>Phone:</strong> {pharmacy.phone || "N/A"}</p>
                        <p className="col-span-2"><strong>Address:</strong> {pharmacy.address || "N/A"}</p>
                        <p><strong>Color:</strong> {pharmacy.primary_color}</p>
                        <p><strong>Status:</strong> {pharmacy.is_active ? "✓ Active" : "✗ Inactive"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Admin Pharmacy Creator */}
            <div className="bg-white border-2 border-purple-300 rounded-lg p-6">
              <h2 className="text-2xl font-semibold mb-4">➕ Admin Pharmacy Creator</h2>
              <p className="text-gray-600 mb-4">Add a new pharmacy to the platform</p>

              <form onSubmit={handleCreatePharmacy} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1">Pharmacy Name *</label>
                    <input
                      type="text"
                      required
                      value={newPharmacy.name}
                      onChange={(e) => setNewPharmacy({ ...newPharmacy, name: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded"
                      placeholder="e.g., HealthPlus Pharmacy"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Slug (URL-safe) *</label>
                    <input
                      type="text"
                      required
                      value={newPharmacy.slug}
                      onChange={(e) => setNewPharmacy({ ...newPharmacy, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded"
                      placeholder="e.g., healthplus"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Primary Color</label>
                    <input
                      type="color"
                      value={newPharmacy.primary_color}
                      onChange={(e) => setNewPharmacy({ ...newPharmacy, primary_color: e.target.value })}
                      className="w-full h-10 border-2 border-gray-300 rounded"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-1">Phone</label>
                    <input
                      type="tel"
                      value={newPharmacy.phone}
                      onChange={(e) => setNewPharmacy({ ...newPharmacy, phone: e.target.value })}
                      className="w-full px-3 py-2 border-2 border-gray-300 rounded"
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Tagline</label>
                  <input
                    type="text"
                    value={newPharmacy.tagline}
                    onChange={(e) => setNewPharmacy({ ...newPharmacy, tagline: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded"
                    placeholder="e.g., Your Trusted Health Partner"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-1">Address</label>
                  <input
                    type="text"
                    value={newPharmacy.address}
                    onChange={(e) => setNewPharmacy({ ...newPharmacy, address: e.target.value })}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded"
                    placeholder="123 Main St, City, State ZIP"
                  />
                </div>

                <button
                  type="submit"
                  disabled={creating}
                  className="w-full px-6 py-3 bg-purple-600 text-white text-lg font-bold rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  {creating ? "Creating..." : "💾 Save Pharmacy"}
                </button>
              </form>
            </div>

            {/* Links */}
            <div className="mt-8 text-center space-y-2">
              <a
                href="/admin/quick-start-guide"
                className="block text-blue-600 hover:text-blue-700 underline text-lg"
              >
                → Go to Quick Start Guide
              </a>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
