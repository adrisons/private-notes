import { clsx, type ClassValue } from "clsx";

/** Tiny utility to merge conditional class names. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
