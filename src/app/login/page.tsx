import { LoginForm } from "./login-form";
import { Logo } from "@/components/brand/logo";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-indigo-600/30 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-violet-600/20 blur-3xl" />
        <div className="relative"><Logo tone="dark" markClassName="size-10" className="[&>span:last-child]:text-xl" /></div>
        <div className="relative max-w-md">
          <h2 className="text-3xl font-semibold leading-tight">Bulk lead collection and outreach, in one personal workspace.</h2>
          <p className="mt-4 text-slate-400">Import thousands of authorized lead records, detect duplicates, organise lists and manage follow-ups.</p>
        </div>
        <p className="relative text-xs text-slate-500">Private, single-user CRM.</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Logo className="mb-8 lg:hidden" markClassName="size-9" />
          <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-slate-500">Administrator access only.</p>
          {sp.error === "not_admin" ? (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">This account is not the LeadFlow administrator.</p>
          ) : null}
          <LoginForm next={sp.next} />
        </div>
      </div>
    </div>
  );
}
