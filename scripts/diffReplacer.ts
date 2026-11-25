// scripts/diffReplacer.ts
// Terapkan diff output AI ke file secara bulk.
// Format yang didukung (auto-deteksi):
//   1. SEARCH/REPLACE blocks       — patch dari AI
//   2. Unified diff gaya git       — patch dari AI / git diff
//   3. Diagnostik biome check/ci   — path:line:col lint/... / format → SKELETON patch untuk AI
//      & TypeScript (tsc)          — path(line,col): error TS... / path:line:col - error TS...
// Mode 3 tidak mengubah file kode: dia mencetak SEARCH/REPLACE skeleton
// (SEARCH = baris asli file, REPLACE = salinannya) supaya AI tinggal mengedit.
// Default: review UI di browser (accept/reject per blok) sebelum ditulis.
//
// Usage:
//   bun diff patch.md            baca patch dari file
//   cat patch.md | bun diff -    baca patch via pipe
//   bun diff                     mode paste interaktif (TTY)
//   bun diff --dry-run           pratinjau tanpa menulis file
//   bun diff --yes               apply langsung tanpa review UI
//   bun lint 2>&1 | bun diff -   output biome/tsc → skeleton patch (stdout)
//   bun diff - --out=.ai/patch.md --context=5   skeleton ditulis ke file

import { exec } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import { createInterface } from "node:readline";

import { c, write } from "@rilaptra/tui";

import { zyLog } from "../src/lib/zylog";

const rootDir = process.cwd();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type PatchFormat = "search-replace" | "unified";
type InputFormat = PatchFormat | "diagnostics";
type MatchType = "exact" | "trimmed" | "collapsed";

interface Diagnostic {
  path: string; // relatif repo, sudah dinormalisasi
  line?: number; // 1-based
  col?: number; // 1-based
  source: "biome" | "tsc";
  rule?: string; // mis. "lint/suspicious/noConsole", "format", "TS2322"
  message: string;
}

interface ReplaceOp {
  kind: "replace";
  search: string[];
  replace: string[];
  lineHint?: number; // posisi approx dari hunk unified (0-based), untuk drift tolerance
  headerText?: string; // header @@ ... @@ asal (untuk display)
}

interface CreateOp {
  kind: "create";
  content: string[];
}

interface DeleteOp {
  kind: "delete";
}

type Op = ReplaceOp | CreateOp | DeleteOp;

interface FilePatch {
  path: string;
  ops: Op[];
  format: PatchFormat;
}

interface ParseOutcome {
  patches: FilePatch[];
  errors: string[];
}

interface DiffLine {
  t: "ctx" | "add" | "del";
  s: string;
}

interface OpResult {
  id: string;
  ok: boolean;
  error?: string;
  matchType?: MatchType;
}

interface FileApplyResult {
  path: string;
  status: "changed" | "error" | "skipped";
  action: "modify" | "create" | "delete";
  ops: OpResult[];
  error?: string;
}

interface HunkView {
  id: string;
  header: string;
  status: "ok" | "error";
  error?: string;
  matchType?: MatchType;
  lines: DiffLine[];
}

interface Payload {
  files: Array<{
    path: string;
    status: FileApplyResult["status"];
    action: FileApplyResult["action"];
    error?: string;
    adds: number;
    dels: number;
    hunks: HunkView[];
  }>;
}

interface Flags {
  dryRun: boolean;
  yes: boolean;
  noOpen: boolean;
  help: boolean;
  port: number;
  out?: string; // mode diagnostik: tulis skeleton ke file (default: stdout)
  context: number; // mode diagnostik: radius konteks (default 3)
}

// ---------------------------------------------------------------------------
// Util
// ---------------------------------------------------------------------------

const RE_SEARCH = /^<{7}\s*SEARCH/i;
const RE_REPLACE = /^>{7}\s*REPLACE/i;
const RE_DELETE = /^>{7}\s*DELETE/i;
const RE_SEPARATOR = /^={7,}$/;
const RE_HEADER = /^-{3,}\s+(.+?)\s*$/;
const RE_HUNK = /^@@ -(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))? @@/;

