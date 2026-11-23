-- LeadFlow CRM: store integration tokens (HubSpot private app token) encrypted in Supabase Vault,
-- so they can be pasted on the Integrations page instead of set as hosting environment variables.
-- Functions only; nothing is dropped. Requires the supabase_vault extension (enabled on Supabase projects).
--
-- Each secret is named lf_<provider>_<user id>, so a user can only reach their own token.
-- Only the signed-in user (role authenticated) can call these; anon cannot.
-- The app reads the token on the server only (collector steps / status checks) and never sends it to the browser.

create or replace function public.lf_secret_name(p_provider text)
returns text language plpgsql stable security invoker set search_path = public as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not signed in' using errcode = '42501'; end if;
  if p_provider is null or p_provider not in ('hubspot') then raise exception 'unknown provider %', p_provider; end if;
  return 'lf_' || p_provider || '_' || uid::text;
end $$;

create or replace function public.set_integration_secret(p_provider text, p_secret text)
returns void language plpgsql security definer set search_path = public as $$
declare v_name text := public.lf_secret_name(p_provider); v_id uuid; v_secret text := btrim(coalesce(p_secret, ''));
begin
  if length(v_secret) < 10 or length(v_secret) > 500 or v_secret ~ '\s' then
    raise exception 'That does not look like a valid token' using errcode = '22023';
  end if;
  select id into v_id from vault.secrets where name = v_name;
  if v_id is null then
    perform vault.create_secret(v_secret, v_name, 'LeadFlow CRM integration token');
  else
    perform vault.update_secret(v_id, v_secret);
  end if;
end $$;

create or replace function public.clear_integration_secret(p_provider text)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from vault.secrets where name = public.lf_secret_name(p_provider);
end $$;

-- Server-side use only (the app never returns this value to the browser).
create or replace function public.get_integration_secret(p_provider text)
returns text language sql stable security definer set search_path = public as $$
  select decrypted_secret from vault.decrypted_secrets where name = public.lf_secret_name(p_provider) limit 1
$$;

-- Safe to show in the UI: whether a token is saved, its last 4 characters and when it changed.
create or replace function public.integration_secret_status(p_provider text)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(
    (select jsonb_build_object('configured', true, 'last4', right(decrypted_secret, 4), 'updated_at', updated_at)
       from vault.decrypted_secrets where name = public.lf_secret_name(p_provider) limit 1),
    jsonb_build_object('configured', false)
  )
$$;

revoke execute on function public.lf_secret_name(text), public.set_integration_secret(text, text),
  public.clear_integration_secret(text), public.get_integration_secret(text), public.integration_secret_status(text)
  from anon, public;
grant execute on function public.lf_secret_name(text), public.set_integration_secret(text, text),
  public.clear_integration_secret(text), public.get_integration_secret(text), public.integration_secret_status(text)
  to authenticated;
