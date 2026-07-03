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

function resolveShortSha() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 8);
  return runGitCommand('git rev-parse --short=8 HEAD');
}

function resolveAppVersion() {
  if (process.env.NEXT_PUBLIC_APP_VERSION) return process.env.NEXT_PUBLIC_APP_VERSION;
  const tag = process.env.GITHUB_REF_NAME?.startsWith('v') ? process.env.GITHUB_REF_NAME : resolveLatestTag();
  const shortSha = resolveShortSha();
  if (tag && shortSha) return `${tag}-${shortSha}`;
  if (shortSha) return `dev-${shortSha}`;
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