function normalizePath(raw: string): string | null {
  let p = raw.trim();
  p = p.replace(/^[`"']+|[`"']+$/g, "");
  p = p.replace(/\\/g, "/");
  p = p.replace(/^a\//, "").replace(/^b\//, "");
  while (p.startsWith("./")) p = p.slice(2);
  p = p.replace(/:$/, "");
  if (!p || p === "." || p === "/") return null;
  return p;
}

function safeAbsPath(repoRel: string): string | null {
  const abs = resolve(rootDir, repoRel);
  const rel = relative(rootDir, abs);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return null;
  return abs;
}

function opId(fileIdx: number, opIdx: number): string {
  return `${fileIdx}:${opIdx}`;
}

function detectEol(content: string): "\r\n" | "\n" {
  const crlf = (content.match(/\r\n/g) ?? []).length;
  const lf = (content.match(/(?<!\r)\n/g) ?? []).length;
  return crlf > lf ? "\r\n" : "\n";
}

// ---------------------------------------------------------------------------
// Parser: SEARCH/REPLACE
// ---------------------------------------------------------------------------

export function parseSearchReplace(lines: string[]): ParseOutcome {
  const patches: FilePatch[] = [];
  const byPath = new Map<string, FilePatch>();
  const errors: string[] = [];

  let pendingHeader: string | null = null;
  let current: FilePatch | null = null;
  let mode: "idle" | "search" | "replace" = "idle";
  let searchBuf: string[] = [];
  let replaceBuf: string[] = [];

  const flush = () => {
    if (mode === "idle") return;
    if (mode === "search") {
      if (current) errors.push(`Blok SEARCH tanpa penutup di ${current.path} — dilewati`);
      mode = "idle";
      searchBuf = [];
      replaceBuf = [];
      return;
    }
    if (current) {
      if (searchBuf.length === 0 && replaceBuf.length === 0) {
        errors.push(`Blok kosong untuk ${current.path} — dilewati`);
      } else if (searchBuf.length === 0) {
        current.ops.push({ kind: "create", content: replaceBuf });
      } else {
        current.ops.push({
          kind: "replace",
          search: searchBuf,
          replace: replaceBuf,
        });
      }
    }
    mode = "idle";
    searchBuf = [];
    replaceBuf = [];
  };

  // Aktifkan file target dari header `--- path` yang tertunda
  const resolveCurrent = () => {
    if (!pendingHeader) return current !== null;
    let file = byPath.get(pendingHeader);
    if (!file) {
      file = { path: pendingHeader, ops: [], format: "search-replace" };
      patches.push(file);
      byPath.set(pendingHeader, file);
    }
    current = file;
    pendingHeader = null;
    return true;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");
    const trimmed = line.trim();

    if (mode === "search") {
      if (RE_SEPARATOR.test(trimmed)) {
        mode = "replace";
        continue;
      }
      searchBuf.push(line);
      continue;
    }

    if (mode === "replace") {
      if (RE_REPLACE.test(trimmed)) {
        flush();
        continue;
      }
      replaceBuf.push(line);
      continue;
    }

    // mode idle — cari header file / pembuka blok
    if (/^```/.test(trimmed)) continue; // code fence di luar blok diabaikan
    if (RE_SEARCH.test(trimmed)) {
      if (!resolveCurrent()) {
        errors.push(`Blok SEARCH tanpa header file (baris ${i + 1}) — dilewati`);
        continue;
      }
      mode = "search";
      searchBuf = [];
      replaceBuf = [];
      continue;
    }
    if (RE_DELETE.test(trimmed)) {
      if (!resolveCurrent()) {
        errors.push(`Marker DELETE tanpa header file (baris ${i + 1}) — dilewati`);
        continue;
      }
      current!.ops.push({ kind: "delete" });
      continue;
    }
    const header = RE_HEADER.exec(line);
    if (header) {
      const p = normalizePath(header[1]);
      if (p) pendingHeader = p;
    }
    // baris lain dianggap prose AI — diabaikan
  }
  flush();

  return { patches: patches.filter((p) => p.ops.length > 0), errors };
}

// ---------------------------------------------------------------------------
// Parser: unified diff (git style)
// ---------------------------------------------------------------------------

function parseUnified(lines: string[]): ParseOutcome {
  const patches: FilePatch[] = [];
  const byPath = new Map<string, FilePatch>();
  const errors: string[] = [];

  const getFile = (path: string): FilePatch => {
    let file = byPath.get(path);
    if (!file) {
      file = { path, ops: [], format: "unified" };
      patches.push(file);
      byPath.set(path, file);
    }
    return file;
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i].replace(/\r$/, "");
    const trimmed = line.trim();

    // Skip metadata git & code fence
    if (
      trimmed === "" ||
      /^```/.test(trimmed) ||
      /^diff --git /.test(line) ||
      /^(index|old mode|new mode|new file mode|deleted file mode|similarity index|dissimilarity index|rename from|rename to)\b/.test(
        line,
      ) ||
      /^Binary files /.test(line) ||
      trimmed === "GIT binary patch"
    ) {
      i++;
      continue;
    }

    const oldHeader = /^--- (\S+)/.exec(line);
    if (!oldHeader) {
      i++;
      continue;
    }
    const plusLine = lines[i + 1]?.replace(/\r$/, "") ?? "";
    const newHeader = /^\+\+\+ (\S+)/.exec(plusLine);
    if (!newHeader) {
      errors.push(`Header --- tanpa +++ (baris ${i + 1}) — dilewati`);
      i++;
      continue;
    }

    const oldIsNull = oldHeader[1] === "/dev/null";
    const newIsNull = newHeader[1] === "/dev/null";
    if (oldIsNull && newIsNull) {
      errors.push(`Patch /dev/null → /dev/null (baris ${i + 1}) — diabaikan`);
      i += 2;
      continue;
    }

    const target = normalizePath(newIsNull ? oldHeader[1] : newHeader[1]);
    if (!target) {
      errors.push(`Path tidak valid (baris ${i + 2})`);
      i += 2;
      continue;
    }
    const file = getFile(target);
    i += 2;

    if (oldIsNull) {
      // File baru: kumpulkan semua baris '+' dari hunk berikutnya
      const content: string[] = [];
      while (i < lines.length && RE_HUNK.test(lines[i])) {
        i++;
        while (i < lines.length) {
          const cl = lines[i].replace(/\r$/, "");
          if (cl.startsWith("+")) {
            content.push(cl.slice(1));
            i++;
          } else if (cl.startsWith("\\")) {
            i++;
          } else {
            break;
          }
        }
      }
      if (content.length === 0) {
        errors.push(`File baru ${target} tanpa isi — dilewati`);
      } else {
        file.ops.push({ kind: "create", content });
      }
      continue;
    }

    if (newIsNull) {
      file.ops.push({ kind: "delete" });
      continue;
    }

    // Hunk-hunk modify
    while (i < lines.length) {
      const l = lines[i].replace(/\r$/, "");
      const h = RE_HUNK.exec(l);
      if (!h) break;
      const oldStart = Number.parseInt(h[1], 10);
      const oldCount = h[2] ? Number.parseInt(h[2], 10) : 1;
      const newCount = h[4] ? Number.parseInt(h[4], 10) : 1;
      i++;

      const oldSeg: string[] = [];
      const newSeg: string[] = [];
      let remaining = oldCount + newCount;
      while (i < lines.length && remaining > 0) {
        const cl = lines[i].replace(/\r$/, "");
        // Hunk berakhir bila bertemu header file/hunk berikutnya (durasi counts tidak konsisten)
        if (/^(diff --git |--- |\+\+\+ )/.test(cl) || RE_HUNK.test(cl)) break;
        if (cl.startsWith("+")) {
          newSeg.push(cl.slice(1));
          remaining--;
        } else if (cl.startsWith("-")) {
          oldSeg.push(cl.slice(1));
          remaining--;
        } else if (cl.startsWith(" ")) {
          oldSeg.push(cl.slice(1));
          newSeg.push(cl.slice(1));
          remaining -= 2;
        } else if (cl === "") {
          // context baris kosong tanpa leading space (kadang hilang saat AI meng-copy)
          oldSeg.push("");
          newSeg.push("");
          remaining -= 2;
        } else if (cl.startsWith("\\")) {
          // "\ No newline at end of file" — diabaikan
        } else {
          break;
        }
        i++;
      }
      file.ops.push({
        kind: "replace",
        search: oldSeg,
        replace: newSeg,
        lineHint: oldStart - 1,
        headerText: l.trim(),
      });
    }
  }

  return { patches: patches.filter((p) => p.ops.length > 0), errors };
}

// ---------------------------------------------------------------------------
// Parser: diagnostik biome (check/ci) & TypeScript (tsc)
// ---------------------------------------------------------------------------

// tsc pretty memuntahkan ANSI walau di-pipe — bersihkan dulu sebelum scan.
function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}

// biome 2.x: `path:line:col lint/group/rule  FIXABLE  ━━━` atau `path format ━━━` (kategori
// format/parse tanpa posisi). Diagnostik global tanpa path (mis. `check ━━━`) tidak match.
const RE_BIOME_DIAG =
  /^(\S+?)(?::(\d+):(\d+))?\s+(lint\/\S*|format|parse|organizeImports|assist\/\S*|syntax\/\S*|configuration\/\S*)(?:\s+FIXABLE)?\s*━/;
// tsc gaya pipe: `path(line,col): error TS1234: msg`
const RE_TSC_PIPE = /^(\S+?)\((\d+),(\d+)\):\s*(?:error|warning)\s+(TS\d+):\s*(.*)$/;
// tsc gaya pretty: `path:line:col - error TS1234: msg`
const RE_TSC_PRETTY = /^(\S+?):(\d+):(\d+)\s+-\s+(?:error|warning)\s+(TS\d+):\s*(.*)$/;

function parseDiagnostics(raw: string): Diagnostic[] {
  const lines = stripAnsi(raw).split("\n");
  const diags: Diagnostic[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, "");

    const biome = RE_BIOME_DIAG.exec(line);
    if (biome) {
      const path = normalizePath(biome[1]);
      if (!path) continue;
      // Pesan manusia = baris non-kosong pertama setelah header (buang simbol ×/✖/!/ℹ/…)
      let message = "";
      for (let j = i + 1; j < lines.length && j <= i + 3; j++) {
        const t = lines[j].replace(/\r$/, "").trim();
        if (t) {
          message = t.replace(/^[×✖✗!⚠ℹi]+/, "").trim();
          break;
        }
      }
      const diagLine = biome[2] ? Number.parseInt(biome[2], 10) : undefined;
      const key = `${path}:${diagLine ?? "*"}:${biome[4]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      diags.push({
        path,
        line: diagLine,
        col: biome[3] ? Number.parseInt(biome[3], 10) : undefined,
        source: "biome",
        rule: biome[4],
        message,
      });
      continue;
    }

    const tsc = RE_TSC_PIPE.exec(line) ?? RE_TSC_PRETTY.exec(line);
    if (tsc) {
      const path = normalizePath(tsc[1]);
      if (!path) continue;
      const diagLine = Number.parseInt(tsc[2], 10);
      const key = `${path}:${diagLine}:${tsc[4]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      diags.push({
        path,
        line: diagLine,
        col: Number.parseInt(tsc[3], 10),
        source: "tsc",
        rule: tsc[4],
        message: tsc[5],
      });
    }
  }

  return diags;
}

// ---------------------------------------------------------------------------
// Skeleton generator: diagnostik → SEARCH/REPLACE blocks untuk AI
// ---------------------------------------------------------------------------

interface SkeletonResult {
  skeleton: string;
  blocks: number;
  files: number;
  warnings: string[];
}

function buildSkeleton(diags: Diagnostic[], contextRadius: number): SkeletonResult {
  const byPath = new Map<string, Diagnostic[]>();
  for (const d of diags) {
    const list = byPath.get(d.path) ?? [];
    list.push(d);
    byPath.set(d.path, list);
  }

  const parts: string[] = [];
  const warnings: string[] = [];
  let blocks = 0;
  let fileCount = 0;

  for (const [path, list] of byPath) {
    const abs = safeAbsPath(path);
    if (!abs || !existsSync(abs)) {
      warnings.push(`File tidak ditemukan: ${path} — diagnostik dilewati`);
      continue;
    }
    const raw = readFileSync(abs, "utf-8").replace(/\r\n/g, "\n").split("\n");
    if (raw.length > 0 && raw[raw.length - 1] === "") raw.pop();

    // Window konteks per diagnostik (0-based inclusive); yang berdekatan digabung.
    interface Window {
      start: number;
      end: number;
      msgs: Diagnostic[];
    }
    const windows: Window[] = [];
    for (const d of [...list].sort((a, b) => (a.line ?? 1) - (b.line ?? 1))) {
      if (d.line !== undefined && (d.line < 1 || d.line > raw.length)) {
        warnings.push(`${path}:${d.line} di luar EOF (file ${raw.length} baris) — dilewati`);
        continue;
      }
      const center = (d.line ?? 1) - 1;
      const start = Math.max(0, center - contextRadius);
      const end = Math.min(raw.length - 1, center + contextRadius);
      const last = windows[windows.length - 1];
      if (last && start <= last.end + 2) {
        last.end = Math.max(last.end, end);
        last.msgs.push(d);
      } else {
        windows.push({ start, end, msgs: [d] });
      }
    }

    if (windows.length === 0) continue;
    parts.push(`--- ${path}`);
    fileCount++;

    for (const w of windows) {
      // Perlebar window sampai isinya unik di file (maks +7 baris per sisi)
      // supaya blok hasil edit AI pasti bisa di-apply tanpa ambiguity.
      let { start, end } = w;
      let search = raw.slice(start, end + 1);
      let widened = 0;
      while (findPositions(raw, search, eqExact).length > 1 && widened < 7) {
        if (start === 0 && end === raw.length - 1) break;
        if (start > 0) start--;
        if (end < raw.length - 1) end++;
        search = raw.slice(start, end + 1);
        widened++;
      }
      if (findPositions(raw, search, eqExact).length > 1) {
        warnings.push(`${path}: konteks blok tetap tidak unik — minta AI menambah baris konteks`);
      }

      for (const d of w.msgs) {
        const loc = d.line !== undefined ? `${path}:${d.line}${d.col ? `:${d.col}` : ""}` : path;
        const tag = d.source === "biome" ? `biome ${d.rule}` : (d.rule ?? "tsc");
        parts.push(`// ${loc} · ${tag}`);
        if (d.message) parts.push(`// ${d.message}`);
      }
      parts.push("<<<<<<< SEARCH");
      parts.push(...search);
      parts.push("=======");
      parts.push(...search); // salinan — AI mengedit bagian yang perlu diubah
      parts.push(">>>>>>> REPLACE");
      blocks++;
    }
  }

  const header = [
    `// Skeleton patch dari ${diags.length} diagnostik (${fileCount} file, ${blocks} blok).`,
    "// REPLACE berisi salinan SEARCH — ubah hanya baris yang perlu, biarkan sisanya.",
    "",
  ];
  return {
    skeleton: [...header, ...parts, ""].join("\n"),
    blocks,
    files: fileCount,
    warnings,
  };
}

function detectFormat(text: string): InputFormat | null {
  const lines = text.replace(/\r/g, "").split("\n");
  for (const line of lines) {
    if (RE_SEARCH.test(line.trim())) return "search-replace";
  }
  if (/^diff --git /m.test(text)) return "unified";
  if (/^@@ -\d+(,\d+)? \+\d+(,\d+)? @@/m.test(text)) return "unified";
  if (/^--- (a\/|\/dev\/null)/m.test(text)) return "unified";
  for (const line of stripAnsi(text).replace(/\r/g, "").split("\n")) {
    if (RE_BIOME_DIAG.test(line) || RE_TSC_PIPE.test(line) || RE_TSC_PRETTY.test(line))
      return "diagnostics";
  }
  return null;
}

// ---------------------------------------------------------------------------
// Matcher & apply engine
// ---------------------------------------------------------------------------

type EqFn = (a: string, b: string) => boolean;
const eqExact: EqFn = (a, b) => a === b;
const eqTrimmed: EqFn = (a, b) => a.trim() === b.trim();
const eqCollapsed: EqFn = (a, b) => a.replace(/\s+/g, " ").trim() === b.replace(/\s+/g, " ").trim();

function findPositions(hay: string[], needle: string[], eq: EqFn): number[] {
  const res: number[] = [];
  if (needle.length === 0 || hay.length < needle.length) return res;
  outer: for (let p = 0; p <= hay.length - needle.length; p++) {
    for (let i = 0; i < needle.length; i++) {
      if (!eq(hay[p + i], needle[i])) continue outer;
    }
    res.push(p);
  }
  return res;
}

function applyReplaceOp(
  fileLines: string[],
  op: ReplaceOp,
  displayPath: string,
): { ok: boolean; error?: string; matchType?: MatchType } {
  // Hunk unified insertion murni (oldCount = 0): sisipkan pada posisi hint
  if (op.search.length === 0) {
    if (op.lineHint === undefined) {
      return {
        ok: false,
        error: "SEARCH kosong — hanya valid untuk membuat file baru",
      };
    }
    const at = Math.max(0, Math.min(op.lineHint, fileLines.length));
    fileLines.splice(at, 0, ...op.replace);
    return { ok: true };
  }

  const strategies: Array<{ type: MatchType; eq: EqFn }> = [
    { type: "exact", eq: eqExact },
    { type: "trimmed", eq: eqTrimmed },
    { type: "collapsed", eq: eqCollapsed },
  ];

  for (const st of strategies) {
    const positions = findPositions(fileLines, op.search, st.eq);
    if (positions.length === 0) continue;
    let pos = positions[0];
    if (positions.length > 1) {
      if (op.lineHint !== undefined) {
        // unified diff: pilih kandidat terdekat dari posisi asal hunk
        pos = positions.reduce(
          (best, p) => (Math.abs(p - op.lineHint!) < Math.abs(best - op.lineHint!) ? p : best),
          positions[0],
        );
      } else {
        return {
          ok: false,
          error: `SEARCH cocok di ${positions.length} lokasi (baris ${positions.map((p) => p + 1).join(", ")}) — tambahkan baris konteks agar unik`,
        };
      }
    }
    fileLines.splice(pos, op.search.length, ...op.replace);
    return { ok: true, matchType: st.type };
  }
  return { ok: false, error: `SEARCH tidak ditemukan di ${displayPath}` };
}

interface ApplyOptions {
  write: boolean;
  approved: Set<string> | null;
}

export function applyPatches(patches: FilePatch[], opts: ApplyOptions): FileApplyResult[] {
  const results: FileApplyResult[] = [];

  patches.forEach((patch, fileIdx) => {
    const action: FileApplyResult["action"] = patch.ops.some((o) => o.kind === "create")
      ? "create"
      : patch.ops.some((o) => o.kind === "delete")
        ? "delete"
        : "modify";

    const abs = safeAbsPath(patch.path);
    if (!abs) {
      results.push({
        path: patch.path,
        status: "error",
        ops: [],
        action,
        error: "Path tidak valid / di luar root repo",
      });
      return;
    }

    let lines: string[] | null = null;
    let eol: "\r\n" | "\n" = "\n";
    let endsNL = true;
    let failed = false;
    let deleteFlag = false;
    const opResults: OpResult[] = [];

    const ensureLoaded = (): boolean => {
      if (lines !== null) return true;
      if (!existsSync(abs)) return false;
      const raw = readFileSync(abs, "utf-8");
      eol = detectEol(raw);
      const norm = raw.replace(/\r\n/g, "\n");
      endsNL = norm.endsWith("\n");
      lines = norm.split("\n");
      if (endsNL) lines.pop();
      return true;
    };

    patch.ops.forEach((op, opIdx) => {
      const id = opId(fileIdx, opIdx);
      if (opts.approved !== null && !opts.approved.has(id)) return;
      if (failed) {
        opResults.push({
          id,
          ok: false,
          error: "Dilewati: blok sebelumnya di file ini gagal",
        });
        return;
      }

      if (op.kind === "create") {
        if (lines !== null || existsSync(abs)) {
          opResults.push({
            id,
            ok: false,
            error: "File sudah ada — create dibatalkan",
          });
          failed = true;
          return;
        }
        lines = [...op.content];
        eol = "\n";
        endsNL = true;
        opResults.push({ id, ok: true });
        return;
      }

      if (op.kind === "delete") {
        if (!existsSync(abs)) {
          opResults.push({ id, ok: false, error: "File tidak ditemukan" });
          failed = true;
          return;
        }
        deleteFlag = true;
        opResults.push({ id, ok: true });
        return;
      }

      if (!ensureLoaded()) {
        opResults.push({ id, ok: false, error: "File tidak ditemukan" });
        failed = true;
        return;
      }
      const r = applyReplaceOp(lines!, op, patch.path);
      opResults.push({ id, ok: r.ok, error: r.error, matchType: r.matchType });
      if (!r.ok) failed = true;
    });

    if (opResults.length === 0) {
      results.push({ path: patch.path, status: "skipped", ops: [], action });
      return;
    }
    if (failed) {
      results.push({
        path: patch.path,
        status: "error",
        ops: opResults,
        action,
        error: "Ada blok gagal — file tidak ditulis",
      });
      return;
    }

    if (opts.write) {
      if (deleteFlag) {
        if (existsSync(abs)) rmSync(abs);
      } else if (lines !== null) {
        // lines/eol di-assign di dalam closure callback, jadi TS tidak bisa
        // melacak narrowing-nya di sini — assertion untuk memulihkan tipe aslinya.
        const body = (lines as string[]).join("\n") + (endsNL ? "\n" : "");
        mkdirSync(dirname(abs), { recursive: true });
        writeFileSync(abs, (eol as "\r\n" | "\n") === "\r\n" ? body.replace(/\n/g, "\r\n") : body);
      }
    }
    results.push({
      path: patch.path,
      status: "changed",
      ops: opResults,
      action,
    });
  });

  return results;
}

// ---------------------------------------------------------------------------
// Display: line diff (LCS) & payload untuk review UI
// ---------------------------------------------------------------------------

function diffLines(a: string[], b: string[]): DiffLine[] {
  const n = a.length;
  const m = b.length;
  if (n * m > 4_000_000) {
    // Terlalu besar untuk DP — fallback: tampil seluruhnya sebagai del+add
    return [
      ...a.map((s) => ({ t: "del" as const, s })),
      ...b.map((s) => ({ t: "add" as const, s })),
    ];
  }
  const dp = new Int32Array((n + 1) * (m + 1));
  const idx = (i: number, j: number) => i * (m + 1) + j;
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[idx(i, j)] =
        a[i] === b[j] ? dp[idx(i + 1, j + 1)] + 1 : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ t: "ctx", s: a[i] });
      i++;
      j++;
    } else if (dp[idx(i + 1, j)] >= dp[idx(i, j + 1)]) {
      out.push({ t: "del", s: a[i] });
      i++;
    } else {
      out.push({ t: "add", s: b[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ t: "del", s: a[i] });
    i++;
  }
  while (j < m) {
    out.push({ t: "add", s: b[j] });
    j++;
  }
  return out;
}

