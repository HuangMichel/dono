"use client";
import { useEffect, useRef, useState } from "react";
import { Button, Card, Chip, Icon, TextareaField } from "@/components/ui";
import type { NeedDraft } from "@/lib/contracts";
import { NEED_SAMPLE_TEXT, prepareNeedSample } from "./need-draft-sample";
import "./need-voice-input.css";

type RecognitionResult = {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
};
type RecognitionError = { error: string };
type Recognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: ((event: RecognitionError) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecognitionConstructor = new () => Recognition;
function browserRecognition(): RecognitionConstructor | undefined {
  const browser = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return browser.SpeechRecognition ?? browser.webkitSpeechRecognition;
}
function speechError(code: string) {
  switch (code) {
    case "not-allowed":
    case "service-not-allowed":
      return "Microphone access was denied. Allow voice input in your browser, or type your description.";
    case "no-speech":
      return "No speech was detected. Try again or type your description.";
    case "audio-capture":
      return "No microphone is available. Connect one or type your description.";
    case "network":
      return "Your browser's speech service is unavailable. Try again or type your description.";
    case "language-not-supported":
      return "English voice input is unavailable in this browser. Type your description instead.";
    case "aborted":
      return "Recording stopped. You can retry or type your description.";
    default:
      return "Voice input could not start. Try again or type your description.";
  }
}
function disposeRecognition(current: Recognition | null) {
  if (!current) return;
  current.onstart = current.onresult = current.onerror = current.onend = null;
  try {
    current.abort();
  } catch {
    /* An ended browser session has nothing left to abort. */
  }
}
export function NeedVoiceInput({
  onDraft,
  disabled = false,
  statusResetKey = 0,
}: {
  onDraft: (draft: NeedDraft) => void;
  disabled?: boolean;
  statusResetKey?: number;
}) {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<"idle" | "starting" | "listening">("idle");
  const [transcript, setTranscript] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const recognition = useRef<Recognition | null>(null);
  const session = useRef(0);
  useEffect(() => {
    // Capability detection runs after browser hydration; the server has no speech API.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(!!browserRecognition());
    return () => {
      // This is a session counter, not a DOM ref. Cleanup must invalidate its latest value.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      ++session.current;
      const current = recognition.current;
      recognition.current = null;
      disposeRecognition(current);
    };
  }, []);
  useEffect(() => {
    if (!disabled) return;
    ++session.current;
    disposeRecognition(recognition.current);
    recognition.current = null;
    // Disabling the control ends the external recording session and its UI state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhase("idle");
  }, [disabled]);
  useEffect(() => {
    // Parent form actions invalidate status copy while retaining the transcript.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessage("");
  }, [statusResetKey]);
  const recording = phase !== "idle";
  function startRecording() {
    const Constructor = browserRecognition();
    if (!Constructor || recording || disabled) return;
    const token = ++session.current;
    disposeRecognition(recognition.current);
    recognition.current = null;
    let current: Recognition;
    try {
      current = new Constructor();
    } catch {
      setError(true);
      setMessage("Voice input could not start. Type your description instead.");
      return;
    }
    let failed = false;
    let heardSpeech = false;
    const originalText = transcript.trim();
    current.lang = "en-GB";
    current.continuous = false;
    current.interimResults = true;
    current.onstart = () => {
      if (session.current === token) {
        setPhase("listening");
        setMessage("Listening. Stop when you have finished.");
      }
    };
    current.onresult = (event) => {
      if (session.current !== token) return;
      const captured = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? "")
        .join(" ")
        .trim();
      if (captured) {
        heardSpeech = true;
        setTranscript([originalText, captured].filter(Boolean).join(" "));
      }
    };
    current.onerror = (event) => {
      if (session.current !== token) return;
      failed = true;
      ++session.current;
      disposeRecognition(current);
      recognition.current = null;
      setError(true);
      setMessage(speechError(event.error));
      setPhase("idle");
    };
    current.onend = () => {
      if (session.current !== token) return;
      recognition.current = null;
      setPhase("idle");
      if (!failed)
        setMessage(
          heardSpeech
            ? "Recording stopped. Review your transcript."
            : "No speech was captured. Try again or type your description.",
        );
    };
    recognition.current = current;
    setError(false);
    setMessage("Starting voice input…");
    setPhase("starting");
    try {
      current.start();
    } catch {
      ++session.current;
      disposeRecognition(current);
      recognition.current = null;
      setPhase("idle");
      setError(true);
      setMessage(
        "Voice input could not start. Try again or type your description.",
      );
    }
  }
  function stopRecording() {
    try {
      recognition.current?.stop();
    } catch {
      ++session.current;
      disposeRecognition(recognition.current);
      recognition.current = null;
      setPhase("idle");
      setMessage("Recording stopped. You can type your description.");
    }
  }
  function prepareDraft() {
    const draft = prepareNeedSample(transcript);
    if (!draft) {
      setError(true);
      setMessage(
        "Free-text AI parsing is unavailable in this demo. Use the fixed sample, or enter the need in the form.",
      );
      return;
    }
    setError(false);
    setMessage(
      "Sample draft loaded into the form. Review and confirm before publishing.",
    );
    onDraft(draft);
  }
  return (
    <Card className="need-voice-input">
      <div className="need-voice-heading">
        <h2>Describe a need</h2>
        <Chip>Sample AI drafts</Chip>
      </div>
      <TextareaField
        id="need-transcript"
        label="Type or record your description"
        rows={2}
        placeholder="Describe the items and quantity you need"
        value={transcript}
        disabled={disabled || recording}
        onChange={(e) => {
          setTranscript(e.target.value);
          setMessage("");
          setError(false);
        }}
      />
      <div className="need-voice-actions">
        {recording ? (
          <Button type="button" variant="outline" onClick={stopRecording}>
            <Icon name="stop" />
            Stop recording
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            disabled={disabled || !supported}
            onClick={startRecording}
          >
            <Icon name="microphone" />
            Record description
          </Button>
        )}
        <Button
          type="button"
          variant="soft"
          disabled={disabled || recording}
          onClick={() => {
            setTranscript(NEED_SAMPLE_TEXT);
            setMessage(
              "Fixed sample selected. Prepare its draft, then review the fields.",
            );
            setError(false);
          }}
        >
          Use sample
        </Button>
        <Button
          type="button"
          disabled={disabled || recording || !transcript.trim()}
          onClick={prepareDraft}
        >
          Prepare sample draft
        </Button>
      </div>
      <p className="meta muted">
        Your browser may process audio online. Draft generation uses a fixed
        sample, without an AI request.
      </p>
      {supported === false && (
        <p className="meta muted">
          Voice input is unavailable in this browser. You can type your
          description.
        </p>
      )}
      {disabled && (
        <p className="meta muted">
          Cancel editing to prepare a new sample draft.
        </p>
      )}
      {message && (
        <p
          className={error ? "notice error" : "need-voice-status"}
          role={error ? "alert" : "status"}
        >
          {message}
        </p>
      )}
    </Card>
  );
}
