import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, requireUser } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { errorMessage } from "@/lib/utils";

type Ctx = Awaited<ReturnType<typeof requireUser>>;

/** Wraps a route handler with auth, per-user rate limiting and consistent JSON errors. */
export function route<P = Record<string, string>>(
  handler: (req: Request, ctx: Ctx, params: P) => Promise<Response>,
  opts: { limit?: number; windowMs?: number; name?: string } = {},
) {
  return async (req: Request, { params }: { params: Promise<P> }) => {
    try {
      const ctx = await requireUser();
      const rl = rateLimit(`${opts.name ?? new URL(req.url).pathname}:${ctx.user.id}`, opts.limit ?? 240, opts.windowMs ?? 60_000);
      if (!rl.ok) return NextResponse.json({ error: "Too many requests, slow down." }, { status: 429 });
      return await handler(req, ctx, await params);
    } catch (e) {
      if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: 401 });
      if (e instanceof ZodError) return NextResponse.json({ error: "Invalid request", issues: e.issues.slice(0, 5) }, { status: 400 });
      console.error(e);
      return NextResponse.json({ error: errorMessage(e) }, { status: 500 });
    }
  };
}

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status });
