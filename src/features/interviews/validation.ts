import {
  ExperienceLevel,
  InterviewerMode,
  InterviewRole,
  InterviewType,
} from "@prisma/client";
import { z } from "zod";

const commaSeparatedStackSchema = z
  .string()
  .min(2, "Add at least one technology.")
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.string()).min(1, "Add at least one technology."));

export const createInterviewSchema = z.object({
  role: z.nativeEnum(InterviewRole),
  experienceLevel: z.nativeEnum(ExperienceLevel),
  interviewerMode: z.nativeEnum(InterviewerMode),
  type: z.nativeEnum(InterviewType),
  technologyStack: commaSeparatedStackSchema,
  targetQuestionCount: z.coerce.number().int().min(3).max(10),
  timeLimitMinutes: z.coerce.number().int().min(5).max(120),
});

export const saveVoiceAnswerSchema = z.object({
  questionId: z.string().cuid("Invalid question id."),
  transcript: z
    .string()
    .trim()
    .min(5, "Record or type a longer answer before saving."),
});
