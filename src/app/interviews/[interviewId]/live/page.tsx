import { ArrowLeft, Bot } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { ConversationalInterviewPanel } from "@/features/interviews/conversational-interview-panel";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type LiveInterviewPageProps = {
  params: Promise<{
    interviewId: string;
  }>;
};

export default async function LiveInterviewPage({
  params,
}: LiveInterviewPageProps) {
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
        where: {
          isFollowUp: false,
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

  if (interview.status === "DRAFT") {
    await prisma.interview.update({
      where: {
        id: interview.id,
      },
      data: {
        status: "IN_PROGRESS",
        startedAt: interview.startedAt ?? new Date(),
      },
    });
  }

  const primaryQuestions = interview.questions.map((question) => ({
    category: question.category,
    id: question.id,
    isFollowUp: question.isFollowUp,
    order: question.order,
    parentQuestionId: question.parentQuestionId,
    prompt: question.prompt,
  }));

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

      <section className="mx-auto max-w-5xl px-6 py-10">
        <div className="surface-hover rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Bot className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-primary">
                Conversational interview
              </p>
              <h1 className="mt-2 text-3xl font-semibold">{interview.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                The interviewer asks, listens, saves each answer, asks
                contextual follow-ups, advances through the session, and ends
                with a feedback report.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <ConversationalInterviewPanel
            completionScore={interview.completionScore ?? 0}
            interviewId={interview.id}
            interviewerMode={interview.interviewerMode}
            primaryQuestions={primaryQuestions}
            startedAt={interview.startedAt?.toISOString() ?? new Date().toISOString()}
            targetQuestionCount={interview.targetQuestionCount}
            timeLimitMinutes={interview.timeLimitMinutes}
          />
        </div>
      </section>
    </main>
  );
}
