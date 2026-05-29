import { ArrowRight, BarChart3, Mic, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Voice interviews",
    description: "Practice speaking answers out loud instead of only typing.",
    icon: Mic,
  },
  {
    title: "AI feedback",
    description: "Get structured scores, strengths, and improvement areas.",
    icon: Sparkles,
  },
  {
    title: "Saved history",
    description: "Track sessions and progress as your skills improve.",
    icon: ShieldCheck,
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-3 font-semibold transition hover:text-sky-700" href="/">
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Mic className="h-5 w-5" aria-hidden="true" />
            </span>
            AI Interview Simulator
          </Link>
          <nav className="flex items-center gap-2">
            <Button asChild size="sm" variant="ghost">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/register">Start practicing</Link>
            </Button>
          </nav>
        </div>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-6xl items-center gap-12 px-6 py-14 lg:grid-cols-[1fr_420px]">
        <div>
          <p className="inline-flex rounded-md border bg-card px-3 py-1 text-sm font-medium text-muted-foreground">
            Voice practice, AI questions, scoring, and saved reports
          </p>
          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-normal text-foreground sm:text-6xl">
            Practice interviews like a real conversation.
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-muted-foreground">
            Create role-specific interview sessions, answer questions by voice,
            save transcripts, and review structured coaching feedback.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/register">
                Create account
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>

        <aside className="surface-hover rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Live flow</p>
              <h2 className="text-xl font-semibold">Frontend mock interview</h2>
            </div>
            <BarChart3 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
          </div>
          <div className="mt-5 space-y-3">
            {["Generate tailored questions", "Speak and transcribe answers", "Evaluate and review feedback"].map((item, index) => (
              <div className="surface-hover flex items-center gap-3 rounded-md border bg-background p-3" key={item}>
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-semibold text-primary-foreground">
                  {index + 1}
                </span>
                <span className="text-sm font-medium">{item}</span>
              </div>
            ))}
          </div>
        </aside>

        <div className="grid gap-4 md:col-span-2 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;

            return (
              <article
                key={feature.title}
                className="surface-hover rounded-lg border bg-card p-5 text-card-foreground shadow-sm"
              >
                <Icon className="h-6 w-6 text-sky-600" aria-hidden="true" />
                <h2 className="mt-4 text-lg font-semibold">{feature.title}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {feature.description}
                </p>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
