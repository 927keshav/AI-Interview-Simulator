"use client";

import { useCallback } from "react";

import { useVoiceStore } from "@/features/voice/voice-store";

const preferredFemaleVoiceNames = [
  "samantha",
  "zira",
  "aria",
  "jenny",
  "victoria",
  "susan",
  "moira",
  "karen",
  "microsoft zira",
  "microsoft aria",
  "microsoft jenny",
  "google uk english female",
  "google us english",
];

function findPreferredAssistantVoice(voices: SpeechSynthesisVoice[]) {
  const englishVoices = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("en"),
  );

  return (
    englishVoices.find((voice) =>
      preferredFemaleVoiceNames.some((name) =>
        voice.name.toLowerCase().includes(name),
      ),
    ) ??
    englishVoices.find((voice) => voice.lang.toLowerCase() === "en-us") ??
    englishVoices[0] ??
    null
  );
}

function loadVoices() {
  return new Promise<SpeechSynthesisVoice[]>((resolve) => {
    const voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      resolve(voices);
      return;
    }

    window.speechSynthesis.onvoiceschanged = () => {
      resolve(window.speechSynthesis.getVoices());
    };
  });
}

export function useTextToSpeech() {
  const { setError, setStatus } = useVoiceStore();

  const speak = useCallback(async (text: string) => {
    if (!("speechSynthesis" in window)) {
      setStatus("unsupported");
      setError("Text-to-speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    const voices = await loadVoices();

    utterance.lang = "en-US";
    utterance.voice = findPreferredAssistantVoice(voices);
    utterance.rate = 1.12;
    utterance.pitch = 1.35;

    utterance.onstart = () => {
      setError(null);
      setStatus("speaking");
    };

    utterance.onend = () => {
      setStatus("idle");
    };

    utterance.onerror = () => {
      setError("Unable to speak this question.");
      setStatus("idle");
    };

    window.speechSynthesis.speak(utterance);
  }, [setError, setStatus]);

  const stopSpeaking = useCallback(() => {
    window.speechSynthesis.cancel();
    setStatus("idle");
  }, [setStatus]);

  return {
    speak,
    stopSpeaking,
  };
}
