# AI Coding Prompt — erzysh

| Perintah                     | Fungsi                                                |
| ---------------------------- | ----------------------------------------------------- |
| `bun diff patch.md`          | baca patch dari file                                  |
| `cat patch.md \| bun diff -` | baca patch via pipe                                   |
| `bun diff`                   | mode paste (tempel output AI langsung di terminal)    |
| `bun diff --dry-run`         | pratinjau di terminal, tanpa menulis file             |
| `bun diff --yes`             | langsung apply semua tanpa review UI                  |
| `bun diff` (default)         | review di browser: accept/reject per blok, lalu apply |

## Error Lint/Type → Skeleton Patch

Kalau `bun lint` / `biome check` / `tsc` gagal, output errornya bisa langsung diubah
jadi skeleton SEARCH/REPLACE (SEARCH diambil dari isi file asli, REPLACE berisi
salinannya yang tinggal diedit AI):

| Perintah                                                  | Fungsi                                       |
| --------------------------------------------------------- | -------------------------------------------- |
| `bun lint 2>&1 \| tail -40 \| bun diff -`                 | skeleton dicetak ke stdout (copy ke chat AI) |
| `bunx tsc --noEmit 2>&1 \| bun diff - --out=.ai/patch.md` | skeleton langsung ditulis ke file            |
| `bun diff - --context=5`                                  | radius konteks per error (default 3 baris)   |

Skeleton aman: kalau REPLACE tidak diedit dan di-apply, hasilnya no-op.

## Konteks Proyek

- **Repo**: erzysh — aplikasi web Next.js 16 (App Router, `src/app`) + React 19 + Tailwind CSS 4
- **Runtime & package manager**: Bun (gunakan perintah `bun`, jangan npm/yarn/pnpm)
- **Sub-proyek**: `ghost-agent/` (Rust workspace, Telegram bot agent), `khs/`
- **Lint/format**: Biome — double quotes, semicolon, indent 2 spasi
- **Logger**: `zyLog` dari `src/lib/zylog` (`zyLog.info/warn/error/success`)

## Tugas

yang copy itu dibikin bisa copy NPM, nama lengkap, "Nama Lengkap (NPM)", "Nama Lengkap\tab(NPM)" dll dong

## Format Jawaban — WAJIB

Keluarkan SEMUA perubahan sebagai patch dalam format **SEARCH/REPLACE** di bawah ini,
satu blok per perubahan. Path **harus** relatif terhadap root repo.

### 1. Edit file yang sudah ada

```text
--- src/contoh/Foo.tsx
<<<<<<< SEARCH
export function Foo() {
  return <div>lama</div>;
}
=======
export function Foo() {
  return <div>baru</div>;
}
>>>>>>> REPLACE
```

- Salin bagian SEARCH **persis** seperti isi file saat ini (indentasi & whitespace ikut).
- Satu file boleh punya beberapa blok — tulis berurutan, header `--- path` boleh diulang.
- Kalau SEARCH muncul di beberapa tempat, sertakan baris konteks di atas/bawahnya agar unik.

### 2. Membuat file baru

Section SEARCH dibiarkan **kosong**, REPLACE berisi isi file lengkap:

```text
--- src/contoh/Bar.ts
<<<<<<< SEARCH
=======
export const BAR = 1;
>>>>>>> REPLACE
```

### 3. Menghapus file

Cukup header path diikuti marker DELETE:

```text
--- src/contoh/Lama.ts
>>>>>>> DELETE
```

### Aturan tambahan

- JANGAN membungkus blok patch dengan code fence tambahan, dan jangan menambahkan
  nomor baris (`@@`) — pencocokan dilakukan per isi teks, bukan nomor baris.
- Jangan mencampur penjelasan panjang di dalam blok — jelaskan di luar blok patch.
- Alternatif: unified diff gaya git (`--- a/path` / `+++ b/path` / hunk `@@`) juga
  diterima `scripts/diffReplacer.ts`, tapi SEARCH/REPLACE lebih aman dari pergeseran baris.
