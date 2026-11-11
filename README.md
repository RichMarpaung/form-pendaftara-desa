# Formulir Pendaftaran Desa — Kabupaten Mamuju Tengah

Aplikasi formulir pendaftaran desa berbasis web yang terintegrasi otomatis ke **Google Sheets** dan **Google Drive** melalui Google Apps Script.

## Struktur Proyek

```text
├── frontend/
│   ├── index.html   # Halaman utama formulir pendaftaran
│   ├── style.css    # Styling responsif dan state validasi/loading
│   └── app.js       # Data 5 Kecamatan (54 Desa), validasi file 5 MB, Base64, & fetch POST
├── gas/
│   └── Code.js      # Webhook doPost (LockService, upload Drive, appendRow Sheets)
└── README.md
```

---

## Panduan Ringkas Pemasangan Webhook

### 1. Siapkan Google Sheets & Google Apps Script
1. Buat **Google Sheet** baru di Google Drive Anda (misal: `Pendaftaran Desa Mamuju Tengah`).
2. Di dalam Google Sheet tersebut, buka menu **Extensions** > **Apps Script**.
3. Hapus seluruh isi default pada `Code.gs`, lalu salin-tempel seluruh kode dari file [`gas/Code.js`](gas/Code.js).
4. Simpan proyek (`Ctrl+S`). *(Header kolom pada sheet akan dibuat otomatis saat pengiriman data pertama).*

### 2. Deploy sebagai Web App
1. Di editor Apps Script, klik **Deploy** > **New deployment**.
2. Klik ikon roda gigi di samping *Select type*, lalu pilih **Web app**.
3. Atur konfigurasi berikut:
   - **Description**: `Webhook Pendaftaran Desa`
   - **Execute as**: `Me` *(akun Google Anda)*
   - **Who has access**: `Anyone`
4. Klik **Deploy**.
5. Jika diminta otorisasi, klik **Authorize access** > pilih akun Google Anda > **Advanced** > **Go to ... (unsafe)** > **Allow** (izin diperlukan untuk menulis ke Google Sheets dan Google Drive Anda).
6. Salin **Web app URL** yang berakhiran `/exec`.

### 3. Pasang URL Webhook ke Frontend
1. Buka file [`frontend/app.js`](frontend/app.js).
2. Temukan bagian `APP_CONFIG` di baris paling atas, lalu ganti nilai `WEBHOOK_URL` dengan URL `/exec` yang baru disalin:
   ```js
   const APP_CONFIG = {
     WEBHOOK_URL: 'https://script.google.com/macros/s/PASTE_DEPLOYMENT_ID_ANDA/exec',
     ...
   };
   ```
3. Simpan file.

### 4. Jalankan Aplikasi
- Untuk uji coba cepat, buka langsung `frontend/index.html` di browser atau jalankan via static server lokal.
- Untuk produksi, cukup upload isi folder `frontend/` ke hosting statis (GitHub Pages, Netlify, Vercel, Cloudflare Pages, atau web server kantor).

> **Catatan Penting:** Setiap kali Anda mengubah kode di `gas/Code.js`, lakukan **Deploy** > **Manage deployments** > ikon pensil (Edit) > ubah *Version* ke **New version** > **Deploy** agar perubahan aktif.
