import { getSheetRows } from "./_googleSheets.js";

/* global process */

export default async function handler(req, res) {
  const sheetTransaksi = process.env.SHEET_TRANSAKSI || "Transaksi";

  try {
    // Cuma minta kolom D (periode) -- lebih ringan daripada tarik seluruh tabel transaksi
    const rows = await getSheetRows(`${sheetTransaksi}!D2:D`);

    const seen = new Set(); // Set menjaga urutan kemunculan pertama
    rows.forEach((r) => {
      const p = String(r[0] ?? "").trim();
      if (p && p !== "ALL" && p !== "UNIT" && !p.includes("00")) seen.add(p);
    });

    return res.status(200).json({ periode: [...seen] });
  } catch (error) {
    console.error("Detail Error (periode):", error.message);
    return res.status(500).json({ error: "Gagal ambil daftar periode." });
  }
}
