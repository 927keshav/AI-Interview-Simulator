"use client";

import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { InterviewActionState } from "@/features/interviews/actions";
import { generateQuestionsAction } from "@/features/interviews/actions";

type GenerateQuestionsButtonProps = {
  interviewId: string;
  disabled: boolean;
};

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} type="submit">
      <Sparkles className="h-4 w-4" aria-hidden="true" />
      {pending ? "Generating..." : "Generate AI questions"}
    </Button>
  );
}

export function GenerateQuestionsButton({
  interviewId,
  disabled,
}: GenerateQuestionsButtonProps) {
  const router = useRouter();
  const action = generateQuestionsAction.bind(null, interviewId);
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
