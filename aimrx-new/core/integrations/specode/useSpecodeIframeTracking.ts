"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Custom hook for tracking pathname changes when running inside Specode AI Coder iframe
 *
 * This project runs inside an iframe within the Specode AI Coder environment.
 * We need to track pathname changes and communicate them to the parent window
 * so the web preview toolbar can display the current route and update accordingly.
 *
 * The hook posts messages to the parent window with the current path information,
 * which allows Specode's preview interface to stay synchronized with the app's navigation.
 */
export function useSpecodeIframeTracking() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only run when inside an iframe (not in standalone mode)
    if (window.parent === window) return;

    // Construct the full path including query parameters
    const search = searchParams.toString();
    const fullPath = pathname + (search ? `?${search}` : "");

    // Send path update message to Specode parent window
    // This enables the preview toolbar to show the current route
    window.parent.postMessage(
      {
        type: "specode:path-update",
        path: fullPath,
        pathname,
        search,
        origin: window.location.origin,
      },
      "*",
    );
  }, [pathname, searchParams]);
}
