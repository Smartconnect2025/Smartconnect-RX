"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/utils/tailwind-utils";

const PROVIDER_TABS = [
  {
    href: "/provider/profile",
    label: "Profile",
  },
  {
    href: "/provider/payment-billing",
    label: "Payment & Billing",
  },
];

export function ProviderTabsNavigation() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <>
      {/* Desktop Navigation */}
      <div className="w-full border-b border-gray-200 bg-white sticky top-[65px] z-40 hidden md:block">
        <div className="container mx-auto">
          <div className="flex justify-center space-x-6">
            {PROVIDER_TABS.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "py-4 px-1 text-sm font-medium transition-colors relative",
                  pathname === route.href
                    ? "text-[#66cdcc] before:absolute before:bottom-0 before:left-0 before:w-full before:h-0.5 before:bg-[#66cdcc]"
                    : "text-foreground/70 hover:text-foreground",
                )}
              >
                {route.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div className="w-full border-b border-gray-200 bg-white sticky top-0 z-10 md:hidden">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center py-3">
            <h2 className="text-lg font-semibold">
              {PROVIDER_TABS.find((route) => route.href === pathname)?.label ||
                "Provider Dashboard"}
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMenu}
              aria-label="Toggle navigation menu"
            >
              {isMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>

          {/* Mobile Menu */}
          <div
            className={cn(
              "overflow-hidden transition-all duration-300 ease-in-out",
              isMenuOpen ? "max-h-screen" : "max-h-0",
            )}
          >
            <div className="py-4 flex flex-col space-y-4 border-t border-gray-200">
              {PROVIDER_TABS.map((route) => (
                <Link
                  key={route.href}
                  href={route.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={cn(
                    "py-2 text-sm font-medium transition-colors",
                    pathname === route.href
                      ? "text-[#66cdcc]"
                      : "text-foreground/80 hover:text-foreground",
                  )}
                >
                  {route.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
