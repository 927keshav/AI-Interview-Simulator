"use client";

import { ClipboardList } from "lucide-react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { InterviewActionState } from "@/features/interviews/actions";
import {
  experienceOptions,
  interviewerModeOptions,
  interviewTypeOptions,
  roleOptions,
} from "@/features/interviews/constants";

type CreateInterviewFormProps = {
  action: (
    previousState: InterviewActionState,
    formData: FormData,
  ) => Promise<InterviewActionState>;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button className="w-full" disabled={pending} type="submit">
      <ClipboardList className="h-4 w-4" aria-hidden="true" />
      {pending ? "Creating..." : "Create interview"}
    </Button>
  );
}

export function CreateInterviewForm({ action }: CreateInterviewFormProps) {
  const [state, formAction] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="role">
            Role
          </label>
          <select
            className="field-hover h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="role"
            name="role"
            required
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="experienceLevel">
            Experience
          </label>
          <select
            className="field-hover h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="experienceLevel"
            name="experienceLevel"
            required
          >
            {experienceOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="type">
          Interview type
        </label>
        <select
          className="field-hover h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="type"
          name="type"
          required
        >
          {interviewTypeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="interviewerMode">
          Interviewer personality
        </label>
        <select
          className="field-hover h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="interviewerMode"
          name="interviewerMode"
          required
        >
          {interviewerModeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Controls tone, depth, pacing, and follow-up pressure.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="technologyStack">
          Technology stack
        </label>
        <input
          className="field-hover h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="technologyStack"
          name="technologyStack"
          placeholder="React, TypeScript, PostgreSQL"
          required
          type="text"
        />
        <p className="text-xs text-muted-foreground">
          Separate technologies with commas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="targetQuestionCount">
            Question target
          </label>
          <input
            className="field-hover h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={5}
            id="targetQuestionCount"
            max={10}
            min={3}
            name="targetQuestionCount"
            required
            type="number"
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="timeLimitMinutes">
            Time limit
          </label>
          <input
            className="field-hover h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            defaultValue={30}
            id="timeLimitMinutes"
            max={120}
            min={5}
            name="timeLimitMinutes"
            required
            type="number"
          />
        </div>
      </div>

      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
