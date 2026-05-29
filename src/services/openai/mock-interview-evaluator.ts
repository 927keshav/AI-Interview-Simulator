import {
  formatInterviewValue,
  interviewerModeProfiles,
  type InterviewSetup,
} from "@/features/interviews/constants";

export type EvaluationQuestion = {
  prompt: string;
  answer: string;
};

export type InterviewEvaluationInput = InterviewSetup & {
  questions: EvaluationQuestion[];
};

export type InterviewEvaluationResult = {
  score: number;
  correctness: number;
  communication: number;
  confidence: number;
  hiringRecommendation: string;
  technicalDepth: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  source: "openai" | "mock";
};

function clampScore(score: number) {
  return Math.max(1, Math.min(100, Math.round(score)));
}

function includesAny(text: string, keywords: string[]) {
  const normalizedText = text.toLowerCase();

  return keywords.some((keyword) => normalizedText.includes(keyword.toLowerCase()));
}

function getWords(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function uniqueRatio(words: string[]) {
  return new Set(words).size / Math.max(words.length, 1);
}

function looksLikeGibberish(answer: string) {
  const words = getWords(answer);
  const longUnknownWords = words.filter(
    (word) => word.length > 14 && !word.includes(".") && !word.includes("#"),
  );
  const hasVeryFewWords = words.length < 5;
  const hasNoUsefulSeparators = !/[ .,;:!?]/.test(answer.trim());
  const hasLowVocabulary = uniqueRatio(words) < 0.45;

  return hasVeryFewWords || hasNoUsefulSeparators || longUnknownWords.length > 0 || hasLowVocabulary;
}

function countMatches(text: string, keywords: string[]) {
  const normalizedText = text.toLowerCase();

  return keywords.filter((keyword) => normalizedText.includes(keyword.toLowerCase())).length;
}

export function evaluateMockInterviewAnswers(
  interview: InterviewEvaluationInput,
): InterviewEvaluationResult {
  const answeredCount = interview.questions.length;
  const profile = interviewerModeProfiles[interview.interviewerMode];
  const allText = interview.questions
    .map((question) => `${question.prompt} ${question.answer}`)
    .join(" ");
  const combinedAnswers = interview.questions
    .map((question) => question.answer)
    .join(" ")
    .toLowerCase();
  const answerWords = getWords(combinedAnswers);
  const averageAnswerLength =
    interview.questions.reduce((total, question) => total + question.answer.length, 0) /
    Math.max(answeredCount, 1);
  const averageWordCount = answerWords.length / Math.max(answeredCount, 1);
  const stack = interview.technologyStack.join(", ");
  const gibberishAnswers = interview.questions.filter((question) =>
    looksLikeGibberish(question.answer),
  ).length;
  const gibberishRatio = gibberishAnswers / Math.max(answeredCount, 1);
  const mentionedStack = interview.technologyStack.some((technology) =>
    combinedAnswers.includes(technology.toLowerCase()),
  );
  const questionKeywords = getWords(allText).filter((word) => word.length > 4);
  const relevantKeywordMatches = countMatches(combinedAnswers, questionKeywords);
  const explainedProcess = includesAny(combinedAnswers, [
    "first",
    "then",
    "because",
    "tradeoff",
    "debug",
    "test",
    "measure",
  ]);
  const practicalExamples = includesAny(combinedAnswers, [
    "project",
    "production",
    "user",
    "team",
    "api",
    "database",
    "component",
  ]);
  const technicalTerms = countMatches(combinedAnswers, [
    "state",
    "props",
    "hook",
    "component",
    "render",
    "api",
    "database",
    "server",
    "client",
    "cache",
    "test",
    "debug",
    "performance",
    "security",
    "scalability",
  ]);
  const relevanceScore = Math.min(25, relevantKeywordMatches * 3 + (mentionedStack ? 8 : 0));
  const depthScore = Math.min(25, technicalTerms * 4 + (explainedProcess ? 5 : 0));
  const exampleScore = practicalExamples ? 15 : 0;
  const communicationScore = Math.min(
    20,
    averageWordCount * 0.8 + (explainedProcess ? 5 : 0),
  );
  const strictnessAdjustment =
    interview.interviewerMode === "STRICT_SENIOR" || interview.interviewerMode === "FAANG"
      ? -8
      : interview.interviewerMode === "FRIENDLY"
      ? 5
      : interview.interviewerMode === "BEHAVIORAL"
      ? practicalExamples
        ? 4
        : -6
      : 0;
  const baseScore =
    gibberishRatio >= 0.5
      ? 18
      : 20 +
        relevanceScore +
        depthScore +
        exampleScore +
        communicationScore +
        strictnessAdjustment;
  const strengths =
    gibberishRatio >= 0.5
      ? [
          "You attempted the question and created a transcript to review.",
          "The answer can now be improved because the weak response is visible.",
          "You have a clear opportunity to practice giving structured technical answers.",
        ]
      : [
          mentionedStack
            ? `You connected your answer to the target stack: ${stack}.`
            : "You stayed close enough to the question topic to build a better answer.",
          explainedProcess
            ? "You showed some reasoning structure, which helps interviewers follow your thinking."
            : "Your answer was concise, which can be useful once paired with stronger technical detail.",
          interview.interviewerMode === "BEHAVIORAL" && practicalExamples
            ? "You gave practical context that supports a behavioral-style answer."
            : practicalExamples
            ? "You included practical context, making the answer feel closer to real engineering work."
            : "You identified a starting point for the answer, but it needs more evidence and detail.",
        ];
  const weaknesses =
    gibberishRatio >= 0.5
      ? [
          "The answer does not contain meaningful technical content related to the question.",
          "The transcript appears random or incomplete, so correctness and depth cannot be evaluated well.",
          "The response does not mention the selected stack, implementation details, or reasoning.",
        ]
      : [
          mentionedStack
            ? "The answer should connect the stack to a clearer implementation example."
            : `The answer should explicitly reference the target stack: ${stack}.`,
          explainedProcess
            ? "The reasoning could go deeper into tradeoffs, edge cases, and alternatives."
            : "The response needs a clearer step-by-step explanation of what you would do and why.",
          practicalExamples
            ? "The example would be stronger with measurable impact or a concrete outcome."
            : "The answer needs a practical example from a project, production issue, or realistic scenario.",
          `For this ${profile.tone} mode, the response should better match a ${profile.communicationStyle} style.`,
        ];
  const suggestions =
    gibberishRatio >= 0.5
      ? [
          "Re-answer using 3 parts: concept, example, and tradeoff.",
          `Mention at least one relevant technology from this stack: ${stack}.`,
          "Use complete sentences and explain what you would do first, then why.",
        ]
      : [
          "Add a concrete example that shows how you applied the concept in a real or realistic project.",
          "Explain one tradeoff or alternative approach to show deeper technical judgment.",
          "End with a short summary sentence that directly answers the interview question.",
        ];

  return {
    score: clampScore(baseScore),
    correctness: clampScore(gibberishRatio >= 0.5 ? 15 : baseScore - 5),
    communication: clampScore(gibberishRatio >= 0.5 ? 22 : baseScore + 2),
    confidence: clampScore(gibberishRatio >= 0.5 ? 18 : baseScore - 3),
    hiringRecommendation:
      baseScore >= 80
        ? "Strong hire for this level."
        : baseScore >= 65
        ? "Leaning hire with targeted improvement areas."
        : baseScore >= 45
        ? "Needs more practice before hire-level performance."
        : "No hire based on the current interview answers.",
    technicalDepth: clampScore(gibberishRatio >= 0.5 ? 12 : baseScore - 2),
    strengths,
    weaknesses,
    suggestions,
    source: "mock",
  };
}
