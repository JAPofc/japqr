# Publishing guide

Panduan lengkap mempublikasikan `japqr` ke GitHub dan npm, dari nol sampai rilis pertama.

---

## 1. Prasyarat

- [Node.js](https://nodejs.org) 18+ dan npm terbaru.
- Akun [GitHub](https://github.com) dan [npm](https://www.npmjs.com).
- Git sudah terkonfigurasi di mesin kamu.

## 2. Persiapan repository

### 2.1 Konfirmasi nama package

Nama package sudah `japqr`, jadi orang tinggal:

```bash
npm i japqr
```

Nama ini **unscoped**, artinya bisa langsung dipublish tanpa perlu membuat organisasi di npm.

Kalau nanti kamu ingin nama scoped (misalnya `@japofc/japqr`), kamu harus membuat organisasi `@japofc` dulu di npm (gratis): **npmjs.com → Add Organization → Free**. Lalu ubah `package.json`:

```json
{
  "name": "@japofc/japqr",
  "bin": { "japqr": "./bin/cli.mjs" }
}
```

Dan sesuaikan:

- `README.md` — ganti semua `japqr` menjadi `@japofc/japqr`
- `docs/PUBLISHING.md` dan `CHANGELOG.md` — sesuaikan nama
- `test/*.test.mjs` **tidak perlu diubah** (import-nya relatif ke `dist/`)
- `examples/node/*.mjs` juga relatif, aman

Saat publish package scoped, wajib tambahkan `--access public` (lihat bagian 4.3).

### 2.2 Cek metadata

```bash
npm pkg get name version description license
```

Pastikan `repository.url`, `bugs.url`, dan `homepage` menunjuk ke repo GitHub kamu.

## 3. Buat repository di GitHub

```bash
cd japqr
git init -b main
git add .
git commit -m "feat: initial release"
```

Lalu buat repo kosong di GitHub (jangan tambahkan README/license dari template agar tidak konflik), dan:

```bash
git remote add origin git@github.com:japofc/japqr.git
git push -u origin main
```

### 3.1 Topik dan deskripsi

Di halaman repo GitHub → **⚙ Settings**:

- **Description**: `Zero-dependency QR Code generator for Node.js, Bun, Deno and browsers.`
- **Website**: `https://www.npmjs.com/package/japqr`
- **Topics**: `qr-code`, `qrcode`, `typescript`, `zero-dependency`, `svg`, `barcode`, `nodejs`

### 3.2 Branch protection

**Settings → Branches → Add rule** untuk `main`:

- ✅ Require a pull request before merging
- ✅ Require status checks to pass (`CI`)
- ✅ Require branches to be up to date

## 4. Publikasi ke npm

### 4.1 Login

```bash
npm login
```

Ikuti prompt (browser akan terbuka untuk otentikasi).

### 4.2 Cek isi package

```bash
npm pack --dry-run
```

Yang akan ikut terbit harus hanya:

```
dist/  bin/  README.md  LICENSE  CHANGELOG.md  package.json
```

Kalau ada file lain yang tidak seharusnya, perbaiki field `files` di `package.json` atau `.npmignore`.

### 4.3 Publikasi

```bash
npm publish
```

Untuk package scoped, perlu akses publik:

```bash
npm publish --access public
```

Script `prepublishOnly` akan otomatis menjalankan `clean → build → test`. Kalau test gagal, publikasi dibatalkan.

### 4.4 Verifikasi

```bash
npm view japqr version
```

Atau buka `https://www.npmjs.com/package/japqr`.

## 4.5 Otomatis lewat GitHub Actions (opsional)

Workflow `.github/workflows/release.yml` sudah disiapkan: setiap tag `vX.Y.Z`
yang di-push akan otomatis build → preflight → test → publish ke npm, lengkap
dengan **provenance attestation** (tanda tangan kriptografis bahwa package
benar dibangun dari commit itu).

Aktifkan sekali saja:

1. Buat **access token** di npmjs.com → **Access Tokens → Generate New Token →
   Automation** (bukan publish type biasa).
2. Di repo GitHub → **Settings → Secrets and variables → Actions → New repository secret**.
   - Name: `NPM_TOKEN`
   - Value: token tadi
3. Push tag:
   ```bash
   npm version patch
   git push --follow-tags
   ```
4. Pantau di tab **Actions**. Kalau hijau, package otomatis sudah terbit.

Verifikasi provenance:
```bash
npm view japqr dist.attestations
```

> Kalau `NPM_TOKEN` belum diset, workflow akan gagal di langkah publish.
> Publish manual (bagian 4.3) tetap jalan dan tidak butuh token ini.

## 5. Rilis berikutnya

```bash
# 1. Pastikan bersih dan lulus test
git checkout main
git pull
npm test

# 2. Naikkan versi (patch | minor | major)
npm version patch

# 3. Push tag
git push --follow-tags

# 4. Terbitkan
npm publish
```

`npm version` otomatis membuat commit + tag `vX.Y.Z`. Perbarui juga `CHANGELOG.md` sebelum commit.

### Versioning

Mengikuti [SemVer](https://semver.org/):

| Perubahan | Versi |
| --- | --- |
| Perbaikan bug, tanpa perubahan API | `patch` |
| Fitur baru, backward compatible | `minor` |
| Perubahan API yang breaking | `major` |

## 6. GitHub Release

Setelah `npm publish` sukses:

1. Buka **Releases → Draft a new release**
2. Pilih tag `vX.Y.Z`
3. Judul: `vX.Y.Z`
4. Isi dari `CHANGELOG.md`
5. Klik **Publish release**

## 7. Checklist sebelum publikasi

- [ ] `npm run typecheck` lulus
- [ ] `npm run preflight` lulus (28 check)
- [ ] `npm test` lulus (50 test)
- [ ] `npm pack --dry-run` hanya berisi file yang diinginkan
- [ ] `README.md` dan `CHANGELOG.md` sudah diperbarui
- [ ] `package.json` → `name`, `repository`, `bugs`, `homepage` benar
- [ ] Semua file source punya header watermark `@japofc`
- [ ] Sudah `git push --follow-tags`
- [ ] CI di GitHub berwarna hijau

## 8. Troubleshooting

**`npm ERR! 403 Forbidden`**
Nama package sudah dipakai orang lain. Ganti nama di `package.json`, atau gunakan scope `@username/nama`.
Cek dulu dengan `npm view japqr version` — kalau muncul `E404`, nama masih tersedia.

**`npm ERR! You do not have permission to publish "japqr"`**
Kamu belum login atau bukan pemilik package. Coba `npm whoami` dan `npm login`.

**`npm ERR! 402 Payment Required`**
Package scoped dipublish sebagai private. Tambahkan `--access public`.

**Workflow Release gagal di langkah "Publish"**
Secret `NPM_TOKEN` belum dibuat atau sudah kedaluwarsa. Buat ulang token
Automation di npmjs.com, lalu update secret-nya.

**Preflight gagal: "stale reference"**
Masih ada nama package lama (`japofc-qrcodegen`) di salah satu file. Cari dengan
`grep -rn "japofc-qrcodegen" --exclude-dir=node_modules --exclude-dir=dist .`

**Build gagal di `prepublishOnly`**
Jalankan `npm run build` secara manual untuk melihat error TypeScript yang sebenarnya.

**CI gagal tapi lokal lulus**
Cek versi Node di matrix CI (18/20/22) dan pastikan `package-lock.json` ter-commit.
