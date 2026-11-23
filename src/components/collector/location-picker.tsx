"use client";
import { useId, useMemo, useState } from "react";
import { Globe, MapPin, Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { CITIES, COUNTRIES, searchCities, searchCountries, type Country } from "@/lib/locations";
import type { LocationSelection } from "@/lib/collector/types";
import { cn } from "@/lib/utils";

const key = (l: LocationSelection) => `${l.country}|${l.state ?? ""}|${l.city ?? ""}`.toLowerCase();

/** Pick whole countries and/or multiple cities across countries. Free-text cities are allowed. */
export function LocationPicker({ value, onChange }: { value: LocationSelection[]; onChange: (v: LocationSelection[]) => void }) {
  const [countryQ, setCountryQ] = useState("");
  const [country, setCountry] = useState<Country | null>(null);
  const [cityQ, setCityQ] = useState("");
  const [stateQ, setStateQ] = useState("");

  const countries = useMemo(() => (countryQ ? searchCountries(countryQ, 8) : []), [countryQ]);
  const cities = useMemo(() => (country ? searchCities(cityQ, country.code, 40) : cityQ.length > 1 ? searchCities(cityQ, undefined, 10) : []), [cityQ, country]);

  const add = (l: LocationSelection) => {
    if (value.some((v) => key(v) === key(l))) return;
    onChange([...value, l]);
  };
  const remove = (l: LocationSelection) => onChange(value.filter((v) => key(v) !== key(l)));

  const grouped = useMemo(() => {
    const m = new Map<string, LocationSelection[]>();
    for (const l of value) m.set(l.country, [...(m.get(l.country) ?? []), l]);
    return Array.from(m.entries());
  }, [value]);

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <div className="relative">
          <p className="mb-1.5 text-xs font-medium text-slate-700">1. Country</p>
          {country ? (
            <div className="flex h-9 items-center justify-between rounded-lg border border-brand-200 bg-brand-50/50 px-3 text-sm">
              <span className="flex items-center gap-2"><Globe className="size-4 text-brand-600" />{country.name}</span>
              <button type="button" onClick={() => { setCountry(null); setCityQ(""); }} aria-label="Change country"><X className="size-4 text-slate-400" /></button>
            </div>
          ) : (
            <>
              <Input value={countryQ} onChange={(e) => setCountryQ(e.target.value)} placeholder="Search countries (e.g. United Kingdom, UAE)" />
              {countries.length ? (
                <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
                  {countries.map((c) => (
                    <button type="button" key={c.code} className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => { setCountry(c); setCountryQ(""); }}>
                      {c.name}<span className="text-xs text-slate-400">{c.code}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </>
          )}
          {country ? (
            <Button type="button" size="sm" variant="outline" className="mt-2" onClick={() => add({ country: country.name, countryCode: country.code })}>
              <Plus /> Add entire {country.name}
            </Button>
          ) : null}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-slate-700">2. Cities {country ? `in ${country.name}` : "(choose a country first, or search all)"}</p>
          <div className="flex gap-2">
            <Input value={cityQ} onChange={(e) => setCityQ(e.target.value)} placeholder="Search or type a city"
              onKeyDown={(e) => {
                if (e.key === "Enter" && country && cityQ.trim()) { e.preventDefault(); add({ country: country.name, countryCode: country.code, city: cityQ.trim(), state: stateQ.trim() || undefined }); setCityQ(""); }
              }} />
            <Input value={stateQ} onChange={(e) => setStateQ(e.target.value)} placeholder="State / province (optional)" className="w-48" />
          </div>
          <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto scrollbar-thin">
            {cities.map((c) => {
              const loc: LocationSelection = { country: COUNTRIES.find((x) => x.code === c.countryCode)?.name ?? c.countryCode, countryCode: c.countryCode, city: c.city, state: stateQ.trim() || undefined };
              const on = value.some((v) => key(v) === key(loc));
              return (
                <button type="button" key={`${c.countryCode}-${c.city}`} onClick={() => (on ? remove(loc) : add(loc))}
                  className={cn("rounded-full border px-2.5 py-1 text-xs transition", on ? "border-brand-500 bg-brand-600 text-white" : "border-slate-200 bg-white hover:border-brand-300")}>
                  {c.city}{!country ? <span className="opacity-60"> · {c.countryCode}</span> : null}
                </button>
              );
            })}
            {country && cityQ.trim() && !cities.some((c) => c.city.toLowerCase() === cityQ.trim().toLowerCase()) ? (
              <button type="button" onClick={() => { add({ country: country.name, countryCode: country.code, city: cityQ.trim(), state: stateQ.trim() || undefined }); setCityQ(""); }}
                className="rounded-full border border-dashed border-brand-300 px-2.5 py-1 text-xs text-brand-700">+ Add “{cityQ.trim()}”</button>
            ) : null}
          </div>
          {country && CITIES[country.code] ? (
            <button type="button" className="mt-2 text-xs font-medium text-brand-600 hover:underline"
              onClick={() => onChange([...value, ...CITIES[country.code].slice(0, 5).map((city) => ({ country: country.name, countryCode: country.code, city })).filter((l) => !value.some((v) => key(v) === key(l)))])}>
              Add top 5 cities in {country.name}
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3">
        <p className="mb-2 text-xs font-medium text-slate-600">Selected locations ({value.length}){value.length === 0 ? ": none, so all locations are included" : ""}</p>
        <div className="space-y-2">
          {grouped.map(([c, locs]) => (
            <div key={c} className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-xs font-semibold text-slate-700">{c}:</span>
              {locs.map((l) => (
                <span key={key(l)} className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs shadow-xs ring-1 ring-slate-200">
                  <MapPin className="size-3 text-brand-500" />{l.city ? `${l.city}${l.state ? `, ${l.state}` : ""}` : "Entire country"}
                  <button type="button" onClick={() => remove(l)} aria-label="Remove"><X className="size-3 text-slate-400 hover:text-rose-600" /></button>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Multi-value text input with optional suggestions. */
export function TagInput({ value, onChange, placeholder, suggestions = [] }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string; suggestions?: string[] }) {
  const [q, setQ] = useState("");
  const listId = useId();
  const add = (v: string) => {
    const t = v.trim();
    if (t && !value.some((x) => x.toLowerCase() === t.toLowerCase())) onChange([...value, t]);
    setQ("");
  };
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
      <div className="flex flex-wrap gap-1">
        {value.map((v) => (
          <span key={v} className="inline-flex items-center gap-1 rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {v}<button type="button" onClick={() => onChange(value.filter((x) => x !== v))} aria-label={`Remove ${v}`}><X className="size-3" /></button>
          </span>
        ))}
        <input
          list={suggestions.length ? listId : undefined}
          value={q}
          onChange={(e) => { const nv = e.target.value; if (suggestions.includes(nv)) add(nv); else setQ(nv); }}
          onKeyDown={(e) => {
            if ((e.key === "Enter" || e.key === ",") && q.trim()) { e.preventDefault(); add(q); }
            if (e.key === "Backspace" && !q && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => q.trim() && add(q)}
          placeholder={value.length ? "" : placeholder}
          className="min-w-32 flex-1 bg-transparent px-1.5 py-0.5 text-sm outline-none placeholder:text-slate-400"
        />
        {suggestions.length ? <datalist id={listId}>{suggestions.map((s) => <option key={s} value={s} />)}</datalist> : null}
      </div>
    </div>
  );
}
