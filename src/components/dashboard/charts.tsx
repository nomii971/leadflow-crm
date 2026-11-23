"use client";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";

const SERIES = "#2a78d6"; // single-series charts use one hue (magnitude), validated reference palette slot 1
const GRID = "#eef0f3";
const AXIS = "#64748b";

function ChartTooltip({ active, payload, label, unit = "leads" }: { active?: boolean; payload?: { value: number }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-slate-900">{label}</p>
      <p className="mt-0.5 text-slate-600">{payload[0].value.toLocaleString()} {unit}</p>
    </div>
  );
}

export function GrowthChart({ data }: { data: { day: string; added: number; cumulative: number }[] }) {
  const fmt = (d: string) => new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data.map((d) => ({ ...d, label: fmt(d.day) }))} margin={{ left: -12, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={SERIES} stopOpacity={0.22} />
            <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} allowDecimals={false} width={48} />
        <Tooltip content={<ChartTooltip unit="total leads" />} cursor={{ stroke: "#94a3b8", strokeDasharray: "3 3" }} />
        <Area type="monotone" dataKey="cumulative" stroke={SERIES} strokeWidth={2} fill="url(#g)" activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function HBarChart({ data, height }: { data: { label: string; value: number }[]; height?: number }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-slate-400">No data yet</p>;
  const h = height ?? Math.max(160, data.length * 30 + 20);
  return (
    <ResponsiveContainer width="100%" height={h}>
      <BarChart data={data} layout="vertical" margin={{ left: 0, right: 16 }} barCategoryGap={6}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11, fill: "#334155" }} tickLine={false} axisLine={false}
          tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 17) + "…" : v)} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ColumnChart({ data, unit = "records" }: { data: { label: string; value: number }[]; unit?: string }) {
  if (!data.length) return <p className="py-10 text-center text-sm text-slate-400">No imports yet</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ left: -12, right: 8, top: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} allowDecimals={false} width={48} />
        <Tooltip content={<ChartTooltip unit={unit} />} cursor={{ fill: "#f1f5f9" }} />
        <Bar dataKey="value" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
