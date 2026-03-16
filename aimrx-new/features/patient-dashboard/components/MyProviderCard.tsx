"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Stethoscope, Mail, Phone } from "lucide-react";
import type { ProviderInfo } from "../types";

interface MyProviderCardProps {
  provider: ProviderInfo | null;
  isLoading: boolean;
}

export function MyProviderCard({ provider, isLoading }: MyProviderCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-[#1E3A8A]" />
            My Provider
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!provider) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-[#1E3A8A]" />
            My Provider
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No provider assigned yet. A provider will be assigned after your first consultation.
          </p>
        </CardContent>
      </Card>
    );
  }

  const providerName = [provider.first_name, provider.last_name]
    .filter(Boolean)
    .join(" ");
  const initials = [provider.first_name?.[0], provider.last_name?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase();
  const specialty =
    provider.specialty ||
    (provider.specialties && provider.specialties.length > 0
      ? provider.specialties[0].name
      : null);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-[#1E3A8A]" />
          My Provider
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14">
            <AvatarImage src={provider.avatar_url || undefined} alt={providerName} />
            <AvatarFallback className="bg-[#1E3A8A] text-white text-lg">
              {initials || "DR"}
            </AvatarFallback>
          </Avatar>
          <div>
            <h3 className="font-semibold text-base">
              Dr. {providerName || "Provider"}
            </h3>
            {specialty && (
              <p className="text-sm text-muted-foreground">{specialty}</p>
            )}
          </div>
        </div>

        {provider.professional_bio && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {provider.professional_bio}
          </p>
        )}

        <div className="space-y-2 pt-2 border-t">
          {provider.email && (
            <div className="flex items-center gap-2 text-sm min-w-0">
              <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <a
                href={`mailto:${provider.email}`}
                className="text-[#1E3A8A] hover:underline truncate"
              >
                {provider.email}
              </a>
            </div>
          )}
          {provider.phone_number && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <a
                href={`tel:${provider.phone_number}`}
                className="text-[#1E3A8A] hover:underline"
              >
                {provider.phone_number}
              </a>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
