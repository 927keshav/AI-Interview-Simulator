import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Bot,
  Brain,
  BriefcaseBusiness,
  ClipboardList,
  Clock,
  LineChart,
  Mic,
  PlusCircle,
  Target,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { LogoutButton } from "@/components/auth/logout-button";
import { createInterviewAction } from "@/features/interviews/actions";
import { CreateInterviewForm } from "@/features/interviews/create-interview-form";
import { formatInterviewValue } from "@/features/interviews/constants";
import { InterviewList } from "@/features/interviews/interview-list";
import { ResumeIntakePanel } from "@/features/resumes/resume-intake-panel";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ChartPoint = {
  label: string;
  value: number;
};

type BarPoint = {
  label: string;
  value: number;
};

type DashboardInterview = Awaited<ReturnType<typeof getDashboardInterviews>>[number] & {
  interviewerMode: string;
  timeLimitMinutes: number;
  feedback: (Awaited<ReturnType<typeof getDashboardInterviews>>[number]["feedback"] & {
    hiringRecommendation?: string | null;
  }) | null;
};

async function getDashboardInterviews(userId: string) {
  return prisma.interview.findMany({
    where: { userId },
    include: {
      feedback: true,
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
    orderBy: { createdAt: "desc" },
  });
}

function average(values: Array<number | null | undefined>) {
  const usableValues = values.filter(
    (value): value is number => typeof value === "number",
  );

  if (usableValues.length === 0) {
    return null;
  }

  return Math.round(
    usableValues.reduce((total, value) => total + value, 0) / usableValues.length,
  );
}

function formatDateLabel(date: Date) {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
}

function getTrendPoint(
  interviews: DashboardInterview[],
  getValue: (interview: DashboardInterview) => number | null | undefined,
) {
  return interviews
    .filter((interview) => typeof getValue(interview) === "number")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((interview) => ({
      label: formatDateLabel(interview.completedAt ?? interview.createdAt),
      value: getValue(interview) ?? 0,
    }));
}

function countBy<T extends string | null | undefined>(
  interviews: DashboardInterview[],
  getValue: (interview: DashboardInterview) => T,
) {
  const counts = new Map<string, number>();

  interviews.forEach((interview) => {
    const label = formatInterviewValue(getValue(interview));

    counts.set(label, (counts.get(label) ?? 0) + 1);
  });

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function countTerms(items: string[]) {
  const counts = new Map<string, number>();

  items.forEach((item) => {
    const label = item
      .replace(/[^\w#+. ]/g, " ")
      .split(/\s+/)
      .filter((word) => word.length > 3)
      .slice(0, 4)
      .join(" ");

    if (label) {
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  });

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);
}

function getTimeSpent(interview: DashboardInterview) {
  if (interview.startedAt && interview.completedAt) {
    return Math.max(
      1,
      Math.round(
        (interview.completedAt.getTime() - interview.startedAt.getTime()) / 60000,
      ),
    );
  }

  return interview.status === "COMPLETED" ? interview.timeLimitMinutes : null;
}

function getImprovementRate(scoredInterviews: DashboardInterview[]) {
  const chronologicalScores = scoredInterviews
    .filter((interview) => interview.overallScore !== null)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((interview) => interview.overallScore ?? 0);

  if (chronologicalScores.length < 2) {
    return null;
  }

  return chronologicalScores[chronologicalScores.length - 1] - chronologicalScores[0];
}

function buildAnalytics(interviews: DashboardInterview[]) {
  const completedInterviews = interviews.filter(
    (interview) => interview.status === "COMPLETED",
  );
  const scoredInterviews = interviews.filter(
    (interview) => interview.overallScore !== null,
  );
  const allQuestions = interviews.flatMap((interview) => interview.questions);
  const followUpQuestions = allQuestions.filter((question) => question.isFollowUp);
  const answeredFollowUps = followUpQuestions.filter(
    (question) => question.answers.length > 0,
  );
  const timeSpentValues = interviews
    .map(getTimeSpent)
    .filter((value): value is number => typeof value === "number");
  const averageTimeSpent = average(timeSpentValues);
  const allStrengths = interviews.flatMap(
    (interview) => interview.feedback?.strengths ?? [],
  );
  const allWeaknesses = interviews.flatMap(
    (interview) => interview.feedback?.weaknesses ?? [],
  );
  const missedTopics = [
    ...allQuestions
      .filter((question) => question.answers.length === 0)
      .map((question) => question.category ?? question.prompt),
    ...allWeaknesses,
  ];
  const stackCoverage = interviews.flatMap((interview) => interview.technologyStack);
  const behavioralScores = interviews
    .filter((interview) => interview.type === "BEHAVIORAL")
    .map((interview) => interview.overallScore);
  const technicalScores = interviews
    .filter((interview) => interview.type !== "BEHAVIORAL")
    .map((interview) => interview.overallScore);
  const hiringTrend = completedInterviews
    .filter((interview) => interview.feedback?.hiringRecommendation)
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .slice(-5)
    .map((interview) => ({
      label: formatDateLabel(interview.completedAt ?? interview.createdAt),
      value: interview.feedback?.hiringRecommendation ?? "No recommendation",
    }));

  return {
    averageScore: average(scoredInterviews.map((interview) => interview.overallScore)),
    averageScoreTrend: getTrendPoint(interviews, (interview) => interview.overallScore),
    averageTimeSpent,
    behavioralVsTechnical: [
      { label: "Behavioral", value: average(behavioralScores) ?? 0 },
      { label: "Technical", value: average(technicalScores) ?? 0 },
    ],
    communicationTrend: getTrendPoint(
      interviews,
      (interview) => interview.feedback?.communication,
    ),
    completedCount: completedInterviews.length,
    confidenceTrend: getTrendPoint(
      interviews,
      (interview) => interview.feedback?.confidence,
    ),
    followUpSuccessRate:
      followUpQuestions.length > 0
        ? Math.round((answeredFollowUps.length / followUpQuestions.length) * 100)
        : null,
    hiringTrend,
    improvementRate: getImprovementRate(scoredInterviews),
    interviewerBreakdown: countBy(interviews, (interview) => interview.interviewerMode),
    missedTopics: countTerms(missedTopics),
    roleCounts: countBy(interviews, (interview) => interview.role),
    skillCoverage: countTerms(stackCoverage),
    strongestSkills: countTerms(allStrengths),
    technicalTrend: getTrendPoint(
      interviews,
      (interview) => interview.feedback?.technicalDepth,
    ),
    weakestSkills: countTerms(allWeaknesses),
    difficultyCounts: countBy(interviews, (interview) => interview.experienceLevel),
    timeSpentTrend: getTrendPoint(interviews, getTimeSpent),
  };
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const interviews = (await getDashboardInterviews(session.user.id)) as DashboardInterview[];
  const analytics = buildAnalytics(interviews);

  return (
    <main className="min-h-screen">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Mic className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Dashboard
              </p>
              <h1 className="text-xl font-semibold">Interview practice</h1>
            </div>
          </div>
          <LogoutButton />
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="surface-hover rounded-lg border bg-card p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <p className="text-sm font-medium text-primary">Welcome back</p>
              <h2 className="mt-2 text-3xl font-semibold">
                {session.user.name ?? session.user.email}
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
                Create a focused interview, practice out loud, and turn each
                answer into measurable coaching analytics.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <StatCard icon={ClipboardList} label="Sessions" value={interviews.length} />
              <StatCard icon={BarChart3} label="Completed" value={analytics.completedCount} />
              <StatCard icon={TrendingUp} label="Avg score" value={analytics.averageScore ?? "-"} />
            </div>
          </div>
        </div>

        <div className="mt-8">
          <ResumeIntakePanel />
        </div>

        <section className="mt-8">
          <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-lg font-semibold">Analytics</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Performance, coverage, pacing, follow-ups, and hiring signals.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <MiniMetric label="Improvement" value={formatDelta(analytics.improvementRate)} />
              <MiniMetric
                label="Follow-ups"
                value={analytics.followUpSuccessRate === null ? "-" : `${analytics.followUpSuccessRate}%`}
              />
              <MiniMetric
                label="Avg time"
                value={analytics.averageTimeSpent === null ? "-" : `${analytics.averageTimeSpent}m`}
              />
              <MiniMetric label="Skills" value={analytics.skillCoverage.length} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <AnalyticsCard
              description="Average score over time"
              icon={LineChart}
              title="Score trend"
            >
              <SparklineChart points={analytics.averageScoreTrend} />
            </AnalyticsCard>
            <AnalyticsCard
              description="Technical score trend"
              icon={Brain}
              title="Technical depth"
            >
              <SparklineChart points={analytics.technicalTrend} tone="emerald" />
            </AnalyticsCard>
            <AnalyticsCard
              description="Communication score trend"
              icon={Activity}
              title="Communication"
            >
              <SparklineChart points={analytics.communicationTrend} tone="amber" />
            </AnalyticsCard>
            <AnalyticsCard
              description="Confidence trend"
              icon={TrendingUp}
              title="Confidence"
            >
              <SparklineChart points={analytics.confidenceTrend} tone="rose" />
            </AnalyticsCard>
            <AnalyticsCard
              description="Interview count by role"
              icon={ClipboardList}
              title="Roles"
            >
              <BarList points={analytics.roleCounts} />
            </AnalyticsCard>
            <AnalyticsCard
              description="Interview count by difficulty"
              icon={Target}
              title="Difficulty"
            >
              <BarList points={analytics.difficultyCounts} tone="emerald" />
            </AnalyticsCard>
            <AnalyticsCard
              description="Strongest skills"
              icon={TrendingUp}
              title="Strengths"
            >
              <BarList points={analytics.strongestSkills} emptyLabel="No strengths yet" />
            </AnalyticsCard>
            <AnalyticsCard
              description="Weakest skills"
              icon={Target}
              title="Weaknesses"
            >
              <BarList points={analytics.weakestSkills} tone="amber" emptyLabel="No weaknesses yet" />
            </AnalyticsCard>
            <AnalyticsCard
              description="Most missed topics"
              icon={Brain}
              title="Missed topics"
            >
              <BarList points={analytics.missedTopics} tone="rose" emptyLabel="No missed topics yet" />
            </AnalyticsCard>
            <AnalyticsCard
              description="Time spent per interview"
              icon={Clock}
              title="Time spent"
            >
              <SparklineChart points={analytics.timeSpentTrend} suffix="m" tone="emerald" />
            </AnalyticsCard>
            <AnalyticsCard
              description="AI interviewer type breakdown"
              icon={Bot}
              title="Interviewer types"
            >
              <BarList points={analytics.interviewerBreakdown} />
            </AnalyticsCard>
            <AnalyticsCard
              description="Resume skill coverage"
              icon={BriefcaseBusiness}
              title="Skill coverage"
            >
              <BarList points={analytics.skillCoverage} tone="emerald" emptyLabel="No skills practiced yet" />
            </AnalyticsCard>
            <AnalyticsCard
              description="Behavioral vs technical performance"
              icon={BarChart3}
              title="Performance split"
            >
              <BarList points={analytics.behavioralVsTechnical} tone="amber" />
            </AnalyticsCard>
            <AnalyticsCard
              description="Hiring recommendation trend"
              icon={BriefcaseBusiness}
              title="Hiring signal"
            >
              <RecommendationTrend items={analytics.hiringTrend} />
            </AnalyticsCard>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
          <section className="surface-hover rounded-lg border bg-card p-6 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-sky-100 text-sky-700">
                <PlusCircle className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-lg font-semibold">Create interview</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Choose the role, level, type, and stack you want to practice.
                </p>
              </div>
            </div>
            <div className="mt-6">
              <CreateInterviewForm action={createInterviewAction} />
            </div>
          </section>

          <section>
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Previous interviews</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {interviews.length} saved session
                  {interviews.length === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <InterviewList interviews={interviews} />
          </section>
        </div>
      </section>
    </main>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
}) {
  return (
    <div className="min-w-24 rounded-lg border bg-background p-3">
      <Icon className="mx-auto h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <p className="mt-2 text-xl font-semibold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}

function AnalyticsCard({
  children,
  description,
  icon: Icon,
  title,
}: {
  children: ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <article className="surface-hover rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border bg-background text-sky-700">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4">{children}</div>
    </article>
  );
}

function SparklineChart({
  points,
  suffix = "",
  tone = "sky",
}: {
  points: ChartPoint[];
  suffix?: string;
  tone?: "amber" | "emerald" | "rose" | "sky";
}) {
  const strokeClass = {
    amber: "stroke-amber-500",
    emerald: "stroke-emerald-500",
    rose: "stroke-rose-500",
    sky: "stroke-sky-500",
  }[tone];
  const fillClass = {
    amber: "fill-amber-500",
    emerald: "fill-emerald-500",
    rose: "fill-rose-500",
    sky: "fill-sky-500",
  }[tone];

  if (points.length === 0) {
    return <EmptyAnalytics label="No scored interviews yet" />;
  }

  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(max - min, 1);
  const coordinates = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 88 - ((point.value - min) / range) * 72;

    return { ...point, x, y };
  });
  const path = coordinates
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const latest = points[points.length - 1];

  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold">
            {latest.value}
            {suffix}
          </p>
          <p className="text-xs text-muted-foreground">Latest {latest.label}</p>
        </div>
        <p className="text-xs text-muted-foreground">
          {points.length} point{points.length === 1 ? "" : "s"}
        </p>
      </div>
      <svg className="mt-3 h-28 w-full overflow-visible" viewBox="0 0 100 100" role="img">
        <path
          className="stroke-muted"
          d="M 0 88 L 100 88"
          fill="none"
          strokeDasharray="3 4"
          strokeWidth="1"
        />
        <path className={strokeClass} d={path} fill="none" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        {coordinates.map((point) => (
          <circle className={fillClass} cx={point.x} cy={point.y} key={`${point.label}-${point.value}`} r="2.4" />
        ))}
      </svg>
    </div>
  );
}

function BarList({
  emptyLabel = "No data yet",
  points,
  tone = "sky",
}: {
  emptyLabel?: string;
  points: BarPoint[];
  tone?: "amber" | "emerald" | "rose" | "sky";
}) {
  const barClass = {
    amber: "bg-amber-500",
    emerald: "bg-emerald-500",
    rose: "bg-rose-500",
    sky: "bg-sky-500",
  }[tone];
  const max = Math.max(...points.map((point) => point.value), 1);

  if (points.length === 0) {
    return <EmptyAnalytics label={emptyLabel} />;
  }

  return (
    <div className="space-y-3">
      {points.slice(0, 6).map((point) => (
        <div key={point.label}>
          <div className="flex items-center justify-between gap-3 text-xs">
            <p className="truncate font-medium">{point.label}</p>
            <p className="text-muted-foreground">{point.value}</p>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
            <div
              className={`h-full rounded-full ${barClass}`}
              style={{ width: `${Math.max(8, (point.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationTrend({
  items,
}: {
  items: Array<{ label: string; value: string }>;
}) {
  if (items.length === 0) {
    return <EmptyAnalytics label="No recommendations yet" />;
  }

  return (
    <ol className="space-y-3">
      {items.map((item) => (
        <li className="rounded-md border bg-background p-3" key={`${item.label}-${item.value}`}>
          <p className="text-xs font-medium text-primary">{item.label}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.value}</p>
        </li>
      ))}
    </ol>
  );
}

function EmptyAnalytics({ label }: { label: string }) {
  return (
    <div className="rounded-md border border-dashed bg-background p-4 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function formatDelta(value: number | null) {
  if (value === null) {
    return "-";
  }

  if (value > 0) {
    return `+${value}`;
  }

  return value;
}
