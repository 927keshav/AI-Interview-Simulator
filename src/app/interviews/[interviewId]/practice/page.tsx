import { ArrowLeft, Mic } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { VoicePracticePanel } from "@/features/voice/voice-practice-panel";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type VoicePracticePageProps = {
  params: Promise<{
    interviewId: string;
  }>;
};

export default async function VoicePracticePage({
  params,
}: VoicePracticePageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const { interviewId } = await params;
  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
      userId: session.user.id,
    },
    include: {
      questions: {
        include: {
          answers: {
            orderBy: {
              answeredAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!interview) {
    notFound();
  }

  return (
    <main className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Button asChild size="sm" variant="ghost">
            <Link href={`/interviews/${interview.id}`}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Report
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 py-10">
        <div className="surface-hover rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Mic className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-primary">Voice practice</p>
              <h1 className="mt-2 text-3xl font-semibold">{interview.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Listen to each question, answer through your microphone, review
                the transcript, and save it to your interview history.
              </p>
            </div>
          </div>
        </div>

        <section className="surface-hover mt-8 rounded-lg border bg-card p-6 shadow-sm">
          <VoicePracticePanel
            interviewId={interview.id}
            questions={interview.questions}
          />
        </section>
      </section>
    </main>
  );
}
