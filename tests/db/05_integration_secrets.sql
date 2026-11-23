-- Tokens: per-user, never visible to anon, other users can't read them, last4 only in status.
set role authenticated;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select public.set_integration_secret('hubspot', 'pat-na1-aaaaaaaa-1111');
select public.set_integration_secret('hubspot', 'pat-na1-bbbbbbbb-2222');  -- update, not a second row
do $$ begin
  assert public.get_integration_secret('hubspot') = 'pat-na1-bbbbbbbb-2222', 'own token';
  assert public.integration_secret_status('hubspot')->>'last4' = '2222', 'last4';
  assert (public.integration_secret_status('hubspot')->>'configured')::boolean, 'configured';
  begin perform public.set_integration_secret('hubspot', 'has space in it'); raise exception 'should reject';
  exception when invalid_parameter_value then null; end;
  begin perform public.get_integration_secret('gmail'); raise exception 'should reject provider';
  exception when raise_exception then null; end;
end $$;
select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert public.get_integration_secret('hubspot') is null, 'other user cannot read it';
  assert not (public.integration_secret_status('hubspot')->>'configured')::boolean, 'other user: not configured';
  begin perform * from vault.secrets; raise exception 'vault must not be readable directly';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111', false);
select public.clear_integration_secret('hubspot');
do $$ begin assert public.get_integration_secret('hubspot') is null, 'cleared'; end $$;
reset role;
set role anon;
do $$ begin
  perform public.get_integration_secret('hubspot'); raise exception 'anon must not call it';
exception when insufficient_privilege then null; end $$;
reset role;
