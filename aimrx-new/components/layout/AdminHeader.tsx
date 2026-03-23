"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@core/supabase";
import { User, Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useUser } from "@core/auth";
import { NotificationsPanel } from "@/features/notifications/components/NotificationsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind-utils";

interface PharmacyBranding {
  id: string;
  name: string;
  logo_url: string | null;
  primary_color: string | null;
  tagline: string | null;
}

export function AdminHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isPharmacyAdmin, setIsPharmacyAdmin] = useState(false);
  const [pharmacyBranding, setPharmacyBranding] = useState<PharmacyBranding | null>(null);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const { user, userRole } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const checkPharmacyAdmin = async () => {
      if (!user?.id) return;

      const { data } = await supabase
        .from("pharmacy_admins")
        .select("pharmacy_id")
        .eq("user_id", user.id)
        .maybeSingle();

      setIsPharmacyAdmin(!!data);

      if (data?.pharmacy_id) {
        const { data: pharmacyData } = await supabase
          .from("pharmacies")
          .select("id, name, logo_url, primary_color, tagline")
          .eq("id", data.pharmacy_id)
          .single();

        if (pharmacyData) {
          setPharmacyBranding(pharmacyData);
          setLogoLoadError(false);
        }
      } else {
        setPharmacyBranding(null);
        setLogoLoadError(false);
      }
    };

    checkPharmacyAdmin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const handleLoginRedirect = () => {
    router.push("/auth");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/auth/login";
  };

  const mainNavLinks = isPharmacyAdmin
    ? [
        { href: "/admin/prescriptions", label: "Incoming Prescriptions" },
        { href: "/admin/medications", label: "Medications" },
        { href: "/admin/medication-catalog", label: "Catalog" },
        { href: "/admin/providers", label: "Providers" },
        { href: "/admin/pharmacy-reports", label: "Reports" },
        { href: "/admin/pharmacy-payment-settings", label: "Payment Settings" },
        { href: "/admin/pharmacy-branding", label: "Branding" },
      ]
    : [
        { href: "/admin", label: "Dashboard" },
        { href: "/admin/prescriptions", label: "Incoming Queue" },
        { href: "/admin/pharmacy-reports", label: "Reporting & Analytics" },
        { href: "/admin/tiers", label: "Manage Tiers" },
        { href: "/admin/refill-engine", label: "Refill Engine" },
        { href: "/admin/api-logs", label: "API & Logs" },
        { href: "/admin/settings", label: "Integration Settings" },
      ];

  const brandColor = pharmacyBranding?.primary_color || "#1E3A8A";

  return (
    <>
      <header
        className="sticky top-0 z-50 w-full shadow-sm border-b border-gray-200"
        style={{
          backgroundColor: "#FFFFFF"
        }}
      >
        <div className="container max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            <Link href="/admin" className="flex items-center gap-3">
              {isPharmacyAdmin ? (
                <>
                  {pharmacyBranding?.logo_url && !logoLoadError ? (
                    <img
                      src={pharmacyBranding.logo_url}
                      alt={pharmacyBranding?.name || "Pharmacy"}
                      className="h-14 w-auto max-w-[180px] object-contain"
                      onError={() => setLogoLoadError(true)}
                    />
                  ) : (
                    <div
                      className="h-12 w-12 rounded-lg flex items-center justify-center text-white text-xl font-bold shrink-0"
                      style={{ backgroundColor: pharmacyBranding?.primary_color || "#1D4E89" }}
                    >
                      {pharmacyBranding?.name?.charAt(0) || "P"}
                    </div>
                  )}
                  <div>
                    <p className="text-lg font-semibold text-gray-900">
                      {pharmacyBranding?.name || "Pharmacy"}
                    </p>
                    {pharmacyBranding?.tagline && (
                      <p className="text-xs text-gray-500">{pharmacyBranding.tagline}</p>
                    )}
                  </div>
                </>
              ) : (
                <img
                  src="/logo-header.png"
                  alt="SmartConnect RX"
                  className="h-14 w-auto"
                />
              )}
            </Link>

            {user && (
              <nav className="hidden lg:flex items-center gap-1 relative">
                {mainNavLinks.map((link) => {
                  const isActive = link.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "text-sm font-medium transition-all duration-200 px-3 py-2 rounded-md relative z-10 text-gray-700",
                        isActive
                          ? "bg-gray-100"
                          : "hover:bg-gray-50",
                      )}
                    >
                      {link.label}
                      {isActive && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full"
                          style={{
                            backgroundColor: isPharmacyAdmin ? brandColor : "#1E3A8A",
                            animation: "slideIn 0.3s ease-out"
                          }}
                        />
                      )}
                    </Link>
                  );
                })}
              </nav>
            )}

            <div className="flex items-center gap-3">
            {/*   <NotificationsPanel /> */}

              {user ? (
                <div className="hidden lg:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div
                        className="relative h-10 w-10 p-0 flex items-center justify-center cursor-pointer hover:bg-gray-100 rounded-full"
                      >
                        <User className="h-6 w-6" style={{ color: isPharmacyAdmin ? brandColor : undefined }} />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-[200px] border border-border"
                    >
                      <div className="px-2 pt-2 pb-2">
                        <p className="text-xs font-medium text-foreground">
                          {isPharmacyAdmin ? "Signed in as Pharmacy Admin" : "Signed in as Admin"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {user.email && user.email.length > 20
                            ? `${user.email.substring(0, 24)}...`
                            : user.email}
                        </p>
                        {isPharmacyAdmin && (
                          <p className="text-xs mt-1 font-medium" style={{ color: brandColor }}>
                            {pharmacyBranding?.name || "Pharmacy"}
                          </p>
                        )}
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onSelect={handleLogout}>
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <Button onClick={handleLoginRedirect}>Sign In</Button>
              )}

              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden hover:bg-gray-100 rounded-full"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" style={{ color: isPharmacyAdmin ? brandColor : undefined }} />
                ) : (
                  <Menu className="h-6 w-6" style={{ color: isPharmacyAdmin ? brandColor : undefined }} />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {isPharmacyAdmin && (
        <div className="w-full bg-gray-50 border-b border-gray-200 py-1">
          <div className="container max-w-7xl mx-auto px-4 flex justify-end">
            <span className="text-[10px] text-gray-400 tracking-wide">
              Powered by <span className="font-semibold text-gray-500">SmartConnect</span>
            </span>
          </div>
        </div>
      )}

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed top-24 right-0 h-[calc(100vh-6rem)] w-full max-w-sm backdrop-blur-md z-40 transform transition-transform duration-300 ease-in-out lg:hidden shadow-2xl",
          mobileMenuOpen ? "translate-x-0" : "translate-x-full",
        )}
        style={{
          backgroundColor: isPharmacyAdmin ? `${brandColor}F2` : "rgba(30, 58, 138, 0.95)",
          borderLeft: `4px solid ${brandColor}`,
        }}
      >
        <div className="h-full overflow-y-auto">
          {user && (
            <div className="p-4">
              <div className="pb-4 mb-4 border-b border-white/20">
                <div className="flex items-center gap-3">
                  {isPharmacyAdmin && pharmacyBranding?.logo_url && !logoLoadError ? (
                    <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                      <img
                        src={pharmacyBranding.logo_url}
                        alt={pharmacyBranding.name}
                        className="h-10 w-10 object-contain"
                        onError={() => setLogoLoadError(true)}
                      />
                    </div>
                  ) : isPharmacyAdmin ? (
                    <div className="h-12 w-12 rounded-full flex items-center justify-center text-white text-lg font-bold" style={{ backgroundColor: brandColor }}>
                      {pharmacyBranding?.name?.charAt(0) || "P"}
                    </div>
                  ) : (
                    <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: brandColor }}>
                      <User className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-white">
                      {user.email && user.email.length > 25
                        ? `${user.email.substring(0, 25)}...`
                        : user.email}
                    </p>
                    {(userRole === "admin" || userRole === "super_admin" || isPharmacyAdmin) && (
                      <Badge className="mt-1 text-white hover:opacity-90" style={{ backgroundColor: brandColor }}>
                        {isPharmacyAdmin ? (pharmacyBranding?.name || "Pharmacy Admin") : "Admin"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider mb-2">
                  Main Menu
                </h3>
                <nav>
                  <ul className="space-y-1">
                    {mainNavLinks.map((link) => {
                      const isActive = link.href === "/admin"
                        ? pathname === "/admin"
                        : pathname.startsWith(link.href);

                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className={cn(
                              "block px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 relative",
                              isActive
                                ? "text-white bg-white/10"
                                : "text-white/80 hover:text-white hover:bg-white/5",
                            )}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {link.label}
                            {isActive && (
                              <span
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] h-0.5 rounded-full"
                                style={{ backgroundColor: brandColor }}
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                    <li className="pt-2 mt-2 border-t border-white/20">
                      <button
                        className="w-full text-left flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer hover:text-white"
                        style={{ color: brandColor }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = brandColor;
                          e.currentTarget.style.color = "#FFFFFF";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                          e.currentTarget.style.color = brandColor;
                        }}
                        onClick={handleLogout}
                      >
                        <User className="h-4 w-4" />
                        Sign Out
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
