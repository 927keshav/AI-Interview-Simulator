"use client";

import { create } from "zustand";

type VoiceStatus = "idle" | "listening" | "speaking" | "unsupported";

type VoiceState = {
  error: string | null;
  status: VoiceStatus;
  transcript: string;
  setError: (error: string | null) => void;
  setStatus: (status: VoiceStatus) => void;
  setTranscript: (transcript: string) => void;
  reset: () => void;
};

export const useVoiceStore = create<VoiceState>((set) => ({
  error: null,
  status: "idle",
  transcript: "",
  setError: (error) => set({ error }),
  setStatus: (status) => set({ status }),
  setTranscript: (transcript) => set({ transcript }),
  reset: () => set({ error: null, status: "idle", transcript: "" }),
}));
