"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex-1 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* 404 Icon */}
        <div className="relative mx-auto w-24 h-24 mb-8">
          <div className="absolute inset-0 bg-blue-200 rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          <h1 className="text-4xl font-bold text-primary">Page not found</h1>
          <p className="text-muted-foreground">
            Sorry, we couldn&apos;t find the page you&apos;re looking for. The
            page might have been removed, had its name changed, or is
            temporarily unavailable.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-center items-center py-4">
          <Button variant="default" asChild>
            <Link href="/">
              <Home className="mr-2 h-4 w-4" />
              Return to home
            </Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
