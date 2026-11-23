"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/misc";
import { signIn } from "./actions";

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(signIn, {});
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Email"><Input name="email" type="email" autoComplete="email" required /></Field>
      <Field label="Password"><Input name="password" type="password" autoComplete="current-password" required /></Field>
      {state?.error ? <p className="text-sm text-rose-600">{state.error}</p> : null}
      <Button type="submit" disabled={pending} size="lg">{pending ? <Spinner /> : null} Sign in</Button>
    </form>
  );
}
