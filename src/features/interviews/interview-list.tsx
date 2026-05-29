import type { Interview } from "@prisma/client";
import { ArrowRight, CalendarDays, CheckCircle2, CircleDashed } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { formatInterviewValue } from "@/features/interviews/constants";

type InterviewListProps = {
  interviews: Interview[];
};

export function InterviewList({ interviews }: InterviewListProps) {
  if (interviews.length === 0) {
    return (
      <div className="surface-hover rounded-lg border border-dashed bg-card p-8 text-center shadow-sm">
        <CircleDashed className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h3 className="mt-3 font-semibold">No interviews yet</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Create your first interview setup. In later phases, AI will generate
          questions and guide the voice interview.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {interviews.map((interview) => (
        <article
          className="surface-hover flex flex-col justify-between gap-4 rounded-lg border bg-card p-5 shadow-sm sm:flex-row sm:items-center"
          key={interview.id}
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{interview.title}</h3>
              <span className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
                {interview.status === "COMPLETED" ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <CircleDashed className="h-3 w-3" aria-hidden="true" />
                )}
                {formatInterviewValue(interview.status)}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {formatInterviewValue(interview.experienceLevel)} ·{" "}
              {formatInterviewValue(interview.type)} ·{" "}
              {interview.technologyStack.join(", ")}
            </p>
            <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              Created {interview.createdAt.toLocaleDateString()}
            </p>
            {interview.overallScore !== null ? (
              <p className="mt-2 text-sm font-medium text-emerald-700">
                Score {interview.overallScore}/100
              </p>
            ) : null}
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href={`/interviews/${interview.id}`}>
              View report
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </article>
      ))}
    </div>
  );
}
