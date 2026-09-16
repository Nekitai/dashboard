import { useEffect, useState } from "react";
import axios from "axios";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

const PERIODE_COLORS = {
  "Semua Periode": { bg: "#E3F2FD", text: "#0D47A1", bar: "#1976D2" },
  "Belum Closing": { bg: "#FFF9C4", text: "#fb2d2d", bar: "#fb2d2d" },
};

function fmt(n) {
  return "Rp " + Math.round(n || 0).toLocaleString("id-ID");
}

function fmtCompact(n) {
  if (n >= 1_000_000_000) return "Rp " + (n / 1_000_000_000).toFixed(1) + "M";
  if (n >= 1_000_000) return "Rp " + (n / 1_000_000).toFixed(1) + "jt";
  return fmt(n);
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

// 👇 PERIODE SEKARANG DIBIKIN NUMPUK 👇
function PeriodePill({ periode }) {
  if (!periode || periode === "ALL" || periode === "UNIT") return null;
  const isPending = periode.toUpperCase().includes("BELUM CLOSING");
  const c = isPending ? PERIODE_COLORS["Belum Closing"] : PERIODE_COLORS[periode] || { bg: "#F5EFE6", text: "#5A4030" };

  // Trik supaya periode yang ada strip (-) otomatis turun ke bawah (numpuk)
  const stackedPeriode = periode.split(" - ").join(" -\n");

  return (
    <span
      style={{
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 8,
        fontSize: 10,
        fontWeight: 500,
        background: c.bg,
        color: c.text,
        whiteSpace: "pre-line", // pre-line agar \n terbaca
        textAlign: "center",
        lineHeight: 1.4,
      }}
    >
      {stackedPeriode}
    </span>
  );
}

function MetricCard({ label, value, sub, bg, lbl, val, isMobile }) {
  return (
    <div
      style={{
        background: bg || "#fff",
        borderRadius: 10,
        border: bg === "#fff" || bg === "#F9F6F0" ? "1px solid #E8DFD0" : "none",
        padding: isMobile ? ".75rem .85rem" : "1.25rem 1.5rem",
        flex: isMobile ? "1 1 calc(50% - 6px)" : "1 1 0",
        minWidth: isMobile ? "calc(50% - 6px)" : 0,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: 10,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: lbl || "#8A7560",
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: isMobile ? 15 : 24,
          fontWeight: 600,
          color: val || "#3D2C1A",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          lineHeight: 1.2,
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: isMobile ? 15 : 15, color: lbl || "#8A7560", marginTop: 5 }}>{sub}</div>}
    </div>
  );
}

