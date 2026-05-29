export type InterviewFlowState =
  | "idle"
  | "initializing"
  | "asking_question"
  | "listening"
  | "processing_answer"
  | "generating_followup"
  | "asking_followup"
  | "evaluating"
  | "moving_next"
  | "completed"
  | "error";

export type InterviewFlowEvent =
  | { type: "INITIALIZE" }
  | { type: "ASK_PRIMARY" }
  | { type: "ASK_FOLLOWUP" }
  | { type: "START_LISTENING" }
  | { type: "STOP_LISTENING" }
  | { type: "SUBMIT_ANSWER" }
  | { type: "GENERATE_FOLLOWUP" }
  | { type: "MOVE_NEXT" }
  | { type: "EVALUATE" }
  | { type: "COMPLETE" }
  | { message: string; type: "FAIL" }
  | { type: "RESET_ERROR" };

export type InterviewFlowSnapshot = {
  error: string | null;
  state: InterviewFlowState;
};

export const initialInterviewFlowSnapshot: InterviewFlowSnapshot = {
  error: null,
  state: "idle",
};

export function interviewFlowReducer(
  snapshot: InterviewFlowSnapshot,
  event: InterviewFlowEvent,
): InterviewFlowSnapshot {
  switch (event.type) {
    case "INITIALIZE":
      return { error: null, state: "initializing" };
    case "ASK_PRIMARY":
      return { error: null, state: "asking_question" };
    case "ASK_FOLLOWUP":
      return { error: null, state: "asking_followup" };
    case "START_LISTENING":
      return { error: null, state: "listening" };
    case "STOP_LISTENING":
      return {
        error: null,
        state: snapshot.state === "listening" ? "asking_question" : snapshot.state,
      };
    case "SUBMIT_ANSWER":
      return { error: null, state: "processing_answer" };
    case "GENERATE_FOLLOWUP":
      return { error: null, state: "generating_followup" };
    case "MOVE_NEXT":
      return { error: null, state: "moving_next" };
    case "EVALUATE":
      return { error: null, state: "evaluating" };
    case "COMPLETE":
      return { error: null, state: "completed" };
    case "FAIL":
      return { error: event.message, state: "error" };
    case "RESET_ERROR":
      return { error: null, state: "idle" };
    default:
      return snapshot;
  }
}
