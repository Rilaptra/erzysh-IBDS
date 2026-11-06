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

import React, { type ReactElement, useEffect, useRef, useState } from "react";

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
      text: "Halo engineer! Saya **Asisten Rekayasa Struktur IBDS**. Saya dapat membantu memeriksa kepatuhan SNI 2847/1729, optimasi profil balok, dan analisis gaya dalam. Silakan ketik pertanyaan Anda.",
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
      className={className}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: 460,
        gap: 8,
        color: "#E2E8F0",
        fontSize: 12,
      }}
    >
      {/* Quick Action Top Bar (Camera Toggle & Reset) */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 6,
          borderBottom: "1px solid rgba(148, 163, 184, 0.12)",
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: "#38BDF8" }}>
          🤖 Consultant AI & Multimodal
        </span>
        {onToggleCamera && (
          <button
            type="button"
            onClick={onToggleCamera}
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              border: "1px solid rgba(148, 163, 184, 0.2)",
              background: isCameraRunning ? "rgba(239, 68, 68, 0.2)" : "rgba(6, 182, 212, 0.15)",
              color: isCameraRunning ? "#FCA5A5" : "#38BDF8",
              fontSize: 10,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {isCameraRunning ? "🛑 Stop Cam" : "📷 Cam Tracking"}
          </button>
        )}
      </div>

      {/* Quick Prompt Pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            onClick={() => handleSendMessage(prompt)}
            disabled={isLoading}
            style={{
              background: "rgba(30, 41, 59, 0.6)",
              border: "1px solid rgba(148, 163, 184, 0.14)",
              borderRadius: 6,
              padding: "3px 8px",
              color: "#94A3B8",
              fontSize: 10,
              cursor: isLoading ? "not-allowed" : "pointer",
              transition: "all 120ms ease",
            }}
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages Scrolling History */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingRight: 4,
          minHeight: 220,
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.sender === "user";
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isUser ? "flex-end" : "flex-start",
                maxWidth: "92%",
                background: isUser
                  ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                  : "rgba(15, 23, 42, 0.8)",
                border: isUser ? "none" : "1px solid rgba(56, 189, 248, 0.2)",
                borderRadius: isUser ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
                padding: "8px 12px",
                color: isUser ? "#FFFFFF" : "#CBD5E1",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  lineHeight: 1.45,
                  whiteSpace: "pre-wrap",
                  fontFamily: isUser ? "inherit" : "system-ui, -apple-system, sans-serif",
                }}
              >
                {msg.text}
              </div>
              <div
                style={{
                  fontSize: 8,
                  color: isUser ? "rgba(255, 255, 255, 0.6)" : "#64748B",
                  textAlign: "right",
                  marginTop: 4,
                }}
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
          <div
            style={{
              alignSelf: "flex-start",
              background: "rgba(15, 23, 42, 0.8)",
              border: "1px solid rgba(56, 189, 248, 0.2)",
              borderRadius: "10px 10px 10px 2px",
              padding: "6px 12px",
              fontSize: 11,
              color: "#38BDF8",
              fontStyle: "italic",
            }}
          >
            Memeriksa parameter struktur & SNI...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form Box */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputText);
        }}
        style={{
          display: "flex",
          gap: 6,
          marginTop: "auto",
        }}
      >
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Tanya saran optimasi balok..."
          disabled={isLoading}
          style={{
            flex: 1,
            background: "rgba(10, 15, 20, 0.8)",
            border: "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: 6,
            padding: "6px 10px",
            color: "#F8FAFC",
            fontSize: 11,
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !inputText.trim()}
          style={{
            background: "linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%)",
            border: "none",
            borderRadius: 6,
            padding: "6px 12px",
            color: "#FFFFFF",
            fontSize: 11,
            fontWeight: 700,
            cursor: isLoading || !inputText.trim() ? "not-allowed" : "pointer",
            opacity: isLoading || !inputText.trim() ? 0.6 : 1,
          }}
        >
          Kirim
        </button>
      </form>
    </div>
  );
}

export default StructuralAiAssistantPanel;
