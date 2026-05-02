import axios from "axios";

/* global process */

export default async function handler(req, res) {
  // 1. Cek PIN
  const pin = req.headers["x-secret-pin"];

  if (pin !== process.env.PIN_RAHASIA) {
    return res.status(401).json({ error: "Akses Ditolak! PIN Salah." });
  }

  // 2. Ambil Link dari Brankas
  const urlTransaksi = process.env.URL_TRANSAKSI;
  const urlClosing = process.env.URL_CLOSING;

  // Cek apakah link di .env terbaca atau kosong
  if (!urlTransaksi || !urlClosing) {
    return res.status(500).json({ error: "Link Google Sheets belum disetting di .env!" });
  }

  try {
    // 3. Pakai AXIOS (lebih aman buat semua versi Node.js)
    const [resTx, resCl] = await Promise.all([axios.get(urlTransaksi), axios.get(urlClosing)]);

    // 4. Kirim Data ke React
    res.status(200).json({
      transaksi: resTx.data,
      closing: resCl.data,
    });
  } catch (error) {
    // Biar ketahuan errornya apa di terminal
    console.error("Detail Error:", error.message);
    res.status(500).json({ error: "Gagal narik data dari Google." });
  }
}
