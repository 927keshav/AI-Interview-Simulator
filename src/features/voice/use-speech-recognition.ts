"use client";

import { useEffect, useRef } from "react";

import { useVoiceStore } from "@/features/voice/voice-store";

export function useSpeechRecognition() {
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const { setError, setStatus, setTranscript } = useVoiceStore();

  useEffect(() => {
    const SpeechRecognitionConstructor =
      window.SpeechRecognition ?? window.webkitSpeechRecognition;

    if (!SpeechRecognitionConstructor) {
      setStatus("unsupported");
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognitionConstructor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const transcriptParts: string[] = [];

      for (let index = 0; index < event.results.length; index += 1) {
        transcriptParts.push(event.results[index]?.[0]?.transcript ?? "");
      }

      const transcript = transcriptParts.join(" ").trim();

      setTranscript(transcript);
    };

    recognition.onerror = (event) => {
      setError(event.message || `Speech recognition error: ${event.error}`);
      setStatus("idle");
    };

    recognition.onend = () => {
      setStatus("idle");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, [setError, setStatus, setTranscript]);

  function startListening() {
    if (!recognitionRef.current) {
      setStatus("unsupported");
      return;
    }

    setError(null);
    setTranscript("");
    setStatus("listening");
    recognitionRef.current.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setStatus("idle");
  }

  return {
    startListening,
    stopListening,
  };
}
