import type { LeadFieldKey } from "@/lib/leads/fields";

/** One location in a job. Omit city/state to select the entire country. */
export interface LocationSelection {
  country: string;       // display name, e.g. "United Kingdom"
  countryCode?: string;  // ISO 3166-1 alpha-2 when known
  state?: string;
  city?: string;
  region?: string;
}

export interface ProfessionalFilters {
  jobTitles?: string[];
  industries?: string[];
  companyNames?: string[];
  companySizes?: string[];
  seniorities?: string[];
  departments?: string[];
  keywords?: string;
}

export interface CollectorConfig {
  locations: LocationSelection[];
  filters: ProfessionalFilters;
  file?: { name: string; size: number; rows: number; mapping?: Record<string, string> };
}

export interface SourceRecord {
  sourceId?: string;
  data: Partial<Record<LeadFieldKey, unknown>>;
  raw: Record<string, unknown>;
}

export interface FetchPageInput {
  config: CollectorConfig;
  cursor: unknown | null;
  pageSize: number;
  /** Page supplied by the browser for file-based sources. */
  payload?: unknown;
}

export interface FetchPageResult {
  records: SourceRecord[];
  /** null = the source says there are no more results (a reliable completion signal). */
  nextCursor: unknown | null;
  totalReported?: number | null;
  /** True when the source already applied the filters, so local filtering is only a safety net. */
  serverSideFiltered: boolean;
}

export interface AdapterCapabilities {
  pagination: boolean;
  totalCount: boolean;
  pauseResume: boolean;
  locationFilters: boolean;
  professionalFilters: boolean;
  maxPageSize: number;
  /** Hard cap the source imposes on one search, if any. */
  maxResultsPerSearch?: number;
}

export interface AdapterStatus {
  state: "connected" | "available" | "not_configured" | "unavailable" | "error";
  label: string;
  detail: string;
}

export interface SourceAdapter {
  id: string;
  name: string;
  description: string;
  kind: "api" | "file" | "unavailable";
  capabilities: AdapterCapabilities;
  status(): Promise<AdapterStatus>;
  fetchPage(input: FetchPageInput): Promise<FetchPageResult>;
}

/** Temporary error: the engine retries with backoff. */
export class RetryableSourceError extends Error {
  constructor(message: string, public retryAfterMs?: number) {
    super(message);
  }
}

/** The source refuses to go further (rate limit window, result cap, permission). Job ends as "partial". */
export class SourceRestrictionError extends Error {}

/** Configuration / auth problem: job fails, retrying will not help. */
export class SourceConfigError extends Error {}
