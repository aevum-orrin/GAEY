"use client";

import { Button } from "@/components/ui/button";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { Loader2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BackgroundAura } from "@/components/background-aura";
import { cn } from "@/lib/utils";
import { useConversation } from "@elevenlabs/react";
import { toast } from "sonner";

async function requestMicrophonePermission() {
  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    return true;
  } catch {
    console.error("Microphone permission denied");
    return false;
  }
}

async function getSignedUrl(): Promise<string> {
  const response = await fetch("/api/signed-url");
  if (!response.ok) {
    throw Error("Failed to get signed url");
  }
  const data = await response.json();
  return data.signedUrl;
}

// Speech-rate range supported by ElevenLabs TTS: 0.7 (slower) … 1.2 (faster).
const MIN_SPEED = 0.7;
const MAX_SPEED = 1.2;
const DEFAULT_SPEED = 1.0;

// A single line in the conversation transcript. The ElevenLabs `onMessage`
// callback reports a role of "user" (the learner's speech) or "agent" (GAEY).
type TranscriptMessage = {
  id: number;
  role: "user" | "agent";
  text: string;
};

// One chat bubble: the learner's lines are right-aligned, GAEY's are left.
function TranscriptBubble({ message }: { message: TranscriptMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-[85%] flex-col gap-1", isUser ? "items-end" : "items-start")}>
        <span className="px-1 text-[11px] font-medium text-muted-foreground">
          {isUser ? "You" : "GAEY"}
        </span>
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-4 py-2 text-sm leading-relaxed",
            isUser
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm border border-border/60 bg-background/80 text-foreground",
          )}
        >
          {message.text}
        </div>
      </div>
    </div>
  );
}

export function ConvAI() {
  // Full conversation transcript: both what the learner said and what GAEY said.
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);
  const messageIdRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // How fast GAEY speaks; applied per session via the TTS override on start.
  const [speed, setSpeed] = useState(DEFAULT_SPEED);

  const { status, isSpeaking, startSession, endSession } = useConversation({
    onError: (error) => {
      console.error(error);
      toast.error("An error occurred during the conversation");
    },
    onMessage: ({ message, role }) => {
      // Fires once per finalized turn for BOTH the user (speech-to-text) and
      // the agent (its reply), so we append every message to the transcript.
      if (!message) return;
      setMessages((prev) => [...prev, { id: messageIdRef.current++, role, text: message }]);
    },
  });

  const [isStarting, setIsStarting] = useState(false);
  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isLoading = isStarting || isConnecting;

  // Keep the transcript scrolled to the latest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function startConversation() {
    setIsStarting(true);
    try {
      const hasPermission = await requestMicrophonePermission();
      if (!hasPermission) {
        toast.error("Microphone permission denied");
        setIsStarting(false);
        return;
      }
      // Start each session with a clean transcript.
      setMessages([]);
      const signedUrl = await getSignedUrl();
      await startSession({
        signedUrl: signedUrl,
        // Apply the learner-selected speech rate for this session. The agent
        // must allow the "speed" override in its ElevenLabs Security settings.
        overrides: {
          tts: { speed },
        },
      });
    } catch (error) {
      console.error(error);
      toast.error("Failed to start conversation");
    } finally {
      setIsStarting(false);
    }
  }

  async function endConversation() {
    await endSession();
  }

  const statusLabel = !isConnected
    ? isLoading
      ? "Connecting…"
      : "Disconnected"
    : isSpeaking
      ? "GAEY is speaking"
      : "Listening…";

  return (
    <div className={"fixed inset-0 flex flex-col items-center overflow-hidden"}>
      <BackgroundAura />

      {/* Header: brand + live connection status */}
      <header className="z-10 flex shrink-0 flex-col items-center gap-2 pt-8 sm:pt-10">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">GAEY</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              isConnected
                ? isSpeaking
                  ? "animate-pulse bg-cyan-400"
                  : "bg-green-400"
                : "bg-muted-foreground/40",
            )}
          />
          {statusLabel}
        </div>
      </header>

      {/* Avatar + microphone waveform */}
      <section className="z-10 mt-4 flex shrink-0 flex-col items-center">
        <div
          className={cn(
            "relative h-28 w-28 overflow-hidden rounded-full border-4 transition-all duration-500 sm:h-32 sm:w-32",
            isConnected
              ? "scale-105 border-green-400/50 shadow-[0_0_40px_rgba(74,222,128,0.4)]"
              : "scale-100 border-white/10 opacity-70 grayscale",
          )}
        >
          <Image src="/avatar.png" alt="GAEY Avatar" fill className="object-cover" priority />
        </div>
        <div className="flex h-16 w-full max-w-md items-center justify-center">
          <LiveWaveform
            active={isConnected}
            height={48}
            className="duration-500 animate-in fade-in zoom-in"
          />
        </div>
      </section>

      {/* Conversation transcript: shows both sides of the conversation */}
      <section className="z-10 min-h-0 w-full max-w-2xl flex-1 px-4 pb-2">
        <div
          ref={scrollRef}
          className="h-full overflow-y-auto rounded-2xl border border-border/60 bg-background/40 p-4 backdrop-blur-sm"
        >
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {isConnected
                ? "Say something — GAEY is listening 🎧"
                : "Start a conversation to see the transcript here. Every line you and GAEY say shows up in real time."}
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <TranscriptBubble key={m.id} message={m} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Call controls */}
      <footer className="z-10 my-6 flex shrink-0 flex-col items-center gap-4">
        {/* Speech-rate control: how fast GAEY talks */}
        <div className="flex w-64 flex-col gap-1.5 rounded-2xl border border-border/60 bg-background/40 px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Speech speed</span>
            <span className="tabular-nums text-foreground">{speed.toFixed(2)}×</span>
          </div>
          <div className="flex items-center gap-2">
            <span aria-hidden className="text-sm">🐢</span>
            <input
              type="range"
              min={MIN_SPEED}
              max={MAX_SPEED}
              step={0.05}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              aria-label="GAEY speech speed"
              className="h-1.5 w-full cursor-pointer accent-cyan-500"
            />
            <span aria-hidden className="text-sm">🐇</span>
          </div>
          <p className="text-center text-[11px] text-muted-foreground">
            Applied when you start a conversation
          </p>
        </div>

        {!isConnected ? (
          <Button
            variant={"outline"}
            className={"rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80"}
            size={"lg"}
            disabled={isConnected || isLoading}
            onClick={startConversation}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Starting...
              </span>
            ) : (
              "Start conversation"
            )}
          </Button>
        ) : (
          <Button
            variant={"destructive"}
            className={"rounded-full"}
            size={"lg"}
            disabled={!isConnected}
            onClick={endConversation}
          >
            End conversation
          </Button>
        )}
      </footer>
    </div>
  );
}
