import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function getThumbnailImagePath(imagePath) {
  return imagePath?.endsWith('-full.webp')
    ? imagePath.replace(/-full\.webp$/, '-thumb.webp')
    : imagePath;
}
