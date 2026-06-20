// apps/server/src/libs/date-mapper.ts

/** Convert a Prisma Date to an ISO string. */
export function toISO(date: Date | string): string;
/** Convert a Prisma Date to an ISO string (or null). */
export function toISO(date: Date | string | null | undefined): string | null;
export function toISO(date: Date | string | null | undefined): string | null {
  if (date === null || date === undefined) return null;
  if (typeof date === "string") return date;
  return date.toISOString();
}

/** Convert a Prisma Date to an ISO string, falling back to now. */
export function toISONow(date: Date | string | null | undefined): string {
  if (date === null || date === undefined) return new Date().toISOString();
  if (typeof date === "string") return date;
  return date.toISOString();
}
