"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createInterviewSchema,
  saveVoiceAnswerSchema,
} from "@/features/interviews/validation";
import { formatInterviewValue } from "@/features/interviews/constants";
import { evaluateInterviewAnswers } from "@/services/openai/interview-evaluator";
import { generateFollowUpQuestion } from "@/services/openai/follow-up-generator";
import { generateInterviewQuestions } from "@/services/openai/interview-question-generator";

export type InterviewActionState = {
  error?: string;
  success?: string;
};

export type ConversationAnswerResult = {
  analysis?: string;
  completion?: {
    completionScore: number;
    reason: string;
    shouldComplete: boolean;
  };
  error?: string;
  followUp?: {
    id: string;
    prompt: string;
    order: number;
    category: string | null;
    isFollowUp: boolean;
    parentQuestionId: string | null;
  };
  success?: string;
};

const MAX_FOLLOW_UP_DEPTH = 2;

function getCompletionReasonLabel(reason: string) {
  const labels: Record<string, string> = {
    completion_score: "completion score reached 100%",
    difficulty_progression: "difficulty progression is complete",
    question_count: "question target reached",
    time_limit: "time limit reached",
  };

  return labels[reason] ?? reason;
}

function calculateCompletionScore(answeredPrimaryCount: number, targetQuestionCount: number) {
  return Math.min(
    100,
    Math.round((answeredPrimaryCount / Math.max(targetQuestionCount, 1)) * 100),
  );
}

function getMaxFollowUpDepth(interviewerMode: string) {
  if (interviewerMode === "FRIENDLY") {
    return 1;
  }

  if (interviewerMode === "FAANG" || interviewerMode === "STRICT_SENIOR") {
    return 3;
  }

  return MAX_FOLLOW_UP_DEPTH;
}

function buildInterviewerNotes(strengths: string[], weaknesses: string[], suggestions: string[]) {
  return [
    "Interviewer notes:",
    `Strength focus: ${strengths[0] ?? "No strength captured yet."}`,
    `Main concern: ${weaknesses[0] ?? "No concern captured yet."}`,
    `Next coaching step: ${suggestions[0] ?? "No suggestion captured yet."}`,
  ].join("\n");
}

export async function createInterviewAction(
  _previousState: InterviewActionState,
  formData: FormData,
): Promise<InterviewActionState> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const parsed = createInterviewSchema.safeParse({
    role: formData.get("role"),
    experienceLevel: formData.get("experienceLevel"),
    interviewerMode: formData.get("interviewerMode"),
    type: formData.get("type"),
    technologyStack: formData.get("technologyStack"),
    targetQuestionCount: formData.get("targetQuestionCount"),
    timeLimitMinutes: formData.get("timeLimitMinutes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid interview data." };
  }

  const {
    role,
    experienceLevel,
    interviewerMode,
    targetQuestionCount,
    timeLimitMinutes,
    type,
    technologyStack,
  } = parsed.data;
  const title = `${formatInterviewValue(role)} ${formatInterviewValue(type)} Interview`;

  const interview = await prisma.interview.create({
    data: {
      userId: session.user.id,
      role,
      experienceLevel,
      interviewerMode,
      targetQuestionCount,
      timeLimitMinutes,
      type,
      technologyStack,
      title,
    },
  });

  redirect(`/interviews/${interview.id}`);
}

export async function generateQuestionsAction(
  interviewId: string,
  _previousState: InterviewActionState,
  _formData: FormData,
): Promise<InterviewActionState> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
      userId: session.user.id,
    },
    include: {
      questions: true,
    },
  });

  if (!interview) {
    return { error: "Interview not found." };
  }

  if (interview.questions.length > 0) {
    return { error: "Questions have already been generated for this interview." };
  }

  try {
    const generated = await generateInterviewQuestions(interview);

    await prisma.question.createMany({
      data: generated.questions.map((question, index) => ({
        interviewId: interview.id,
        prompt: question.prompt,
        category: question.category,
        order: index + 1,
      })),
    });

    revalidatePath(`/interviews/${interview.id}`);
    revalidatePath(`/interviews/${interview.id}/live`);

    return {
      success:
        generated.source === "mock"
          ? "Mock questions generated successfully."
          : "AI questions generated successfully.",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate questions right now.";

    return { error: message };
  }
}

