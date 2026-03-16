import { Shield } from "lucide-react";

interface HipaaNoticeProps {
  variant?: "banner" | "footer" | "inline";
  className?: string;
}

export function HipaaNotice({ variant = "footer", className = "" }: HipaaNoticeProps) {
  if (variant === "banner") {
    return (
      <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-l-4 border-blue-600 p-4 rounded-r-lg shadow-sm ${className}`}>
        <div className="flex items-start gap-3">
          <div className="bg-blue-600 p-2 rounded-full flex-shrink-0">
            <Shield className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-blue-900 tracking-wide">HIPAA COMPLIANT PLATFORM</p>
            <p className="text-xs text-blue-800 mt-1.5 leading-relaxed">
              This platform adheres to the Health Insurance Portability and Accountability Act (HIPAA) regulations,
              ensuring the highest level of security and privacy for Protected Health Information (PHI).
              All patient data is encrypted using industry-standard protocols both in transit (TLS 1.3) and at rest (AES-256).
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div className={`flex items-center gap-2 text-xs text-gray-700 ${className}`}>
        <Shield className="h-4 w-4 text-blue-600" />
        <span className="font-medium">HIPAA Compliant • End-to-End Encrypted • Secure PHI Handling</span>
      </div>
    );
  }

  // Default: footer variant
  return (
    <div className={`flex items-center justify-center gap-2 py-4 px-4 bg-gradient-to-r from-gray-50 to-blue-50 border-t border-blue-100 text-xs text-gray-700 ${className}`}>
      <span className="font-medium">HIPAA Compliant Healthcare Platform • All Patient Data Encrypted & Secure • Meeting Federal Privacy Standards</span>
    </div>
  );
}