function buildPayload(patches: FilePatch[], preview: FileApplyResult[]): Payload {
  const files = patches.map((patch, fileIdx) => {
    const pr = preview[fileIdx];
    const hunks: HunkView[] = patch.ops.map((op, opIdx) => {
      const id = opId(fileIdx, opIdx);
      const opr = pr.ops.find((o) => o.id === id);
      let lines: DiffLine[];
      let header: string;
      if (op.kind === "create") {
        lines = op.content.map((s) => ({ t: "add" as const, s }));
        header = "File baru";
      } else if (op.kind === "delete") {
        const abs = safeAbsPath(patch.path);
        const raw =
          abs && existsSync(abs)
            ? readFileSync(abs, "utf-8").replace(/\r\n/g, "\n").split("\n")
            : [];
        if (raw.length > 0 && raw[raw.length - 1] === "") raw.pop();
        lines = raw.map((s) => ({ t: "del" as const, s }));
        header = "Hapus file";
      } else {
        lines = diffLines(op.search, op.replace);
        header = op.headerText ?? `Blok ${opIdx + 1}`;
      }
      return {
        id,
        header,
        status: opr?.ok ? "ok" : "error",
        error: opr?.error,
        matchType: opr?.matchType,
        lines,
      };
    });
    const flat = hunks.flatMap((h) => h.lines);
    return {
      path: patch.path,
      status: pr.status,
      action: pr.action,
      error: pr.error,
      adds: flat.filter((l) => l.t === "add").length,
      dels: flat.filter((l) => l.t === "del").length,
      hunks,
    };
  });
  return { files };
}

