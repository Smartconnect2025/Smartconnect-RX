"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Users, Building2, Pill, FolderTree, UserCog, ShieldCheck, LayoutGrid } from "lucide-react";

export function AdminNavigationTabs() {
  const pathname = usePathname();

  const tabs = [
    {
      name: "Manage Providers",
      href: "/admin/doctors",
      icon: Users,
      active: pathname?.startsWith("/admin/doctors"),
    },
    {
      name: "Manage Pharmacies",
      href: "/admin/pharmacy-management",
      icon: Building2,
      active: pathname?.startsWith("/admin/pharmacy-management"),
    },
    {
      name: "Manage Groups",
      href: "/admin/groups",
      icon: FolderTree,
      active: pathname?.startsWith("/admin/groups"),
    },
    {
      name: "Platform Managers",
      href: "/admin/platform-managers",
      icon: UserCog,
      active: pathname?.startsWith("/admin/platform-managers"),
    },
    {
      name: "Manage Categories",
      href: "/admin/categories",
      icon: LayoutGrid,
      active: pathname?.startsWith("/admin/categories"),
    },
    {
      name: "Manage Medications",
      href: "/admin/medication-catalog",
      icon: Pill,
      active: pathname?.startsWith("/admin/medication-catalog") || pathname?.startsWith("/admin/medications"),
    },
    {
      name: "Manage Admins",
      href: "/admin/super-admins",
      icon: ShieldCheck,
      active: pathname?.startsWith("/admin/super-admins"),
    },
  ];

  return (
    <div className="border-b border-gray-200 bg-white">
      <nav className="container mx-auto max-w-7xl px-4" aria-label="Admin Navigation">
        <div className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <Link
                key={tab.name}
                href={tab.href}
                className={`
                  inline-flex items-center gap-2 px-1 py-4 border-b-2 text-sm font-medium transition-colors
                  ${
                    tab.active
                      ? "border-[#1E3A8A] text-[#1E3A8A]"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }
                `}
              >
                <Icon className="h-5 w-5" />
                {tab.name}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
