import {
  formatInterviewValue,
  type InterviewSetup,
} from "@/features/interviews/constants";

type MockQuestion = {
  prompt: string;
  category: string;
};

type MockQuestions = {
  questions: MockQuestion[];
};

export function generateMockInterviewQuestions(
  interview: InterviewSetup,
): MockQuestions {
  const role = formatInterviewValue(interview.role);
  const level = formatInterviewValue(interview.experienceLevel);
  const type = formatInterviewValue(interview.type);
  const stack = interview.technologyStack.join(", ");
  const primaryTechnology = interview.technologyStack[0] ?? "your main stack";

  return {
    questions: [
      {
        category: "Fundamentals",
        prompt: `For a ${level} ${role} role, explain the most important concepts you would focus on when working with ${stack}.`,
      },
      {
        category: "Practical Scenario",
        prompt: `Imagine a production issue appears in a ${primaryTechnology} feature. How would you investigate, isolate, and fix the problem?`,
      },
      {
        category: "Tradeoffs",
        prompt: `What tradeoffs would you consider when choosing tools or patterns for a ${type} interview project using ${stack}?`,
      },
      {
        category: "Code Quality",
        prompt: `How would you structure a maintainable ${role} feature so that it is easy to test, debug, and extend later?`,
      },
      {
        category: "Communication",
        prompt: `Tell me about a technical decision you made. How did you explain the reasoning, risks, and outcome to another developer?`,
      },
    ],
  };
}
