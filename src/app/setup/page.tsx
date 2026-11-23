import { isSupabaseConfigured } from "@/lib/env";
import { redirect } from "next/navigation";
import { Logo } from "@/components/brand/logo";

export const metadata = { title: "Setup required" };
export const dynamic = "force-dynamic";

export default function SetupPage() {
  if (isSupabaseConfigured()) redirect("/login");
  return (
    <div className="mx-auto max-w-2xl p-8">
      <Logo className="mb-6" markClassName="size-9" />
      <h1 className="text-2xl font-semibold">LeadFlow CRM setup</h1>
      <p className="mt-2 text-slate-600">Supabase environment variables are missing. Follow these steps (all free tier):</p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-slate-700">
        <li>Create a free project at supabase.com.</li>
        <li>Open SQL Editor and run <code className="rounded bg-slate-100 px-1">supabase/migrations/0001_init.sql</code>.</li>
        <li>Authentication → Users → <b>Add user</b> with your email and a strong password. Then Authentication → Sign In / Providers → turn off <b>Allow new users to sign up</b>.</li>
        <li>Copy <code className="rounded bg-slate-100 px-1">.env.example</code> to <code className="rounded bg-slate-100 px-1">.env.local</code> and fill in the Project URL, anon key and ADMIN_EMAIL.</li>
        <li>Restart the app.</li>
      </ol>
    </div>
  );
}