function AngledTick({ x, y, payload }) {
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="end" fill="#8A7560" fontSize={11} fontFamily="Georgia, serif" transform="rotate(-45)">
        {payload.value?.split(" ")[0]}
      </text>
    </g>
  );
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [dataTransaksi, setDataTransaksi] = useState([]);
  const [dataClosing, setDataClosing] = useState([]);
  const [selectedPeriode, setSelectedPeriode] = useState("");
  const [periodeList, setPeriodeList] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const isMobile = useIsMobile();

  // Ambil laporan HANYA untuk satu periode (server yang filter, bukan browser).
  const fetchData = (periode) => {
    if (!periode) return;
    setIsLoading(true);

    axios
      .get(`/api/laporan?periode=${encodeURIComponent(periode)}`)
      .then((response) => {
        // Server (Sheets API) sudah balikin JSON bersih & terfilter, tinggal dipakai langsung.
        setDataTransaksi(response.data.transaksi || []);
        setDataClosing(response.data.closing || []);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Gagal narik data dari Vercel API!", err);
        setIsLoading(false);
      });
  };

  // Daftar periode itu ringan (cuma nama-nama periode), dipakai buat isi dropdown
  // tanpa perlu menarik seluruh data transaksi lebih dulu.
  useEffect(() => {
    axios
      .get("/api/periode")
      .then((res) => {
        const pList = res.data.periode || [];
        setPeriodeList(["All", ...pList]);
        const periodeClosing = pList.filter((p) => !p.toUpperCase().includes("BELUM"));
        setSelectedPeriode(periodeClosing.length > 0 ? periodeClosing[periodeClosing.length - 1] : "All");
      })
      .catch((err) => {
        console.error("Gagal ambil daftar periode!", err);
        setIsLoading(false);
      });
  }, []);

  // Setiap kali periode yang dipilih berubah, baru fetch data periode itu saja
  useEffect(() => {
    if (selectedPeriode) {
      fetchData(selectedPeriode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeriode]);

  const getDisplayData = () => {
    // dataTransaksi sudah difilter sesuai periode di SERVER, jadi tinggal dikelompokkan.
    const raw = dataTransaksi;
    const grouped = {};
    raw.forEach((d) => {
      const key = d.nama;
      if (!grouped[key]) grouped[key] = { ...d, bruto: 0, uang: 0, periode: selectedPeriode === "All" ? "Semua Periode" : d.periode, ket: [] };
      grouped[key].bruto += d.bruto;
      grouped[key].uang += d.uang;
      if (d.ket && d.ket !== "-" && !grouped[key].ket.includes(d.ket)) grouped[key].ket.push(d.ket);
    });

    let finalData = Object.values(grouped)
      .map((g) => ({ ...g, ket: g.ket.length > 0 ? g.ket.join(", ") : "-" }))
      .sort((a, b) => b.uang - a.uang);

    if (searchTerm) {
      finalData = finalData.filter((d) => d.nama.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return finalData;
  };

  const displayTransaksi = getDisplayData();
  const totalUangSementara = displayTransaksi.reduce((s, d) => s + d.uang, 0);
  const totalBruto = displayTransaksi.reduce((s, d) => s + d.bruto, 0);

  const rekap =
    selectedPeriode === "All"
      ? dataClosing.reduce(
          (a, b) => ({
            fuso: a.fuso + b.fuso,
            kontainer: a.kontainer + b.kontainer,
            transport: a.transport + b.transport,
            buruh: a.buruh + b.buruh,
            total: a.total + b.total,
          }),
          { fuso: 0, kontainer: 0, transport: 0, buruh: 0, total: 0 },
        )
      : dataClosing.find((d) => d.periode === selectedPeriode) || { fuso: 0, kontainer: 0, transport: 0, buruh: 0, total: 0 };

  const nilaiTotalKeseluruhan = rekap.total > 0 ? rekap.total : totalUangSementara;
  const avg = displayTransaksi.length ? totalUangSementara / displayTransaksi.length : 0;

  const chartData = displayTransaksi;

  let statusInfo = { icon: "✅", text: "Telah Closing", bg: "#E8F5E9", lbl: "#1B4332", sub: "Data laporan valid" };
  if (selectedPeriode === "All") statusInfo = { icon: "📊", text: "Akumulasi Total", bg: "#E3F2FD", lbl: "#0D47A1", sub: "Seluruh data digabung" };
  else if (selectedPeriode.toUpperCase().includes("BELUM")) statusInfo = { icon: "⏳", text: "Belum Closing", bg: "#FFF9C4", lbl: "#B78103", sub: "Data masih berjalan" };

  if (isLoading || !selectedPeriode) {
    return (
      <div style={{ padding: isMobile ? "16px 12px" : "28px 40px", width: "100%", background: "#FFFDF7", minHeight: "100vh", boxSizing: "border-box" }}>
        <style>{`@keyframes skeleton-pulse { 0% { opacity: 0.6; } 50% { opacity: 0.2; } 100% { opacity: 0.6; } }`}</style>

        <div style={{ background: "#2E6B4F", borderRadius: 12, padding: isMobile ? ".85rem 1rem" : "1.1rem 1.5rem", display: "flex", justifyContent: "space-between", marginBottom: 20, animation: "skeleton-pulse 1.5s infinite" }}>
          <div>
            <div style={{ width: 180, height: 24, background: "rgba(255,255,255,0.3)", borderRadius: 6, marginBottom: 8 }}></div>
            <div style={{ width: 120, height: 14, background: "rgba(255,255,255,0.2)", borderRadius: 4 }}></div>
          </div>
          <div style={{ width: 100, height: 35, background: "rgba(255,255,255,0.3)", borderRadius: 8 }}></div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #E8DFD0", borderRadius: 10, padding: "1.25rem 1.5rem", flex: "1 1 0", minWidth: isMobile ? "calc(50% - 6px)" : 0, animation: "skeleton-pulse 1.5s infinite" }}>
              <div style={{ width: 80, height: 12, background: "#E8DFD0", borderRadius: 4, marginBottom: 12 }}></div>
              <div style={{ width: 120, height: 28, background: "#E8DFD0", borderRadius: 6, marginBottom: 10 }}></div>
              <div style={{ width: 100, height: 12, background: "#E8DFD0", borderRadius: 4 }}></div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} style={{ background: "#fff", border: "1px solid #E8DFD0", borderRadius: 10, padding: "1.25rem 1.5rem", flex: "1 1 0", minWidth: isMobile ? "calc(50% - 6px)" : 0, animation: "skeleton-pulse 1.5s infinite" }}>
              <div style={{ width: 80, height: 12, background: "#E8DFD0", borderRadius: 4, marginBottom: 12 }}></div>
              <div style={{ width: 120, height: 28, background: "#E8DFD0", borderRadius: 6, marginBottom: 10 }}></div>
              <div style={{ width: 100, height: 12, background: "#E8DFD0", borderRadius: 4 }}></div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: "#fff", border: "1px solid #E8DFD0", borderRadius: 12, height: 350, animation: "skeleton-pulse 1.5s infinite" }}></div>
          <div style={{ background: "#fff", border: "1px solid #E8DFD0", borderRadius: 12, height: 350, animation: "skeleton-pulse 1.5s infinite" }}></div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: isMobile ? "16px 12px" : "28px 40px", width: "100%", fontFamily: "Georgia, serif", background: "#FFFDF7", minHeight: "100vh", boxSizing: "border-box" }}>
      <div
        style={{
          background: "#2E6B4F",
          borderRadius: 12,
          padding: isMobile ? ".85rem 1rem" : "1.1rem 1.5rem",
          display: "flex",
          alignItems: isMobile ? "flex-start" : "center",
          justifyContent: "space-between",
          flexDirection: isMobile ? "column" : "row",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <div>
          <h1 style={{ color: "#fff", fontSize: isMobile ? 16 : 20, fontWeight: 500, margin: 0 }}>Dashboard Pembelian</h1>
          <p style={{ color: "#A8D5BF", fontSize: 12, margin: "3px 0 0 0" }}>
            {selectedPeriode === "All" ? "Semua periode" : selectedPeriode} · {displayTransaksi.length} pelanggan ditampikan
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", width: isMobile ? "100%" : "auto", flexWrap: isMobile ? "wrap" : "nowrap" }}>
          <input
            type="text"
            placeholder="🔍 Cari nama..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ fontSize: 13, padding: "8px 12px", borderRadius: 8, border: "none", background: "#fff", color: "#3D2C1A", fontFamily: "Georgia, serif", width: isMobile ? "100%" : "200px", boxSizing: "border-box" }}
          />

          <select
            value={selectedPeriode}
            onChange={(e) => setSelectedPeriode(e.target.value)}
            style={{
              fontSize: 13,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#fff",
              color: "#2E6B4F",
              fontWeight: 500,
              cursor: "pointer",
              fontFamily: "Georgia, serif",
              width: isMobile ? "calc(100% - 45px)" : "auto",
            }}
          >
            {periodeList.map((p, i) => (
              <option key={i} value={p}>
                {p === "All" ? "Semua Periode" : p}
              </option>
            ))}
          </select>
          <button
            onClick={() => fetchData(selectedPeriode)}
            title="Perbarui Data"
            style={{ background: "#1B4332", border: "none", borderRadius: 8, padding: "8px 12px", color: "#fff", cursor: "pointer", width: isMobile ? "37px" : "auto", display: "flex", justifyContent: "center", alignItems: "center" }}
          >
            🔄
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
          <MetricCard
            label="Status Data"
            value={
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {statusInfo.icon} {statusInfo.text}
              </div>
            }
            sub={statusInfo.sub}
            bg={statusInfo.bg}
            lbl={statusInfo.lbl}
            val={statusInfo.lbl}
            isMobile={isMobile}
          />
          <MetricCard
            label="Total Keseluruhan"
            value={fmtCompact(nilaiTotalKeseluruhan)}
            sub={rekap.total > 0 && !searchTerm ? "Data Final  Closing: " + fmt(rekap.total) : `Akumulasi Pencarian / Sementara` + (rekap.total > 0 ? ": " + fmt(rekap.total) : "")}
            bg="#fff"
            lbl="#8A7560"
            val="#3D2C1A"
            isMobile={isMobile}
          />
          <MetricCard label="Total Bruto" value={totalBruto.toLocaleString("id-ID")} sub={searchTerm ? `Total bruto dari pencarian` : `Total semua bruto`} bg="#F3E5F5" lbl="#7B3FA0" val="#4A1870" isMobile={isMobile} />
          <MetricCard label="Biaya Transport" value={fmtCompact(rekap.transport)} sub={`Fuso & Kontainer: ${fmt(rekap.transport)}`} bg="#FFF3E0" lbl="#BF6000" val="#7A3D00" isMobile={isMobile} />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          <MetricCard
            label="Total Fuso"
            value={
              <>
                {rekap.fuso} <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 400 }}>Unit</span>
              </>
            }
            bg="#F9F6F0"
            lbl="#8A7560"
            val="#3D2C1A"
            isMobile={isMobile}
          />
          <MetricCard
            label="Total Kontainer"
            value={
              <>
                {rekap.kontainer} <span style={{ fontSize: isMobile ? 12 : 14, fontWeight: 400 }}>Unit</span>
              </>
            }
            bg="#F9F6F0"
            lbl="#8A7560"
            val="#3D2C1A"
            isMobile={isMobile}
          />
          <MetricCard label="Rata-rata Transaksi" value={fmtCompact(avg)} sub={`Nominal rata-rata ${searchTerm ? "pencarian" : "per pelanggan"}`} bg="#FFF8E1" lbl="#9A6B00" val="#5C3D00" isMobile={isMobile} />
          <MetricCard label="Biaya Buruh" value={fmtCompact(rekap.buruh)} sub={`Total biaya untuk buruh: ${fmt(rekap.buruh)}`} bg="#FFF3E0" lbl="#BF6000" val="#7A3D00" isMobile={isMobile} />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ background: "#fff", border: "1px solid #E8DFD0", borderRadius: 12, padding: isMobile ? "1rem .85rem" : "1.5rem 1.5rem 1rem", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <p style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.06em", color: "#8A7560", margin: 0 }}>Grafik Uang per Customer {searchTerm && <span>(Hasil Filter: "{searchTerm}")</span>}</p>
          </div>

          <div style={{ overflowX: "auto", overflowY: "hidden", width: "100%", paddingBottom: "10px" }}>
            <div style={{ minWidth: Math.max(chartData.length * 45, isMobile ? 300 : 700), height: isMobile ? 250 : 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ bottom: isMobile ? 0 : 80, left: isMobile ? -15 : 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0E8DC" vertical={false} />
                  <XAxis dataKey="nama" axisLine={false} tickLine={false} tick={isMobile ? { fontSize: 10, fill: "#8A7560" } : <AngledTick />} />
                  <YAxis tick={{ fontSize: isMobile ? 10 : 12, fill: "#8A7560" }} axisLine={false} tickLine={false} tickFormatter={(v) => Intl.NumberFormat("id-ID", { notation: "compact" }).format(v)} />
                  <Tooltip formatter={(v) => fmt(v)} contentStyle={{ borderRadius: 8, border: "1px solid #E8DFD0" }} />
                  <Bar dataKey="uang" name="Uang" radius={[5, 5, 0, 0]} maxBarSize={60}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={selectedPeriode.toUpperCase().includes("BELUM CLOSING") ? "#FBC02D" : "#2E6B4F"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div style={{ background: "#fff", border: "1px solid #E8DFD0", borderRadius: 12, padding: isMobile ? "1rem .85rem" : "1.5rem", overflowX: "auto", width: "100%", boxSizing: "border-box" }}>
          <p style={{ fontSize: 11, textTransform: "uppercase", color: "#8A7560", marginBottom: 14 }}>Detail Transaksi Lengkap</p>
          {displayTransaksi.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 12 : 13 }}>
              <thead>
                <tr>
                  {["Nama", "Bruto", "Uang", "Ket", "Periode"].map((h) => (
                    <th key={h} style={{ textAlign: h === "Bruto" || h === "Uang" ? "right" : "left", padding: "8px 12px", fontSize: 10, color: "#8A7560", borderBottom: "1.5px solid #E8DFD0", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayTransaksi.map((d, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F5EFE6" }}>
                    <td style={{ padding: "9px 12px", fontWeight: 500, whiteSpace: "nowrap" }}>{d.nama}</td>
                    <td style={{ padding: "9px 12px", textAlign: "right", whiteSpace: "nowrap" }}>{d.bruto.toLocaleString("id-ID")}</td>
                    {/* 👇 UANG TAMPIL LENGKAP TANPA COMPACT 👇 */}
                    <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 500, whiteSpace: "nowrap" }}>{fmt(d.uang)}</td>
                    <td style={{ padding: "9px 12px", color: "#8A7560", fontStyle: "italic", fontSize: 11, minWidth: 100 }}>{d.ket}</td>
                    <td style={{ padding: "9px 12px", whiteSpace: "nowrap", textAlign: "center" }}>
                      <PeriodePill periode={d.periode} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div style={{ textAlign: "center", padding: "20px", color: "#8A7560" }}>Data nama "{searchTerm}" tidak ditemukan di periode ini.</div>
          )}
        </div>
      </div>
    </div>
  );
}
