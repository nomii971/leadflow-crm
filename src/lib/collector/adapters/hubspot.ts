import "server-only";
import { findCountry } from "@/lib/locations";
import {
  RetryableSourceError,
  SourceConfigError,
  SourceRestrictionError,
  type CollectorConfig,
  type SourceAdapter,
} from "../types";

// HubSpot CRM (free tier) via a Private App access token with the crm.objects.contacts.read scope.
// Authorized path for Sales Navigator data: Sales Navigator "CRM Sync" -> HubSpot -> this adapter.
// Docs: https://developers.hubspot.com/docs/api/crm/search
const API = "https://api.hubapi.com";
const SEARCH_RESULT_CAP = 10_000; // HubSpot search API returns at most 10k results per query
const PROPERTIES = [
  "firstname", "lastname", "email", "phone", "mobilephone", "jobtitle", "company", "industry", "city", "state",
  "country", "website", "hs_linkedin_url", "linkedin_url", "seniority", "hs_seniority", "department",
  "numemployees", "lifecyclestage", "createdate",
];

const token = () => process.env.HUBSPOT_ACCESS_TOKEN?.trim() || null;

type Filter = { propertyName: string; operator: string; value?: string; values?: string[] };

/** Builds HubSpot filterGroups. Groups are OR-ed (max 5), filters inside a group are AND-ed (max 6). */
export function buildHubspotFilterGroups(config: CollectorConfig): { filterGroups: { filters: Filter[] }[]; query?: string } {
  const f = config.filters ?? {};
  const common: Filter[] = [];
  if (f.jobTitles?.length === 1) common.push({ propertyName: "jobtitle", operator: "CONTAINS_TOKEN", value: `*${f.jobTitles[0]}*` });
  if (f.companyNames?.length === 1) common.push({ propertyName: "company", operator: "CONTAINS_TOKEN", value: `*${f.companyNames[0]}*` });

  // Group locations by country: one group per country with city IN [...]
  const byCountry = new Map<string, { variants: string[]; cities: string[]; whole: boolean }>();
  for (const loc of config.locations ?? []) {
    const c = findCountry(loc.country);
    const key = c?.code ?? loc.country.toLowerCase();
    const entry = byCountry.get(key) ?? {
      variants: Array.from(new Set([loc.country, ...(c ? [c.name, c.code, ...(c.aliases ?? [])] : [])])),
      cities: [],
      whole: false,
    };
    if (loc.city) entry.cities.push(loc.city);
    else entry.whole = true;
    byCountry.set(key, entry);
  }

  let groups: { filters: Filter[] }[] = [];
  if (byCountry.size > 0 && byCountry.size <= 5) {
    groups = Array.from(byCountry.values()).map((e) => ({
      filters: [
        // ASSUMPTION: HubSpot IN matching on free-text country values; both cases are sent to be safe.
        { propertyName: "country", operator: "IN", values: Array.from(new Set(e.variants.flatMap((v) => [v, v.toLowerCase()]))) },
        ...(!e.whole && e.cities.length
          ? [{ propertyName: "city", operator: "IN", values: Array.from(new Set(e.cities.flatMap((v) => [v, v.toLowerCase()]))) }]
          : []),
        ...common,
      ].slice(0, 6),
    }));
  } else if (common.length) {
    groups = [{ filters: common }];
  }
  // Anything not expressible server-side is still enforced by the engine's local filter.
  return { filterGroups: groups, query: f.keywords?.trim() || undefined };
}

function toLead(p: Record<string, string | null>) {
  return {
    first_name: p.firstname,
    last_name: p.lastname,
    business_email: p.email,
    business_phone: p.phone || p.mobilephone,
    job_title: p.jobtitle,
    company_name: p.company,
    industry: p.industry,
    city: p.city,
    state: p.state,
    country: p.country,
    company_website: p.website,
    linkedin_url: p.hs_linkedin_url || p.linkedin_url,
    seniority: p.seniority || p.hs_seniority,
    department: p.department,
    company_size: p.numemployees,
    lead_source: "HubSpot CRM",
  };
}

async function hubspotFetch(path: string, init: RequestInit) {
  const t = token();
  if (!t) throw new SourceConfigError("HUBSPOT_ACCESS_TOKEN is not set on the server.");
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json", ...(init.headers ?? {}) },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e) {
    throw new RetryableSourceError(`Network error contacting HubSpot: ${(e as Error).message}`);
  }
  if (res.status === 429) {
    const ra = Number(res.headers.get("retry-after"));
    throw new RetryableSourceError("HubSpot rate limit hit", Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2000);
  }
  if (res.status >= 500) throw new RetryableSourceError(`HubSpot server error ${res.status}`);
  if (res.status === 401 || res.status === 403) {
    throw new SourceConfigError("HubSpot rejected the token. Check the private app token and its contacts read scope.");
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new SourceConfigError(`HubSpot error ${res.status}: ${body?.message ?? "unknown"}`);
  return body;
}

export const hubspotAdapter: SourceAdapter = {
  id: "hubspot",
  name: "HubSpot CRM (free)",
  description:
    "Collect contacts from your own HubSpot CRM, including Sales Navigator leads synced through LinkedIn's official CRM Sync.",
  kind: "api",
  capabilities: {
    pagination: true,
    totalCount: true,
    pauseResume: true,
    locationFilters: true,
    professionalFilters: true,
    maxPageSize: 200,
    maxResultsPerSearch: SEARCH_RESULT_CAP,
  },
  async status() {
    if (!token()) {
      return { state: "not_configured", label: "Not configured", detail: "Set HUBSPOT_ACCESS_TOKEN in your server environment (Vercel project settings)." };
    }
    try {
      await hubspotFetch("/crm/v3/objects/contacts?limit=1", { method: "GET" });
      return { state: "connected", label: "Connected", detail: "Token accepted by HubSpot." };
    } catch (e) {
      return { state: "error", label: "Connection error", detail: (e as Error).message };
    }
  },
  async fetchPage({ config, cursor, pageSize }) {
    const after = Number((cursor as { after?: string } | null)?.after ?? 0);
    if (after >= SEARCH_RESULT_CAP) {
      throw new SourceRestrictionError(
        `HubSpot search returns at most ${SEARCH_RESULT_CAP.toLocaleString()} results per query. Narrow the locations or filters and run another job for the rest.`,
      );
    }
    const { filterGroups, query } = buildHubspotFilterGroups(config);
    const limit = Math.min(pageSize, 200, SEARCH_RESULT_CAP - after);
    const body = await hubspotFetch("/crm/v3/objects/contacts/search", {
      method: "POST",
      body: JSON.stringify({
        filterGroups,
        ...(query ? { query } : {}),
        properties: PROPERTIES,
        sorts: [{ propertyName: "createdate", direction: "ASCENDING" }],
        limit,
        ...(after ? { after: String(after) } : {}),
      }),
    });
    const results: { id: string; properties: Record<string, string | null> }[] = body.results ?? [];
    const next: string | undefined = body.paging?.next?.after;
    return {
      records: results.map((r) => ({ sourceId: `hubspot:contact:${r.id}`, data: toLead(r.properties), raw: { id: r.id, ...r.properties } })),
      nextCursor: next ? { after: next } : null,
      totalReported: typeof body.total === "number" ? body.total : null,
      serverSideFiltered: true,
    };
  },
};
