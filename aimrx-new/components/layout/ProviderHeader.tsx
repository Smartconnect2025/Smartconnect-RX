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
import { useUser } from "@core/auth";
import { usePharmacy } from "@/contexts/PharmacyContext";
import { NotificationsPanel } from "@/features/notifications/components/NotificationsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind-utils";

export function ProviderHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [providerName, setProviderName] = useState<string>("");
  const [companyName, setCompanyName] = useState<string>("");
  const { user } = useUser();
  const { pharmacy } = usePharmacy();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  useEffect(() => {
    const loadProviderName = async () => {
      if (!user?.id) return;

      const { data } = await supabase
        .from("providers")
        .select("first_name, last_name, company_name")
        .eq("user_id", user.id)
        .single();

      if (data) {
        setProviderName(`Dr. ${data.first_name} ${data.last_name}`);
        if (data.company_name) {
          setCompanyName(data.company_name);
        }
      }
    };

    loadProviderName();
  }, [user?.id, supabase]);

  const handleLoginRedirect = () => {
    router.push("/auth");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/auth/login";
  };

  const mainNavLinks = [
    { href: "/provider/dashboard", label: "Dashboard" },
    { href: "/provider/catalog", label: "Catalog" },
    { href: "/prescriptions", label: "Prescriptions" },
    { href: "/refills", label: "Refills" },
    { href: "/prescriptions/new/step1", label: "Prescribe" },
    { href: "/basic-emr", label: "Patients" },
  ];

  const pharmacyColor = pharmacy?.primary_color || "#1E3A8A";
  const pharmacyAccent = pharmacy?.primary_color || "#1E3A8A";
  const pharmacyLogo = pharmacy?.logo_url || null;
  const pharmacyName = pharmacy?.name || null;

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
            <div className="flex items-center gap-3">
              <Link href="/prescriptions/new/step1" className="flex items-center gap-3">
                {pharmacyLogo ? (
                  <img
                    src={pharmacyLogo}
                    alt={pharmacyName || "Pharmacy"}
                    className="h-14 w-auto max-w-[180px] object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = "/logo-header.png";
                    }}
                  />
                ) : (
                  <img
                    src="/logo-header.png"
                    alt="SmartConnect RX"
                    className="h-14 w-auto"
                  />
                )}
              </Link>
              {(pharmacyName || companyName) && (
                <div className="hidden md:block border-l border-gray-300 pl-3">
                  {pharmacyName && (
                    <p className="text-lg font-semibold text-gray-900">{pharmacyName}</p>
                  )}
                  {companyName && companyName !== pharmacyName && (
                    <p className="text-xs text-gray-500">{companyName}</p>
                  )}
                </div>
              )}
            </div>

            {user && (
              <nav className="hidden lg:flex items-center gap-1 relative">
                {mainNavLinks.map((link) => {
                  let isActive = false;

                  if (link.href === "/provider/dashboard") {
                    isActive = pathname === "/provider/dashboard";
                  } else if (link.href === "/prescriptions") {
                    isActive = pathname === "/prescriptions";
                  } else if (link.href === "/refills") {
                    isActive = pathname === "/refills";
                  } else if (link.href === "/prescriptions/new/step1") {
                    isActive = pathname.startsWith("/prescriptions/new");
                  } else if (link.href === "/basic-emr") {
                    isActive = pathname.startsWith("/basic-emr") || pathname.startsWith("/patients");
                  } else {
                    isActive = pathname === link.href || pathname.startsWith(link.href);
                  }

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "text-sm font-medium transition-all duration-200 px-3 py-2 rounded-md relative z-10 text-gray-700 group",
                        isActive
                          ? "bg-gray-100"
                          : "hover:bg-gray-50",
                      )}
                    >
                      {link.label}
                      <span
                        className={cn(
                          "absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-all duration-300",
                          isActive
                            ? "opacity-100"
                            : "opacity-0 group-hover:opacity-100"
                        )}
                        style={{ backgroundColor: pharmacyColor }}
                      />
                    </Link>
                  );
                })}
              </nav>
            )}

            <div className="flex items-center gap-3">
              {user && <NotificationsPanel />}

              {user ? (
                <div className="hidden lg:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <div
                        className="relative h-10 w-10 p-0 flex items-center justify-center cursor-pointer hover:bg-gray-100 rounded-full"
                      >
                        <User className="h-6 w-6" style={{ color: pharmacyColor }} />
                      </div>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-[200px] border border-border"
                    >
                      <div className="px-2 pt-2 pb-2">
                        <p className="text-xs font-medium text-foreground">
                          {providerName || "Provider"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {user.email && user.email.length > 20
                            ? `${user.email.substring(0, 24)}...`
                            : user.email}
                        </p>
                        {pharmacyName && (
                          <p className="text-xs mt-1 font-medium" style={{ color: pharmacyColor }}>
                            {pharmacyName}
                          </p>
                        )}
                      </div>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/provider/profile">Profile</Link>
                      </DropdownMenuItem>
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
                  <X className="h-6 w-6" style={{ color: pharmacyColor }} />
                ) : (
                  <Menu className="h-6 w-6" style={{ color: pharmacyColor }} />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <div
        className={cn(
          "fixed top-24 right-0 h-[calc(100vh-6rem)] w-full max-w-sm bg-white z-40 transform transition-transform duration-300 ease-in-out lg:hidden shadow-xl",
          mobileMenuOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="h-full overflow-y-auto">
          {user && (
            <div className="p-4">
              <div className="pb-4 mb-4 border-b border-border">
                {pharmacyName && (
                  <div className="mb-3 flex items-center gap-2">
                    {pharmacyLogo && (
                      <img
                        src={pharmacyLogo}
                        alt={pharmacyName || "Pharmacy"}
                        className="h-8 w-auto max-w-[120px] object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "/logo-header.png";
                        }}
                      />
                    )}
                    <p className="text-base font-semibold text-gray-900">{pharmacyName}</p>
                  </div>
                )}
                {!pharmacyName && companyName && (
                  <div className="mb-3">
                    <p className="text-base font-semibold text-gray-900">{companyName}</p>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full flex items-center justify-center" style={{ backgroundColor: `${pharmacyAccent}20` }}>
                    <User className="h-6 w-6" style={{ color: pharmacyColor }} />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {providerName || "Provider"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {user.email && user.email.length > 25
                        ? `${user.email.substring(0, 25)}...`
                        : user.email}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Main Menu
                </h3>
                <nav>
                  <ul className="space-y-1">
                    {mainNavLinks.map((link) => {
                      let isActive = false;

                      if (link.href === "/provider/dashboard") {
                        isActive = pathname === "/provider/dashboard";
                      } else if (link.href === "/prescriptions") {
                        isActive = pathname === "/prescriptions";
                      } else if (link.href === "/prescriptions/new/step1") {
                        isActive = pathname.startsWith("/prescriptions/new");
                      } else if (link.href === "/basic-emr") {
                        isActive = pathname.startsWith("/basic-emr") || pathname.startsWith("/patients");
                      } else {
                        isActive = pathname === link.href || pathname.startsWith(link.href);
                      }

                      return (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className={cn(
                              "text-sm font-medium transition-all duration-200 px-3 py-2 rounded-md relative block",
                              isActive
                                ? "text-foreground bg-gray-100"
                                : "text-foreground/80 hover:text-foreground hover:bg-gray-50",
                            )}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            {link.label}
                            {isActive && (
                              <span
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] h-0.5 rounded-full"
                                style={{ backgroundColor: pharmacyColor }}
                              />
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </div>

              <div>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Account
                </h3>
                <nav>
                  <ul className="space-y-1">
                    <li>
                      <Link
                        href="/provider/profile"
                        className={cn(
                          "block px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 relative",
                          pathname === "/provider/profile"
                            ? "text-foreground bg-gray-100"
                            : "text-foreground/80 hover:text-foreground hover:bg-gray-50",
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Profile
                        {pathname === "/provider/profile" && (
                          <span
                            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[calc(100%-1.5rem)] h-0.5 rounded-full"
                            style={{ backgroundColor: pharmacyColor }}
                          />
                        )}
                      </Link>
                    </li>
                  </ul>
                </nav>
              </div>

              <div className="pt-4">
                <button
                  className="block px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 cursor-pointer"
                  style={{ color: pharmacyColor }}
                  onClick={handleLogout}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
