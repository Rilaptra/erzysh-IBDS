/**
 * @file StructuralAiAssistantPanel.tsx
 * @description Interactive Structural Engineering AI Consultant Chat Panel.
 * Designed for embedding within the GESTURE_AI_ASSISTANT Floating Window.
 * Features:
 * - Direct bidirectional connection to the `/api/ai/structural-consultant` endpoint.
 * - Live snapshot injection of current beam parameters (Span, Pu, Mu, Material, Deflection).
 * - Instant Quick-Prompt action pills for fast design checks (IWF vs BOX, Stirrups, L/360).
 * - Robust heuristic civil engineering fallback when offline or during local development.
 * - Professional CAD/CAE monospace layout with engineer-friendly message bubbles.
 */

"use client";

import { cn } from "cn";
import React, { type ReactElement, useEffect, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { synthesizeAudioTone } from "@/hooks/use-web-speech-command";
import { useBeamSimulatorStore } from "@/state/beam-simulator-store";

/**
 * Chat message contract.
 */
export interface AssistantChatMessage {
  readonly id: string;
  readonly sender: "user" | "assistant" | "system";
  readonly text: string;
  readonly timestamp: number;
  readonly isError?: boolean;
}

/**
 * Props for `StructuralAiAssistantPanel`.
 */
export interface StructuralAiAssistantPanelProps {
  /** Optional custom CSS class name. */
  readonly className?: string;
  /** Optional callback to toggle camera preview window. */
  readonly onToggleCamera?: () => void;
  /** Whether hand camera tracking is currently active. */
  readonly isCameraRunning?: boolean;
}

/** Quick prompt suggestions for rapid structural checks */
const QUICK_PROMPTS = [
  "Bandingkan IWF vs BOX",
  "Rekomendasi tulangan geser",
  "Periksa batas lendutan L/360",
  "Analisis kapasitas lentur nominal Mn",
] as const;

/**
 * Generates an engineering consultant response locally if network endpoint is unreachable.
 * @param query User prompt text.
 * @param state Current beam simulator snapshot.
 * @returns Comprehensive civil engineering consultant guidance.
 */
function generateLocalConsultantHeuristic(
  query: string,
  state: ReturnType<typeof useBeamSimulatorStore.getState>,
): string {
  const q = query.toLowerCase();
  const span = state.spanLengthM;
  const defl = Math.abs(state.maxDeflectionMm);
  const allowDefl = (span * 1000) / state.deflectionLimitDenominator;
  const deflPass = defl <= allowDefl;

  if (q.includes("iwf") || q.includes("box") || q.includes("bandingkan")) {
    return [
      `📊 **Perbandingan Profil Baja (SNI 1729:2020) untuk Bentang ${span.toFixed(1)} m:**`,
      `1. **Profil IWF (Wide Flange):** Efisiensi lentur sumbu kuat ($I_x$) sangat tinggi per satuan berat. Ideal untuk balok lantai tipikal dengan pengekangan lateral yang memadai. Waspadai bahaya tekuk torsi lateral (*Lateral-Torsional Buckling / LTB*) bila bentang tak terkekang $L_b$ cukup panjang.`,
      `2. **Profil Hollow (BOX):** Memiliki konstanta puntir torsi ($J$) hingga 100x lebih besar dari IWF. Sangat direkomendasikan bila balok menerima momen puntir eksentris ($T_u$) atau tidak memiliki sokongan lateral flens tekan.`,
      `💡 **Rekomendasi:** Gunakan **IWF** untuk efisiensi biaya jika flens atas tertahan pelat beton; beralih ke **BOX** jika terjadi torsi gabungan atau ruang vertikal terbatas.`,
    ].join("\n\n");
  }

  if (q.includes("geser") || q.includes("sengkang") || q.includes("stirrup")) {
    const vu = state.governingForces.absoluteMaxVu;
    return [
      `🔩 **Evaluasi Tulangan Geser & Sengkang (SNI 2847:2019 Pasal 22.5):**`,
      `- Gaya geser terfaktor maksimum: $V_u = ${vu.toFixed(1)}$ kN.`,
      `- Ketentuan spasi sengkang maksimum: $s_{\\max} = \\min(d/2, 600\\text{ mm})$.`,
      `- Bila $V_s > 0.33\\sqrt{f'_c} b_w d$, spasi diperketat menjadi $\\min(d/4, 300\\text{ mm})$.`,
      `💡 **Rekomendasi Detailing:** Pasang sengkang rapat ($s = 100\\text{ mm}$) pada zona sendi plastis ($2h$ dari muka tumpuan), lalu perlebar menjadi $s = 150\\text{–}200\\text{ mm}$ di tengah bentang.`,
    ].join("\n\n");
  }

  if (q.includes("lendutan") || q.includes("360") || q.includes("defleksi")) {
    const ratio = (defl / Math.max(allowDefl, 0.001)) * 100;
    return [
      `📏 **Pemeriksaan Batas Lendutan SNI (${span.toFixed(2)} m):**`,
      `- Lendutan maksimum terhitung: $\\Delta_{\\max} = -${defl.toFixed(2)}$ mm.`,
      `- Batas izin lendutan ($L/${state.deflectionLimitDenominator}$): $\\Delta_{\\text{allow}} = ${allowDefl.toFixed(2)}$ mm.`,
      `- Rasio lendutan: **${ratio.toFixed(1)}%** [${deflPass ? "MEMENUHI SYARAT (OK)" : "MELEBIHI BATAS IZIN (NOT OK)"}].`,
      deflPass
        ? `✅ Lendutan balok berada dalam batas aman kelayanan lendutan lentur.`
        : `⚠️ Balok mengalami defleksi berlebih! Disarankan memperbesar tinggi penampang $h$ atau inersia $I_x$ untuk meningkatkan kekakuan $EI$.`,
    ].join("\n\n");
  }

  return [
    `📐 **Konsultasi Struktur IBDS (SNI 2847:2019 / SNI 1729:2020):**`,
    `- Material aktif: **${state.materialKind === "STEEL" ? "Baja Struktural" : "Beton Bertulang"}**.`,
    `- Bentang: **${span.toFixed(2)} m** | Momen maksimum: **${state.governingForces.absoluteMaxMux.toFixed(1)} kNm**.`,
    `- Status defleksi: **${defl.toFixed(2)} mm** dari batas **${allowDefl.toFixed(1)} mm** [${deflPass ? "AMAN" : "PERIKSA KEMBALI"}].`,
    `Ketik pertanyaan atau klik salah satu *Quick Prompt* di atas untuk analisis perancangan mendalam.`,
  ].join("\n\n");
}

/**
 * Structural AI Assistant Panel Component.
 *
 * @param props {@link StructuralAiAssistantPanelProps}
 * @returns ReactElement rendering the assistant conversation window.
 * @example
 * <StructuralAiAssistantPanel onToggleCamera={() => {}} />
 */
export function StructuralAiAssistantPanel({
  className,
  onToggleCamera,
  isCameraRunning = false,
}: StructuralAiAssistantPanelProps): ReactElement {
  const store = useBeamSimulatorStore();

  const [messages, setMessages] = useState<AssistantChatMessage[]>([
    {
      id: "initial-msg",
      sender: "assistant",
      text: "Halo engineer! Aku **Ucuy**, asisten rekayasa struktur dan pemandu cerdas kamu di IBDS. Aku siap membantu analisis lendutan, kepatuhan SNI 2847/1729, optimasi profil balok, hingga menjelaskan seluruh fitur aplikasi ini. Silakan tanya apa saja!",
      timestamp: Date.now(),
    },
  ]);

  const [inputText, setInputText] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom of conversation
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /**
   * Sends prompt to the structural consultant endpoint or processes heuristic fallback.
   * @param query Message string to process.
   */
  const handleSendMessage = async (query: string): Promise<void> => {
    const cleanQuery = query.trim();
    if (!cleanQuery || isLoading) return;

    const userMessage: AssistantChatMessage = {
      id: `user-${Date.now()}`,
      sender: "user",
      text: cleanQuery,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsLoading(true);

    try {
      // Send context payload with current structural state
      const response = await fetch("/api/ai/structural-consultant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: cleanQuery,
          simulatorState: {
            materialKind: store.materialKind,
            loadingMode: store.loadingMode,
            spanLengthM: store.spanLengthM,
            maxDeflectionMm: store.maxDeflectionMm,
            governingForces: store.governingForces,
            steelProfileName: store.selectedSteelProfileName,
            steelGrade: store.steelGrade,
            concreteFcMpa: store.concreteFcMpa,
            deflectionLimitDenominator: store.deflectionLimitDenominator,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Endpoint returned status ${response.status}`);
      }

      const data = (await response.json()) as { reply?: string; message?: string; text?: string };
      const replyText = data.reply || data.message || data.text || "Pesan diterima.";

      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          sender: "assistant",
          text: replyText,
          timestamp: Date.now(),
        },
      ]);
    } catch {
      // Fallback: Generate local civil engineering consultation heuristics
      const fallbackReply = generateLocalConsultantHeuristic(cleanQuery, store);
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-fb-${Date.now()}`,
          sender: "assistant",
          text: fallbackReply,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={cn("text-foreground flex h-full max-h-[460px] flex-col gap-2 text-xs", className)}
    >
      {/* Quick Action Top Bar (Camera Toggle & Reset) */}
      <div className="border-border/40 flex items-center justify-between border-b pb-2">
        <span className="text-[11px] font-bold text-sky-400">🤖 Consultant AI & Multimodal</span>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={() => synthesizeAudioTone("SUCCESS")}
            title="Klik untuk menguji bunyi audio speaker"
            className="h-6 border-emerald-500/30 bg-emerald-500/15 px-2 text-[10px] font-semibold text-emerald-400 hover:bg-emerald-500/25 hover:text-emerald-300"
          >
            🔊 Uji Audio
          </Button>
          {onToggleCamera && (
            <Button
              type="button"
              size="xs"
              variant="outline"
              onClick={onToggleCamera}
              className={cn(
                "h-6 px-2 text-[10px] font-semibold transition-colors",
                isCameraRunning
                  ? "border-destructive/30 bg-destructive/15 text-destructive hover:bg-destructive/25"
                  : "border-cyan-500/30 bg-cyan-500/15 text-cyan-400 hover:bg-cyan-500/25",
              )}
            >
              {isCameraRunning ? "🛑 Stop Cam" : "📷 Cam Tracking"}
            </Button>
          )}
        </div>
      </div>

      {/* Quick Prompt Pills */}
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PROMPTS.map((prompt) => (
          <Badge
            key={prompt}
            variant="outline"
            onClick={() => !isLoading && handleSendMessage(prompt)}
            className={cn(
              "cursor-pointer px-2 py-0.5 text-[10px] font-normal transition-colors select-none",
              isLoading
                ? "cursor-not-allowed opacity-50"
                : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted/70 hover:text-foreground",
            )}
          >
            {prompt}
          </Badge>
        ))}
      </div>

      {/* Chat Messages Scrolling History */}
      <ScrollArea className="border-border/30 bg-background/50 min-h-[220px] flex-1 rounded-md border p-2.5">
        <div className="flex flex-col gap-2.5 pr-2">
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                className={cn(
                  "max-w-[92%] rounded-xl px-3 py-2 text-xs shadow-xs",
                  isUser
                    ? "bg-primary text-primary-foreground ml-auto rounded-br-xs"
                    : "border-border/60 bg-card text-card-foreground mr-auto rounded-bl-xs border",
                )}
              >
                <div className="font-sans text-[11px] leading-relaxed whitespace-pre-wrap">
                  {msg.text}
                </div>
                <div
                  className={cn(
                    "mt-1 text-right text-[8px]",
                    isUser ? "text-primary-foreground/70" : "text-muted-foreground",
                  )}
                >
                  {new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </div>
              </div>
            );
          })}

          {/* Loading / Thinking Indicator */}
          {isLoading && (
            <div className="bg-card mr-auto rounded-xl rounded-bl-xs border border-sky-500/30 px-3 py-1.5 text-[11px] text-sky-400 italic">
              Memeriksa parameter struktur & SNI...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input Form Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        className="mt-auto"
      >
        <InputGroup className="border-border/60 bg-background/60 h-9">
          <InputGroupInput
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Tanya saran optimasi balok..."
            disabled={isLoading}
            className="text-xs"
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="submit"
              size="xs"
              variant="default"
              disabled={isLoading || !inputText.trim()}
              className="bg-linear-to-r from-cyan-500 to-blue-600 font-bold text-white hover:from-cyan-600 hover:to-blue-700"
            >
              Kirim
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
    </div>
  );
}

export default StructuralAiAssistantPanel;
