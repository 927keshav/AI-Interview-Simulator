"use client";

import type { Answer, Question } from "@prisma/client";
import { Mic, Save, Square, Volume2 } from "lucide-react";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import type { InterviewActionState } from "@/features/interviews/actions";
import { saveVoiceAnswerAction } from "@/features/interviews/actions";
import { useSpeechRecognition } from "@/features/voice/use-speech-recognition";
import { useTextToSpeech } from "@/features/voice/use-text-to-speech";
import { useVoiceStore } from "@/features/voice/voice-store";

type QuestionWithAnswers = Question & {
  answers: Answer[];
};

type VoicePracticePanelProps = {
  interviewId: string;
  questions: QuestionWithAnswers[];
};

function SaveButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button disabled={disabled || pending} type="submit" variant="secondary">
      <Save className="h-4 w-4" aria-hidden="true" />
      {pending ? "Saving..." : "Save answer"}
    </Button>
  );
}

export function VoicePracticePanel({
  interviewId,
  questions,
}: VoicePracticePanelProps) {
  const [selectedQuestionId, setSelectedQuestionId] = useState(
    questions[0]?.id ?? "",
  );
  const { error, status, transcript, setTranscript } = useVoiceStore();
  const { startListening, stopListening } = useSpeechRecognition();
  const { speak, stopSpeaking } = useTextToSpeech();
  const selectedQuestion = useMemo(
    () => questions.find((question) => question.id === selectedQuestionId),
    [questions, selectedQuestionId],
  );
  const action = saveVoiceAnswerAction.bind(null, interviewId);
  const [state, formAction] = useActionState<InterviewActionState, FormData>(
    action,
    {},
  );

  if (questions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm leading-6 text-muted-foreground">
        Generate questions first, then return here to practice with voice.
      </p>
    );
  }

  const isListening = status === "listening";
  const isSpeaking = status === "speaking";

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-[220px_1fr]">
        <label className="text-sm font-medium" htmlFor="questionId">
          Question
        </label>
        <select
          className="field-hover h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          id="questionId"
          name="questionId"
          onChange={(event) => {
            setSelectedQuestionId(event.target.value);
            setTranscript("");
          }}
          value={selectedQuestionId}
        >
          {questions.map((question) => (
            <option key={question.id} value={question.id}>
              Question {question.order}
            </option>
          ))}
        </select>
      </div>

      {selectedQuestion ? (
        <article className="surface-hover rounded-lg border bg-background p-5">
          <p className="text-xs font-medium uppercase text-primary">
            Question {selectedQuestion.order}
            {selectedQuestion.category ? ` · ${selectedQuestion.category}` : ""}
          </p>
          <h2 className="mt-2 text-lg font-semibold leading-8">
            {selectedQuestion.prompt}
          </h2>
          {selectedQuestion.answers[0] ? (
            <p className="mt-3 rounded-md border bg-card p-3 text-sm leading-6 text-muted-foreground">
              Saved answer: {selectedQuestion.answers[0].transcript}
            </p>
          ) : null}
        </article>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => selectedQuestion && speak(selectedQuestion.prompt)}
          type="button"
          variant="outline"
        >
          <Volume2 className="h-4 w-4" aria-hidden="true" />
          Speak question
        </Button>

        {isListening ? (
          <Button onClick={stopListening} type="button" variant="outline">
            <Square className="h-4 w-4" aria-hidden="true" />
            Stop listening
          </Button>
        ) : (
          <Button
            disabled={isSpeaking || status === "unsupported"}
            onClick={startListening}
            type="button"
          >
            <Mic className="h-4 w-4" aria-hidden="true" />
            Start answer
          </Button>
        )}

        {isSpeaking ? (
          <Button onClick={stopSpeaking} type="button" variant="ghost">
            Stop speech
          </Button>
        ) : null}
      </div>

      <form action={formAction} className="space-y-4">
        <input name="questionId" type="hidden" value={selectedQuestionId} />
        <div className="space-y-2">
          <label className="text-sm font-medium" htmlFor="transcript">
            Transcript
          </label>
          <textarea
            className="field-hover min-h-40 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="transcript"
            name="transcript"
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Your spoken answer will appear here. You can edit it before saving."
            value={transcript}
          />
        </div>

        {error ? (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

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

        <SaveButton disabled={!selectedQuestionId || transcript.trim().length < 5} />
      </form>
    </div>
  );
}
