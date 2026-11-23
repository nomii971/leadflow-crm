-- LeadFlow CRM: database storage meter + support for "Export & delete".
-- Adds functions only (no tables changed, nothing dropped).

-- Approximate storage used, for the dashboard meter (Supabase Free = 500 MB per project).
-- security definer because pg_database_size needs CONNECT on the database; it only returns sizes and the
-- caller's own lead count, never any row data.
create or replace function public.storage_usage()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'leads_bytes', pg_total_relation_size('public.leads'),
    'lead_count', (select count(*) from public.leads where user_id = (select auth.uid()))
  )
$$;
revoke execute on function public.storage_usage() from anon, public;
grant execute on function public.storage_usage() to authenticated;

-- Database clock, so "Export & delete" can compare against updated_at / added_at set by the database itself.
create or replace function public.lf_db_now()
returns timestamptz language sql stable security invoker set search_path = public as $$ select now() $$;
revoke execute on function public.lf_db_now() from anon, public;
grant execute on function public.lf_db_now() to authenticated;
