import "server-only";
import { fileAdapter } from "./adapters/file";
import { hubspotAdapter } from "./adapters/hubspot";
import { linkedinSalesNavigatorAdapter } from "./adapters/linkedin";
import type { SourceAdapter } from "./types";

// To add a new authorized source: implement SourceAdapter in ./adapters and register it here.
export const ADAPTERS: SourceAdapter[] = [fileAdapter, hubspotAdapter, linkedinSalesNavigatorAdapter];

export const getAdapter = (id: string) => ADAPTERS.find((a) => a.id === id);

export async function adapterCatalog() {
  return Promise.all(
    ADAPTERS.map(async (a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      kind: a.kind,
      capabilities: a.capabilities,
      status: await a.status(),
    })),
  );
}
export type AdapterInfo = Awaited<ReturnType<typeof adapterCatalog>>[number];
