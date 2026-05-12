/**
 * Re-export from presentation layer.
 * Next.js requires src/app/ for file-system routing.
 * Actual implementation lives in src/presentation/app/.
 */
export { default } from "@/presentation/app/layout";
export { metadata, viewport } from "@/presentation/app/layout";
