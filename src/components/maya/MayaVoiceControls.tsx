"use client";

import { useEffect, useRef, useState } from "react";

type SpeechRecognitionEventLike = Event & {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

export default function MayaVoiceControls() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState("Tap mic and talk to Maya");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const Recognition =
      w.SpeechRecognition || w.webkitSpeechRecognition;

    if (!Recognition) {
      setSupported(false);
      setStatus("Voice input is not supported in this browser");
      return;
    }

    const recognition = new Recognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "hi-IN";

    recognition.onresult = async (event) => {
      const transcript =
        event.results?.[0]?.[0]?.transcript?.trim() || "";

      if (!transcript) {
        setStatus("I couldn't hear that clearly");
        return;
      }

      setListening(false);
      setStatus("Sending to Maya...");

      try {
        const saved =
          window.sessionStorage.getItem("mayaConversationId") || "";

        const response = await fetch(
          `/api/maya/chat${saved ? `?conversationId=${saved}` : ""}`,
          {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              text: transcript,
              conversationId: saved || undefined,
            }),
          },
        );

        if (!response.ok) {
          throw new Error("Maya chat request failed");
        }

        const data = await response.json();

        if (data.conversationId) {
          window.sessionStorage.setItem(
            "mayaConversationId",
            data.conversationId,
          );
        }

        const reply =
          typeof data.text === "string"
            ? data.text.trim()
            : "";

        if (!reply) {
          setStatus("Maya replied without text");
          return;
        }

        window.dispatchEvent(
          new CustomEvent("maya:conversation-updated", {
            detail: { conversationId: data.conversationId, text: transcript, reply },
          }),
        );

        if ("speechSynthesis" in window) {
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(reply);
          utterance.lang = "hi-IN";
          utterance.rate = 1;
          utterance.pitch = 1;

          utterance.onstart = () => {
            setSpeaking(true);
            setStatus("Maya is speaking...");
          };

          utterance.onend = () => {
            setSpeaking(false);
            setStatus("Tap mic and talk to Maya");
          };

          utterance.onerror = () => {
            setSpeaking(false);
            setStatus("Maya replied — voice playback unavailable");
          };

          window.speechSynthesis.speak(utterance);
        } else {
          setStatus("Maya replied");
        }
      } catch {
        setStatus("Could not connect to Maya");
      }
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognition.onerror = () => {
      setListening(false);
      setStatus("Mic error — tap and try again");
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  function toggleListening() {
    if (!recognitionRef.current || !supported) return;

    if (listening) {
      recognitionRef.current.stop();
      setListening(false);
      setStatus("Stopped listening");
      return;
    }

    try {
      recognitionRef.current.lang = "hi-IN";
      recognitionRef.current.start();
      setListening(true);
      setStatus("Listening...");
    } catch {
      setStatus("Mic is already active");
    }
  }

  function stopSpeaking() {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
    setStatus("Tap mic and talk to Maya");
  }

  if (!supported) {
    return (
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white/60">
        Voice input is not supported by this browser.
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={toggleListening}
        aria-label={listening ? "Stop listening" : "Talk to Maya"}
        className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15"
      >
        {listening ? "⏹️ Stop" : "🎙️ Talk to Maya"}
      </button>

      {speaking && (
        <button
          type="button"
          onClick={stopSpeaking}
          className="rounded-full border border-white/15 bg-white/10 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/15"
        >
          🔇 Stop Maya
        </button>
      )}

      <span className="text-xs text-white/50">
        {status}
      </span>
    </div>
  );
}
