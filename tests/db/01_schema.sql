-- Two users; verify isolation, triggers, normalisation and RPCs.
insert into auth.users values ('11111111-1111-1111-1111-111111111111','a@x.com'),('22222222-2222-2222-2222-222222222222','b@x.com');

set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);

insert into public.leads (first_name, last_name, company_name, linkedin_url, business_email, country, city, industry, origin)
values ('Jane','Doe','Acme Ltd','https://uk.linkedin.com/in/jane-doe/?trk=x','Jane@Acme.COM','United Kingdom','London','Marketing','csv_import'),
       ('Ali','Khan','acme limited', null, null,'Pakistan','Islamabad','Software Development','manual');

do $$
declare r record; n int;
begin
  select * into r from public.leads where first_name='Jane';
  assert r.full_name = 'Jane Doe', 'full_name derived';
  assert r.linkedin_url_norm = 'linkedin.com/in/jane-doe', 'url norm: ' || r.linkedin_url_norm;
  assert r.email_norm = 'jane@acme.com', 'email norm';
  assert r.name_company_key = 'jane doe|acme', 'name company key: ' || r.name_company_key;
  select count(*) into n from public.companies; assert n = 1, 'companies deduped by normalised name, got ' || n;
  select count(*) into n from public.leads where company_id is not null; assert n = 2, 'both linked';
  select count(*) into n from public.find_duplicate_candidates(array['linkedin.com/in/jane-doe'], '{}', '{}'); assert n = 1;
  assert (public.dashboard_stats()->>'total')::int = 2;
  assert (public.dashboard_stats()->>'imported')::int = 1;
  select count(*) into n from public.lead_breakdown('country', 10); assert n = 2;
  select count(*) into n from public.lead_growth(30); assert n = 30;
  select cumulative into n from public.lead_growth(30) order by day desc limit 1; assert n = 2, 'cumulative';
end $$;

-- activity updates last_contacted_at
insert into public.activities (lead_id, type, subject) select id, 'call', 'Intro' from public.leads where first_name='Jane';
do $$ begin assert (select last_contacted_at is not null from public.leads where first_name='Jane'); end $$;

-- list members
insert into public.lead_lists(name) values ('UK Marketing');
insert into public.lead_list_members(list_id, lead_id) select l.id, d.id from public.lead_lists l, public.leads d where d.first_name='Jane';
do $$ begin assert (select member_count from public.lead_lists_with_counts) = 1; end $$;

-- second user sees nothing and cannot write into user 1's rows
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$
declare n int;
begin
  select count(*) into n from public.leads; assert n = 0, 'RLS leak';
  select count(*) into n from public.companies; assert n = 0, 'RLS leak companies';
  assert (public.dashboard_stats()->>'total')::int = 0;
  update public.leads set status='won'; get diagnostics n = row_count; assert n = 0;
end $$;
do $$ begin
  insert into public.leads(full_name, user_id) values ('X','11111111-1111-1111-1111-111111111111');
  raise exception 'should have failed';
exception when insufficient_privilege then null; end $$;
do $$ begin
  insert into public.lead_list_members(list_id, lead_id)
  select (select id from public.lead_lists limit 1), gen_random_uuid();
exception when others then null; end $$;

-- anon has no access
reset role; set role anon;
do $$ begin
  perform 1 from public.leads;
  raise exception 'anon could read';
exception when insufficient_privilege then null; end $$;
reset role;

-- invalid dimension rejected
do $$ begin perform public.lead_breakdown('user_id'); raise exception 'no'; exception when raise_exception then
  if sqlerrm = 'no' then raise; end if; end $$;
select 'ok' as schema_tests;
-- import batch idempotency
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
set role authenticated;
insert into public.import_jobs(id, file_name, strategy) values ('33333333-3333-3333-3333-333333333333','a.csv','skip_duplicates');
do $$ begin
  assert public.record_import_batch('33333333-3333-3333-3333-333333333333', 1, 500, 490, 0, 5, 0, 2, 3) = true;
  assert public.record_import_batch('33333333-3333-3333-3333-333333333333', 1, 500, 490, 0, 5, 0, 2, 3) = false, 'replay must be rejected';
  assert (select processed_rows from public.import_jobs where id='33333333-3333-3333-3333-333333333333') = 500;
  assert (select next_row from public.import_jobs where id='33333333-3333-3333-3333-333333333333') = 501;
end $$;
reset role;
select 'ok' as import_batch_tests;
