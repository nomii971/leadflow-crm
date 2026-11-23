-- Values must match tests/normalize.test.ts exactly (TS <-> SQL parity).
do $$ begin
  assert public.lf_norm_url('https://uk.linkedin.com/in/jane-doe/?trk=x') = 'linkedin.com/in/jane-doe';
  assert public.lf_norm_url('HTTP://www.LinkedIn.com/in/Jane-Doe/') = 'linkedin.com/in/jane-doe';
  assert public.lf_norm_url('linkedin.com/in/jane-doe#about') = 'linkedin.com/in/jane-doe';
  assert public.lf_norm_url('  ') is null;
  assert public.lf_norm_email(' Jane@Acme.COM ') = 'jane@acme.com';
  assert public.lf_norm_company('Acme Ltd.') = 'acme';
  assert public.lf_norm_company('ACME limited') = 'acme';
  assert public.lf_norm_company('Acme, Inc') = 'acme';
  assert public.lf_norm_company('Coca-Cola Company') = 'coca cola';
  assert public.lf_norm_company('Ltd') is null;
  assert public.lf_norm_company('Société Générale') = 'société générale', public.lf_norm_company('Société Générale');
  assert public.lf_name_company_key('Jane  Doe', 'Acme Ltd') = 'jane doe|acme';
  assert public.lf_name_company_key('Jane', null) is null;
end $$;
select 'ok' as parity_tests;
