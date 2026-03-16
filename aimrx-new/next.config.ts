import type { NextConfig } from "next";

const isReplit = !!process.env.REPL_ID;

const nextConfig: NextConfig = {
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
          "*.spock.replit.dev",
        ]
      : []),
  ],
  eslint: {
    ignoreDuringBuilds: true,
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
            "https://*.spock.replit.dev",
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
            value: `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; style-src 'self' 'unsafe-inline' https:; img-src 'self' data: https: http:; font-src 'self' data: https:; connect-src 'self' https: http: wss: ws:; frame-ancestors 'self' ${frameAncestors}`,
          },
        ],
      },
    ];
  },
  reactStrictMode: true,
};

export default nextConfig;
