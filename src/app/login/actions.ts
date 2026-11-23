"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAllowedUser } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const schema = z.object({ email: z.string().email().max(320), password: z.string().min(6).max(200), next: z.string().optional() });

export async function signIn(_: unknown, formData: FormData): Promise<{ error?: string }> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (!rateLimit(`login:${ip}`, 8, 60_000).ok) return { error: "Too many attempts. Wait a minute and try again." };

  if (!isAllowedUser(parsed.data.email)) return { error: "Invalid email or password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error) return { error: "Invalid email or password." };
  const next = parsed.data.next && parsed.data.next.startsWith("/") && !parsed.data.next.startsWith("//") ? parsed.data.next : "/dashboard";
  redirect(next);
}
