"use client";

import { spokenForm } from "@/lib/maya/speech-text";
import { useEffect, useRef, useState } from "react";

type SpeechRecognitionEventLike = Event & {
  resultIndex?: number;
  results: {
    length: number;
    [index: number]: {
      isFinal?: boolean;
      [index: number]: { transcript: string };
    };
  };
};

type SpeechRecognitionErrorEventLike = Event & { error?: string };

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives?: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onstart: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type VoicePhase = "idle" | "requesting-mic" | "listening" | "sending" | "speaking" | "error";

function normalizeEcho(text: string) {
  return text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
}

function pickMayaVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const hi = voices.filter((voice) => /hi-IN|^hi\b/i.test(voice.lang));
  return (
    hi.find((voice) => voice.localService && /lekha|female|woman|neerja|kalpana|meera/i.test(voice.name)) ||
    hi.find((voice) => voice.localService) ||
    hi[0] ||
    voices.find((voice) => /en-IN/i.test(voice.lang) && voice.localService) ||
    null
  );
}

function transcriptFromEvent(event: SpeechRecognitionEventLike): { text: string; isFinal: boolean } {
  const chunks: string[] = [];
  let isFinal = false;
  for (let i = event.resultIndex ?? 0; i < event.results.length; i += 1) {
    const result = event.results[i];
    const piece = result?.[0]?.transcript?.trim();
    if (piece) chunks.push(piece);
    if (result?.isFinal) isFinal = true;
  }
  return { text: chunks.join(" ").trim(), isFinal };
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!("speechSynthesis" in window)) return Promise.resolve([]);
  const existing = window.speechSynthesis.getVoices();
  if (existing.length) return Promise.resolve(existing);
  return new Promise((resolve) => {
    const finish = () => resolve(window.speechSynthesis.getVoices());
    window.speechSynthesis.onvoiceschanged = finish;
    window.setTimeout(finish, 700);
  });
}

