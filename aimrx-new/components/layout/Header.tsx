"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@core/supabase";
import { Menu, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@core/auth";
import { useUserProfile } from "@/hooks";
import { NotificationsPanel } from "@/features/notifications/components/NotificationsPanel";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind-utils";

export function FullHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, userRole } = useUser();
  const { profile, getAvatarUrl, getInitials } = useUserProfile();
  // Patients have role "user" or null - they should NOT see provider navigation
  const isProviderOrAdmin = userRole === "provider" || userRole === "admin";
  const router = useRouter();
  const pathname = usePathname();
  const supabase = createClient();

  const handleLoginRedirect = () => {
    router.push("/auth");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut({ scope: "local" });
    window.location.href = "/auth/login";
  };

  // Check if user is admin
  const isAdmin = () => {
    return userRole === "admin";
  };

  // Main navigation links - show ONLY for providers/admins, not patients
  const mainNavLinks = user && isProviderOrAdmin
    ? [
        { href: "/", label: "Dashboard" },
        { href: "/prescriptions", label: "Prescriptions" },
        { href: "/basic-emr", label: "Patients" },
      ]
    : [];

  // Profile link based on user role
  const profileLink = "/provider/profile";

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-white shadow-sm border-b border-gray-200">
        <div className="container max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between py-3">
            {/* Left: Logo */}
            <Link href="/" className="flex items-center gap-3">
              <img
                src="/logo-header.png"
                alt="AIM Logo"
                className="h-14 w-auto"
              />
            </Link>

            {/* Center: Navigation Tabs - Hidden on Mobile */}
            {user && mainNavLinks.length > 0 && (
              <nav className="hidden lg:flex items-center gap-2">
                {mainNavLinks.map((link) => {
                  const isActive =
                    link.href === "/"
                      ? pathname === "/"
                      : pathname === link.href || pathname.startsWith(link.href);

                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn(
                        "text-lg font-bold transition-all duration-200 px-6 py-2 rounded-md relative whitespace-nowrap border-2",
                        isActive
                          ? "text-white bg-[#1E3A8A] border-[#1E3A8A]"
                          : "text-[#1E3A8A] border-[#1E3A8A] hover:bg-[#1E3A8A] hover:text-white",
                      )}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            )}

            {/* Right: Icons */}
            <div className="flex items-center gap-3">
              {/* Notifications */}
            {/*   <NotificationsPanel /> */}

              {/* Desktop Profile Menu */}
              {user ? (
                <div className="hidden lg:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="relative h-10 w-10 p-0 flex items-center justify-center cursor-pointer"
                        title="Profile"
                      >
                        <Avatar className="h-10 w-10 relative shadow-md">
                          <AvatarImage src={getAvatarUrl(40)} alt="Profile" />
                          <AvatarFallback className="text-xs bg-[#1E3A8A] text-white font-bold">
                            {getInitials()}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-[200px] border border-border"
                    >
                      <div className="px-2 pt-2 text-sm text-muted-foreground">
                        {user.email && user.email.length > 20
                          ? `${user.email.substring(0, 24)}...`
                          : user.email}
                      </div>
                      <DropdownMenuItem asChild>
                        <Link href={profileLink}>Profile</Link>
                      </DropdownMenuItem>
                      {isAdmin() && (
                        <DropdownMenuItem asChild>
                          <Link href="/super-admin">Platform Dashboard</Link>
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onSelect={handleLogout}>
                        Sign out
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ) : (
                <Button onClick={handleLoginRedirect}>Sign In</Button>
              )}

              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden hover:bg-gray-100 rounded-full"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" style={{ color: "#1E3A8A" }} />
                ) : (
                  <Menu className="h-6 w-6" style={{ color: "#1E3A8A" }} />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Menu Drawer */}
      <div
        className={cn(
          "fixed top-24 right-0 h-[calc(100vh-6rem)] w-full max-w-sm bg-white z-40 transform transition-transform duration-300 ease-in-out md:hidden shadow-xl",
          mobileMenuOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="h-full overflow-y-auto">
          {user ? (
            <div className="p-4">
              {/* User Info Section */}
              <div className="pb-4 mb-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <Avatar className="h-14 w-14 shadow-md">
                    <AvatarImage src={getAvatarUrl(56)} alt="Profile" />
                    <AvatarFallback className="bg-[#1E3A8A] text-white font-bold">{getInitials()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {profile?.firstName && profile?.lastName
                        ? `${profile.firstName} ${profile.lastName}`
                        : user.email && user.email.length > 25
                          ? `${user.email.substring(0, 25)}...`
                          : user.email}
                    </p>
                  </div>
                </div>
              </div>

              {/* Main Navigation - only show for non-patients */}
              {mainNavLinks.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Main Menu
                  </h3>
                  <nav>
                    <ul className="space-y-1">
                      {mainNavLinks.map((link) => {
                        const isActive =
                          link.href === "/"
                            ? pathname === "/"
                            : pathname === link.href || pathname.startsWith(link.href);

                        return (
                          <li key={link.href}>
                            <Link
                              href={link.href}
                              className={cn(
                                "block px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 relative",
                                isActive
                                  ? "text-foreground after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-[calc(100%-1.5rem)] after:h-0.5 after:bg-primary after:rounded-full"
                                  : "text-foreground/80 hover:text-foreground hover:bg-gray-200",
                              )}
                              onClick={() => setMobileMenuOpen(false)}
                            >
                              {link.label}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </nav>
                </div>
              )}

              {/* Profile Navigation */}
              <div className="">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Account
                </h3>
                <nav>
                  <ul className="space-y-1">
                    <li>
                      <Link
                        href={profileLink}
                        className={cn(
                          "block px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 relative",
                          pathname === profileLink
                            ? "text-foreground after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-[calc(100%-1.5rem)] after:h-0.5 after:bg-primary after:rounded-full"
                            : "text-foreground/80 hover:text-foreground hover:bg-gray-200",
                        )}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        Profile
                      </Link>
                    </li>
                    {isAdmin() && (
                      <li>
                        <Link
                          href="/super-admin"
                          className={cn(
                            "block px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 relative",
                            pathname === "/super-admin"
                              ? "text-foreground after:content-[''] after:absolute after:bottom-0 after:left-1/2 after:-translate-x-1/2 after:w-[calc(100%-1.5rem)] after:h-0.5 after:bg-primary after:rounded-full"
                              : "text-foreground/80 hover:text-foreground hover:bg-gray-200",
                          )}
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Platform Dashboard
                        </Link>
                      </li>
                    )}
                  </ul>
                </nav>
              </div>

              {/* Sign Out */}
              <div className="">
                <button
                  className="w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-all duration-200 hover:bg-gray-200"
                  onClick={handleLogout}
                >
                  Sign out
                </button>
              </div>
            </div>
          ) : (
            <div className="p-4">
              <Button
                className="w-full"
                onClick={() => {
                  handleLoginRedirect();
                  setMobileMenuOpen(false);
                }}
              >
                Sign In
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
