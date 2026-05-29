"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useUser } from "@core/auth";

interface Pharmacy {
  id: string;
  name: string;
  slug: string;
  primary_color: string | null;
  tagline: string | null;
}

interface PharmacyContextType {
  pharmacy: Pharmacy | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

const PharmacyContext = createContext<PharmacyContextType | undefined>(
  undefined
);

export function PharmacyProvider({ children }: { children: React.ReactNode }) {
  const [pharmacy, setPharmacy] = useState<Pharmacy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useUser();

  const loadPharmacy = async () => {
    try {
      const response = await fetch("/api/provider/pharmacy");

      // If not authenticated or no pharmacy, silently fail
      if (!response.ok) {
        setPharmacy(null);
        setIsLoading(false);
        return;
      }

      const data = await response.json();

      if (data.success) {
        setPharmacy(data.pharmacy);
      } else {
        setPharmacy(null);
      }
    } catch {
      // Silently handle errors - not all users have pharmacies
      setPharmacy(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Load pharmacy when user is available
    if (user) {
      loadPharmacy();
    }
  }, [user]);

  const refresh = async () => {
    setIsLoading(true);
    await loadPharmacy();
  };

  return (
    <PharmacyContext.Provider value={{ pharmacy, isLoading, refresh }}>
      {children}
    </PharmacyContext.Provider>
  );
}

export function usePharmacy() {
  const context = useContext(PharmacyContext);
  if (context === undefined) {
    throw new Error("usePharmacy must be used within a PharmacyProvider");
  }
  return context;
}
