import { z } from "zod";

import {
  formatInterviewValue,
  interviewerModeProfiles,
  type InterviewSetup,
} from "@/features/interviews/constants";
import { generateMockInterviewQuestions } from "@/services/openai/mock-interview-question-generator";

const generatedQuestionSchema = z.object({
  prompt: z.string().min(10),
  category: z.string().min(2),
});

const generatedQuestionsSchema = z.object({
  questions: z.array(generatedQuestionSchema).min(5).max(7),
});

type GeneratedQuestions = z.infer<typeof generatedQuestionsSchema>;

type QuestionGenerationResult = GeneratedQuestions & {
  source: "openai" | "mock";
};

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
    questions: {
      type: "array",
      minItems: 5,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          prompt: {
            type: "string",
            minLength: 10,
          },
          category: {
            type: "string",
            minLength: 2,
          },
        },
        required: ["prompt", "category"],
      },
    },
  },
  required: ["questions"],
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

function buildQuestionPrompt(interview: InterviewSetup) {
  const profile = interviewerModeProfiles[interview.interviewerMode];

  return [
    "Generate interview questions for this technical interview setup.",
    `Role: ${formatInterviewValue(interview.role)}`,
    `Experience level: ${formatInterviewValue(interview.experienceLevel)}`,
    `Interview type: ${formatInterviewValue(interview.type)}`,
    `Interviewer personality: ${formatInterviewValue(interview.interviewerMode)}`,
    `Tone: ${profile.tone}`,
    `Communication style: ${profile.communicationStyle}`,
    `Technical depth: ${profile.technicalDepth}`,
    `Pacing: ${profile.pacing}`,
    `Technology stack: ${interview.technologyStack.join(", ")}`,
    "",
    "Requirements:",
    "- Create 5 questions.",
    "- Questions should be realistic for a live technical interview.",
    "- Mix practical understanding, tradeoffs, and scenario-based thinking.",
    "- Do not include answers.",
    "- Keep each question concise and clear.",
  ].join("\n");
}

export async function generateInterviewQuestions(
  interview: InterviewSetup,
): Promise<QuestionGenerationResult> {
  const config = getOpenAIConfig();

  if (!config) {
    return {
      ...generatedQuestionsSchema.parse(generateMockInterviewQuestions(interview)),
      source: "mock",
    };
  }

  const { apiKey, model } = config;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content:
            "You are a senior technical interviewer. Generate fair, specific, role-appropriate interview questions that match the requested interviewer personality.",
        },
        {
          role: "user",
          content: buildQuestionPrompt(interview),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "interview_questions",
          strict: true,
          schema: responseJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();

    if (shouldUseMockAI()) {
      return {
        ...generatedQuestionsSchema.parse(generateMockInterviewQuestions(interview)),
        source: "mock",
      };
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
    throw new Error("OpenAI returned an empty question response.");
  }

  return {
    ...generatedQuestionsSchema.parse(JSON.parse(outputText)),
    source: "openai",
  };
}
