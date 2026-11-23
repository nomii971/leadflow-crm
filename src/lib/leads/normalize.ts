// Mirrors the SQL functions in supabase/migrations/0001_init.sql exactly.
// tests/normalize.test.ts and tests/db/02_parity.sql keep them in sync.

export function normText(t: string | null | undefined): string | null {
  const v = (t ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  return v === "" ? null : v;
}

export function normEmail(t: string | null | undefined): string | null {
  const v = (t ?? "").trim().toLowerCase();
  return v === "" ? null : v;
}

export function normUrl(t: string | null | undefined): string | null {
  let v = (t ?? "").trim().toLowerCase();
  v = v.replace(/^[a-z]+:\/\//, "");
  v = v.replace(/^(www\.|[a-z]{2}\.)(linkedin\.com)/, "$2");
  v = v.replace(/[?#].*$/, "");
  v = v.replace(/\/+$/, "");
  return v === "" ? null : v;
}

export function normCompany(t: string | null | undefined): string | null {
  let v = (t ?? "").toLowerCase();
  v = v.replace(/[^\p{L}\p{N}]+/gu, " ");
  v = v.replace(/(^| )(ltd|limited|inc|llc|llp|plc|corp|corporation|co|company|gmbh|pvt|private)( |$)/g, " ");
  v = v.replace(/\s+/g, " ").trim();
  return v === "" ? null : v;
}

export function nameCompanyKey(fullName: string | null | undefined, company: string | null | undefined) {
  const n = normText(fullName);
  const c = normCompany(company);
  return n && c ? `${n}|${c}` : null;
}

export function splitName(full: string): { first: string | null; last: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: null, last: null };
  if (parts.length === 1) return { first: parts[0], last: null };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Adds https:// to bare domains so stored URLs are clickable. */
export function toHttpUrl(t: string | null | undefined): string | null {
  const v = (t ?? "").trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return `https://${v}`;
  return v;
}
