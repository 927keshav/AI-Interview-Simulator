"use client";

import { ArrowRight, CheckCircle2, Mic, Save, Square, Volume2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
  useTransition,
} from "react";

import { Button } from "@/components/ui/button";
import {
  formatInterviewValue,
  interviewerModeProfiles,
} from "@/features/interviews/constants";
import {
  completeConversationInterviewAction,
  submitConversationAnswerAction,
} from "@/features/interviews/actions";
import {
  initialInterviewFlowSnapshot,
  interviewFlowReducer,
} from "@/features/interviews/interview-flow-machine";
import { useSpeechRecognition } from "@/features/voice/use-speech-recognition";
import { useTextToSpeech } from "@/features/voice/use-text-to-speech";
import { useVoiceStore } from "@/features/voice/voice-store";

type ConversationQuestion = {
  category: string | null;
  id: string;
  isFollowUp: boolean;
  order: number;
  parentQuestionId: string | null;
  prompt: string;
};

type ConversationalInterviewPanelProps = {
  completionScore: number;
  interviewId: string;
  interviewerMode: keyof typeof interviewerModeProfiles;
  primaryQuestions: ConversationQuestion[];
  startedAt: string;
  targetQuestionCount: number;
  timeLimitMinutes: number;
};

function getInitialQuestionIndex(questions: ConversationQuestion[]) {
  return questions.length > 0 ? 0 : -1;
}

