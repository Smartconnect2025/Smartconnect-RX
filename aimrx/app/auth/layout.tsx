import { Loader2 } from "lucide-react";
import { Suspense } from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex-1">
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#1E3A8A] to-[#00AEEF]">
              <Loader2 className="h-12 w-12 animate-spin text-white" />
            </div>
          }
        >
          {children}
        </Suspense>
      </main>
    </div>
  );
}
