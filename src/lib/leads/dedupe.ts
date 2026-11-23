import type { LeadInput } from "./validate";
import { nameCompanyKey, normEmail, normUrl } from "./normalize";

export type MatchType = "linkedin_url" | "email" | "name_company";

export interface ExistingLeadKey {
  id: string;
  linkedin_url_norm: string | null;
  email_norm: string | null;
  name_company_key: string | null;
}

export interface DedupeKeys {
  linkedin: string | null;
  email: string | null;
  nameCompany: string | null;
}

export function keysFor(lead: Pick<LeadInput, "linkedin_url" | "business_email" | "full_name" | "company_name">): DedupeKeys {
  return {
    linkedin: normUrl(lead.linkedin_url),
    email: normEmail(lead.business_email),
    nameCompany: nameCompanyKey(lead.full_name, lead.company_name),
  };
}

/** Strong matches (URL / email) are certain; name+company is a "possible" match that must never auto-merge. */
export const isStrongMatch = (t: MatchType) => t === "linkedin_url" || t === "email";

export function findMatch(keys: DedupeKeys, existing: ExistingLeadKey[]): { lead: ExistingLeadKey; type: MatchType } | null {
  if (keys.linkedin) {
    const m = existing.find((e) => e.linkedin_url_norm === keys.linkedin);
    if (m) return { lead: m, type: "linkedin_url" };
  }
  if (keys.email) {
    const m = existing.find((e) => e.email_norm === keys.email);
    if (m) return { lead: m, type: "email" };
  }
  if (keys.nameCompany) {
    const m = existing.find((e) => e.name_company_key === keys.nameCompany);
    if (m) {
      // Different LinkedIn URLs on both sides means two different people with the same name.
      if (keys.linkedin && m.linkedin_url_norm && keys.linkedin !== m.linkedin_url_norm) return null;
      return { lead: m, type: "name_company" };
    }
  }
  return null;
}

export type DuplicateDecision =
  | { action: "insert" }
  | { action: "update"; leadId: string; matchType: MatchType }
  | { action: "skip"; leadId: string; matchType: MatchType }
  | { action: "review"; leadId: string; matchType: MatchType };

export type DuplicateStrategy = "new_only" | "skip_duplicates" | "update_existing" | "review_duplicates" | "keep_both";

/**
 * Decide what to do with an incoming record given a (possible) match.
 * Invariant: uncertain (name+company) matches are never merged automatically.
 */
export function decide(
  match: { lead: ExistingLeadKey; type: MatchType } | null,
  strategy: DuplicateStrategy,
): DuplicateDecision {
  if (!match) return { action: "insert" };
  const base = { leadId: match.lead.id, matchType: match.type };
  switch (strategy) {
    case "keep_both":
      return { action: "insert" };
    case "new_only":
      return { action: "skip", ...base };
    case "skip_duplicates":
      return isStrongMatch(match.type) ? { action: "skip", ...base } : { action: "review", ...base };
    case "update_existing":
      return isStrongMatch(match.type) ? { action: "update", ...base } : { action: "review", ...base };
    case "review_duplicates":
      return { action: "review", ...base };
  }
}

/** Only non-empty incoming values overwrite; status/priority/notes are never overwritten by imports. */
export function buildUpdatePatch(lead: LeadInput): Partial<LeadInput> {
  const patch: Record<string, unknown> = {};
  const protectedKeys = new Set(["status", "priority", "notes", "email_verified", "phone_verified", "is_verified"]);
  for (const [k, v] of Object.entries(lead)) {
    if (protectedKeys.has(k)) continue;
    if (v === null || v === undefined || v === "") continue;
    patch[k] = v;
  }
  if (lead.email_verified) patch.email_verified = true;
  if (lead.phone_verified) patch.phone_verified = true;
  return patch as Partial<LeadInput>;
}
