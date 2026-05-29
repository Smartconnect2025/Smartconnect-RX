import type { NextConfig } from "next";

const isReplit = !!process.env.REPL_ID;

const nextConfig: NextConfig = {
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  ...(isReplit
    ? {
        webpack: (config, { isServer }) => {
          if (!isServer) {
            config.devtool = "cheap-module-source-map";
          }
          config.watchOptions = {
            poll: false,
            followSymlinks: false,
            aggregateTimeout: 3000,
            ignored: /(?:node_modules|\.next|\.git|\.local|attached_assets|\.replit|tmp)/,
          };
          return config;
        },
      }
    : {}),
  allowedDevOrigins: [
    "*.up.railway.app",
    "*.app-dev.specode.ai",
    "*.app.specode.ai",
    ...(isReplit
      ? [
          "*.replit.dev",
          "*.repl.co",
          "*.replit.app",
          "*.riker.replit.dev",
        ]
      : []),
  ],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type-checking is enforced locally by the .husky/pre-push gate
    // (runs `npm run build`). Skipping it during the Render production
    // build avoids OOM kills on the Render instance during the
    // "Checking validity of types ..." phase. Established May 2026
    // after Step 9 (Task #54) deploys repeatedly silent-killed at the
    // tsc phase with no error output.
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54323",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54323",
      },
    ],
  },
  async headers() {
    const frameAncestors = [
      "https://*.specode.ai",
      "http://localhost:*",
      ...(isReplit
        ? [
            "https://*.replit.dev",
            "https://*.repl.co",
            "https://*.replit.app",
            "https://*.riker.replit.dev",
          ]
        : []),
    ].join(" ");

    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Methods",
            value: "GET,DELETE,PATCH,POST,PUT,OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value:
              "X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization",
          },
          {
            key: "Content-Security-Policy",
            // CSP notes:
            //  - frame-src / child-src keep the Authnet origins because the
            //    /payment/<token> page used to iframe the hosted form. The
            //    inline-iframe modal was removed Apr 25 2026 (post triple-
            //    charge incident), so those directives are no longer strictly
            //    required, but we leave them as harmless defense-in-depth.
            //  - form-action MUST keep the Authnet origins: the /payment/
            //    <token> page redirects by submitting a hidden HTML form to
            //    accept.authorize.net (or test.authorize.net in sandbox).
            //  - frame-ancestors no longer needs Authnet — Authnet never
            //    embeds OUR pages, and now that we don't host the iframe
            //    ourselves there is no remaining reason to allow it. Removed.
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: http:; font-src 'self' data: https:; connect-src 'self' https: http: wss: ws:; frame-src 'self' https://accept.authorize.net https://test.authorize.net; child-src 'self' https://accept.authorize.net https://test.authorize.net; form-action 'self' https://accept.authorize.net https://test.authorize.net; frame-ancestors 'self' ${frameAncestors}`,
          },
        ],
      },
    ];
  },
  reactStrictMode: true,
};

export default nextConfig;
