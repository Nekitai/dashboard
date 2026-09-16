import { getSheetRows } from "./_googleSheets.js";

/* global process */

export default async function handler(req, res) {
  // Nama tab/sheet, bisa diubah lewat Environment Variables kalau nama tab beda
  const sheetTransaksi = process.env.SHEET_TRANSAKSI || "Master Transaksi";
  const sheetClosing = process.env.SHEET_CLOSING || "Master Closing";

  // Periode yang diminta client -- kalau diisi, filter SEBELUM dikirim ke browser
  const periode = typeof req.query.periode === "string" ? req.query.periode.trim() : "";

  try {
    // Baris 1 diasumsikan header, jadi ambil mulai baris 2. Kolom A-E untuk transaksi,
    // A-F untuk closing (samakan dengan urutan kolom di sheet kamu).
    const [rowsTx, rowsCl] = await Promise.all([getSheetRows(`${sheetTransaksi}!A2:E`), getSheetRows(`${sheetClosing}!A2:F`)]);

    let transaksi = rowsTx
      .filter((r) => r[0])
      .map((r) => ({
        nama: String(r[0] ?? "").trim(),
        bruto: Number(r[1]) || 0,
        uang: Number(r[2]) || 0,
        periode: String(r[3] ?? "").trim(),
        ket: r[4] ? String(r[4]).trim() : "-",
      }));

    let closing = rowsCl
      .filter((r) => r[0])
      .map((r) => ({
        periode: String(r[0] ?? "").trim(),
        fuso: Number(r[1]) || 0,
        kontainer: Number(r[2]) || 0,
        transport: Number(r[3]) || 0,
        buruh: Number(r[4]) || 0,
        total: Number(r[5]) || 0,
      }));

    if (periode && periode !== "All") {
      transaksi = transaksi.filter((d) => d.periode === periode);
      closing = closing.filter((d) => d.periode === periode);
    }

    res.status(200).json({ transaksi, closing });
  } catch (error) {
    console.error("Detail Error:", error.message);
    res.status(500).json({ error: "Gagal ambil data dari Google Sheets." });
  }
}
