-- LeadFlow CRM: initial schema
-- Single-user personal CRM. Every row is owned by auth.uid() and protected by RLS.
-- Run in the Supabase SQL editor (or `supabase db push`).

create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Normalisation helpers (mirrored exactly in src/lib/leads/normalize.ts)
-- ---------------------------------------------------------------------------

create or replace function public.lf_norm_text(t text)
returns text language sql immutable parallel safe as $$
  select nullif(btrim(regexp_replace(lower(coalesce(t, '')), '\s+', ' ', 'g')), '')
$$;

create or replace function public.lf_norm_email(t text)
returns text language sql immutable parallel safe as $$
  select nullif(lower(btrim(coalesce(t, ''))), '')
$$;

-- linkedin.com/in/jane-doe-123  (protocol, www/country subdomain, query, fragment, trailing slash removed)
create or replace function public.lf_norm_url(t text)
returns text language sql immutable parallel safe as $$
  select nullif(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(btrim(coalesce(t, ''))), '^[a-z]+://', ''),
        '^(www\.|[a-z]{2}\.)(linkedin\.com)', '\2'),
      '[?#].*$', ''),
    '/+$', ''),
  '')
$$;

create or replace function public.lf_norm_company(t text)
returns text language sql immutable parallel safe as $$
  select nullif(btrim(regexp_replace(
    regexp_replace(
      regexp_replace(lower(coalesce(t, '')), '[^[:alnum:]]+', ' ', 'g'),
    '(^| )(ltd|limited|inc|llc|llp|plc|corp|corporation|co|company|gmbh|pvt|private)( |$)', ' ', 'g'),
  '\s+', ' ', 'g')), '')
$$;

create or replace function public.lf_name_company_key(full_name text, company text)
returns text language sql immutable parallel safe as $$
  select case
    when public.lf_norm_text(full_name) is null or public.lf_norm_company(company) is null then null
    else public.lf_norm_text(full_name) || '|' || public.lf_norm_company(company)
  end
$$;

create or replace function public.lf_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.user_settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  display_name text,
  default_page_size int not null default 50 check (default_page_size between 10 and 200),
  default_import_strategy text not null default 'skip_duplicates'
    check (default_import_strategy in ('new_only','update_existing','skip_duplicates','review_duplicates')),
  default_lead_source text default 'LinkedIn Sales Navigator',
  visible_columns jsonb not null default '[]'::jsonb,
  timezone text default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  name_norm text generated always as (public.lf_norm_company(name)) stored,
  website text,
  industry text,
  company_size text,
  country text,
  city text,
  linkedin_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index companies_user_name_norm_uq on public.companies(user_id, name_norm);
create index companies_user_name_trgm on public.companies using gin (name gin_trgm_ops);

create table public.import_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  file_name text not null,
  file_size bigint,
  lead_source text,
  strategy text not null
    check (strategy in ('new_only','update_existing','skip_duplicates','review_duplicates')),
  column_mapping jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','completed_with_errors','failed','cancelled')),
  total_rows int not null default 0,
  processed_rows int not null default 0,
  inserted_count int not null default 0,
  updated_count int not null default 0,
  duplicate_count int not null default 0,
  skipped_count int not null default 0,
  review_count int not null default 0,
  failed_count int not null default 0,
  next_row int not null default 1,                   -- next expected data row; makes batch retries idempotent
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index import_jobs_user_created on public.import_jobs(user_id, created_at desc);