export function ConversationalInterviewPanel({
  completionScore,
  interviewId,
  interviewerMode,
  primaryQuestions,
  startedAt,
  targetQuestionCount,
  timeLimitMinutes,
}: ConversationalInterviewPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [flow, dispatchFlow] = useReducer(
    interviewFlowReducer,
    initialInterviewFlowSnapshot,
  );
  const [primaryIndex, setPrimaryIndex] = useState(
    getInitialQuestionIndex(primaryQuestions),
  );
  const [currentQuestion, setCurrentQuestion] = useState<
    ConversationQuestion | null
  >(primaryQuestions[0] ?? null);
  const [message, setMessage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [liveCompletionScore, setLiveCompletionScore] = useState(completionScore);
  const [remainingSeconds, setRemainingSeconds] = useState(() =>
    Math.max(
      0,
      Math.ceil(
        (new Date(startedAt).getTime() + timeLimitMinutes * 60000 - Date.now()) /
          1000,
      ),
    ),
  );
  const { error, status, transcript, setError, setTranscript } = useVoiceStore();
  const { startListening, stopListening } = useSpeechRecognition();
  const { speak, stopSpeaking } = useTextToSpeech();
  const interviewerProfile = interviewerModeProfiles[interviewerMode];
  const progressText = useMemo(() => {
    if (primaryIndex < 0) {
      return "No questions";
    }

    return `Primary question ${primaryIndex + 1} of ${primaryQuestions.length}`;
  }, [primaryIndex, primaryQuestions.length]);

  const flowLabel = flow.state.replaceAll("_", " ");
  const answeredPrimaryCount = Math.round(
    (liveCompletionScore / 100) * Math.max(targetQuestionCount, 1),
  );
  const remainingTimeLabel = `${Math.floor(remainingSeconds / 60)}:${String(
    remainingSeconds % 60,
  ).padStart(2, "0")}`;

  function getPacingDelay() {
    if (interviewerProfile.pacing === "fast") {
      return 200;
    }

    if (interviewerProfile.pacing === "slow") {
      return 1200;
    }

    return 700;
  }

  async function waitForPacing() {
    await new Promise((resolve) => {
      window.setTimeout(resolve, getPacingDelay());
    });
  }

  useEffect(() => {
    if (!currentQuestion) {
      return;
    }

    dispatchFlow({
      type: currentQuestion.isFollowUp ? "ASK_FOLLOWUP" : "ASK_PRIMARY",
    });
    setTranscript("");
    setError(null);
    void speak(currentQuestion.prompt);
  }, [currentQuestion, setError, setTranscript, speak]);

  const completeInterview = useCallback((statusMessage: string) => {
    setIsCompleting(true);
    stopListening();
    stopSpeaking();
    dispatchFlow({ type: "EVALUATE" });
    setMessage(statusMessage);
    startTransition(async () => {
      const result = await completeConversationInterviewAction(interviewId);

      if (result.error) {
        dispatchFlow({ message: result.error, type: "FAIL" });
        setMessage(result.error);
        setIsCompleting(false);
        return;
      }

      dispatchFlow({ type: "COMPLETE" });
      setMessage("Interview completed. Opening final report...");
      router.push(`/interviews/${interviewId}`);
    });
  }, [interviewId, router, startTransition, stopListening, stopSpeaking]);

  useEffect(() => {
    if (isCompleting) {
      return;
    }

    const deadline = new Date(startedAt).getTime() + timeLimitMinutes * 60000;
    const timer = window.setInterval(() => {
      const nextRemainingSeconds = Math.max(
        0,
        Math.ceil((deadline - Date.now()) / 1000),
      );

      setRemainingSeconds(nextRemainingSeconds);

      if (nextRemainingSeconds === 0) {
        window.clearInterval(timer);
        completeInterview("Time limit reached. Completing the interview...");
      }
    }, 1000);

    return () => window.clearInterval(timer);
  }, [completeInterview, isCompleting, startedAt, timeLimitMinutes]);

  function moveToNextPrimary() {
    const nextIndex = primaryIndex + 1;
    const nextQuestion = primaryQuestions[nextIndex];

    if (nextQuestion) {
      dispatchFlow({ type: "MOVE_NEXT" });
      void waitForPacing().then(() => {
      setPrimaryIndex(nextIndex);
      setCurrentQuestion(nextQuestion);
      setAnalysis(null);
      setMessage(null);
      });
      return;
    }

    completeInterview("Question target reached. Generating final report...");
  }

  function submitAnswer() {
    if (!currentQuestion || transcript.trim().length < 5) {
      dispatchFlow({ message: "Add a longer answer before continuing.", type: "FAIL" });
      setMessage("Add a longer answer before continuing.");
      return;
    }

    stopListening();
    stopSpeaking();
    dispatchFlow({ type: "SUBMIT_ANSWER" });
    setMessage("Saving answer...");

    startTransition(async () => {
      const result = await submitConversationAnswerAction(
        interviewId,
        currentQuestion.id,
        transcript.trim(),
      );

      if (result.error) {
        dispatchFlow({ message: result.error, type: "FAIL" });
        setMessage(result.error);
        return;
      }

      if (result.analysis) {
        setAnalysis(result.analysis);
      }

      if (result.completion) {
        setLiveCompletionScore(result.completion.completionScore);

        if (result.completion.shouldComplete) {
          dispatchFlow({ type: "COMPLETE" });
          setMessage("Interview completed. Opening final report...");
          router.push(`/interviews/${interviewId}`);
          return;
        }
      }

      if (result.followUp) {
        dispatchFlow({ type: "GENERATE_FOLLOWUP" });
        setMessage(
          result.followUp.isFollowUp
            ? "Answer saved. Asking a deeper contextual follow-up."
            : "Answer saved. Asking a contextual follow-up.",
        );
        await waitForPacing();
        setCurrentQuestion(result.followUp);
        return;
      }

      setMessage("Answer saved. Moving to the next question.");
      moveToNextPrimary();
    });
  }

  if (!currentQuestion) {
    return (
      <div className="rounded-lg border border-dashed bg-card p-8 text-center">
        <h2 className="text-lg font-semibold">No questions available</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Generate interview questions before starting the conversational flow.
        </p>
      </div>
    );
  }

  const isListening = status === "listening";
  const isSpeaking = status === "speaking";
  const isBusy =
    isPending ||
    flow.state === "processing_answer" ||
    flow.state === "generating_followup" ||
    flow.state === "evaluating";

  return (
    <div className="space-y-6">
      <section className="surface-hover rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <p className="text-sm font-medium text-primary">{progressText}</p>
            <h2 className="mt-2 text-2xl font-semibold">
              {currentQuestion.isFollowUp ? "Follow-up question" : "Primary question"}
            </h2>
            <p className="mt-3 max-w-3xl text-lg leading-8">
              {currentQuestion.prompt}
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-md bg-secondary px-3 py-1 text-sm font-medium text-secondary-foreground">
            {currentQuestion.category ?? "Interview"}
          </span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <p className="inline-flex rounded-md border bg-background px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
            State: {flowLabel}
          </p>
          <p className="inline-flex rounded-md border bg-background px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
            Mode: {formatInterviewValue(interviewerMode)}
          </p>
          <p className="inline-flex rounded-md border bg-background px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
            Depth: {interviewerProfile.technicalDepth}
          </p>
          <p className="inline-flex rounded-md border bg-background px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
            Pacing: {interviewerProfile.pacing}
          </p>
          <p className="inline-flex rounded-md border bg-background px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
            Completion: {liveCompletionScore}%
          </p>
          <p className="inline-flex rounded-md border bg-background px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
            Answered: {answeredPrimaryCount}/{targetQuestionCount}
          </p>
          <p className="inline-flex rounded-md border bg-background px-3 py-1 text-xs font-medium uppercase text-muted-foreground">
            Time left: {remainingTimeLabel}
          </p>
        </div>

        {analysis ? (
          <p className="mt-4 rounded-md border bg-background p-3 text-sm leading-6 text-muted-foreground">
            {analysis}
          </p>
        ) : null}
      </section>

      <section className="surface-hover rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={() => speak(currentQuestion.prompt)}
            type="button"
            variant="outline"
          >
            <Volume2 className="h-4 w-4" aria-hidden="true" />
            Repeat question
          </Button>

          {isListening ? (
            <Button
              onClick={() => {
                stopListening();
                dispatchFlow({ type: "STOP_LISTENING" });
              }}
              type="button"
              variant="outline"
            >
              <Square className="h-4 w-4" aria-hidden="true" />
              Stop listening
            </Button>
          ) : (
            <Button
              disabled={isSpeaking || status === "unsupported" || isBusy}
              onClick={() => {
                dispatchFlow({ type: "START_LISTENING" });
                startListening();
              }}
              type="button"
            >
              <Mic className="h-4 w-4" aria-hidden="true" />
              Answer by voice
            </Button>
          )}
        </div>

        <div className="mt-5 space-y-2">
          <label className="text-sm font-medium" htmlFor="conversationTranscript">
            Your answer
          </label>
          <textarea
            className="field-hover min-h-44 w-full rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            id="conversationTranscript"
            onChange={(event) => setTranscript(event.target.value)}
            placeholder="Speak or type your answer here. It saves as soon as you continue."
            value={transcript}
          />
        </div>

        {error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="mt-3 rounded-md border bg-background px-3 py-2 text-sm text-muted-foreground">
            {message}
          </p>
        ) : null}

        {flow.error ? (
          <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {flow.error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            disabled={isBusy || isCompleting || transcript.trim().length < 5}
            onClick={submitAnswer}
            type="button"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Save and continue
          </Button>

          <Button
            disabled={isBusy || isCompleting}
            onClick={moveToNextPrimary}
            type="button"
            variant="ghost"
          >
            Skip to next
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Button>

          {isCompleting ? (
            <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              Ending interview automatically
            </span>
          ) : null}
        </div>
      </section>
    </div>
  );
}
