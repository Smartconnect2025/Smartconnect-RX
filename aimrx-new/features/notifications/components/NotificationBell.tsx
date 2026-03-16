"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useNotificationContext } from "../context/NotificationContext";

export const NotificationBell = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>((props, ref) => {
  const { unreadCount } = useNotificationContext();
  const [isRinging, setIsRinging] = useState(false);
  const prevCountRef = useRef(unreadCount);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/sounds/notification.wav");
      audioRef.current.volume = 0.4;
    }
  }, []);

  useEffect(() => {
    if (unreadCount > prevCountRef.current) {
      setIsRinging(true);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
      const timeout = setTimeout(() => setIsRinging(false), 1200);
      return () => clearTimeout(timeout);
    }
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  return (
    <div className="relative" data-testid="notification-bell-wrapper">
      <button
        ref={ref}
        {...props}
        className={`relative h-10 w-10 p-0 flex items-center justify-center cursor-pointer rounded-full transition-all duration-200
          ${unreadCount > 0 ? "text-[#1E3A8A] hover:bg-blue-50" : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"}
          ${isRinging ? "animate-bell-ring" : ""}
        `}
        data-testid="button-notifications"
      >
        <Bell
          className={`h-5.5 w-5.5 transition-transform duration-200 ${unreadCount > 0 ? "fill-[#1E3A8A]/10" : ""}`}
          strokeWidth={unreadCount > 0 ? 2.2 : 1.8}
        />
        <span className="sr-only">Notifications</span>
      </button>

      {unreadCount > 0 && (
        <span
          className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white shadow-sm animate-badge-pop"
          data-testid="badge-unread-count"
        >
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}

      {unreadCount > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[20px] h-[20px] rounded-full bg-red-500 animate-ping opacity-30 pointer-events-none" />
      )}

      <style jsx>{`
        @keyframes bell-ring {
          0% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-12deg); }
          30% { transform: rotate(10deg); }
          40% { transform: rotate(-8deg); }
          50% { transform: rotate(6deg); }
          60% { transform: rotate(-4deg); }
          70% { transform: rotate(2deg); }
          80% { transform: rotate(-1deg); }
          100% { transform: rotate(0deg); }
        }
        .animate-bell-ring {
          animation: bell-ring 0.8s ease-in-out;
        }
        @keyframes badge-pop {
          0% { transform: scale(0); }
          50% { transform: scale(1.3); }
          100% { transform: scale(1); }
        }
        .animate-badge-pop {
          animation: badge-pop 0.3s ease-out;
        }
      `}</style>
    </div>
  );
});

NotificationBell.displayName = "NotificationBell";