create table public.collection_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  source_adapter text not null,
  config jsonb not null default '{}'::jsonb,         -- { locations: [...], filters: {...} }
  max_records int not null default 1000 check (max_records between 1 and 100000),
  page_size int not null default 100 check (page_size between 1 and 500),
  duplicate_strategy text not null default 'skip_duplicates'
    check (duplicate_strategy in ('skip_duplicates','update_existing','keep_both','review_duplicates')),
  status text not null default 'queued'
    check (status in ('queued','running','paused','complete','partial','limit_reached','interrupted','failed')),
  status_reason text,
  total_reported int,                                -- null when source does not report totals
  retrieved_count int not null default 0,
  saved_count int not null default 0,
  updated_count int not null default 0,
  duplicate_count int not null default 0,
  review_count int not null default 0,
  filtered_count int not null default 0,
  failed_count int not null default 0,
  pages_fetched int not null default 0,
  cursor jsonb,                                      -- adapter-specific pagination state
  step_seq int not null default 0,                   -- optimistic lock, prevents double-processing
  retry_count int not null default 0,
  last_error text,
  last_heartbeat_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index collection_jobs_user_created on public.collection_jobs(user_id, created_at desc);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  first_name text,
  last_name text,
  job_title text,
  company_name text,
  company_id uuid references public.companies(id) on delete set null,
  industry text,
  country text,
  state text,
  city text,
  region text,
  linkedin_url text,
  company_website text,
  business_email text,
  business_phone text,
  company_size text,
  seniority text,
  department text,
  lead_source text,
  source_reference text,                             -- source URL / record id from the source system
  origin text not null default 'manual' check (origin in ('manual','csv_import','collector','api')),
  status text not null default 'new'
    check (status in ('new','qualified','contacted','interested','meeting_scheduled','proposal_sent','won','lost')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  notes text,
  last_contacted_at timestamptz,
  collected_at timestamptz,                          -- when the source produced / we collected the record
  email_verified boolean not null default false,
  phone_verified boolean not null default false,
  is_verified boolean not null default false,        -- overall record verified by the user
  verified_at timestamptz,
  custom_fields jsonb not null default '{}'::jsonb,
  import_job_id uuid references public.import_jobs(id) on delete set null,
  collection_job_id uuid references public.collection_jobs(id) on delete set null,
  linkedin_url_norm text generated always as (public.lf_norm_url(linkedin_url)) stored,
  email_norm text generated always as (public.lf_norm_email(business_email)) stored,
  name_company_key text generated always as (public.lf_name_company_key(full_name, company_name)) stored,
  search_text text generated always as (
    lower(coalesce(full_name,'') || ' ' || coalesce(job_title,'') || ' ' || coalesce(company_name,'') || ' ' ||
          coalesce(business_email,'') || ' ' || coalesce(city,'') || ' ' || coalesce(country,'') || ' ' ||
          coalesce(industry,''))
  ) stored,
  created_at timestamptz not null default now(),     -- "Date Added"
  updated_at timestamptz not null default now()
);
create index leads_user_created on public.leads(user_id, created_at desc);
create index leads_user_status on public.leads(user_id, status);
create index leads_user_country on public.leads(user_id, country);
create index leads_user_city on public.leads(user_id, city);
create index leads_user_industry on public.leads(user_id, industry);
create index leads_user_job_title on public.leads(user_id, job_title);
create index leads_user_company on public.leads(user_id, company_id);
create index leads_user_origin on public.leads(user_id, origin);
create index leads_user_linkedin_norm on public.leads(user_id, linkedin_url_norm) where linkedin_url_norm is not null;
create index leads_user_email_norm on public.leads(user_id, email_norm) where email_norm is not null;
create index leads_user_name_company on public.leads(user_id, name_company_key) where name_company_key is not null;
create index leads_search_trgm on public.leads using gin (search_text gin_trgm_ops);
create index leads_import_job on public.leads(import_job_id) where import_job_id is not null;
create index leads_collection_job on public.leads(collection_job_id) where collection_job_id is not null;

create table public.import_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  import_job_id uuid not null references public.import_jobs(id) on delete cascade,
  row_number int not null,
  error_type text not null check (error_type in ('validation','database','duplicate_review','skipped_duplicate')),
  message text not null,
  raw_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index import_errors_job on public.import_errors(import_job_id, row_number);

create table public.collection_job_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  job_id uuid not null references public.collection_jobs(id) on delete cascade,
  page_number int not null,
  outcome text not null check (outcome in ('saved','updated','duplicate','review','filtered_out','failed')),
  lead_id uuid references public.leads(id) on delete set null,
  source_record_id text,
  raw_data jsonb not null default '{}'::jsonb,
  error_message text,
  created_at timestamptz not null default now()
);
create index collection_job_results_job on public.collection_job_results(job_id, outcome, created_at);

