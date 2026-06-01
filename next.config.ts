import type { NextConfig } from "next";
import pkg from "./package.json";

function resolveAppVersion() {
  if (process.env.NEXT_PUBLIC_APP_VERSION) return process.env.NEXT_PUBLIC_APP_VERSION;
  if (process.env.GITHUB_REF_TYPE === 'tag' && process.env.GITHUB_REF_NAME?.startsWith('v')) {
    return process.env.GITHUB_REF_NAME;
  }
  if (process.env.GITHUB_SHA) return `dev-${process.env.GITHUB_SHA.slice(0, 8)}`;
  return `dev-v${pkg.version}`;
}

const appVersion = resolveAppVersion();

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: './',
  allowedDevOrigins: ['192.168.123.154', 'localhost'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
};

export default nextConfig;
