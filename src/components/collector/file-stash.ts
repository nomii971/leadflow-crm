"use client";
// Keeps the selected File in memory across client-side navigation (new job -> job page).
// Files cannot be persisted by the browser, so after a reload the user re-selects the same file.
const stash = new Map<string, File>();
export const stashFile = (jobId: string, f: File) => stash.set(jobId, f);
export const takeFile = (jobId: string) => stash.get(jobId) ?? null;
