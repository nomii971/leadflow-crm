export interface Lead {
  id: string;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company_name: string | null;
  company_id: string | null;
  industry: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  region: string | null;
  linkedin_url: string | null;
  company_website: string | null;
  business_email: string | null;
  business_phone: string | null;
  company_size: string | null;
  seniority: string | null;
  department: string | null;
  lead_source: string | null;
  source_reference: string | null;
  origin: string;
  status: string;
  priority: string;
  notes: string | null;
  last_contacted_at: string | null;
  collected_at: string | null;
  email_verified: boolean;
  phone_verified: boolean;
  is_verified: boolean;
  verified_at: string | null;
  import_job_id: string | null;
  collection_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportJob {
  id: string;
  file_name: string;
  file_size: number | null;
  lead_source: string | null;
  strategy: string;
  status: string;
  total_rows: number;
  processed_rows: number;
  inserted_count: number;
  updated_count: number;
  duplicate_count: number;
  skipped_count: number;
  review_count: number;
  failed_count: number;
  error_message: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface CollectionJob {
  id: string;
  name: string;
  source_adapter: string;
  config: { locations?: import("@/lib/collector/types").LocationSelection[]; filters?: import("@/lib/collector/types").ProfessionalFilters; file?: { name: string; size: number; rows: number; mapping?: Record<string, string> } };
  max_records: number;
  page_size: number;
  duplicate_strategy: string;
  status: string;
  status_reason: string | null;
  total_reported: number | null;
  retrieved_count: number;
  saved_count: number;
  updated_count: number;
  duplicate_count: number;
  review_count: number;
  filtered_count: number;
  failed_count: number;
  pages_fetched: number;
  cursor: unknown;
  step_seq: number;
  retry_count: number;
  last_error: string | null;
  last_heartbeat_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

export interface Task {
  id: string;
  lead_id: string | null;
  title: string;
  description: string | null;
  type: string;
  due_at: string | null;
  priority: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  leads?: { full_name: string; company_name: string | null } | null;
}

export interface Activity {
  id: string;
  lead_id: string | null;
  type: string;
  subject: string | null;
  body: string | null;
  outcome: string | null;
  occurred_at: string;
  created_at: string;
  leads?: { full_name: string; company_name: string | null } | null;
}
