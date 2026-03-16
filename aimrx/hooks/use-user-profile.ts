/**
 * Hook to fetch user profile data with avatar information
 * Used in header components to display user avatars
 */

"use client";

import { useState, useEffect } from "react";
import { createClient } from "@core/supabase";
import { getOptimizedAvatarUrl } from "@core/services/storage/avatarStorage";
import { useUser } from "@/core/auth";

export interface UserProfileData {
  id: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  email?: string;
  role: "patient" | "provider" | "admin";
}

export function useUserProfile() {
  const { user, userRole, isLoading: isUserLoading } = useUser();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user || !userRole) {
        if (!isUserLoading) {
          setIsLoading(false);
          setProfile(null);
        }
        return;
      }

      try {
        setIsLoading(true);
        setError(null);

        const supabase = createClient();

        // Determine user role and fetch appropriate profile
        if (userRole === "provider") {
          const { data: providerData } = await supabase
            .from("providers")
            .select("id, first_name, last_name, avatar_url")
            .eq("user_id", user.id)
            .single();

          if (providerData) {
            setProfile({
              id: providerData.id,
              firstName: providerData.first_name,
              lastName: providerData.last_name,
              avatarUrl: providerData.avatar_url,
              email: user.email,
              role: "provider",
            });
            return;
          }
        } else if (userRole === "patient") {
          const { data: patientData } = await supabase
            .from("patients")
            .select("id, first_name, last_name, avatar_url")
            .eq("user_id", user.id)
            .single();

          if (patientData) {
            setProfile({
              id: patientData.id,
              firstName: patientData.first_name,
              lastName: patientData.last_name,
              avatarUrl: patientData.avatar_url,
              email: user.email,
              role: "patient",
            });
            return;
          }
        }

        // If no profile found, create a basic profile
        setProfile({
          id: user.id,
          email: user.email,
          role: "patient", // Default role
        });
      } catch (err) {
        console.error("Error fetching user profile:", err);
        setError(
          err instanceof Error ? err.message : "Failed to fetch profile",
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();

    // Listen for avatar update events
    const handleAvatarUpdate = () => {
      fetchProfile();
    };

    window.addEventListener("avatar-updated", handleAvatarUpdate);

    return () => {
      window.removeEventListener("avatar-updated", handleAvatarUpdate);
    };
  }, [user, userRole, isUserLoading]);

  const refreshProfile = async () => {
    // The profile will be refreshed automatically when the user context changes.
    // This function can be kept for manual refreshes if needed,
    // but it would need to trigger a refresh of the UserProvider state.
    // For now, it doesn't need to do anything.
  };

  const getAvatarUrl = (size: number = 40) => {
    if (!profile?.avatarUrl) return "";
    return getOptimizedAvatarUrl(profile.avatarUrl, size);
  };

  const getInitials = () => {
    if (!profile?.firstName || !profile?.lastName) return "U";
    return `${profile.firstName.charAt(0)}${profile.lastName.charAt(0)}`.toUpperCase();
  };

  return {
    profile,
    isLoading,
    error,
    refreshProfile,
    getAvatarUrl,
    getInitials,
  };
}
