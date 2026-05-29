import type { NextConfig } from "next";
import pkg from "./package.json";

const appVersion = process.env.NEXT_PUBLIC_APP_VERSION || `v${pkg.version}`;

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: './',
  allowedDevOrigins: ['192.168.123.154', 'localhost'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
