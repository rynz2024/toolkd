# Affiliate Video Generator

Aplikasi desktop (Windows) untuk membuat video promosi afiliasi produk kaos
secara otomatis. Pengguna cukup mengunggah 3 gambar (depan kaos, belakang
kaos, foto model), mengisi nama produk dan harga, memilih musik latar, lalu
klik **Generate Video**. Aplikasi langsung menghasilkan video vertikal
1080×1920 (~21 detik) yang siap diunggah ke TikTok / Reels / Shorts.

Semua dependensi (FFmpeg, musik, font) dibundle di dalam installer — pengguna
**tidak perlu** menginstal Python, Node.js, atau apapun di komputernya.

## Daftar Isi

- [Cara Tercepat Mencoba Aplikasi (Windows)](#cara-tercepat-mencoba-aplikasi-windows)
- [Untuk Pengguna Akhir (sudah punya installer)](#untuk-pengguna-akhir-sudah-punya-installer)
- [Untuk Developer](#untuk-developer)
- [Struktur Proyek](#struktur-proyek)
- [Detail Teknis Video](#detail-teknis-video)
- [Troubleshooting](#troubleshooting)
- [Lisensi Aset](#lisensi-aset)

## Cara Tercepat Mencoba Aplikasi (Windows)

Setelah clone repo ini dan ada Node.js LTS di komputer Anda:

1. Buka folder `affiliate-video-generator/` di Windows Explorer.
2. Klik dobel **`Jalankan Aplikasi.bat`** → otomatis install dependency dan
   buka jendela aplikasi. Pertama kali butuh 2–5 menit untuk download
   dependency (~250 MB). Selanjutnya tinggal beberapa detik.
3. Untuk membuat installer `.exe` siap-distribusi, klik dobel
   **`Build Installer.bat`** → hasil di `dist-electron\`.

Window CMD akan tetap terbuka setelah app tertutup, jadi kalau ada error
Anda bisa langsung screenshot pesan errornya.

## Untuk Pengguna Akhir (sudah punya installer)

1. Jalankan `AffiliateVideoGenerator-Setup.exe` (installer) atau
   `AffiliateVideoGenerator-Portable.exe` (versi portable, tanpa install).
2. Unggah 3 gambar pada panel kiri: **Depan**, **Belakang**, **Model**.
3. Isi **Nama Produk** dan **Harga** di panel kanan.
4. Pilih **Track 1 / Track 2 / Track 3** untuk musik latar.
5. Klik **✨ Generate Video** dan tunggu sampai progress bar 100%.
6. Klik **📁 Open Hasil Video** untuk membuka folder hasil.

Hasil disimpan otomatis di
`%USERPROFILE%\Desktop\Affiliate Videos\affiliate-YYYY-MM-DDTHH-MM-SS.mp4`.

## Untuk Developer

### Prasyarat

- Node.js 18 LTS atau lebih baru (direkomendasikan 20 LTS)
- npm 9+ atau pnpm/yarn (instruksi di bawah memakai npm)
- Sistem operasi untuk build:
  - **Build .exe Windows:** sebaiknya dari mesin Windows 10/11. Build di
    Linux/macOS bisa dilakukan namun memerlukan Wine.
- 4 GB RAM, 2 GB disk space untuk node_modules + binary FFmpeg.

### Menjalankan di Mode Development

```bash
npm install
npm start
```

Perintah `npm start` menjalankan dua proses sekaligus:

1. Vite dev server (renderer React) di `http://localhost:5173`
2. Electron yang me-load URL tersebut.

### Build Installer (.exe Windows)

```bash
npm run build
```

Output dihasilkan di folder `dist-electron/`:

- `AffiliateVideoGenerator-Setup.exe` — NSIS installer
- `AffiliateVideoGenerator-Portable.exe` — single-file portable

> **Catatan cross-build di Linux/macOS:** `electron-builder` akan
> mengunduh Wine + tooling NSIS pada build pertama. Jika koneksi internet
> terbatas, jalankan build dari mesin Windows.

### Build hanya direktori (untuk pengujian cepat)

```bash
npm run build:dir
```

Menghasilkan folder yang berisi `Affiliate Video Generator.exe` tanpa
installer — berguna untuk smoke-test sebelum membungkus installer.

## Struktur Proyek

```
affiliate-video-generator/
├─ src/
│  ├─ main/        Electron main process (jendela, IPC, akses file)
│  ├─ renderer/    UI React + Tailwind
│  └─ video/       Pipeline fluent-ffmpeg untuk generate video
├─ assets/
│  ├─ music/       3 track musik default (.mp3, ~30s)
│  ├─ fonts/       Inter-Bold (OFL)
│  └─ icons/       icon.png + icon.ico untuk installer
├─ build/          Resource icon untuk electron-builder
├─ electron-builder config di dalam package.json
└─ package.json
```

## Detail Teknis Video

| Properti        | Nilai                                    |
| --------------- | ---------------------------------------- |
| Resolusi        | 1080 × 1920 (vertikal 9:16)              |
| Frame rate      | 30 fps                                   |
| Codec video     | H.264 (yuv420p)                          |
| Codec audio     | AAC 192 kbps                             |
| Container       | MP4 (`+faststart` untuk streaming cepat) |
| Durasi total    | ~21 detik (23s adegan − 4 × 0.5s xfade)  |

### Urutan Adegan

| Waktu      | Adegan                                                         |
| ---------- | -------------------------------------------------------------- |
| 0–3 s      | Foto model fullscreen, fade-in + gentle zoom-in                |
| 3–8 s      | Crossfade ke kaos depan, Ken Burns + nama produk               |
| 8–13 s     | Slide left ke kaos belakang, Ken Burns                         |
| 13–18 s    | Crossfade ke foto model, zoom-out perlahan                     |
| 18–23 s    | Outro: nama produk → harga → "Shop Now!" (fade berurutan)      |
| Akhir      | Fade ke hitam, audio fade-out 2 detik terakhir                 |

## Troubleshooting

**Generate Video gagal dengan pesan "ffmpeg exited with code …"**
Pastikan ukuran file gambar wajar (< 25 MB) dan format-nya PNG/JPG/WebP.
Aplikasi otomatis crop center ke rasio 9:16; jika gambar sumber rusak,
FFmpeg akan gagal. Klik **Coba Lagi** dan unggah ulang.

**Tidak ada pilihan musik di dropdown**
Folder `assets/music` kosong saat dev, atau resource musik gagal di-extract
saat install. Reinstall aplikasi atau tambahkan file `.mp3` apapun ke
`%APPDATA%\Affiliate Video Generator\music` (untuk versi installer).

**Build di Linux gagal saat membuat installer .exe**
`electron-builder` membutuhkan Wine. Install dengan
`sudo apt install wine64` atau jalankan build dari Windows.

## Lisensi Aset

- **Inter font** — SIL Open Font License 1.1 (lihat
  `assets/fonts/LICENSE.txt`). Boleh dipakai komersial.
- **Track musik default** — disintesa secara prosedural (sine + triangle
  wave) tanpa material berhak cipta, dirilis sebagai CC0. Pengguna dipersilakan
  mengganti dengan musik pilihan sendiri dari [Pixabay](https://pixabay.com/music/)
  atau sumber CC0/Royalty-Free lain. Letakkan `.mp3` baru di folder
  `assets/music/` (sebelum build) atau `%APPDATA%\Affiliate Video Generator\music`
  (setelah install).
- **Icon** — generated oleh proyek ini, dirilis sebagai CC0.
- **FFmpeg** — disertakan via `ffmpeg-static` (LGPL-3.0).
