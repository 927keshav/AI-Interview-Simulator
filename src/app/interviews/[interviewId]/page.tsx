import {
  ArrowLeft,
  Bot,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Lightbulb,
  Layers,
  ListChecks,
  MessageSquareText,
  Mic,
  NotebookText,
  ShieldCheck,
  Target,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { EvaluateFeedbackButton } from "@/features/interviews/evaluate-feedback-button";
import { formatInterviewValue } from "@/features/interviews/constants";
import { GenerateQuestionsButton } from "@/features/interviews/generate-questions-button";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type InterviewReportPageProps = {
  params: Promise<{
    interviewId: string;
  }>;
};

export default async function InterviewReportPage({
  params,
}: InterviewReportPageProps) {
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
          parentQuestion: true,
        },
        orderBy: {
          order: "asc",
        },
      },
      feedback: true,
    },
  });

  if (!interview) {
    notFound();
  }

  const answeredQuestionCount = interview.questions.filter(
    (question) => question.answers.length > 0,
  ).length;
  const hasAnswers = answeredQuestionCount > 0;
  const scoreItems = interview.feedback
    ? [
        { label: "Correctness", value: interview.feedback.correctness },
        { label: "Communication", value: interview.feedback.communication },
        { label: "Confidence", value: interview.feedback.confidence },
        { label: "Technical depth", value: interview.feedback.technicalDepth },
      ]
    : [];

  return (
    <main className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Button asChild size="sm" variant="ghost">
            <Link href="/dashboard">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Dashboard
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="surface-hover rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-start">
            <div>
              <p className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {formatInterviewValue(interview.status)}
              </p>
              <h1 className="mt-4 text-3xl font-semibold">{interview.title}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Review the setup, generate questions, practice by voice, and
                evaluate your latest saved answers.
              </p>
            </div>
            {interview.overallScore !== null ? (
              <div className="rounded-lg border bg-background p-4 text-center">
                <p className="text-sm text-muted-foreground">Overall</p>
                <p className="mt-1 text-3xl font-semibold">
                  {interview.overallScore}
                </p>
              </div>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="surface-hover rounded-lg border bg-background p-4">
              <Layers className="h-5 w-5 text-sky-600" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold">Interview setup</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatInterviewValue(interview.role)} ·{" "}
                {formatInterviewValue(interview.experienceLevel)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatInterviewValue(interview.interviewerMode)} interviewer
              </p>
            </div>

            <div className="surface-hover rounded-lg border bg-background p-4">
              <ListChecks className="h-5 w-5 text-emerald-600" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold">Question count</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {answeredQuestionCount}/{interview.targetQuestionCount} answered
                toward the target
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Completion score: {interview.completionScore ?? 0}%
              </p>
            </div>

            <div className="surface-hover rounded-lg border bg-background p-4">
              <Clock className="h-5 w-5 text-amber-600" aria-hidden="true" />
              <h2 className="mt-3 text-sm font-semibold">Time limit</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                {interview.timeLimitMinutes} minutes
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Created {interview.createdAt.toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>

        <section className="surface-hover mt-8 rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Technology stack</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {interview.technologyStack.map((technology) => (
              <span
                className="rounded-md border bg-background px-3 py-1 text-sm text-muted-foreground"
                key={technology}
              >
                {technology}
              </span>
            ))}
          </div>
        </section>

        <section className="surface-hover mt-8 rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-lg font-semibold">AI questions</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Generate role-specific interview questions from your setup.
                Later, the voice interview flow will ask these questions aloud.
              </p>
            </div>
            <GenerateQuestionsButton
              disabled={interview.questions.length > 0}
              interviewId={interview.id}
            />
          </div>

          {interview.questions.length > 0 ? (
            <div className="mt-4 flex flex-wrap gap-3">
              <Button asChild>
                <Link href={`/interviews/${interview.id}/live`}>
                  <Bot className="h-4 w-4" aria-hidden="true" />
                  Start conversational interview
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={`/interviews/${interview.id}/practice`}>
                  <Mic className="h-4 w-4" aria-hidden="true" />
                  Start voice practice
                </Link>
              </Button>
            </div>
          ) : null}

          <div className="mt-6 space-y-3">
            {interview.questions.length > 0 ? (
              interview.questions.map((question) => (
                <article className="surface-hover rounded-lg border bg-background p-4" key={question.id}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs font-medium uppercase text-primary">
                      Question {question.order}
                      {question.category ? ` · ${question.category}` : ""}
                    </p>
                    <span className={
                      question.answers[0]
                        ? "inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700"
                        : "inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700"
                    }>
                      {question.answers[0] ? "Answered" : "Needs answer"}
                    </span>
                  </div>
                  <h3 className="mt-3 font-medium leading-7">{question.prompt}</h3>
                  {question.answers[0] ? (
                    <p className="mt-3 rounded-md border bg-card p-3 text-sm leading-6 text-muted-foreground">
                      Latest answer: {question.answers[0].transcript}
                    </p>
                  ) : null}
                </article>
              ))
            ) : (
              <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground">
                No questions yet. Click the generation button to create the
                first question set for this interview.
              </p>
            )}
          </div>
        </section>

        <section className="surface-hover mt-8 rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-lg font-semibold">Feedback report</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Evaluate your saved answers for correctness, communication,
                confidence, and technical depth.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {answeredQuestionCount} answered question
                {answeredQuestionCount === 1 ? "" : "s"} ready for evaluation.
              </p>
            </div>
            <EvaluateFeedbackButton
              disabled={!hasAnswers}
              interviewId={interview.id}
            />
          </div>

          {interview.feedback ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                <div className="surface-hover rounded-lg border bg-primary p-5 text-primary-foreground">
                  <p className="text-sm font-medium text-primary-foreground/75">
                    Overall score
                  </p>
                  <p className="mt-3 text-5xl font-semibold">
                    {interview.feedback.score}
                  </p>
                  <p className="mt-1 text-sm text-primary-foreground/70">
                    out of 100
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {scoreItems.map((item) => (
                    <ScoreMetric
                      key={item.label}
                      label={item.label}
                      value={item.value}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                <FeedbackList
                  icon={ShieldCheck}
                  items={interview.feedback.strengths}
                  title="Strengths"
                  tone="emerald"
                />
                <FeedbackList
                  icon={TriangleAlert}
                  items={interview.feedback.weaknesses}
                  title="Weaknesses"
                  tone="amber"
                />
                <FeedbackList
                  icon={Lightbulb}
                  items={interview.feedback.suggestions}
                  title="Suggestions"
                  tone="sky"
                />
              </div>

              {interview.feedback.interviewerNotes ? (
                <div className="surface-hover rounded-lg border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-sky-50 text-sky-700">
                      <NotebookText className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="font-semibold">Interviewer notes</h3>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">
                    {interview.feedback.interviewerNotes}
                  </p>
                </div>
              ) : null}

              {interview.feedback.hiringRecommendation ? (
                <div className="surface-hover rounded-lg border bg-background p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md border bg-emerald-50 text-emerald-700">
                      <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <h3 className="font-semibold">Hiring recommendation</h3>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {interview.feedback.hiringRecommendation}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-6 rounded-lg border border-dashed bg-background p-6 text-center">
              <Target className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-3 font-semibold">No feedback yet</h3>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                Save at least one answer, then evaluate the interview to create
                scores, strengths, weaknesses, and suggestions.
              </p>
            </div>
          )}
        </section>

        <section className="surface-hover mt-8 rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <MessageSquareText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">Interview timeline</h2>
              <p className="text-sm text-muted-foreground">
                Persisted questions, follow-ups, answers, timestamps, and notes.
              </p>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            {interview.questions.map((question) => (
              <article
                className="surface-hover rounded-lg border bg-background p-4"
                key={question.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-xs font-medium uppercase text-primary">
                    {question.isFollowUp ? "Follow-up" : "Primary"} · Question{" "}
                    {question.order}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    Asked {question.createdAt.toLocaleString()}
                  </span>
                </div>
                {question.parentQuestion ? (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Follow-up to: {question.parentQuestion.prompt}
                  </p>
                ) : null}
                <h3 className="mt-3 font-medium leading-7">{question.prompt}</h3>

                {question.answers[0] ? (
                  <div className="mt-3 rounded-md border bg-card p-3">
                    <p className="text-xs text-muted-foreground">
                      Answered {question.answers[0].answeredAt.toLocaleString()}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {question.answers[0].transcript}
                    </p>
                    {question.answers[0].notes ? (
                      <p className="mt-3 rounded-md bg-sky-50 p-3 text-sm leading-6 text-sky-800">
                        Interviewer note: {question.answers[0].notes}
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    No answer saved yet.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function ScoreMetric({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  const safeValue = value ?? 0;

  return (
    <div className="surface-hover rounded-lg border bg-background p-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold">{value ?? "-"}</p>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-sky-600"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}

function FeedbackList({
  icon: Icon,
  items,
  title,
  tone,
}: {
  icon: LucideIcon;
  items: string[];
  title: string;
  tone: "amber" | "emerald" | "sky";
}) {
  const toneClasses = {
    amber: "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    sky: "bg-sky-50 text-sky-700 border-sky-100",
  };

  return (
    <div className="surface-hover rounded-lg border bg-background p-4">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 items-center justify-center rounded-md border ${toneClasses[tone]}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <h3 className="font-semibold">{title}</h3>
      </div>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li className="flex gap-2 text-sm leading-6 text-muted-foreground" key={item}>
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
