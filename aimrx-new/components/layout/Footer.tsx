import Link from "next/link";
import { Instagram, Facebook, Linkedin, Youtube } from "lucide-react";

const XIcon = () => (
  <svg
    className="h-5 w-5"
    width="24"
    height="24"
    viewBox="0 0 1200 1227"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.137 519.284H714.163ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.854V687.828Z"
      fill="currentColor"
    />
  </svg>
);

const socialLinks = [
  {
    name: "Instagram",
    href: "https://instagram.com",
    icon: Instagram,
  },
  {
    name: "Facebook",
    href: "https://facebook.com",
    icon: Facebook,
  },
  {
    name: "X",
    href: "https://x.com",
    icon: XIcon,
  },
  {
    name: "LinkedIn",
    href: "https://linkedin.com",
    icon: Linkedin,
  },
  {
    name: "Youtube",
    href: "https://youtube.com",
    icon: Youtube,
  },
];

const legalLinks = [
  {
    name: "Terms & Conditions",
    href: "/policies/terms",
  },
  {
    name: "Privacy Policy",
    href: "/policies/privacy",
  },
  {
    name: "Refund Policy",
    href: "/policies/refund",
  },
  {
    name: "Telemedicine Consent",
    href: "/policies/telemedicine-consent",
  },
];

const links = [
  {
    name: "About us",
    href: "/about",
  },
  {
    name: "FAQs",
    href: "/faqs",
  },
];

export function Footer() {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="container max-w-5xl mx-auto px-4 pb-8 pt-16 md:pt-24">
        {/* Upper Section */}
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column - Logo and Support */}
            <div className="space-y-6 text-center md:text-left">
              <Link
                href="/"
                className="block flex justify-center md:justify-start items-center gap-3"
              >
                <img
                  src="https://i.imgur.com/JjQDNtL.png"
                  alt="SmartConnect RX Logo"
                  width={48}
                  height={48}
                />
                <span className="text-2xl font-bold text-white">
                  SmartConnect RX
                </span>
              </Link>

              <div className="space-y-2">
                <p className="text-base text-primary-foreground/90">
                  Need Help?
                </p>
                <div className="space-y-1">
                  <p className="text-primary-foreground/90">(512) 377-9898</p>
                  <p className="text-sm text-primary-foreground/70">
                    Mon–Fri 9AM–6PM CST
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Address and Links */}
            <div className="space-y-4 text-center md:text-right">
              <div className="space-y-1">
                <h3 className="text-primary-foreground/90 font-semibold">
                  SmartConnect RX
                </h3>
                <p className="text-sm text-primary-foreground/70">
                  106 E 6th St, Suite 900
                </p>
                <p className="text-sm text-primary-foreground/70">
                  Austin, TX 78701
                </p>
              </div>
              <ul className="space-y-3">
                {links.map((link) => (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="text-sm text-primary-foreground/90 hover:text-primary-foreground transition-colors"
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Social Links */}
        <div className="space-y-3 hidden mt-8">
          <p className="text-sm text-center">Follow us on</p>
          <div className="flex gap-4 justify-center">
            {socialLinks.map((social) => (
              <a
                key={social.name}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-foreground hover:text-primary-foreground/80 transition-colors"
              >
                <social.icon className="h-5 w-5" />
                <span className="sr-only">{social.name}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-8 pt-6 border-t border-primary-foreground/20">
          <div className="max-w-5xl mx-auto">
            <div className="flex flex-col items-center gap-4 text-center">
              <p className="text-xs text-primary-foreground/80 font-medium">
                HIPAA Compliant Healthcare Platform • All Patient Data Encrypted
                & Secure • Meeting Federal Privacy Standards
              </p>
              <p className="text-xs text-primary-foreground/70 max-w-4xl italic bg-primary-foreground/10 px-4 py-2 rounded-md">
                SmartConnect RX is a technology marketplace platform that connects
                patients, providers, and pharmacies. SmartConnect RX is not a licensed
                healthcare provider and does not diagnose, treat, or provide
                medical advice.
              </p>
              <p className="text-sm text-primary-foreground/90">
                &copy; 2026 SmartConnect RX – The smartest way to connect
                pharmacies, providers &amp; patients
              </p>
              <div className="flex flex-wrap gap-4 sm:gap-6 justify-center">
                {legalLinks.map((link) => (
                  <Link
                    key={link.name}
                    href={link.href}
                    className="text-sm text-primary-foreground/90 hover:text-primary-foreground hover:underline transition-colors"
                  >
                    {link.name}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
