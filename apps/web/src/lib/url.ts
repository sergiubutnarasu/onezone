// apps/web/src/lib/url.ts
// URL / routing utilities.

/**
 * Sanitise a return-to path so we never redirect to an external domain.
 * Only relative paths starting with a single '/' are accepted.
 */
export function safeReturnTo(value: string | null): string {
  // Only accept relative paths — prevents open redirect to external domains.
  // A single leading '/' (not '//') is always same-origin with router.push().
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}
