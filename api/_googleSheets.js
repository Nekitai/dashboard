import { JWT } from "google-auth-library";

/* global process */

let authClient = null;

// Cache sederhana di memori: kalau request datang lagi dalam waktu TTL, tidak usah
// nembak ke Google Sheets API lagi -- langsung pakai data yang barusan diambil.
// Catatan: ini per-instance server (bukan shared), jadi manfaatnya "mengurangi", bukan
// menjamin cuma 1x panggilan API buat semua orang -- tapi cukup buat menekan jumlah request.
const cache = new Map(); // range -> { data, expiresAt }

function getCacheTtlMs() {
  const raw = process.env.CACHE_TTL_SECONDS;
  const n = Number(raw);
  if (!raw || Number.isNaN(n) || n <= 0) return 0; // tidak diset / 0 / invalid = cache mati
  return n * 1000;
}

function getClient() {
  if (authClient) return authClient;

  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  // Private key disimpan di env var sebagai satu baris dengan literal "\n",
  // jadi perlu diubah balik jadi newline asli sebelum dipakai.
  const key = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

  if (!email || !key) {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY belum diset di Environment Variables.");
  }

  authClient = new JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return authClient;
}

// Ambil nilai sel dari satu range, mis. "Transaksi!A2:E" atau "Closing!D2:D".
// Balikannya array of array (baris x kolom), angka sudah dalam bentuk number asli
// (bukan string berformat), jadi tidak perlu lagi regex bersih-bersih angka.
export async function getSheetRows(range) {
  const ttlMs = getCacheTtlMs();

  if (ttlMs > 0) {
    const cached = cache.get(range);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.data;
    }
  }

  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("SPREADSHEET_ID belum diset di Environment Variables.");
  }

  const client = getClient();
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await client.request({ url });
  const data = res.data.values || [];

  if (ttlMs > 0) {
    cache.set(range, { data, expiresAt: Date.now() + ttlMs });
  }

  return data;
}
