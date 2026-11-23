-- LeadFlow CRM: extra contact fields (personal email, mobile, company email / phone).
-- Safe to run once on a database that already has 0001_init.sql.
-- Values only ever come from authorized imports, the HubSpot API or manual entry.

alter table public.leads
  add column if not exists personal_email text,
  add column if not exists mobile_phone text,
  add column if not exists company_email text,
  add column if not exists company_phone text;

alter table public.companies
  add column if not exists email text,
  add column if not exists phone text;

-- Search also covers the new emails and phone numbers.
-- The old column, index and view are renamed (*_v1) rather than dropped, matching how this was applied
-- to the live project. They are unused and can be dropped later.
alter index public.leads_search_trgm rename to leads_search_trgm_v1;
alter table public.leads rename column search_text to search_text_v1;
alter table public.leads add column search_text text generated always as (
  lower(coalesce(full_name,'') || ' ' || coalesce(job_title,'') || ' ' || coalesce(company_name,'') || ' ' ||
        coalesce(business_email,'') || ' ' || coalesce(personal_email,'') || ' ' || coalesce(company_email,'') || ' ' ||
        coalesce(business_phone,'') || ' ' || coalesce(mobile_phone,'') || ' ' || coalesce(company_phone,'') || ' ' ||
        coalesce(city,'') || ' ' || coalesce(country,'') || ' ' || coalesce(industry,''))
) stored;
create index leads_search_trgm on public.leads using gin (search_text gin_trgm_ops);

-- The company record also keeps the company email / phone seen on its leads (first value wins).
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
  elsif tg_op = 'INSERT' or new.company_name is distinct from old.company_name or new.company_id is null
        or new.company_email is distinct from old.company_email or new.company_phone is distinct from old.company_phone then
    insert into public.companies (user_id, name, website, industry, company_size, country, city, email, phone)
    values (new.user_id, btrim(new.company_name), new.company_website, new.industry, new.company_size, new.country, new.city,
            new.company_email, new.company_phone)
    on conflict (user_id, name_norm) do update set
      website = coalesce(public.companies.website, excluded.website),
      industry = coalesce(public.companies.industry, excluded.industry),
      company_size = coalesce(public.companies.company_size, excluded.company_size),
      email = coalesce(public.companies.email, excluded.email),
      phone = coalesce(public.companies.phone, excluded.phone)
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

-- c.* in a view is expanded when the view is created, so recreate it to include the new columns.
alter view public.companies_with_counts rename to companies_with_counts_v1;
revoke all on public.companies_with_counts_v1 from anon, authenticated;
create view public.companies_with_counts with (security_invoker = true) as
  select c.*, (select count(*) from public.leads l where l.company_id = c.id) as lead_count
  from public.companies c;
grant select on public.companies_with_counts to authenticated;
revoke all on public.companies_with_counts from anon;
