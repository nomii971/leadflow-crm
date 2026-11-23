import { SourceRestrictionError, type SourceAdapter } from "../types";

/**
 * LinkedIn Sales Navigator.
 * There is no public API that lets a personal app pull Sales Navigator search results. Programmatic access
 * exists only through LinkedIn's partner programs (e.g. Sales Navigator Application Platform / CRM Sync),
 * which require LinkedIn approval. This adapter is a placeholder for such an approved integration and never
 * scrapes pages, reads cookies, or calls private endpoints.
 */
export const linkedinSalesNavigatorAdapter: SourceAdapter = {
  id: "linkedin_sales_navigator",
  name: "LinkedIn Sales Navigator (official API)",
  description:
    "Reserved for an officially approved LinkedIn partner integration. Not available for personal apps today.",
  kind: "unavailable",
  capabilities: {
    pagination: false,
    totalCount: false,
    pauseResume: false,
    locationFilters: false,
    professionalFilters: false,
    maxPageSize: 0,
  },
  async status() {
    return {
      state: "unavailable",
      label: "Not connected",
      detail:
        "LinkedIn does not offer a public Sales Navigator search API. Use CRM Sync to a supported CRM (e.g. HubSpot) and the HubSpot adapter, or import an authorized CSV.",
    };
  },
  async fetchPage() {
    throw new SourceRestrictionError("LinkedIn Sales Navigator has no authorized API connection in this CRM.");
  },
};