// ---------------------------------------------------------------------------
// Terminal output
// ---------------------------------------------------------------------------

function colorLine(l: DiffLine): string {
  if (l.t === "add") return c.green(`+ ${l.s}`);
  if (l.t === "del") return c.red(`- ${l.s}`);
  return c.gray(`  ${l.s}`);
}

function printDryRun(patches: FilePatch[], preview: FileApplyResult[]) {
  const payload = buildPayload(patches, preview);
  write("\n");
  for (const file of payload.files) {
    const icon =
      file.status === "error" ? c.red("✗") : file.status === "skipped" ? c.gray("○") : c.green("✓");
    const actionLabel =
      file.action === "create"
        ? c.cyanBold("[buat]")
        : file.action === "delete"
          ? c.cyanBold("[hapus]")
          : "";
    write(
      `${icon} ${c.bold(file.path)} ${actionLabel} ${c.green(`+${file.adds}`)} ${c.red(`-${file.dels}`)}\n`,
    );
    if (file.error) write(`${c.red(`   ${file.error}`)}\n`);
    for (const hunk of file.hunks) {
      const mark = hunk.status === "ok" ? c.gray(hunk.header) : c.red(hunk.header);
      const fuzzy =
        hunk.matchType && hunk.matchType !== "exact" ? c.yellow(` [${hunk.matchType} match]`) : "";
      write(`   ${mark}${fuzzy}\n`);
      if (hunk.error) write(`${c.red(`   ⚠ ${hunk.error}`)}\n`);
      for (const l of hunk.lines) write(`   ${colorLine(l)}\n`);
    }
    write("\n");
  }
}

