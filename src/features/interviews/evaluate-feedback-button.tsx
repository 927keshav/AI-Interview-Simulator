"use client";

import { BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { InterviewActionState } from "@/features/interviews/actions";
import { evaluateInterviewAction } from "@/features/interviews/actions";

type EvaluateFeedbackButtonProps = {
  disabled: boolean;
  interviewId: string;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} type="submit">
      <BarChart3 className="h-4 w-4" aria-hidden="true" />
      {pending ? "Evaluating..." : "Evaluate answers"}
    </Button>
  );
}

export function EvaluateFeedbackButton({
  disabled,
  interviewId,
}: EvaluateFeedbackButtonProps) {
  const router = useRouter();
  const action = evaluateInterviewAction.bind(null, interviewId);
  const [state, formAction] = useActionState<InterviewActionState, FormData>(
    action,
    {},
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [router, state.success]);

  return (
    <form action={formAction} className="space-y-3">
      <SubmitButton disabled={disabled} />
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {state.success}
        </p>
      ) : null}
    </form>
  );
}
