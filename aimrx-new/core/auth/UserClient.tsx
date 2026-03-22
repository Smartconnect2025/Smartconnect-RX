"use client";
/**
 * Client-side Authentication Context Provider
 *
 * Provides user authentication state to client components and manages
 * authentication state changes.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@core/supabase";
import { User } from "@supabase/supabase-js";
import { SerializedUser, serializeUser, getUserRole, getUserRoleAndDemo } from "./auth-utils";

type UserContextType = {
  user: SerializedUser;
  userRole: string | null;
  isDemo: boolean;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

// Create context
const UserContext = createContext<UserContextType | undefined>(undefined);

// The Supabase client should be initialized outside the component to prevent re-creation on every render.
const supabase = createClient();

/**
 * Client-side authentication state provider component
 *
 * This component:
 * 1. Manages user authentication state
 * 2. Listens for auth state changes from Supabase
 * 3. Provides the user data and role to child components
 * 4. Offers a way to refresh authentication data
 *
 * @param props - Component props
 * @param props.children - Child components to wrap with authentication context
 * @param props.user - Initial user data from server
 * @param props.userRole - Initial user role from server
 * @returns A component tree with authentication context
 */
export function UserClient({
  children,
  user: initialUser,
  userRole: initialUserRole,
  isDemo: initialIsDemo = false,
}: {
  children: React.ReactNode;
  user: SerializedUser;
  userRole: string | null;
  isDemo?: boolean;
}) {
  const [currentUser, setCurrentUser] = useState<SerializedUser>(initialUser);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(
    initialUserRole,
  );
  const [currentIsDemo, setCurrentIsDemo] = useState<boolean>(initialIsDemo);
  const [isLoading, setIsLoading] = useState(!initialUser);
  const isRefreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (isRefreshing.current) {
      return;
    }
    isRefreshing.current = true;

    try {
      let newSupabaseUser: User | null = null;

      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error && error.message?.includes("Failed to fetch")) {
          return;
        }

        if (error) {
          console.error("Auth error:", error);
          return;
        }

        newSupabaseUser = session?.user ?? null;
      } catch {
        return;
      }

      if (!newSupabaseUser) {
        const hostName = typeof window !== "undefined" ? window.location.hostname : "";
        const isDevEnvironment = hostName.includes("replit") || hostName.includes("riker") || hostName.includes("repl.co") || hostName.includes("repl.dev") || hostName === "localhost" || hostName === "127.0.0.1";
        if (isDevEnvironment && initialUser) {
          setIsLoading(false);
          return;
        }
      }

      const newSerializedUser = newSupabaseUser
        ? serializeUser(newSupabaseUser)
        : null;

      let newExtractedUserRole: string | null = null;
      let newIsDemo = false;

      if (newSupabaseUser?.id) {
        const hostName = typeof window !== "undefined" ? window.location.hostname : "";
        const isReplit = hostName.includes("replit") || hostName.includes("riker") || hostName.includes("repl.co") || hostName.includes("repl.dev");
        if (isReplit) {
          try {
            const result = await getUserRoleAndDemo(newSupabaseUser.id, supabase);
            newExtractedUserRole = result.role;
            newIsDemo = result.isDemo;
          } catch {
            return;
          }
        } else {
          try {
            const response = await fetch("/api/auth/me");
            if (response.ok) {
              const data = await response.json();
              newExtractedUserRole = data.role;
              newIsDemo = data.isDemo || false;
            }
          } catch {
            try {
              const result = await getUserRoleAndDemo(newSupabaseUser.id, supabase);
              newExtractedUserRole = result.role;
              newIsDemo = result.isDemo;
            } catch {
              return;
            }
          }
        }
      }

      setCurrentUser(newSerializedUser);
      setCurrentUserRole(newExtractedUserRole);
      setCurrentIsDemo(newIsDemo);
      setIsLoading(false);
    } finally {
      isRefreshing.current = false;
    }
  }, []); // Remove dependencies to prevent unnecessary re-creations

  useEffect(() => {
    // Initial explicit refresh if no initialUser was provided server-side,
    // or to ensure client is in sync if it was.
    // This also handles the case where the tab becomes active.

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED" ||
          event === "INITIAL_SESSION"
        ) {
          refresh();
        } else if (event === "SIGNED_OUT") {
          setCurrentUser(null);
          setCurrentUserRole(null);
          setCurrentIsDemo(false);
          refresh();
        }
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [refresh]); // refresh is memoized

  return (
    <UserContext.Provider
      value={{
        user: currentUser,
        userRole: currentUserRole,
        isDemo: currentIsDemo,
        isLoading,
        refresh,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

/**
 * Hook to access the user authentication context
 *
 * @returns Authentication context with user data, role, loading state, and refresh function
 * @throws Error if used outside of UserProvider
 */
export function useUser(): UserContextType {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}
