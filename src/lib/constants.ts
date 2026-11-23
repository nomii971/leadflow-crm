export const LEAD_STATUSES = [
  { value: "new", label: "New", color: "slate" },
  { value: "qualified", label: "Qualified", color: "violet" },
  { value: "contacted", label: "Contacted", color: "blue" },
  { value: "interested", label: "Interested", color: "cyan" },
  { value: "meeting_scheduled", label: "Meeting Scheduled", color: "amber" },
  { value: "proposal_sent", label: "Proposal Sent", color: "orange" },
  { value: "won", label: "Won", color: "emerald" },
  { value: "lost", label: "Lost", color: "rose" },
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number]["value"];
export const STATUS_VALUES = LEAD_STATUSES.map((s) => s.value) as [LeadStatus, ...LeadStatus[]];
export const statusLabel = (v: string | null | undefined) =>
  LEAD_STATUSES.find((s) => s.value === v)?.label ?? v ?? "—";

export const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
] as const;
export type Priority = (typeof PRIORITIES)[number]["value"];
export const PRIORITY_VALUES = PRIORITIES.map((p) => p.value) as [Priority, ...Priority[]];

export const ORIGINS = [
  { value: "manual", label: "Manual" },
  { value: "csv_import", label: "CSV / XLSX import" },
  { value: "collector", label: "Bulk Lead Collector" },
  { value: "api", label: "API" },
] as const;

export const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"];

export const SENIORITY_LEVELS = [
  "Owner / Founder", "CXO", "Partner", "Vice President", "Director", "Manager",
  "Senior", "Entry", "Training", "Unpaid",
];

export const DEPARTMENTS = [
  "Accounting", "Administrative", "Business Development", "Consulting", "Customer Success", "Education",
  "Engineering", "Finance", "Healthcare", "Human Resources", "Information Technology", "Legal", "Marketing",
  "Media & Communication", "Operations", "Product Management", "Purchasing", "Real Estate", "Research", "Sales",
];

export const INDUSTRIES = [
  "Accounting", "Advertising Services", "Architecture & Planning", "Automotive", "Banking", "Biotechnology",
  "Business Consulting", "Civil Engineering", "Construction", "E-Learning", "Education", "Financial Services",
  "Food & Beverage", "Government", "Healthcare", "Hospitality", "Human Resources", "Information Technology",
  "Insurance", "Investment Management", "Legal Services", "Logistics & Supply Chain", "Manufacturing", "Marketing",
  "Media & Entertainment", "Non-profit", "Oil & Energy", "Pharmaceuticals", "Real Estate", "Recruiting & Staffing",
  "Retail", "Software Development", "Telecommunications", "Travel & Tourism", "Venture Capital & Private Equity",
  "Wholesale",
];

export const IMPORT_STRATEGIES = [
  { value: "skip_duplicates", label: "Skip duplicates", help: "Import new records; strong duplicates are skipped and listed in the report." },
  { value: "new_only", label: "Import new records only", help: "Same as skip, but possible (name + company) matches are skipped too." },
  { value: "update_existing", label: "Update existing records", help: "Strong matches (LinkedIn URL or email) are updated with non-empty incoming values. Uncertain matches go to review." },
  { value: "review_duplicates", label: "Review duplicates manually", help: "Every duplicate is queued for your decision. Nothing is merged automatically." },
] as const;
export type ImportStrategy = (typeof IMPORT_STRATEGIES)[number]["value"];

export const COLLECTOR_DUPLICATE_STRATEGIES = [
  { value: "skip_duplicates", label: "Skip duplicates" },
  { value: "update_existing", label: "Update existing (strong matches only)" },
  { value: "keep_both", label: "Keep both records" },
  { value: "review_duplicates", label: "Queue duplicates for review" },
] as const;
export type CollectorDuplicateStrategy = (typeof COLLECTOR_DUPLICATE_STRATEGIES)[number]["value"];

export const ACTIVITY_TYPES = [
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "linkedin_message", label: "LinkedIn message" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
  { value: "status_change", label: "Status change" },
  { value: "other", label: "Other" },
] as const;

export const COLLECTION_STATUS_META: Record<string, { label: string; tone: string; help: string }> = {
  queued: { label: "Queued", tone: "slate", help: "Created, not started yet." },
  running: { label: "Running", tone: "blue", help: "Fetching pages from the source." },
  paused: { label: "Paused", tone: "amber", help: "Paused by you. Resume continues from the saved page cursor." },
  complete: { label: "Complete", tone: "emerald", help: "The source reported there are no more results." },
  partial: { label: "Partially complete", tone: "orange", help: "The source imposed a restriction before all results were retrieved." },
  limit_reached: { label: "Limit reached", tone: "violet", help: "Your configured maximum record limit was reached." },
  interrupted: { label: "Interrupted", tone: "rose", help: "Cancelled or stopped before the source finished." },
  failed: { label: "Failed", tone: "red", help: "An error prevented further processing." },
};

export const IMPORT_STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pending", tone: "slate" },
  processing: { label: "Processing", tone: "blue" },
  completed: { label: "Completed", tone: "emerald" },
  completed_with_errors: { label: "Completed with errors", tone: "amber" },
  failed: { label: "Failed", tone: "red" },
  cancelled: { label: "Cancelled", tone: "rose" },
};

export const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024; // 50 MB, parsed in the browser in chunks
export const IMPORT_BATCH_SIZE = 500;
