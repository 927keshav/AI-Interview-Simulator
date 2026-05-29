import { z } from "zod";

import {
  generateMockFollowUp,
  type FollowUpGenerationInput,
  type FollowUpGenerationResult,
} from "@/services/openai/mock-follow-up-generator";
import {
  formatInterviewValue,
  interviewerModeProfiles,
} from "@/features/interviews/constants";

const followUpSchema = z.object({
  analysis: z.string().min(10),
  difficulty: z.enum(["deeper", "foundational", "practical"]),
  followUpPrompt: z.string().min(10),
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
    analysis: {
      type: "string",
      minLength: 10,
    },
    followUpPrompt: {
      type: "string",
      minLength: 10,
    },
    difficulty: {
      type: "string",
      enum: ["deeper", "foundational", "practical"],
    },
  },
  required: ["analysis", "followUpPrompt", "difficulty"],
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

function buildPrompt(input: FollowUpGenerationInput) {
  const profile = interviewerModeProfiles[input.interviewerMode];
  const previousTurns = input.previousTurns
    .map(
      (turn, index) =>
        [`Previous Q${index + 1}: ${turn.question}`, `Previous A${index + 1}: ${turn.answer}`].join(
          "\n",
        ),
    )
    .join("\n\n");

  return [
    "Analyze the candidate answer and generate one contextual follow-up question.",
    `Role: ${formatInterviewValue(input.role)}`,
    `Experience level: ${formatInterviewValue(input.experienceLevel)}`,
    `Interview type: ${formatInterviewValue(input.type)}`,
    `Interviewer personality: ${formatInterviewValue(input.interviewerMode)}`,
    `Tone: ${profile.tone}`,
    `Communication style: ${profile.communicationStyle}`,
    `Follow-up aggressiveness: ${profile.followUpAggressiveness}`,
    `Technical depth: ${profile.technicalDepth}`,
    `Pacing: ${profile.pacing}`,
    `Technology stack: ${input.technologyStack.join(", ")}`,
    `Current follow-up depth for this primary question: ${input.currentDepth}`,
    "",
    previousTurns ? `Conversation context:\n${previousTurns}` : "Conversation context: none yet",
    "",
    `Primary question: ${input.question}`,
    `Candidate answer: ${input.answer}`,
    "",
    "Requirements:",
    "- Keep the analysis short and constructive.",
    "- Ask exactly one follow-up question.",
    "- Use the candidate's actual words and concepts.",
    "- If the answer is vague, ask for specificity, examples, or reasoning.",
    "- If the answer is solid, increase depth with tradeoffs, edge cases, performance, testing, debugging, or architecture.",
    "- Adapt difficulty to the answer and experience level.",
    "- Match the requested personality's tone, aggressiveness, depth, pacing, and communication style.",
    "- For React state answers, ask when useReducer is preferable over useState when relevant.",
    "- Do not include an answer.",
  ].join("\n");
}

export async function generateFollowUpQuestion(
  input: FollowUpGenerationInput,
): Promise<FollowUpGenerationResult> {
  const config = getOpenAIConfig();

  if (!config) {
    return generateMockFollowUp(input);
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
            "You are a senior technical interviewer who asks concise, contextual follow-up questions.",
        },
        {
          role: "user",
          content: buildPrompt(input),
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "interview_follow_up",
          strict: true,
          schema: responseJsonSchema,
        },
      },
    }),
  });

  if (!response.ok) {
    if (shouldUseMockAI()) {
      return generateMockFollowUp(input);
    }

    throw new Error(`OpenAI request failed: ${await response.text()}`);
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
    throw new Error("OpenAI returned an empty follow-up response.");
  }

  return {
    ...followUpSchema.parse(JSON.parse(outputText)),
    source: "openai",
  };
}
