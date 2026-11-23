import { z } from "zod";

const list = z.array(z.string().trim().min(1).max(200)).max(50).optional();

export const locationSchema = z.object({
  country: z.string().trim().min(1).max(120),
  countryCode: z.string().max(3).optional(),
  state: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  region: z.string().trim().max(200).optional(),
});

export const filtersSchema = z.object({
  jobTitles: list, industries: list, companyNames: list, companySizes: list, seniorities: list, departments: list,
  keywords: z.string().trim().max(300).optional(),
});

export const createJobSchema = z.object({
  name: z.string().trim().min(1).max(200),
  source_adapter: z.string().max(60),
  locations: z.array(locationSchema).max(200),
  filters: filtersSchema,
  max_records: z.number().int().min(1).max(100000),
  page_size: z.number().int().min(1).max(500),
  duplicate_strategy: z.enum(["skip_duplicates", "update_existing", "keep_both", "review_duplicates"]),
  file: z.object({ name: z.string().max(255), size: z.number().int().min(0), rows: z.number().int().min(0), mapping: z.record(z.string(), z.string()) }).optional(),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;
