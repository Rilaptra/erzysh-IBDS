import type { ValidationCaseCard } from "@/types/presentation-types";

export const VALIDATION_DRAFTS_STORAGE_KEY = "ibds:presentation-validation-drafts-v1";
export const MAX_VALIDATION_STORAGE_BYTES = 4 * 1024 * 1024;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidCardCandidate(value: unknown): value is ValidationCaseCard {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === "string" &&
    value.id.trim().length > 0 &&
    typeof value.code === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.category === "string" &&
    typeof value.benchmarkSource === "string" &&
    Array.isArray(value.modelInputs) &&
    Array.isArray(value.comparisonRows) &&
    Array.isArray(value.evidenceMedia) &&
    Array.isArray(value.sniClauses)
  );
}

export function loadLocalValidationDrafts(): ValidationCaseCard[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(VALIDATION_DRAFTS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidCardCandidate).map((card) => ({
      ...card,
      origin: "USER_LOCAL_DRAFT",
    }));
  } catch {
    return [];
  }
}

export function saveLocalValidationDrafts(drafts: readonly ValidationCaseCard[]): {
  readonly ok: boolean;
  readonly error?: string;
} {
  if (typeof window === "undefined") {
    return { ok: false, error: "Storage browser tidak tersedia." };
  }
  try {
    const serialized = JSON.stringify(drafts);
    const byteLength = new TextEncoder().encode(serialized).length;
    if (byteLength > MAX_VALIDATION_STORAGE_BYTES) {
      return {
        ok: false,
        error:
          "Ukuran draft melebihi batas 4 MB. Kurangi jumlah gambar lokal atau ekspor JSON terlebih dahulu.",
      };
    }
    window.localStorage.setItem(VALIDATION_DRAFTS_STORAGE_KEY, serialized);
    return { ok: true };
  } catch {
    return {
      ok: false,
      error: "Gagal menyimpan ke localStorage (kuota browser penuh atau mode privat).",
    };
  }
}

export function exportValidationCardsToJson(cards: readonly ValidationCaseCard[]): string {
  return JSON.stringify(
    {
      schema: "ibds-validation-cards-v1",
      exportedAt: new Date().toISOString(),
      cards,
    },
    null,
    2,
  );
}

export function parseValidationCardsFromJson(rawJson: string): {
  readonly cards: ValidationCaseCard[];
  readonly error?: string;
} {
  try {
    const parsed: unknown = JSON.parse(rawJson);
    const candidateList: unknown = Array.isArray(parsed)
      ? parsed
      : isRecord(parsed) && Array.isArray(parsed.cards)
        ? parsed.cards
        : null;

    if (!Array.isArray(candidateList)) {
      return {
        cards: [],
        error: "Format JSON harus berupa array card atau objek dengan properti 'cards'.",
      };
    }

    const validCards = candidateList.filter(isValidCardCandidate).map((card) => ({
      ...card,
      origin: "USER_LOCAL_DRAFT" as const,
      verificationStatus:
        card.verificationStatus === "VERIFIED" || card.verificationStatus === "TEMPLATE_PLACEHOLDER"
          ? card.verificationStatus
          : ("DRAFT_LOCAL" as const),
    }));

    if (validCards.length === 0) {
      return { cards: [], error: "Tidak ditemukan card validasi yang valid di dalam JSON." };
    }

    return { cards: validCards };
  } catch {
    return { cards: [], error: "Berkas JSON tidak valid atau gagal diparsing." };
  }
}

export async function compressEvidenceImageFile(
  file: File,
  maxWidth = 1280,
  quality = 0.78,
): Promise<{ readonly dataUrl: string; readonly width: number; readonly height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Gagal membaca berkas gambar."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        reject(new Error("Data gambar kosong."));
        return;
      }

      const img = new Image();
      img.onerror = () => reject(new Error("Format gambar tidak dapat dimuat."));
      img.onload = () => {
        const scale = img.width > maxWidth ? maxWidth / img.width : 1;
        const targetWidth = Math.max(1, Math.round(img.width * scale));
        const targetHeight = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement("canvas");
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve({ dataUrl: result, width: img.width, height: img.height });
          return;
        }
        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

        const webpUrl = canvas.toDataURL("image/webp", quality);
        resolve({
          dataUrl: webpUrl.startsWith("data:image/webp")
            ? webpUrl
            : canvas.toDataURL("image/jpeg", quality),
          width: targetWidth,
          height: targetHeight,
        });
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}
