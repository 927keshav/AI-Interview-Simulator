import { z } from "zod";

import {
  evaluateMockInterviewAnswers,
  type InterviewEvaluationInput,
  type InterviewEvaluationResult,
} from "@/services/openai/mock-interview-evaluator";
import {
  formatInterviewValue,
  interviewerModeProfiles,
} from "@/features/interviews/constants";

const evaluationSchema = z.object({
  score: z.number().int().min(1).max(100),
  correctness: z.number().int().min(1).max(100),
  communication: z.number().int().min(1).max(100),
  confidence: z.number().int().min(1).max(100),
  hiringRecommendation: z.string().min(5),
  technicalDepth: z.number().int().min(1).max(100),
  strengths: z.array(z.string().min(5)).min(3).max(5),
  weaknesses: z.array(z.string().min(5)).min(3).max(5),
  suggestions: z.array(z.string().min(5)).min(3).max(5),
});

type OpenAIResponsesApiResult = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

const responseJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "integer", minimum: 1, maximum: 100 },
    correctness: { type: "integer", minimum: 1, maximum: 100 },
    communication: { type: "integer", minimum: 1, maximum: 100 },
    confidence: { type: "integer", minimum: 1, maximum: 100 },
    hiringRecommendation: { type: "string", minLength: 5 },
    technicalDepth: { type: "integer", minimum: 1, maximum: 100 },
    strengths: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string", minLength: 5 },
    },
    weaknesses: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string", minLength: 5 },
    },
    suggestions: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string", minLength: 5 },
    },
  },
  required: [
    "score",
    "correctness",
    "communication",
    "confidence",
    "hiringRecommendation",
    "technicalDepth",
    "strengths",
    "weaknesses",
    "suggestions",
  ],
} as const;

function shouldUseMockAI() {
  return process.env.USE_MOCK_AI?.trim().replaceAll('"', "").toLowerCase() === "true";
}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey || apiKey === "replace-later-in-ai-phases") {
    if (shouldUseMockAI()) {
      return null;
    }

    throw new Error("OPENAI_API_KEY is missing. Add your OpenAI API key to .env.");
  }

  return {
    apiKey,
    model: process.env.OPENAI_MODEL ?? "gpt-5.4-mini",
  };
}

function buildEvaluationPrompt(interview: InterviewEvaluationInput) {
  const profile = interviewerModeProfiles[interview.interviewerMode];
  const answers = interview.questions
    .map(
      (question, index) =>
        [
          `Question ${index + 1}: ${question.prompt}`,
          `Answer ${index + 1}: ${question.answer}`,
        ].join("\n"),
    )
    .join("\n\n");

  return [
    "Evaluate this technical interview attempt.",
    `Role: ${formatInterviewValue(interview.role)}`,
    `Experience level: ${formatInterviewValue(interview.experienceLevel)}`,
    `Interview type: ${formatInterviewValue(interview.type)}`,
    `Interviewer personality: ${formatInterviewValue(interview.interviewerMode)}`,
    `Evaluation tone: ${profile.tone}`,
    `Expected communication style: ${profile.communicationStyle}`,
    `Expected technical depth: ${profile.technicalDepth}`,
    `Technology stack: ${interview.technologyStack.join(", ")}`,
    "",
    "Scoring guidance:",
    "- Score from 1 to 100.",
    "- Correctness measures technical accuracy.",
    "- Communication measures clarity and structure.",
    "- Confidence measures decisiveness and specificity in the transcript.",
    "- Technical depth measures tradeoffs, edge cases, and implementation detail.",
    "- Be fair for the candidate's experience level.",
    "- Include a concise hiring recommendation such as Strong hire, Leaning hire, Needs practice, or No hire, with brief rationale.",
    "- Apply the selected interviewer personality when deciding how strict, deep, and communication-focused the feedback should be.",
    "",
    answers,
  ].join("\n");
}

export async function evaluateInterviewAnswers(
  interview: InterviewEvaluationInput,
): Promise<InterviewEvaluationResult> {
  const config = getOpenAIConfig();

  if (!config) {
    return evaluateMockInterviewAnswers(interview);
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: config.model,
      input: [
        {
          role: "system",
          content:
            "You are a senior interview coach. Evaluate answers with practical, constructive, specific feedback.",
        },
        {
          role: "user",
          content: buildEvaluationPrompt(interview),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "interview_evaluation",
          strict: true,
          schema: responseJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (shouldUseMockAI()) {
      return evaluateMockInterviewAnswers(interview);
    }

    throw new Error(`OpenAI request failed: ${errorText}`);
  }

  const data = (await response.json()) as OpenAIResponsesApiResult;
  const outputText =
    data.output_text ??
    data.output
      ?.flatMap((item) => item.content ?? [])
      .map((content) => content.text)
      .filter((text): text is string => Boolean(text))
      .join("");

  if (!outputText) {
    throw new Error("OpenAI returned an empty evaluation response.");
  }

  return {
    ...evaluationSchema.parse(JSON.parse(outputText)),
    source: "openai",
  };
}
