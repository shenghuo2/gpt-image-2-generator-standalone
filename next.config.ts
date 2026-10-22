import type { NextConfig } from "next";
import { execSync } from "node:child_process";
import pkg from "./package.json";

function runGitCommand(command: string) {
  try {
    return execSync(command, { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
}

function resolveLatestTag() {
  return runGitCommand("git tag --list 'v*' --sort=-v:refname | head -n 1");
}

const commitSha = process.env.NEXT_PUBLIC_APP_COMMIT_SHA || process.env.GITHUB_SHA || runGitCommand('git rev-parse HEAD');

function resolveAppVersion() {
  if (process.env.NEXT_PUBLIC_APP_VERSION) return process.env.NEXT_PUBLIC_APP_VERSION;
  const tag = process.env.GITHUB_REF_NAME?.startsWith('v') ? process.env.GITHUB_REF_NAME : resolveLatestTag();
  const shortSha = commitSha.slice(0, 8);
  if (tag && shortSha) return `${tag}-${shortSha}`;
  if (shortSha) return `dev-${shortSha}`;
  return `dev-v${pkg.version}`;
}

const appVersion = resolveAppVersion();
const buildTime = process.env.NEXT_PUBLIC_APP_BUILD_TIME || new Date().toISOString();
const isDev = process.env.NODE_ENV === 'development';

const nextConfig: NextConfig = {
  output: 'export',
  assetPrefix: isDev ? undefined : './',
  allowedDevOrigins: ['192.168.123.154', 'localhost', '127.0.0.1', '0.0.0.0', 'null'],
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
    NEXT_PUBLIC_APP_COMMIT_SHA: commitSha,
    NEXT_PUBLIC_APP_BUILD_TIME: buildTime,
  },
};

export default nextConfig;
