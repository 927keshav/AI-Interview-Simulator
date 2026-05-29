import type {
  ExperienceLevel,
  InterviewRole,
  InterviewType,
} from "@prisma/client";

export type InterviewerMode =
  | "FRIENDLY"
  | "FAANG"
  | "STARTUP_FOUNDER"
  | "STRICT_SENIOR"
  | "BEHAVIORAL";

export type InterviewSetup = {
  role: InterviewRole;
  experienceLevel: ExperienceLevel;
  interviewerMode: InterviewerMode;
  type: InterviewType;
  technologyStack: string[];
};

export const roleOptions: Array<{ label: string; value: InterviewRole }> = [
  { label: "Frontend", value: "FRONTEND" },
  { label: "Backend", value: "BACKEND" },
  { label: "Full Stack", value: "FULL_STACK" },
  { label: "DevOps", value: "DEVOPS" },
  { label: "Data Scientist", value: "DATA_SCIENTIST" },
  { label: "Mobile", value: "MOBILE" },
  { label: "QA Engineer", value: "QA_ENGINEER" },
];

export const experienceOptions: Array<{
  label: string;
  value: ExperienceLevel;
}> = [
  { label: "Intern", value: "INTERN" },
  { label: "Junior", value: "JUNIOR" },
  { label: "Mid Level", value: "MID_LEVEL" },
  { label: "Senior", value: "SENIOR" },
];

export const interviewTypeOptions: Array<{
  label: string;
  value: InterviewType;
}> = [
  { label: "Behavioral", value: "BEHAVIORAL" },
  { label: "Technical", value: "TECHNICAL" },
  { label: "System Design", value: "SYSTEM_DESIGN" },
  { label: "Mixed", value: "MIXED" },
];

export const interviewerModeOptions: Array<{
  description: string;
  label: string;
  value: InterviewerMode;
}> = [
  {
    description: "Encouraging, patient, and coaching-oriented.",
    label: "Friendly",
    value: "FRIENDLY",
  },
  {
    description: "Structured, precise, and bar-raiser style.",
    label: "FAANG-style",
    value: "FAANG",
  },
  {
    description: "Fast-moving, product-minded, and pragmatic.",
    label: "Startup founder",
    value: "STARTUP_FOUNDER",
  },
  {
    description: "Direct, rigorous, and technically demanding.",
    label: "Strict senior engineer",
    value: "STRICT_SENIOR",
  },
  {
    description: "STAR-focused, communication-heavy, and reflective.",
    label: "Behavioral interviewer",
    value: "BEHAVIORAL",
  },
];

export const interviewerModeProfiles: Record<
  InterviewerMode,
  {
    communicationStyle: string;
    followUpAggressiveness: "low" | "medium" | "high";
    pacing: "slow" | "balanced" | "fast";
    technicalDepth: "light" | "medium" | "deep";
    tone: string;
  }
> = {
  FRIENDLY: {
    communicationStyle: "warm, encouraging, and explanatory",
    followUpAggressiveness: "low",
    pacing: "slow",
    technicalDepth: "medium",
    tone: "supportive coach",
  },
  FAANG: {
    communicationStyle: "structured, precise, rubric-driven, and concise",
    followUpAggressiveness: "high",
    pacing: "balanced",
    technicalDepth: "deep",
    tone: "calm bar-raiser",
  },
  STARTUP_FOUNDER: {
    communicationStyle: "pragmatic, product-focused, and outcome-oriented",
    followUpAggressiveness: "medium",
    pacing: "fast",
    technicalDepth: "medium",
    tone: "curious founder",
  },
  STRICT_SENIOR: {
    communicationStyle: "direct, skeptical, and implementation-focused",
    followUpAggressiveness: "high",
    pacing: "fast",
    technicalDepth: "deep",
    tone: "strict senior engineer",
  },
  BEHAVIORAL: {
    communicationStyle: "reflective, scenario-based, and STAR-focused",
    followUpAggressiveness: "medium",
    pacing: "balanced",
    technicalDepth: "light",
    tone: "behavioral interviewer",
  },
};

export function formatInterviewValue(value: string | null | undefined) {
  if (!value) {
    return "Unknown";
  }

  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