export async function saveVoiceAnswerAction(
  interviewId: string,
  _previousState: InterviewActionState,
  formData: FormData,
): Promise<InterviewActionState> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const parsed = saveVoiceAnswerSchema.safeParse({
    questionId: formData.get("questionId"),
    transcript: formData.get("transcript"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid answer data." };
  }

  const question = await prisma.question.findFirst({
    where: {
      id: parsed.data.questionId,
      interview: {
        id: interviewId,
        userId: session.user.id,
      },
    },
  });

  if (!question) {
    return { error: "Question not found." };
  }

  await prisma.answer.create({
    data: {
      questionId: question.id,
      transcript: parsed.data.transcript,
    },
  });

  revalidatePath(`/interviews/${interviewId}`);
  revalidatePath(`/interviews/${interviewId}/practice`);

  return { success: "Answer saved successfully." };
}

export async function evaluateInterviewAction(
  interviewId: string,
  _previousState: InterviewActionState,
  _formData: FormData,
): Promise<InterviewActionState> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
      userId: session.user.id,
    },
    include: {
      questions: {
        include: {
          answers: {
            orderBy: {
              answeredAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!interview) {
    return { error: "Interview not found." };
  }

  const answeredQuestions = interview.questions
    .map((question) => ({
      prompt: question.prompt,
      answer: question.answers[0]?.transcript,
    }))
    .filter(
      (question): question is { prompt: string; answer: string } =>
        Boolean(question.answer),
    );

  if (answeredQuestions.length === 0) {
    return { error: "Save at least one voice answer before evaluating." };
  }

  try {
    const evaluation = await evaluateInterviewAnswers({
      role: interview.role,
      experienceLevel: interview.experienceLevel,
      interviewerMode: interview.interviewerMode,
      type: interview.type,
      technologyStack: interview.technologyStack,
      questions: answeredQuestions,
    });

    await prisma.$transaction([
      prisma.feedback.upsert({
        where: {
          interviewId: interview.id,
        },
        update: {
          score: evaluation.score,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          suggestions: evaluation.suggestions,
          communication: evaluation.communication,
          technicalDepth: evaluation.technicalDepth,
          correctness: evaluation.correctness,
          confidence: evaluation.confidence,
          hiringRecommendation: evaluation.hiringRecommendation,
          metadata: {
            answeredQuestionCount: answeredQuestions.length,
            completionScore: interview.completionScore,
            evaluatorSource: evaluation.source,
            generatedAt: new Date().toISOString(),
            interviewerMode: interview.interviewerMode,
          },
          interviewerNotes: buildInterviewerNotes(
            evaluation.strengths,
            evaluation.weaknesses,
            evaluation.suggestions,
          ),
        },
        create: {
          interviewId: interview.id,
          score: evaluation.score,
          strengths: evaluation.strengths,
          weaknesses: evaluation.weaknesses,
          suggestions: evaluation.suggestions,
          communication: evaluation.communication,
          technicalDepth: evaluation.technicalDepth,
          correctness: evaluation.correctness,
          confidence: evaluation.confidence,
          hiringRecommendation: evaluation.hiringRecommendation,
          metadata: {
            answeredQuestionCount: answeredQuestions.length,
            completionScore: interview.completionScore,
            evaluatorSource: evaluation.source,
            generatedAt: new Date().toISOString(),
            interviewerMode: interview.interviewerMode,
          },
          interviewerNotes: buildInterviewerNotes(
            evaluation.strengths,
            evaluation.weaknesses,
            evaluation.suggestions,
          ),
        },
      }),
      prisma.interview.update({
        where: {
          id: interview.id,
        },
        data: {
          status: "COMPLETED",
          overallScore: evaluation.score,
          completedAt: new Date(),
        },
      }),
    ]);

    revalidatePath(`/interviews/${interview.id}`);
    revalidatePath("/dashboard");

    return {
      success:
        evaluation.source === "mock"
          ? "Mock feedback generated successfully."
          : "AI feedback generated successfully.",
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to evaluate this interview right now.";

    return { error: message };
  }
}

async function buildEvaluationFromInterview(interviewId: string, userId: string) {
  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
      userId,
    },
    include: {
      questions: {
        include: {
          answers: {
            orderBy: {
              answeredAt: "desc",
            },
            take: 1,
          },
        },
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!interview) {
    return { error: "Interview not found." };
  }

  const answeredQuestions = interview.questions
    .map((question) => ({
      prompt: question.prompt,
      answer: question.answers[0]?.transcript,
    }))
    .filter(
      (question): question is { prompt: string; answer: string } =>
        Boolean(question.answer),
    );

  if (answeredQuestions.length === 0) {
    return { error: "Save at least one answer before completing the interview." };
  }

  const evaluation = await evaluateInterviewAnswers({
    role: interview.role,
    experienceLevel: interview.experienceLevel,
    interviewerMode: interview.interviewerMode,
    type: interview.type,
    technologyStack: interview.technologyStack,
    questions: answeredQuestions,
  });

  await prisma.$transaction([
    prisma.feedback.upsert({
      where: {
        interviewId: interview.id,
      },
      update: {
        score: evaluation.score,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        suggestions: evaluation.suggestions,
        communication: evaluation.communication,
        technicalDepth: evaluation.technicalDepth,
        correctness: evaluation.correctness,
        confidence: evaluation.confidence,
        hiringRecommendation: evaluation.hiringRecommendation,
        metadata: {
          answeredQuestionCount: answeredQuestions.length,
          completionScore: interview.completionScore,
          evaluatorSource: evaluation.source,
          generatedAt: new Date().toISOString(),
          interviewerMode: interview.interviewerMode,
        },
        interviewerNotes: buildInterviewerNotes(
          evaluation.strengths,
          evaluation.weaknesses,
          evaluation.suggestions,
        ),
      },
      create: {
        interviewId: interview.id,
        score: evaluation.score,
        strengths: evaluation.strengths,
        weaknesses: evaluation.weaknesses,
        suggestions: evaluation.suggestions,
        communication: evaluation.communication,
        technicalDepth: evaluation.technicalDepth,
        correctness: evaluation.correctness,
        confidence: evaluation.confidence,
        hiringRecommendation: evaluation.hiringRecommendation,
        metadata: {
          answeredQuestionCount: answeredQuestions.length,
          completionScore: interview.completionScore,
          evaluatorSource: evaluation.source,
          generatedAt: new Date().toISOString(),
          interviewerMode: interview.interviewerMode,
        },
        interviewerNotes: buildInterviewerNotes(
          evaluation.strengths,
          evaluation.weaknesses,
          evaluation.suggestions,
        ),
      },
    }),
    prisma.interview.update({
      where: {
        id: interview.id,
      },
      data: {
        status: "COMPLETED",
        overallScore: evaluation.score,
        completedAt: new Date(),
      },
    }),
  ]);

  revalidatePath(`/interviews/${interview.id}`);
  revalidatePath(`/interviews/${interview.id}/live`);
  revalidatePath("/dashboard");

  return { success: "Interview completed and feedback generated." };
}

export async function startConversationAction(interviewId: string) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const interview = await prisma.interview.findFirst({
    where: {
      id: interviewId,
      userId: session.user.id,
    },
  });

  if (!interview) {
    return { error: "Interview not found." };
  }

  if (interview.status === "DRAFT") {
    await prisma.interview.update({
      where: {
        id: interview.id,
      },
      data: {
        status: "IN_PROGRESS",
        startedAt: interview.startedAt ?? new Date(),
      },
    });
  }

  revalidatePath(`/interviews/${interview.id}`);
  revalidatePath(`/interviews/${interview.id}/live`);

  return { success: "Interview started." };
}

export async function submitConversationAnswerAction(
  interviewId: string,
  questionId: string,
  transcript: string,
): Promise<ConversationAnswerResult> {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const parsed = saveVoiceAnswerSchema.safeParse({
    questionId,
    transcript,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message ?? "Invalid answer data." };
  }

  const question = await prisma.question.findFirst({
    where: {
      id: parsed.data.questionId,
      interview: {
        id: interviewId,
        userId: session.user.id,
      },
    },
    include: {
      interview: true,
      parentQuestion: true,
      followUps: true,
    },
  });

  if (!question) {
    return { error: "Question not found." };
  }

  const answer = await prisma.answer.create({
    data: {
      questionId: question.id,
      transcript: parsed.data.transcript,
      metadata: {
        answeredVia: "conversational_interview",
        interviewerMode: question.interview.interviewerMode,
        isFollowUpAnswer: question.isFollowUp,
        savedAt: new Date().toISOString(),
        transcriptLength: parsed.data.transcript.length,
        wordCount: parsed.data.transcript.split(/\s+/).filter(Boolean).length,
      },
    },
  });

  const completion = await updateInterviewCompletion(interviewId);

  if (completion.shouldComplete) {
    const evaluation = await buildEvaluationFromInterview(interviewId, session.user.id);

    if (evaluation.error) {
      return { error: evaluation.error };
    }

    return {
      completion,
      success: `Answer saved. Interview completed because ${getCompletionReasonLabel(
        completion.reason,
      )}.`,
    };
  }

  const existingFollowUp = question.followUps[0];

  if (existingFollowUp) {
    return {
      success: "Answer saved.",
      followUp: {
        id: existingFollowUp.id,
        prompt: existingFollowUp.prompt,
        order: existingFollowUp.order,
        category: existingFollowUp.category,
        isFollowUp: existingFollowUp.isFollowUp,
        parentQuestionId: existingFollowUp.parentQuestionId,
      },
    };
  }

  const currentDepth = await getFollowUpDepth(question.id);

  if (currentDepth >= getMaxFollowUpDepth(question.interview.interviewerMode)) {
    revalidatePath(`/interviews/${interviewId}`);
    revalidatePath(`/interviews/${interviewId}/live`);

    return {
      success:
        "Answer saved. Follow-up depth reached, moving to the next primary question.",
    };
  }

  const previousTurns = await prisma.question.findMany({
    where: {
      interviewId,
      answers: {
        some: {},
      },
    },
    include: {
      answers: {
        orderBy: {
          answeredAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      order: "asc",
    },
  });

  const generated = await generateFollowUpQuestion({
    role: question.interview.role,
    experienceLevel: question.interview.experienceLevel,
    interviewerMode: question.interview.interviewerMode,
    type: question.interview.type,
    technologyStack: question.interview.technologyStack,
    question: question.prompt,
    answer: parsed.data.transcript,
    currentDepth,
    previousTurns: previousTurns.map((turn) => ({
      question: turn.prompt,
      answer: turn.answers[0]?.transcript ?? "",
    })),
  });

  const lastQuestion = await prisma.question.findFirst({
    where: {
      interviewId,
    },
    orderBy: {
      order: "desc",
    },
  });
  const followUp = await prisma.question.create({
    data: {
      interviewId,
      parentQuestionId: question.id,
      prompt: generated.followUpPrompt,
      category: `Follow-up · ${formatInterviewValue(generated.difficulty)}`,
      isFollowUp: true,
      order: (lastQuestion?.order ?? 0) + 1,
    },
  });

  await prisma.answer.update({
    where: {
      id: answer.id,
    },
    data: {
      notes: generated.analysis,
      metadata: {
        answeredVia: "conversational_interview",
        followUpDifficulty: generated.difficulty,
        followUpGeneratedAt: new Date().toISOString(),
        followUpQuestionId: followUp.id,
        followUpSource: generated.source,
        interviewerMode: question.interview.interviewerMode,
        isFollowUpAnswer: question.isFollowUp,
        savedAt: answer.answeredAt.toISOString(),
        transcriptLength: parsed.data.transcript.length,
        wordCount: parsed.data.transcript.split(/\s+/).filter(Boolean).length,
      },
    },
  });

  revalidatePath(`/interviews/${interviewId}`);
  revalidatePath(`/interviews/${interviewId}/live`);

  return {
    analysis: generated.analysis,
    success:
      generated.source === "mock"
        ? "Answer saved and mock follow-up generated."
        : "Answer saved and follow-up generated.",
    followUp: {
      id: followUp.id,
      prompt: followUp.prompt,
      order: followUp.order,
      category: followUp.category,
      isFollowUp: followUp.isFollowUp,
      parentQuestionId: followUp.parentQuestionId,
    },
  };
}

async function getFollowUpDepth(questionId: string) {
  let depth = 0;
  let cursor = await prisma.question.findUnique({
    where: {
      id: questionId,
    },
    select: {
      parentQuestionId: true,
    },
  });

  while (cursor?.parentQuestionId) {
    depth += 1;
    cursor = await prisma.question.findUnique({
      where: {
        id: cursor.parentQuestionId,
      },
      select: {
        parentQuestionId: true,
      },
    });
  }

  return depth;
}

export async function completeConversationInterviewAction(interviewId: string) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  await updateInterviewCompletion(interviewId);

  return buildEvaluationFromInterview(interviewId, session.user.id);
}

async function updateInterviewCompletion(interviewId: string) {
  const interview = await prisma.interview.findUnique({
    where: {
      id: interviewId,
    },
    include: {
      questions: {
        include: {
          answers: {
            take: 1,
          },
        },
      },
    },
  });

  if (!interview) {
    return {
      completionScore: 0,
      reason: "not_found",
      shouldComplete: false,
    };
  }

  const answeredQuestions = interview.questions.filter(
    (question) => question.answers.length > 0,
  );
  const answeredPrimaryCount = answeredQuestions.filter(
    (question) => !question.isFollowUp,
  ).length;
  const completionScore = calculateCompletionScore(
    answeredPrimaryCount,
    interview.targetQuestionCount,
  );
  const startedAt = interview.startedAt ?? new Date();
  const elapsedMinutes = (Date.now() - startedAt.getTime()) / 60000;
  const reachedTimeLimit = elapsedMinutes >= interview.timeLimitMinutes;
  const reachedQuestionCount = answeredPrimaryCount >= interview.targetQuestionCount;
  const reachedCompletionScore = completionScore >= 100;
  const completedDifficultyProgression = answeredQuestions.some((question) => {
    const category = question.category?.toLowerCase() ?? "";

    return question.isFollowUp && category.includes("deeper");
  }) && completionScore >= 80;

  const reason = reachedTimeLimit
    ? "time_limit"
    : reachedQuestionCount
    ? "question_count"
    : reachedCompletionScore
    ? "completion_score"
    : completedDifficultyProgression
    ? "difficulty_progression"
    : "in_progress";
  const shouldComplete =
    interview.status !== "COMPLETED" &&
    (reachedTimeLimit ||
      reachedQuestionCount ||
      reachedCompletionScore ||
      completedDifficultyProgression);

  await prisma.interview.update({
    where: {
      id: interview.id,
    },
    data: {
      completionScore,
    },
  });

  return {
    completionScore,
    reason,
    shouldComplete,
  };
}
