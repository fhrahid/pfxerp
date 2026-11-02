import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const taka = (n: number | undefined | null) =>
  "৳" + Number(n || 0).toLocaleString("en-US", { maximumFractionDigits: 0 });

export const dt = (d: string | Date | undefined | null) =>
  d ? new Date(d).toLocaleString() : "—";

export const uuid = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now();
