import {
  formatInterviewValue,
  interviewerModeProfiles,
  type InterviewSetup,
} from "@/features/interviews/constants";

export type FollowUpGenerationInput = InterviewSetup & {
  question: string;
  answer: string;
  currentDepth: number;
  previousTurns: Array<{
    question: string;
    answer: string;
  }>;
};

export type FollowUpGenerationResult = {
  analysis: string;
  difficulty: "deeper" | "foundational" | "practical";
  followUpPrompt: string;
  source: "openai" | "mock";
};

export function generateMockFollowUp(
  input: FollowUpGenerationInput,
): FollowUpGenerationResult {
  const role = formatInterviewValue(input.role);
  const profile = interviewerModeProfiles[input.interviewerMode];
  const stack = input.technologyStack[0] ?? "your stack";
  const answer = input.answer.toLowerCase();
  const isVague = input.answer.trim().split(/\s+/).length < 25;
  const mentionsReactHooks = answer.includes("react hook") || answer.includes("hooks");
  const mentionsState = answer.includes("state");
  const asksForExample =
    !answer.includes("example") && !answer.includes("project") && !answer.includes("production");
  const difficulty =
    profile.technicalDepth === "deep" && !isVague
      ? "deeper"
      : isVague
      ? "foundational"
      : input.currentDepth > 0
      ? "deeper"
      : "practical";
  const strictPrefix =
    input.interviewerMode === "STRICT_SENIOR"
      ? "Be specific: "
      : input.interviewerMode === "FRIENDLY"
      ? "Let's build on that: "
      : input.interviewerMode === "STARTUP_FOUNDER"
      ? "From a product impact angle, "
      : input.interviewerMode === "BEHAVIORAL"
      ? "Using a concrete situation, "
      : "";

  return {
    analysis:
      isVague
        ? "Your answer was saved, but it was broad. The next question asks you to be more specific."
        : "Your answer was saved. The next question probes the reasoning, tradeoffs, or implementation detail behind it.",
    difficulty,
    followUpPrompt: mentionsReactHooks && mentionsState
      ? `${strictPrefix}When would useReducer be preferable over useState, and what tradeoffs would you consider?`
      : asksForExample
      ? `${strictPrefix}Can you give a concrete project or production example where you applied that idea as a ${role}?`
      : isVague
      ? `${strictPrefix}Can you explain that more specifically, including what you would do first and why?`
      : `${strictPrefix}What tradeoffs, edge cases, or failure modes would you consider if you implemented this with ${stack}?`,
    source: "mock",
  };
}
