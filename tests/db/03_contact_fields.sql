-- Contact fields: stored, searchable, and the company keeps its email / phone.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);

insert into public.leads (full_name, company_name, business_email, personal_email, mobile_phone, company_email, company_phone)
values ('Sara Malik', 'Contact Fields Co', 'sara@cfco.com', 'sara.m@gmail.com', '+92 300 1234567', 'info@cfco.com', '+92 51 111 222');
insert into public.leads (full_name, company_name, company_email) values ('Omar Riaz', 'Contact Fields Co', 'other@cfco.com');

do $$
declare r record; n int;
begin
  select * into r from public.companies where name = 'Contact Fields Co';
  assert r.email = 'info@cfco.com', 'company email kept (first wins): ' || coalesce(r.email, 'null');
  assert r.phone = '+92 51 111 222', 'company phone kept';
  select count(*) into n from public.leads where search_text like '%sara.m@gmail.com%'; assert n = 1, 'personal email searchable';
  select count(*) into n from public.leads where search_text like '%300 1234567%'; assert n = 1, 'mobile searchable';
  select count(*) into n from public.companies_with_counts where email = 'info@cfco.com' and lead_count = 2; assert n = 1, 'view has new columns';
end $$;

-- a company missing an email picks one up when a later lead brings it
insert into public.leads (full_name, company_name) values ('Hina Shah', 'No Email Yet Ltd');
update public.leads set company_email = 'hello@noemail.com' where full_name = 'Hina Shah';
do $$ begin
  assert (select email from public.companies where name = 'No Email Yet Ltd') = 'hello@noemail.com', 'company email filled on update';
end $$;
reset role;