export default function MayaVoiceControls({ disabled = false }: { disabled?: boolean }) {
  const [phase, setPhase] = useState<VoicePhase>("idle");
  const [supported, setSupported] = useState(true);
  const [status, setStatus] = useState("Tap mic and talk to Maya");
  const [interim, setInterim] = useState("");

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const phaseRef = useRef<VoicePhase>("idle");
  const ignoreEndRef = useRef(false);
  const listenGen = useRef(0);
  const speakGen = useRef(0);
  const lastSentRef = useRef("");
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);

  function setVoicePhase(next: VoicePhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  function cancelSpeech() {
    speakGen.current += 1;
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
  }

  function abortInFlightChat() {
    abortRef.current?.abort();
    abortRef.current = null;
  }

  function stopRecognition(hard = false) {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    ignoreEndRef.current = true;
    try {
      if (hard) recognition.abort();
      else recognition.stop();
    } catch {
      // already stopped
    }
  }

  function looksLikeMayaEcho(transcript: string) {
    const heard = normalizeEcho(transcript);
    if (heard.length < 8) return false;
    const last = normalizeEcho(window.sessionStorage.getItem("mayaLastAssistantText") || "");
    if (!last) return false;
    return last.includes(heard) || heard.includes(last.slice(0, Math.min(40, last.length)));
  }

  async function ensureMicPermission(): Promise<boolean> {
    if (!navigator.mediaDevices?.getUserMedia) {
      setVoicePhase("error");
      setStatus("Mic API unavailable in this browser");
      return false;
    }
    setVoicePhase("requesting-mic");
    setStatus("Allow microphone access…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return true;
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setVoicePhase("error");
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setStatus("Mic blocked. Allow the microphone for this site, then tap Talk to Maya to retry.");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setStatus("No microphone found");
      } else {
        setStatus("Could not access microphone — tap Talk to Maya to retry");
      }
      return false;
    }
  }

  async function sendTranscript(transcript: string, session: number) {
    const text = transcript.trim();
    if (!text || session !== listenGen.current) return;
    if (lastSentRef.current === text) return;
    if (looksLikeMayaEcho(text)) {
      setInterim("");
      setVoicePhase("idle");
      setStatus("Ignored speaker echo — tap mic when you want to talk");
      return;
    }

    lastSentRef.current = text;
    setInterim("");
    setVoicePhase("sending");
    setStatus("Sending to Maya…");
    window.dispatchEvent(new CustomEvent("maya:voice-pending", { detail: { pending: true } }));

    abortInFlightChat();
    const controller = new AbortController();
    abortRef.current = controller;
    const tokenAtSend = speakGen.current;

    try {
      const saved = window.sessionStorage.getItem("mayaConversationId") || "";
      const response = await fetch(`/api/maya/chat${saved ? `?conversationId=${encodeURIComponent(saved)}` : ""}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ text, conversationId: saved || undefined }),
      });
      if (speakGen.current !== tokenAtSend || controller.signal.aborted) return;
      if (!response.ok) throw new Error(`Maya chat failed (${response.status})`);

      const data = (await response.json()) as { conversationId?: string; text?: string };
      if (speakGen.current !== tokenAtSend) return;

      if (data.conversationId) window.sessionStorage.setItem("mayaConversationId", data.conversationId);
      const reply = typeof data.text === "string" ? data.text.trim() : "";
      if (!reply) {
        setVoicePhase("idle");
        setStatus("Maya replied without text");
        return;
      }
      window.sessionStorage.setItem("mayaLastAssistantText", reply);
      window.dispatchEvent(
        new CustomEvent("maya:conversation-updated", {
          detail: { conversationId: data.conversationId, text, reply },
        }),
      );
      speakReply(reply);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setVoicePhase("idle");
        setStatus("Cancelled");
        return;
      }
      if (speakGen.current !== tokenAtSend) return;
      setVoicePhase("error");
      setStatus("Could not connect to Maya — tap Talk to Maya to retry");
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      window.dispatchEvent(new CustomEvent("maya:voice-pending", { detail: { pending: false } }));
    }
  }

  function speakReply(reply: string) {
    if (!("speechSynthesis" in window)) {
      setVoicePhase("idle");
      setStatus("Maya replied (no TTS on this browser)");
      return;
    }
    const spoken = spokenForm(reply);
    if (!spoken) {
      setVoicePhase("idle");
      setStatus("Tap mic and talk to Maya");
      return;
    }

    const token = speakGen.current;
    const utterance = new SpeechSynthesisUtterance(spoken);
    const voice = selectedVoiceRef.current;
    utterance.lang = voice?.lang || "hi-IN";
    utterance.rate = 1;
    utterance.pitch = 1;
    if (voice) utterance.voice = voice;

    utterance.onstart = () => {
      if (speakGen.current !== token) {
        window.speechSynthesis.cancel();
        return;
      }
      setVoicePhase("speaking");
      const where = voice ? `${voice.name} (${voice.lang}${voice.localService ? ", local" : ", remote"})` : "default engine";
      setStatus(`Maya is speaking… ${where}`);
    };
    utterance.onend = () => {
      if (speakGen.current !== token || phaseRef.current !== "speaking") return;
      setVoicePhase("idle");
      setStatus("Tap mic and talk to Maya");
    };
    utterance.onerror = () => {
      if (speakGen.current !== token) return;
      setVoicePhase("idle");
      setStatus("Maya replied — voice playback unavailable");
    };

    window.setTimeout(() => {
      if (speakGen.current !== token) return;
      try {
        window.speechSynthesis.cancel();
        window.speechSynthesis.resume();
        window.speechSynthesis.speak(utterance);
      } catch {
        if (speakGen.current === token) {
          setVoicePhase("idle");
          setStatus("Maya replied — voice playback unavailable");
        }
      }
    }, 60);
  }

  useEffect(() => {
    const w = window as Window & {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const Recognition = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      setStatus("Voice input is not supported in this browser");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "hi-IN";
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      ignoreEndRef.current = false;
      setVoicePhase("listening");
      setStatus("Listening…");
    };

    recognition.onresult = (event) => {
      const session = listenGen.current;
      if (phaseRef.current === "sending" || phaseRef.current === "speaking") return;
      const { text, isFinal } = transcriptFromEvent(event);
      if (!text) return;
      if (!isFinal) {
        setInterim(text);
        setStatus(`Hearing: ${text}`);
        return;
      }
      setInterim("");
      stopRecognition(false);
      void sendTranscript(text, session);
    };

    recognition.onerror = (event) => {
      const code = event.error || "";
      if (code === "aborted" || code === "no-speech") {
        if (code === "no-speech" && phaseRef.current === "listening") {
          setVoicePhase("idle");
          setInterim("");
          setStatus("No speech heard — tap and try again");
        }
        return;
      }
      setInterim("");
      setVoicePhase("error");
      if (code === "not-allowed") setStatus("Mic blocked. Allow the microphone, then tap Talk to Maya to retry.");
      else if (code === "audio-capture") setStatus("No microphone found");
      else if (code === "network") setStatus("Speech recognition needs a network connection in Chrome — tap to retry");
      else setStatus("Mic error — tap and try again");
    };

    recognition.onend = () => {
      if (ignoreEndRef.current) {
        ignoreEndRef.current = false;
        return;
      }
      if (phaseRef.current === "listening") {
        setVoicePhase("idle");
        setStatus("Tap mic and talk to Maya");
      }
    };

    recognitionRef.current = recognition;
    void loadVoices().then((voices) => {
      selectedVoiceRef.current = pickMayaVoice(voices);
    });

    return () => {
      listenGen.current += 1;
      speakGen.current += 1;
      ignoreEndRef.current = true;
      abortInFlightChat();
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
      try {
        recognition.abort();
      } catch {
        // ignore
      }
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function beginListening() {
    const allowed = await ensureMicPermission();
    if (!allowed || !recognitionRef.current) return;
    lastSentRef.current = "";
    listenGen.current += 1;
    const voices = await loadVoices();
    selectedVoiceRef.current = pickMayaVoice(voices);
    try {
      recognitionRef.current.lang = "hi-IN";
      recognitionRef.current.start();
      setVoicePhase("listening");
      setStatus("Listening…");
    } catch {
      setVoicePhase("error");
      setStatus("Mic is already active — tap stop, then try again");
    }
  }

  async function toggleListening() {
    if (!recognitionRef.current || !supported || disabled) return;

    if (phaseRef.current === "listening" || phaseRef.current === "requesting-mic") {
      listenGen.current += 1;
      stopRecognition(true);
      setInterim("");
      setVoicePhase("idle");
      setStatus("Stopped listening");
      return;
    }

    if (phaseRef.current === "sending") {
      listenGen.current += 1;
      speakGen.current += 1;
      abortInFlightChat();
      setVoicePhase("idle");
      setStatus("Cancelled — Maya will not speak this reply");
      window.dispatchEvent(new CustomEvent("maya:voice-pending", { detail: { pending: false } }));
      return;
    }

    if (phaseRef.current === "speaking") {
      cancelSpeech();
      stopRecognition(true);
      setVoicePhase("idle");
      setStatus("Stopped Maya");
      // Let the speaker tail die before opening the mic so Maya is not transcribed.
      await new Promise((resolve) => window.setTimeout(resolve, 450));
    }

    await beginListening();
  }

  function stopSpeaking() {
    cancelSpeech();
    stopRecognition(true);
    setVoicePhase("idle");
    setInterim("");
    setStatus("Stopped Maya");
  }

  if (!supported) {
    return (
      <div className="mt-3 rounded-2xl border border-[#3a2a31] bg-[#1b1216] px-3 py-2 text-sm text-[#d7c4c8]">
        Voice input is not supported by this browser. Chrome on desktop can use the mic; typing still works.
      </div>
    );
  }

  const listening = phase === "listening" || phase === "requesting-mic";
  const sending = phase === "sending";
  const speaking = phase === "speaking";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3" data-maya-voice-phase={phase}>
      <button
        type="button"
        onClick={() => void toggleListening()}
        disabled={disabled && !listening && !sending}
        aria-label={listening ? "Stop listening" : sending ? "Cancel Maya reply" : "Talk to Maya"}
        className="rounded-full border border-[#3a2a31] bg-[#241820] px-5 py-3 text-sm font-medium text-[#f6ecef] transition hover:bg-[#2e2028] disabled:opacity-50"
      >
        {listening ? "Stop" : sending ? "Cancel" : "Talk to Maya"}
      </button>
      {speaking ? (
        <button
          type="button"
          onClick={stopSpeaking}
          className="rounded-full border border-[#3a2a31] bg-[#241820] px-5 py-3 text-sm font-medium text-[#f6ecef] transition hover:bg-[#2e2028]"
        >
          Stop Maya
        </button>
      ) : null}
      <span className="text-xs text-[#d7c4c8]" data-maya-voice-status>
        {status}
      </span>
      {interim ? (
        <span className="text-xs text-[#e7b7c8]" data-maya-voice-interim>
          {interim}
        </span>
      ) : null}
    </div>
  );
}
