# Bukti Validasi SAP2000 & Perhitungan Excel Manual

Letakkan tangkapan layar dan berkas pendukung per studi kasus di subfolder sesuai `id` pada `src/data/presentation/validation-cases.ts`:

- `val-01-simply-supported-udl/` — `ibds.png`, `sap2000.png`, `excel.png`, `model.s2k`, `calc.xlsx`
- `val-02-indeterminate-fixed-cantilever/` — `ibds.png`, `sap2000.png`, `excel.png`
- `val-03-steel-sni1729/` — `ibds.png`, `sap2000.png`, `excel.png`
- `val-04-concrete-sni2847/` — `ibds.png`, `sap2000.png`, `excel.png`

Setelah menambahkan gambar dan nilai numerik pembanding di `src/data/presentation/validation-cases.ts`, jalankan:

```bash
bun run data:validate
```
