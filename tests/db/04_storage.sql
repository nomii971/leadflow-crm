-- storage_usage() returns sizes and only the caller's own lead count; lf_db_now() is callable.
set role authenticated;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$
declare u jsonb;
begin
  u := public.storage_usage();
  assert (u->>'database_bytes')::bigint > 0, 'database size';
  assert (u->>'leads_bytes')::bigint > 0, 'leads size';
  assert (u->>'lead_count')::int = (select count(*) from public.leads), 'own lead count only: ' || (u->>'lead_count');
  assert public.lf_db_now() <= now(), 'db clock';
end $$;
reset role;
set role anon;
do $$ begin
  perform public.storage_usage();
  raise exception 'anon must not call storage_usage';
exception when insufficient_privilege then null;
end $$;
reset role;
