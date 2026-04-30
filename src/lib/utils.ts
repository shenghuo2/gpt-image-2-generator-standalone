import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function gcd(a: number, b: number): number {
  while (b) { [a, b] = [b, a % b] }
  return a
}

export const QUALITY_CN: Record<string, string> = {
  auto: '自动', low: '低', medium: '中', high: '高', standard: '标准', hd: '高清',
}
