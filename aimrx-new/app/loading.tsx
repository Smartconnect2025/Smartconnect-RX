import { Loader2 } from "lucide-react";

export default function Loading() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center w-full min-h-screen">
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    </div>
  );
}
