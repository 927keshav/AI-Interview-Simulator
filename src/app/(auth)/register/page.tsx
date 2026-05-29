import Link from "next/link";
import { Mic } from "lucide-react";

import { registerAction } from "@/features/auth/actions";
import { AuthForm } from "@/features/auth/auth-form";

export default function RegisterPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-md">
        <Link className="flex items-center gap-3 font-semibold text-primary transition hover:text-sky-700" href="/">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Mic className="h-5 w-5" aria-hidden="true" />
          </span>
          AI Interview Simulator
        </Link>
        <h1 className="mt-8 text-3xl font-semibold">Create your account</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Start saving interview practice sessions and feedback reports.
        </p>
        <div className="surface-hover mt-8 rounded-lg border bg-card p-6 shadow-sm">
          <AuthForm action={registerAction} mode="register" />
        </div>
      </section>
    </main>
  );
}
