import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const formatModelName = (value: string) =>
  value
    .replace(/_best\.h5$/i, "")
    .replace(/\.h5$/i, "")
    .replace(/_/g, " ")
    .trim();