function printSummary(results: FileApplyResult[]) {
  write("\n");
  for (const r of results) {
    if (r.status === "skipped") {
      write(`${c.gray(`○ ${r.path} — dilewati`)}\n`);
      continue;
    }
    if (r.status === "error") {
      write(`${c.red(`✗ ${r.path} — ${r.error}`)}\n`);
      for (const op of r.ops) {
        if (!op.ok) write(`${c.red(`   [${op.id}] ${op.error}`)}\n`);
      }
      continue;
    }
    const fuzzy = r.ops.filter((o) => o.matchType && o.matchType !== "exact");
    const label =
      r.action === "create"
        ? "dibuat"
        : r.action === "delete"
          ? "dihapus"
          : `${r.ops.length} blok diterapkan`;
    const fuzzyNote = fuzzy.length > 0 ? c.yellow(` (${fuzzy.length} blok fuzzy-match)`) : "";
    write(`${c.green(`✓ ${r.path} — ${label}${fuzzyNote}`)}\n`);
  }
  write("\n");
  const hasError = results.some((r) => r.status === "error");
  if (hasError) {
    zyLog.warn("Ada file gagal — perbaiki patch lalu jalankan ulang untuk file tersebut.");
  } else if (results.some((r) => r.status === "changed")) {
    zyLog.info(
      "Selesai. Periksa hasilnya dengan `git diff` lalu jalankan `bun run lint` bila perlu.",
    );
  }
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

async function readPastedText(): Promise<string> {
  zyLog.info("Tempel output diff AI di bawah, akhiri dengan:");
  write(`${c.gray("  - baris kosong dua kali berturut-turut, atau")}\n`);
  write(`${c.gray("  - Ctrl+Z lalu Enter (Windows) / Ctrl+D (Unix)")}\n`);
  const rl = createInterface({ input: process.stdin, terminal: true });
  const lines: string[] = [];
  let emptyCount = 0;
  for await (const line of rl) {
    if (line.trim() === "") {
      emptyCount++;
      if (emptyCount >= 2) break;
    } else {
      emptyCount = 0;
    }
    lines.push(line);
  }
  rl.close();
  return lines.join("\n");
}

async function readInput(input: string | null): Promise<string> {
  if (input && input !== "-") {
    const abs = resolve(process.cwd(), input);
    if (!existsSync(abs)) {
      zyLog.error(`File patch tidak ditemukan: ${input}`);
      process.exit(1);
    }
    return readFileSync(abs, "utf-8");
  }
  if (input === "-" || !process.stdin.isTTY) {
    const text = await new Response(Bun.stdin).text();
    if (!text.trim()) {
      zyLog.error("Stdin kosong — tidak ada diff yang dibaca.");
      process.exit(1);
    }
    return text;
  }
  return readPastedText();
}

// ---------------------------------------------------------------------------
// Review UI server
// ---------------------------------------------------------------------------

function openBrowser(url: string) {
  const plat = process.platform;
  const cmd =
    plat === "win32"
      ? `start "" "${url}"`
      : plat === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(cmd, (err) => {
    if (err) zyLog.warn(`Gagal membuka browser otomatis — buka manual: ${url}`);
  });
}

function startReviewServer(patches: FilePatch[], preview: FileApplyResult[], flags: Flags) {
  const html = readFileSync(join(import.meta.dir, "diffReplacer.review.html"), "utf-8");
  const payload = buildPayload(patches, preview);

  let finished = false;
  const server = Bun.serve({
    port: flags.port,
    async fetch(req) {
      const url = new URL(req.url);

      if (req.method === "GET" && url.pathname === "/") {
        return new Response(html, {
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }
      if (req.method === "GET" && url.pathname === "/api/patch") {
        return Response.json(payload);
      }
      if (req.method === "POST" && url.pathname === "/api/apply") {
        const body = (await req.json().catch(() => ({}))) as {
          approved?: string[];
        };
        const approved = new Set(body.approved ?? []);
        const results = applyPatches(patches, { write: true, approved });
        printSummary(results);
        const ok = results.every((r) => r.status !== "error");
        finish(ok ? 0 : 1);
        return Response.json({ ok, results });
      }
      if (req.method === "POST" && url.pathname === "/api/close") {
        zyLog.warn("Review dibatalkan — tidak ada file yang ditulis.");
        finish(0);
        return Response.json({ ok: true });
      }
      return new Response("Not found", { status: 404 });
    },
  });

  function finish(code: number) {
    if (finished) return;
    finished = true;
    setTimeout(() => {
      server.stop();
      if (code === 0) {
        zyLog.success("Selesai. Server berhenti, fokus kembali ke terminal/VS Code.");
      } else {
        zyLog.warn("Review dibatalkan. Server berhenti.");
      }
      process.exit(code);
    }, 250);
  }

  const url = server.url.toString();
  zyLog.cmd(`Review UI: ${url}`);
  zyLog.info("Server berhenti otomatis setelah apply/cancel, atau tekan Ctrl+C di sini.");
  if (!flags.noOpen) openBrowser(url);
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(argv: string[]): { input: string | null; flags: Flags } {
  const flags: Flags = {
    dryRun: false,
    yes: false,
    noOpen: false,
    help: false,
    port: 0,
    context: 3,
  };
  let input: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") flags.dryRun = true;
    else if (arg === "--yes" || arg === "-y") flags.yes = true;
    else if (arg === "--no-open") flags.noOpen = true;
    else if (arg === "--help" || arg === "-h") flags.help = true;
    else if (arg.startsWith("--port=")) flags.port = Number.parseInt(arg.slice(7), 10) || 0;
    else if (arg.startsWith("--context=")) {
      const n = Number.parseInt(arg.slice(10), 10);
      if (n > 0 && n <= 20) flags.context = n;
    } else if (arg.startsWith("--out=")) flags.out = arg.slice(6);
    else if (arg === "--out" && argv[i + 1]) flags.out = argv[++i];
    // Argumen posisi TERAKHIR menang — script "diff" di package.json selalu menyisipkan
    // .ai/patch.md sebagai argumen pertama, jadi `bun diff file-lain` harus tetap bekerja.
    else if (!arg.startsWith("-")) input = arg;
    else if (arg === "-") input = "-";
  }
  return { input, flags };
}

function printHelp() {
  write(`
${c.bold("diffReplacer")} — terapkan diff output AI ke file secara bulk

${c.bold("Usage:")}
  bun diff [patchFile|-] [flags]

${c.bold("Input:")}
  patchFile    file berisi diff output AI
  -            baca dari stdin (pipe)
  (kosong)     mode paste interaktif (TTY) / stdin (pipe)

${c.bold("Flags:")}
  --dry-run    pratinjau perubahan di terminal, tanpa menulis file
  --yes, -y    apply langsung semua blok tanpa review UI
  --no-open    jangan buka browser otomatis (review UI manual)
  --port=N     port review UI (default: acak)
  --out=FILE   mode diagnostik: tulis skeleton ke file (default: stdout)
  --context=N  mode diagnostik: radius konteks per error (default: 3)
  --help, -h   tampilkan bantuan ini

${c.bold("Format yang didukung (auto-deteksi):")}
  1. SEARCH/REPLACE blocks  (lihat .ai/prompt.md untuk spec yang dikirim ke AI)
  2. Unified diff gaya git  (--- a/path, +++ b/path, hunk @@)
  3. Diagnostik biome check/ci & TypeScript (tsc) → menghasilkan SKELETON
     SEARCH/REPLACE untuk diteruskan ke AI, bukan mengubah file:
     bun lint 2>&1 | tail -40 | bun diff -
     bunx tsc --noEmit 2>&1 | bun diff - --out=.ai/patch.md
`);
}

async function main() {
  const { input, flags } = parseArgs(process.argv.slice(2));
  if (flags.help) {
    printHelp();
    return;
  }

  const text = await readInput(input);
  const format = detectFormat(text);
  if (!format) {
    zyLog.error(
      "Format diff tidak dikenali — tidak ada blok SEARCH/REPLACE, unified diff, atau diagnostik biome/tsc yang valid.",
    );
    process.exit(1);
  }

  // Mode diagnostik: tidak mengubah file kode — cetak skeleton untuk AI lalu selesai.
  if (format === "diagnostics") {
    const diags = parseDiagnostics(text);
    if (diags.length === 0) {
      zyLog.error(
        "Terdeteksi sebagai diagnostik, tapi tidak ada error biome/tsc yang bisa di-parse.",
      );
      process.exit(1);
    }
    const { skeleton, blocks, files, warnings } = buildSkeleton(diags, flags.context);
    for (const w of warnings) zyLog.warn(w);
    if (blocks === 0) {
      zyLog.error("Tidak ada blok skeleton yang bisa dibuat (file tidak ada / di luar EOF).");
      process.exit(1);
    }
    zyLog.info(`${diags.length} diagnostik · ${files} file → ${blocks} blok skeleton`);
    if (flags.out) {
      const abs = resolve(process.cwd(), flags.out);
      writeFileSync(abs, skeleton);
      zyLog.success(
        `Skeleton ditulis ke ${flags.out} — kirim ke AI, lalu apply hasilnya dengan bun diff.`,
      );
    } else {
      write(skeleton);
    }
    return;
  }

  const lines = text.split("\n");
  const { patches, errors } =
    format === "search-replace" ? parseSearchReplace(lines) : parseUnified(lines);
  for (const e of errors) zyLog.warn(e);

  if (patches.length === 0) {
    zyLog.error("Tidak ada blok patch valid yang berhasil di-parse.");
    process.exit(1);
  }

  // Validasi awal: terapkan semua op di memori untuk deteksi error match sejak dini
  const preview = applyPatches(patches, { write: false, approved: null });

  if (flags.dryRun) {
    printDryRun(patches, preview);
    process.exitCode = preview.some((r) => r.status === "error") ? 1 : 0;
    return;
  }

  if (flags.yes) {
    const results = applyPatches(patches, { write: true, approved: null });
    printSummary(results);
    process.exitCode = results.some((r) => r.status === "error") ? 1 : 0;
    return;
  }

  startReviewServer(patches, preview, flags);
}

// Jalankan sebagai CLI hanya kalau dieksekusi langsung (bun diff / bun scripts/diffReplacer.ts),
// bukan saat di-import sebagai library — mis. oleh scripts/release.ts.
if (import.meta.main) {
  main();
}
