"use client";

import React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Package } from "lucide-react";
import { cn } from "@/utils/tailwind-utils";

interface TriageListProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  description: string;
  primaryAction: {
    label: string;
    href: string;
  };
  contextMenu?: {
    label: string;
    href: string;
  }[];
  className?: string;
}

const TriageList: React.FC<TriageListProps> = ({
  title,
  count,
  icon,
  description,
  primaryAction,
  contextMenu,
  className,
}) => {
  return (
    <Card className={cn("h-full", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {icon}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          <Badge variant="secondary" className="text-sm">
            {count}
          </Badge>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-3">
          <Button asChild className="w-full">
            <a href={primaryAction.href}>{primaryAction.label}</a>
          </Button>
          {contextMenu && contextMenu.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {contextMenu.map((item, index) => (
                <Button key={index} variant="outline" size="sm" asChild>
                  <a href={item.href}>{item.label}</a>
                </Button>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export const TriageLists: React.FC = () => {
  // Placeholder data - will be replaced with real data in future phases
  const triageData = [
    {
      title: "Upcoming Appointments",
      count: 12,
      icon: <Calendar className="h-5 w-5" />,
      description: "Today, tomorrow, and next week",
      primaryAction: {
        label: "View All Appointments",
        href: "/provider/appointments",
      },
      contextMenu: [
        { label: "Today", href: "/provider/appointments?filter=today" },
        { label: "Tomorrow", href: "/provider/appointments?filter=tomorrow" },
        { label: "This Week", href: "/provider/appointments?filter=week" },
      ],
    },
    {
      title: "Order Inbox",
      count: 8,
      icon: <Package className="h-5 w-5" />,
      description: "Pending orders to handle",
      primaryAction: {
        label: "Review Orders",
        href: "/provider/orders",
      },
      contextMenu: [
        { label: "Pending", href: "/provider/orders?status=pending" },
        { label: "Urgent", href: "/provider/orders?status=urgent" },
        { label: "Today", href: "/provider/orders?filter=today" },
      ],
    },
    {
      title: "Patients List",
      count: 45,
      icon: <Users className="h-5 w-5" />,
      description: "Active patient roster",
      primaryAction: {
        label: "View Patients",
        href: "/provider/patients",
      },
      contextMenu: [
        { label: "Recent", href: "/provider/patients?filter=recent" },
        { label: "Active", href: "/provider/patients?filter=active" },
        { label: "Search", href: "/provider/patients?search=" },
      ],
    },
  ];

  return (
    <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {triageData.map((item, index) => (
        <TriageList
          key={index}
          title={item.title}
          count={item.count}
          icon={item.icon}
          description={item.description}
          primaryAction={item.primaryAction}
          contextMenu={item.contextMenu}
        />
      ))}
    </div>
  );
};
