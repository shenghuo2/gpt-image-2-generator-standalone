import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: './',
  allowedDevOrigins: ['192.168.123.154', 'localhost'],
};

export default nextConfig;