create table public.duplicate_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_type text not null check (source_type in ('import','collection','manual')),
  import_job_id uuid references public.import_jobs(id) on delete cascade,
  collection_job_id uuid references public.collection_jobs(id) on delete cascade,
  matched_lead_id uuid references public.leads(id) on delete cascade,
  match_type text not null check (match_type in ('linkedin_url','email','name_company')),
  incoming jsonb not null,
  status text not null default 'pending' check (status in ('pending','skipped','updated','kept_both')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create index duplicate_reviews_user_status on public.duplicate_reviews(user_id, status, created_at desc);

create table public.lead_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  description text,
  color text default 'indigo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index lead_lists_user_name_uq on public.lead_lists(user_id, lower(name));

create table public.lead_list_members (
  list_id uuid not null references public.lead_lists(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (list_id, lead_id)
);
create index lead_list_members_lead on public.lead_list_members(lead_id);

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  type text not null check (type in ('call','email','linkedin_message','meeting','note','status_change','other')),
  subject text,
  body text,
  outcome text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index activities_user_occurred on public.activities(user_id, occurred_at desc);
create index activities_lead on public.activities(lead_id, occurred_at desc);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  content text not null check (length(content) <= 20000),
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notes_lead on public.notes(lead_id, created_at desc);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete cascade,
  title text not null,
  description text,
  type text not null default 'follow_up' check (type in ('follow_up','call','email','linkedin_message','meeting','other')),
  due_at timestamptz,
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_user_open_due on public.tasks(user_id, completed, due_at);
create index tasks_lead on public.tasks(lead_id);

create table public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  locations jsonb not null default '[]'::jsonb,
  filters jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['user_settings','companies','import_jobs','collection_jobs','leads',
                           'lead_lists','activities','notes','tasks','saved_searches']
  loop
    execute format('create trigger %I_touch before update on public.%I
                    for each row execute function public.lf_touch_updated_at()', t, t);
  end loop;
end $$;

-- Derive full name and link (or create) the company row for each lead.
create or replace function public.lf_leads_before_write()
returns trigger language plpgsql security invoker set search_path = public as $$
declare v_company_id uuid;
begin
  if coalesce(btrim(new.full_name), '') = '' then
    new.full_name := nullif(btrim(coalesce(new.first_name, '') || ' ' || coalesce(new.last_name, '')), '');
  end if;
  if new.full_name is null then
    raise exception 'full_name (or first_name/last_name) is required';
  end if;

  if public.lf_norm_company(new.company_name) is null then
    new.company_id := null;
  elsif tg_op = 'INSERT' or new.company_name is distinct from old.company_name or new.company_id is null then
    insert into public.companies (user_id, name, website, industry, company_size, country, city)
    values (new.user_id, btrim(new.company_name), new.company_website, new.industry, new.company_size, new.country, new.city)
    on conflict (user_id, name_norm) do update set
      website = coalesce(public.companies.website, excluded.website),
      industry = coalesce(public.companies.industry, excluded.industry),
      company_size = coalesce(public.companies.company_size, excluded.company_size)
    returning id into v_company_id;
    new.company_id := v_company_id;
  end if;

  if new.is_verified and (tg_op = 'INSERT' or not old.is_verified) then
    new.verified_at := now();
  elsif not new.is_verified then
    new.verified_at := null;
  end if;
  return new;
end $$;

create trigger leads_before_write before insert or update on public.leads
  for each row execute function public.lf_leads_before_write();

-- Keep last_contacted_at in sync with outreach activities.
create or replace function public.lf_activity_after_insert()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.lead_id is not null and new.type in ('call','email','linkedin_message','meeting') then
    update public.leads set last_contacted_at = greatest(coalesce(last_contacted_at, new.occurred_at), new.occurred_at)
    where id = new.lead_id;
  end if;
  return new;
end $$;

create trigger activities_after_insert after insert on public.activities
  for each row execute function public.lf_activity_after_insert();

-- ---------------------------------------------------------------------------
-- Row Level Security: one owner per row
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['user_settings','companies','import_jobs','collection_jobs','leads','import_errors',
                           'collection_job_results','duplicate_reviews','lead_lists','lead_list_members',
                           'activities','notes','tasks','saved_searches']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($p$create policy owner_all on public.%I for all to authenticated
                     using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

-- List members may only reference the owner's own lists and leads.
create policy members_same_owner on public.lead_list_members as restrictive for insert to authenticated
  with check (
    exists (select 1 from public.lead_lists l where l.id = list_id and l.user_id = (select auth.uid()))
    and exists (select 1 from public.leads d where d.id = lead_id and d.user_id = (select auth.uid()))
  );

-- ---------------------------------------------------------------------------
-- Views & RPCs (security invoker: RLS still applies)
-- ---------------------------------------------------------------------------

create view public.companies_with_counts with (security_invoker = true) as
  select c.*, (select count(*) from public.leads l where l.company_id = c.id) as lead_count
  from public.companies c;

create view public.lead_lists_with_counts with (security_invoker = true) as
  select l.*, (select count(*) from public.lead_list_members m where m.list_id = l.id) as member_count
  from public.lead_lists l;

create or replace function public.dashboard_stats()
returns json language sql stable security invoker set search_path = public as $$
  select json_build_object(
    'total',       count(*),
    'new',         count(*) filter (where status = 'new'),
    'imported',    count(*) filter (where origin in ('csv_import','collector','api')),
    'contacted',   count(*) filter (where status = 'contacted'),
    'interested',  count(*) filter (where status = 'interested'),
    'qualified',   count(*) filter (where status = 'qualified'),
    'converted',   count(*) filter (where status = 'won'),
    'added_7d',    count(*) filter (where created_at >= now() - interval '7 days'),
    'companies',   (select count(*) from public.companies),
    'open_tasks',  (select count(*) from public.tasks where not completed),
    'overdue_tasks', (select count(*) from public.tasks where not completed and due_at < now())
  )
  from public.leads
$$;

create or replace function public.lead_breakdown(p_dimension text, p_limit int default 10)
returns table(label text, value bigint) language plpgsql stable security invoker set search_path = public as $$
begin
  if p_dimension not in ('country','city','industry','status','job_title','lead_source','seniority','department','origin','company_size') then
    raise exception 'invalid dimension %', p_dimension;
  end if;
  return query execute format(
    'select coalesce(nullif(btrim(%1$I), ''''), ''Unknown'')::text as label, count(*)::bigint as value
       from public.leads group by 1 order by 2 desc, 1 limit %2$s', p_dimension, greatest(1, least(p_limit, 100)));
end $$;

create or replace function public.lead_growth(p_days int default 30)
returns table(day date, added bigint, cumulative bigint) language sql stable security invoker set search_path = public as $$
  with days as (
    select generate_series((current_date - (greatest(p_days,1) - 1)), current_date, interval '1 day')::date as day
  ), base as (
    select count(*)::bigint as n from public.leads where created_at::date < current_date - (greatest(p_days,1) - 1)
  ), per_day as (
    select created_at::date as day, count(*)::bigint as n from public.leads
    where created_at::date >= current_date - (greatest(p_days,1) - 1) group by 1
  )
  select d.day, coalesce(p.n, 0) as added,
         (select n from base) + sum(coalesce(p.n, 0)) over (order by d.day) as cumulative
  from days d left join per_day p on p.day = d.day order by d.day
$$;

create or replace function public.distinct_lead_values(p_dimension text, p_query text default null, p_limit int default 20)
returns table(label text, value bigint) language plpgsql stable security invoker set search_path = public as $$
begin
  if p_dimension not in ('country','city','state','industry','job_title','lead_source','seniority','department','company_size','company_name') then
    raise exception 'invalid dimension %', p_dimension;
  end if;
  return query execute format(
    'select %1$I::text as label, count(*)::bigint as value from public.leads
      where %1$I is not null and btrim(%1$I) <> '''' and ($1 is null or %1$I ilike ''%%'' || $1 || ''%%'')
      group by 1 order by 2 desc, 1 limit %2$s', p_dimension, greatest(1, least(p_limit, 200)))
  using p_query;
end $$;

-- Find existing leads matching any of the given normalised keys (used by import & collector).
create or replace function public.find_duplicate_candidates(
  p_linkedin text[] default '{}', p_emails text[] default '{}', p_name_company text[] default '{}')
returns table(id uuid, full_name text, company_name text, business_email text, linkedin_url text,
              linkedin_url_norm text, email_norm text, name_company_key text)
language sql stable security invoker set search_path = public as $$
  select l.id, l.full_name, l.company_name, l.business_email, l.linkedin_url,
         l.linkedin_url_norm, l.email_norm, l.name_company_key
  from public.leads l
  where (cardinality(p_linkedin) > 0 and l.linkedin_url_norm = any(p_linkedin))
     or (cardinality(p_emails) > 0 and l.email_norm = any(p_emails))
     or (cardinality(p_name_company) > 0 and l.name_company_key = any(p_name_company))
$$;

-- Pipeline column counts in one round-trip.
create or replace function public.pipeline_counts()
returns table(status text, value bigint) language sql stable security invoker set search_path = public as $$
  select status, count(*)::bigint from public.leads group by status
$$;

-- Atomically record a processed import batch. Returns false if the batch was already applied / out of order.
create or replace function public.record_import_batch(
  p_job uuid, p_start int, p_rows int, p_inserted int, p_updated int, p_duplicates int,
  p_skipped int, p_review int, p_failed int)
returns boolean language plpgsql security invoker set search_path = public as $$
declare n int;
begin
  update public.import_jobs set
    next_row = next_row + p_rows,
    processed_rows = processed_rows + p_rows,
    inserted_count = inserted_count + p_inserted,
    updated_count = updated_count + p_updated,
    duplicate_count = duplicate_count + p_duplicates,
    skipped_count = skipped_count + p_skipped,
    review_count = review_count + p_review,
    failed_count = failed_count + p_failed,
    status = 'processing',
    started_at = coalesce(started_at, now())
  where id = p_job and next_row = p_start and status in ('pending','processing');
  get diagnostics n = row_count;
  return n = 1;
end $$;

grant execute on function public.record_import_batch(uuid,int,int,int,int,int,int,int,int) to authenticated;
revoke execute on function public.record_import_batch(uuid,int,int,int,int,int,int,int,int) from anon, public;

grant execute on function public.dashboard_stats(), public.lead_breakdown(text,int), public.lead_growth(int),
  public.distinct_lead_values(text,text,int), public.find_duplicate_candidates(text[],text[],text[]),
  public.pipeline_counts() to authenticated;
revoke execute on function public.dashboard_stats(), public.lead_breakdown(text,int), public.lead_growth(int),
  public.distinct_lead_values(text,text,int), public.find_duplicate_candidates(text[],text[],text[]),
  public.pipeline_counts() from anon, public;
