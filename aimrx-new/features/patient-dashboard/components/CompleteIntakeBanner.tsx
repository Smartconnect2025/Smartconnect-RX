"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClipboardList, ArrowRight } from "lucide-react";

interface CompleteIntakeBannerProps {
  show: boolean;
}

export function CompleteIntakeBanner({ show }: CompleteIntakeBannerProps) {
  if (!show) return null;

  return (
    <Card className="border-[#F97316] bg-orange-50">
      <CardContent className="flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#F97316]/20 flex items-center justify-center">
            <ClipboardList className="h-5 w-5 text-[#F97316]" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Complete Your Profile</h3>
            <p className="text-xs text-muted-foreground">
              Add your medical information to get personalized care
            </p>
          </div>
        </div>
        <Link href="/intake/patient-information">
          <Button
            size="sm"
            className="bg-[#F97316] hover:bg-[#F97316]/90 text-white"
          >
            Complete Intake
            <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
