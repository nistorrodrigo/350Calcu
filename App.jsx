import { useState, useEffect } from "react";

// BYMA tick = $0.25
const TICK = 0.25;
const roundDown = (n) => Math.floor(n / TICK) * TICK;
const roundUp = (n) => Math.ceil(n / TICK) * TICK;
const fmt = (n, d = 2) => isNaN(n) || !isFinite(n) ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

function Input({ label, value, onChange, suffix, prefix, step = "any", small, hl, type = "number" }) {
  const [focused, setFocused] = useState(false);
  const borderColor = focused ? (hl || "#4ade80") : (hl ? hl + "25" : "#252525");
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <label style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: hl || "#777", fontWeight: 500 }}>{label}</label>
      <div style={{ display: "flex", alignItems: "center", background: "#1a1a1a", border: `1px solid ${borderColor}`, borderRadius: 7, padding: "0 10px", height: small ? 36 : 44, transition: "border-color 0.2s" }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}>
        {prefix && <span style={{ color: "#444", fontSize: 13, marginRight: 5, fontFamily: "'JetBrains Mono', monospace" }}>{prefix}</span>}
        <input type={type} value={value} onChange={e => onChange(e.target.value)} step={type === "number" ? step : undefined}
          onKeyDown={type === "text" ? (e => { if (e.key === "Enter") { e.preventDefault(); document.querySelector("[data-search-btn]")?.click(); }}) : undefined}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: small ? 14 : 16, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, padding: "6px 0", width: "100%", textTransform: type === "text" ? "uppercase" : "none" }} />
        {suffix && <span style={{ color: "#444", fontSize: 11, marginLeft: 5, fontFamily: "'JetBrains Mono', monospace" }}>{suffix}</span>}
      </div>
    </div>
  );
}

export default function App() {
  // ── Ticker search ──
  const [ticker, setTicker] = useState("BYMA");
  const [tickerLoading, setTickerLoading] = useState(false);
  const [tickerInfo, setTickerInfo] = useState(null);

  const doSearchTicker = async (sym) => {
    const yf = sym.includes(".") ? sym : sym + ".BA";
    for (const host of ["query1", "query2"]) {
      try {
        const r = await fetch(`https://${host}.finance.yahoo.com/v8/finance/chart/${yf}?interval=1d&range=1d`);
        if (!r.ok) continue;
        const d = await r.json();
        const meta = d?.chart?.result?.[0]?.meta;
        const price = meta?.regularMarketPrice ?? meta?.previousClose;
        if (price) return { price, source: `Yahoo Finance · ${yf}` };
      } catch (e) { /* next */ }
    }
    try {
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(`https://www.rava.com/empresas/perfil/${sym.toLowerCase()}`)}`;
      const r = await fetch(proxyUrl);
      if (r.ok) {
        const html = await r.text();
        const m = html.match(/precio["\s:]+(\d+[\.,]?\d*)/i) || html.match(/\$\s*(\d+[\.,]?\d*)/);
        if (m) return { price: parseFloat(m[1].replace(",", ".")), source: "Rava Bursátil" };
      }
    } catch (e) { /* ignore */ }
    return null;
  };

  const searchTicker = async (overrideSym) => {
    const sym = (overrideSym || ticker).trim().toUpperCase();
    if (!sym) return;
    setTickerLoading(true);
    setTickerInfo(null);
    const result = await doSearchTicker(sym);
    if (result) {
      setPrecioVenta(String(result.price));
      setPrecioCompra(String(result.price));
      setRepVenta(String(result.price));
      setRepCompra(String(result.price));
      setTickerInfo({ text: `${sym}: $${result.price} ARS (${result.source})`, error: false });
    } else {
      setTickerInfo({ text: `No se pudo obtener precio de ${sym}. Ingresalo manualmente.`, error: true });
    }
    setTickerLoading(false);
  };

  // ── Clipboard ──
  const [copied, setCopied] = useState("");
  const copyText = (text, label) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(label); setTimeout(() => setCopied(""), 1500); });
  };

  // ── Mode ──
  const [modo, setModo] = useState("ars");

  // ── Prices (ARS→USD) ──
  const [precioVenta, setPrecioVenta] = useState("");
  const [precioCompra, setPrecioCompra] = useState("");

  // ── Prices (USD→ARS) ──
  const [targetVentaUSD, setTargetVentaUSD] = useState("");
  const [targetCompraUSD, setTargetCompraUSD] = useState("");

  // ── Prices (Reporte) ── executed trade prices, no tick rounding
  const [repVenta, setRepVenta] = useState("");
  const [repCompra, setRepCompra] = useState("");

  // ── FX ──
  const [fxBid, setFxBid] = useState("");
  const [fxAsk, setFxAsk] = useState("");
  const [fxLoading, setFxLoading] = useState(true);
  const [fxError, setFxError] = useState(false);
  const [fxUpdated, setFxUpdated] = useState("");

  // ── Fees (bps) ──
  const [comision, setComision] = useState(20);
  const [marketFee, setMarketFee] = useState(6);

  // ── Broker spread ──
  const [brokerSpread, setBrokerSpread] = useState(0);
  const [spreadMode, setSpreadMode] = useState("pct");

  // ── FX extra spread ──
  const [fxExtraSpread, setFxExtraSpread] = useState(0);

  // ── Quantity ──
  const [cantidad, setCantidad] = useState(1);

  // ── Fetch CCL + default ticker on mount ──
  useEffect(() => {
    (async () => {
      const apis = [
        "https://dolarapi.com/v1/dolares/contadoconliqui",
        "https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui",
      ];
      for (const url of apis) {
        try {
          const r = await fetch(url);
          if (!r.ok) continue;
          const d = await r.json();
          const compra = d.compra ?? d[0]?.compra;
          const venta = d.venta ?? d[0]?.venta;
          if (compra && venta) {
            setFxBid(compra);
            setFxAsk(venta);
            const fecha = d.fechaActualizacion ?? d[0]?.fechaActualizacion;
            if (fecha) setFxUpdated(new Date(fecha).toLocaleString("es-AR"));
            setFxLoading(false);
            return;
          }
        } catch (e) { /* next */ }
      }
      setFxBid(1390); setFxAsk(1440); setFxError(true); setFxLoading(false);
    })();
    (async () => {
      setTickerLoading(true);
      const result = await doSearchTicker("BYMA");
      if (result) {
        setPrecioVenta(String(result.price));
        setPrecioCompra(String(result.price));
        setRepVenta(String(result.price));
        setRepCompra(String(result.price));
        setTickerInfo({ text: `BYMA: $${result.price} ARS (${result.source})`, error: false });
      }
      setTickerLoading(false);
    })();
  }, []);

  // ────────────────────────────────────────────────
  // CALCULATIONS
  // ────────────────────────────────────────────────

  // ── Parsed values (shared) ──
  const bid = parseFloat(fxBid) || 1;
  const ask = parseFloat(fxAsk) || 1;
  const feeBps = (parseFloat(comision) || 0) + (parseFloat(marketFee) || 0);
  const feePct = feeBps / 100;
  const fee = feeBps / 10000;
  const bSpreadPct = spreadMode === "pct" ? (parseFloat(brokerSpread) || 0) / 100 : 0;
  const bSpreadUSD = spreadMode === "usd" ? (parseFloat(brokerSpread) || 0) : 0;
  const cant = parseFloat(cantidad) || 1;
  const fxSpread = ((ask - bid) / bid) * 100;
  const fxExtra = parseFloat(fxExtraSpread) || 0;
  const brokerBid = Math.max(bid - fxExtra, 0.01);
  const brokerAsk = ask + fxExtra;
  const hasSpread = spreadMode === "pct" ? bSpreadPct !== 0 : bSpreadUSD !== 0;

  const calcClientPrice = (allInUSD, side) => {
    if (spreadMode === "pct") return side === "venta" ? allInUSD * (1 - bSpreadPct) : allInUSD * (1 + bSpreadPct);
    return side === "venta" ? allInUSD - bSpreadUSD : allInUSD + bSpreadUSD;
  };

  // ── ARS → USD (tick-rounded, broker perspective) ──
  const pVraw = parseFloat(precioVenta) || 0;
  const pCraw = parseFloat(precioCompra) || 0;
  const pV = roundDown(pVraw);
  const pC = roundUp(pCraw);
  const ventaAllInARS = pV * (1 - fee);
  const ventaAllInUSD = ventaAllInARS / brokerAsk;
  const compraAllInARS = pC * (1 + fee);
  const compraAllInUSD = compraAllInARS / brokerBid;

  // ── USD → ARS (reverse) ──
  const tV = parseFloat(targetVentaUSD) || 0;
  const tC = parseFloat(targetCompraUSD) || 0;
  const maxCompraRaw = tC * brokerBid / (1 + fee);
  const maxCompraARS = roundDown(maxCompraRaw);
  const maxCompraActualUSD = maxCompraARS * (1 + fee) / brokerBid;
  const minVentaRaw = tV * brokerAsk / (1 - fee);
  const minVentaARS = roundUp(minVentaRaw);
  const minVentaActualUSD = minVentaARS * (1 - fee) / brokerAsk;

  // ── Reporte: executed trade → report USD to counterparty ──
  // No tick rounding — price is exact as executed on BYMA
  // Sell: client sells → receives ARS − fees → convert at Ask → lower USD
  // Buy:  client buys  → pays ARS + fees → convert at Bid → higher USD
  const rV = parseFloat(repVenta) || 0;
  const rC = parseFloat(repCompra) || 0;
  const repVentaNetoARS = rV * (1 - fee);
  const repVentaUSD = repVentaNetoARS / brokerAsk;
  const repCompraCostoARS = rC * (1 + fee);
  const repCompraUSD = repCompraCostoARS / brokerBid;

  // ── Has-data flags ──
  const hasV = modo === "ars" ? pV > 0 : modo === "usd" ? tV > 0 : rV > 0;
  const hasC = modo === "ars" ? pC > 0 : modo === "usd" ? tC > 0 : rC > 0;

  // ── Broker spread / profit (all modes) ──
  let profitPerShareVenta = 0, profitPerShareCompra = 0;
  let clientPriceVentaUSD = 0, clientPriceCompraUSD = 0;

  const baseVentaUSD = modo === "ars" ? ventaAllInUSD : modo === "usd" ? minVentaActualUSD : repVentaUSD;
  const baseCompraUSD = modo === "ars" ? compraAllInUSD : modo === "usd" ? maxCompraActualUSD : repCompraUSD;

  if (hasV) {
    clientPriceVentaUSD = calcClientPrice(baseVentaUSD, "venta");
    profitPerShareVenta = baseVentaUSD - clientPriceVentaUSD;
  }
  if (hasC) {
    clientPriceCompraUSD = calcClientPrice(baseCompraUSD, "compra");
    profitPerShareCompra = clientPriceCompraUSD - baseCompraUSD;
  }

  const totalProfitVenta = profitPerShareVenta * cant;
  const totalProfitCompra = profitPerShareCompra * cant;

  // ────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "#0d0d0d", color: "#e0e0e0", fontFamily: "'JetBrains Mono', monospace", display: "flex", justifyContent: "center", padding: "28px 14px" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;600;700&display=swap'); * { font-family: 'JetBrains Mono', monospace !important; } @keyframes fadeIn { from { opacity:0; transform:translateY(6px) } to { opacity:1; transform:translateY(0) } }`}</style>

      <div style={{ width: "100%", maxWidth: 540 }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0, color: "#fff" }}>Calculadora All-In</h1>
          <p style={{ fontSize: 10, color: "#444", margin: "3px 0 0" }}>Perspectiva broker · Comisiones · FX CCL Bid/Ask · Tick BYMA</p>
        </div>

        {/* ── Tab toggle ── */}
        <div style={{ display: "flex", marginBottom: 18, background: "#141414", borderRadius: 9, padding: 3, border: "1px solid #1c1c1c" }}>
          {[{ k: "ars", l: "ARS → USD" }, { k: "usd", l: "USD → ARS" }, { k: "reporte", l: "Reporte" }].map(m => (
            <button key={m.k} onClick={() => setModo(m.k)} style={{
              flex: 1, padding: "8px 0", border: "none", borderRadius: 7, cursor: "pointer",
              fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", transition: "all 0.2s",
              background: modo === m.k ? "#ffffff0a" : "transparent",
              color: modo === m.k ? "#fff" : "#555",
              boxShadow: modo === m.k ? "inset 0 0 0 1px #ffffff18" : "none",
            }}>{m.l}</button>
          ))}
        </div>

        {/* ── Ticker search ── */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 4 }}>
            <div style={{ flex: 1 }}>
              <Input label="Ticker BYMA" value={ticker} onChange={setTicker} small type="text" />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <button data-search-btn onClick={() => searchTicker()} disabled={tickerLoading} style={{
                height: 36, padding: "0 14px", border: "none", borderRadius: 7,
                background: tickerLoading ? "#333" : "#4ade8020", color: tickerLoading ? "#666" : "#4ade80",
                fontSize: 11, fontWeight: 600, cursor: tickerLoading ? "wait" : "pointer",
                fontFamily: "inherit", letterSpacing: "0.05em", transition: "all 0.2s",
              }}>
                {tickerLoading ? "Buscando..." : "Buscar precio"}
              </button>
            </div>
          </div>
          {tickerInfo && <div style={{ fontSize: 10, color: tickerInfo.error ? "#f87171" : "#4ade80", padding: "2px 0" }}>{tickerInfo.text}</div>}
        </div>

        {/* ── Price inputs per mode ── */}
        {modo === "ars" ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <Input label="Venta acción (bid)" value={precioVenta} onChange={setPrecioVenta} prefix="$" suffix="ARS" hl="#f87171" step="0.25" />
              <Input label="Compra acción (ask)" value={precioCompra} onChange={setPrecioCompra} prefix="$" suffix="ARS" hl="#4ade80" step="0.25" />
            </div>
            {(pV !== pVraw || pC !== pCraw) && (pVraw > 0 || pCraw > 0) && (
              <div style={{ fontSize: 9, color: "#fbbf24", marginTop: -10, marginBottom: 10 }}>
                ⚠ Precio ajustado al tick BYMA ($0.25) a favor broker:
                {pV !== pVraw && pVraw > 0 ? ` Venta ${fmt(pVraw)}→${fmt(pV)}↓` : ""}
                {pC !== pCraw && pCraw > 0 ? ` Compra ${fmt(pCraw)}→${fmt(pC)}↑` : ""}
              </div>
            )}
          </>
        ) : modo === "usd" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
            <Input label="Target venta USD" value={targetVentaUSD} onChange={setTargetVentaUSD} prefix="$" suffix="USD" hl="#f87171" />
            <Input label="Target compra USD" value={targetCompraUSD} onChange={setTargetCompraUSD} prefix="$" suffix="USD" hl="#4ade80" />
          </div>
        ) : (
          <>
            <div style={{ fontSize: 9, color: "#a78bfa", marginBottom: 8, lineHeight: 1.5 }}>
              Precio ejecutado en mercado doméstico → reporte al counterparty offshore con comisiones incluidas.
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <Input label="Venta ejecutada" value={repVenta} onChange={setRepVenta} prefix="$" suffix="ARS" hl="#f87171" step="0.01" />
              <Input label="Compra ejecutada" value={repCompra} onChange={setRepCompra} prefix="$" suffix="ARS" hl="#4ade80" step="0.01" />
            </div>
          </>
        )}

        {/* ── FX ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 6 }}>
          <Input label="FX CCL Bid" value={fxBid} onChange={setFxBid} suffix="ARS" small />
          <Input label="FX CCL Ask" value={fxAsk} onChange={setFxAsk} suffix="ARS" small />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 6, alignItems: "end" }}>
          <Input label="Spread FX broker" value={fxExtraSpread} onChange={setFxExtraSpread} prefix="$" suffix="ARS" step="0.5" small hl="#38bdf8" />
          {fxExtra > 0 && (
            <div style={{ fontSize: 10, color: "#38bdf8", padding: "8px 0" }}>
              FX broker: Bid {fmt(brokerBid, 2)} (−${fmt(fxExtra)}) / Ask {fmt(brokerAsk, 2)} (+${fmt(fxExtra)})
            </div>
          )}
        </div>
        <div style={{ fontSize: 9, color: "#3a3a3a", marginBottom: 14, display: "flex", justifyContent: "space-between" }}>
          <span>Spread FX mercado: {fmt(fxSpread, 2)}%{fxExtra > 0 ? ` · Broker ±$${fmt(fxExtra)} ARS → ${fmt(brokerBid, 2)}/${fmt(brokerAsk, 2)}` : ""}{fxUpdated && ` · ${fxUpdated}`}</span>
          {fxLoading && <span style={{ color: "#fbbf24" }}>Cargando CCL...</span>}
          {fxError && <span style={{ color: "#f87171" }}>CCL no disponible — usando valores estimados</span>}
        </div>

        {/* ── Fees ── */}
        <details style={{ marginBottom: 20 }}>
          <summary style={{ cursor: "pointer", fontSize: 10, color: "#444", padding: "5px 0", userSelect: "none", listStyle: "none" }}>
            ⚙ Comisiones: {fmt(feeBps, 0)} bps ({fmt(feePct, 2)}%)
          </summary>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8, padding: 12, background: "#111", borderRadius: 9, border: "1px solid #1c1c1c" }}>
            <Input label="Comisión" value={comision} onChange={setComision} suffix="bps" step="1" small />
            <Input label="Market fee" value={marketFee} onChange={setMarketFee} suffix="bps" step="1" small />
          </div>
        </details>

        <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #222, transparent)", marginBottom: 18 }} />

        {/* ═══════════════════════════════════════════
            RESULTS
            ═══════════════════════════════════════════ */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

          {/* ── ARS → USD results ── */}
          {modo === "ars" && hasV && (
            <div style={{ background: "#f871710a", border: "1px solid #f8717118", borderRadius: 12, padding: "16px 18px", animation: "fadeIn 0.25s" }}>
              {hasSpread ? (
                <>
                  <div style={{ fontSize: 9, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 600 }}>▸ Cotizar al cliente · Venta</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#fbbf24", letterSpacing: "-0.02em" }}>${fmt(clientPriceVentaUSD, 4)} <span style={{ fontSize: 14, color: "#fbbf2488" }}>USD</span></div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>All-in: ${fmt(ventaAllInUSD, 4)} USD · Spread: {spreadMode === "pct" ? `−${fmt(bSpreadPct * 100, 4)}%` : `−$${fmt(bSpreadUSD, 4)}`}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Venta All-In / acción</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#f87171" }}>${fmt(ventaAllInUSD, 4)} <span style={{ fontSize: 12, color: "#f8717177" }}>USD</span></div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#555" }}>${fmt(ventaAllInARS)} ARS (neto)</span>
                <span style={{ fontSize: 11, color: "#555" }}>${fmt(pV)} ARS (nominal)</span>
              </div>
              {fxExtra > 0 && <div style={{ fontSize: 10, color: "#38bdf8", marginTop: 3 }}>FX Ask broker: {fmt(brokerAsk, 2)} (mercado: {fmt(ask, 2)})</div>}
            </div>
          )}

          {modo === "ars" && hasC && (
            <div style={{ background: "#4ade800a", border: "1px solid #4ade8018", borderRadius: 12, padding: "16px 18px", animation: "fadeIn 0.25s" }}>
              {hasSpread ? (
                <>
                  <div style={{ fontSize: 9, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 600 }}>▸ Cotizar al cliente · Compra</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#fbbf24", letterSpacing: "-0.02em" }}>${fmt(clientPriceCompraUSD, 4)} <span style={{ fontSize: 14, color: "#fbbf2488" }}>USD</span></div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>All-in: ${fmt(compraAllInUSD, 4)} USD · Spread: {spreadMode === "pct" ? `+${fmt(bSpreadPct * 100, 4)}%` : `+$${fmt(bSpreadUSD, 4)}`}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Compra All-In / acción</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#4ade80" }}>${fmt(compraAllInUSD, 4)} <span style={{ fontSize: 12, color: "#4ade8077" }}>USD</span></div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#555" }}>${fmt(compraAllInARS)} ARS (neto)</span>
                <span style={{ fontSize: 11, color: "#555" }}>${fmt(pC)} ARS (nominal)</span>
              </div>
              {fxExtra > 0 && <div style={{ fontSize: 10, color: "#38bdf8", marginTop: 3 }}>FX Bid broker: {fmt(brokerBid, 2)} (mercado: {fmt(bid, 2)})</div>}
            </div>
          )}

          {/* ── USD → ARS results ── */}
          {modo === "usd" && hasV && (
            <div style={{ background: "#f871710a", border: "1px solid #f8717118", borderRadius: 12, padding: "16px 18px", animation: "fadeIn 0.25s" }}>
              {hasSpread ? (
                <>
                  <div style={{ fontSize: 9, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 600 }}>▸ Cotizar al cliente · Venta</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#fbbf24", letterSpacing: "-0.02em" }}>${fmt(clientPriceVentaUSD, 4)} <span style={{ fontSize: 14, color: "#fbbf2488" }}>USD</span></div>
                </>
              ) : (
                <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Venta → precio mín BYMA</div>
              )}
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f87171", marginTop: 4 }}>${fmt(minVentaARS)} <span style={{ fontSize: 11, color: "#f8717177" }}>ARS</span></div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>Exacto: ${fmt(minVentaRaw)} → tick ↑ · All-in: ${fmt(minVentaActualUSD, 4)} USD</div>
              {fxExtra > 0 && <div style={{ fontSize: 10, color: "#38bdf8", marginTop: 3 }}>FX Ask broker: {fmt(brokerAsk, 2)} (mercado: {fmt(ask, 2)})</div>}
            </div>
          )}

          {modo === "usd" && hasC && (
            <div style={{ background: "#4ade800a", border: "1px solid #4ade8018", borderRadius: 12, padding: "16px 18px", animation: "fadeIn 0.25s" }}>
              {hasSpread ? (
                <>
                  <div style={{ fontSize: 9, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 600 }}>▸ Cotizar al cliente · Compra</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#fbbf24", letterSpacing: "-0.02em" }}>${fmt(clientPriceCompraUSD, 4)} <span style={{ fontSize: 14, color: "#fbbf2488" }}>USD</span></div>
                </>
              ) : (
                <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Compra → precio máx BYMA</div>
              )}
              <div style={{ fontSize: 20, fontWeight: 700, color: "#4ade80", marginTop: 4 }}>${fmt(maxCompraARS)} <span style={{ fontSize: 11, color: "#4ade8077" }}>ARS</span></div>
              <div style={{ fontSize: 10, color: "#555", marginTop: 3 }}>Exacto: ${fmt(maxCompraRaw)} → tick ↓ · All-in: ${fmt(maxCompraActualUSD, 4)} USD</div>
              {fxExtra > 0 && <div style={{ fontSize: 10, color: "#38bdf8", marginTop: 3 }}>FX Bid broker: {fmt(brokerBid, 2)} (mercado: {fmt(bid, 2)})</div>}
            </div>
          )}

          {/* ── Reporte results ── */}
          {modo === "reporte" && hasV && (
            <div style={{ background: "#f871710a", border: "1px solid #f8717118", borderRadius: 12, padding: "16px 18px", animation: "fadeIn 0.25s" }}>
              {hasSpread ? (
                <>
                  <div style={{ fontSize: 9, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 600 }}>▸ Reportar a counterparty · Venta</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#fbbf24", letterSpacing: "-0.02em" }}>${fmt(clientPriceVentaUSD, 4)} <span style={{ fontSize: 14, color: "#fbbf2488" }}>USD</span></div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>All-in: ${fmt(repVentaUSD, 4)} USD · Spread: {spreadMode === "pct" ? `−${fmt(bSpreadPct * 100, 4)}%` : `−$${fmt(bSpreadUSD, 4)}`}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Reportar a counterparty · Venta</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#f87171" }}>${fmt(repVentaUSD, 4)} <span style={{ fontSize: 12, color: "#f8717177" }}>USD</span></div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#555" }}>${fmt(repVentaNetoARS)} ARS (neto − fees)</span>
                <span style={{ fontSize: 11, color: "#555" }}>${fmt(rV)} ARS (ejecutado)</span>
              </div>
              <div style={{ fontSize: 9, color: "#555", marginTop: 3 }}>Fees: −${fmt(rV * fee)} ARS ({fmt(feeBps, 0)} bps) · ÷ FX Ask {fxExtra > 0 ? `${fmt(brokerAsk, 2)} (broker)` : fmt(ask, 2)}</div>
              {fxExtra > 0 && <div style={{ fontSize: 10, color: "#38bdf8", marginTop: 3 }}>FX Ask broker: {fmt(brokerAsk, 2)} (mercado: {fmt(ask, 2)})</div>}
            </div>
          )}

          {modo === "reporte" && hasC && (
            <div style={{ background: "#4ade800a", border: "1px solid #4ade8018", borderRadius: 12, padding: "16px 18px", animation: "fadeIn 0.25s" }}>
              {hasSpread ? (
                <>
                  <div style={{ fontSize: 9, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6, fontWeight: 600 }}>▸ Reportar a counterparty · Compra</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: "#fbbf24", letterSpacing: "-0.02em" }}>${fmt(clientPriceCompraUSD, 4)} <span style={{ fontSize: 14, color: "#fbbf2488" }}>USD</span></div>
                  <div style={{ fontSize: 10, color: "#666", marginTop: 6 }}>All-in: ${fmt(repCompraUSD, 4)} USD · Spread: {spreadMode === "pct" ? `+${fmt(bSpreadPct * 100, 4)}%` : `+$${fmt(bSpreadUSD, 4)}`}</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 9, color: "#666", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>Reportar a counterparty · Compra</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: "#4ade80" }}>${fmt(repCompraUSD, 4)} <span style={{ fontSize: 12, color: "#4ade8077" }}>USD</span></div>
                </>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                <span style={{ fontSize: 11, color: "#555" }}>${fmt(repCompraCostoARS)} ARS (neto + fees)</span>
                <span style={{ fontSize: 11, color: "#555" }}>${fmt(rC)} ARS (ejecutado)</span>
              </div>
              <div style={{ fontSize: 9, color: "#555", marginTop: 3 }}>Fees: +${fmt(rC * fee)} ARS ({fmt(feeBps, 0)} bps) · ÷ FX Bid {fxExtra > 0 ? `${fmt(brokerBid, 2)} (broker)` : fmt(bid, 2)}</div>
              {fxExtra > 0 && <div style={{ fontSize: 10, color: "#38bdf8", marginTop: 3 }}>FX Bid broker: {fmt(brokerBid, 2)} (mercado: {fmt(bid, 2)})</div>}
            </div>
          )}

          {/* ── P&L Broker (all modes) ── */}
          {(hasV || hasC) && (
            <>
              <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #fbbf2425, transparent)", margin: "6px 0" }} />
              <div style={{ background: "#fbbf240a", border: "1px solid #fbbf2418", borderRadius: 12, padding: "16px 18px" }}>
                <div style={{ fontSize: 10, color: "#fbbf24", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10, fontWeight: 600 }}>💰 P&L Broker</div>

                <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <Input label={spreadMode === "pct" ? "Spread broker %" : "Spread broker USD"} value={brokerSpread} onChange={setBrokerSpread} suffix={spreadMode === "pct" ? "%" : "USD"} step="0.0001" small hl="#fbbf24" />
                  </div>
                  <div style={{ display: "flex", background: "#1a1a1a", borderRadius: 6, overflow: "hidden", height: 36, border: "1px solid #252525" }}>
                    {[{ k: "pct", l: "%" }, { k: "usd", l: "$" }].map(m => (
                      <button key={m.k} onClick={() => { setSpreadMode(m.k); setBrokerSpread(0); }} style={{
                        padding: "0 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
                        fontFamily: "inherit", transition: "all 0.2s",
                        background: spreadMode === m.k ? "#fbbf2420" : "transparent",
                        color: spreadMode === m.k ? "#fbbf24" : "#555",
                      }}>{m.l}</button>
                    ))}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <label style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", textTransform: "uppercase", letterSpacing: "0.08em", color: "#777", fontWeight: 500 }}>Cantidad</label>
                      <div style={{ display: "flex", alignItems: "center", background: "#1a1a1a", border: "1px solid #252525", borderRadius: 7, padding: "0 10px", height: 36 }}>
                        <input type="text" inputMode="numeric"
                          value={cantidad === "" ? "" : (parseInt(cantidad) || 0).toLocaleString("en-US")}
                          onChange={e => setCantidad(e.target.value.replace(/,/g, "").replace(/[^0-9]/g, ""))}
                          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#ddd", fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, padding: "6px 0", width: "100%" }} />
                        <span style={{ color: "#444", fontSize: 11, marginLeft: 5, fontFamily: "'JetBrains Mono', monospace" }}>acc</span>
                      </div>
                    </div>
                  </div>
                </div>

                {hasSpread ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {hasV && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: 11, color: "#f87171" }}>Venta</span>
                          <div style={{ fontSize: 9, color: "#555" }}>All-in: ${fmt(baseVentaUSD, 4)} → Cliente: ${fmt(clientPriceVentaUSD, 4)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: totalProfitVenta >= 0 ? "#4ade80" : "#f87171" }}>{totalProfitVenta >= 0 ? "+" : ""}${fmt(totalProfitVenta, 1)} USD</span>
                          {cant > 1 && <div style={{ fontSize: 9, color: "#555" }}>${fmt(profitPerShareVenta, 4)}/acc × {cant.toLocaleString("en-US")}</div>}
                        </div>
                      </div>
                    )}
                    {hasC && (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: 11, color: "#4ade80" }}>Compra</span>
                          <div style={{ fontSize: 9, color: "#555" }}>All-in: ${fmt(baseCompraUSD, 4)} → Cliente: ${fmt(clientPriceCompraUSD, 4)}</div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: 16, fontWeight: 700, color: totalProfitCompra >= 0 ? "#4ade80" : "#f87171" }}>{totalProfitCompra >= 0 ? "+" : ""}${fmt(totalProfitCompra, 1)} USD</span>
                          {cant > 1 && <div style={{ fontSize: 9, color: "#555" }}>${fmt(profitPerShareCompra, 4)}/acc × {cant.toLocaleString("en-US")}</div>}
                        </div>
                      </div>
                    )}
                    {hasV && hasC && (() => {
                      const total = totalProfitVenta + totalProfitCompra;
                      return (
                        <div style={{ borderTop: "1px solid #fbbf2420", paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: total >= 0 ? "#fbbf24" : "#f87171", fontWeight: 600 }}>{total >= 0 ? "Total ganancia" : "Total pérdida"}</span>
                          <span style={{ fontSize: 20, fontWeight: 700, color: total >= 0 ? "#fbbf24" : "#f87171" }}>{total >= 0 ? "+" : ""}{fmt(total, 1)} USD</span>
                        </div>
                      );
                    })()}
                  </div>
                ) : (
                  <div style={{ fontSize: 11, color: "#444", textAlign: "center", padding: "8px 0" }}>
                    Ingresá un spread para calcular la ganancia
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Detail collapsible ── */}
          {(hasV || hasC) && (
            <details>
              <summary style={{ cursor: "pointer", fontSize: 10, color: "#333", padding: "4px 0", userSelect: "none", listStyle: "none" }}>▸ Ver detalle</summary>
              <div style={{ background: "#111", borderRadius: 9, padding: "12px 14px", border: "1px solid #1c1c1c", fontSize: 10, color: "#555", display: "flex", flexDirection: "column", gap: 4, marginTop: 6 }}>
                {modo === "ars" ? (
                  <>
                    {hasV && (
                      <>
                        <div style={{ color: "#f87171", fontWeight: 600, fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Venta</div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Precio nominal{pV !== pVraw ? " (tick ↓)" : ""}</span><span style={{ color: "#888" }}>${fmt(pV)} ARS{pV !== pVraw ? ` (ingresado: ${fmt(pVraw)})` : ""}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fees ({fmt(feeBps, 0)} bps)</span><span style={{ color: "#f8717166" }}>−${fmt(pV * fee)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Neto ARS</span><span style={{ color: "#888" }}>${fmt(ventaAllInARS)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontWeight: 600 }}><span>÷ FX Ask {fxExtra > 0 ? `${fmt(brokerAsk, 2)} (broker)` : fmt(ask, 2)}</span><span>${fmt(ventaAllInUSD, 4)} USD</span></div>
                        {hasSpread && <div style={{ display: "flex", justifyContent: "space-between", color: "#fbbf24" }}><span>− Spread broker ({spreadMode === "pct" ? fmt(bSpreadPct * 100, 4) + "%" : "$" + fmt(bSpreadUSD, 4)})</span><span>→ ${fmt(clientPriceVentaUSD, 4)} USD al cliente</span></div>}
                      </>
                    )}
                    {hasV && hasC && <div style={{ height: 1, background: "#1c1c1c", margin: "4px 0" }} />}
                    {hasC && (
                      <>
                        <div style={{ color: "#4ade80", fontWeight: 600, fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Compra</div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Precio nominal{pC !== pCraw ? " (tick ↑)" : ""}</span><span style={{ color: "#888" }}>${fmt(pC)} ARS{pC !== pCraw ? ` (ingresado: ${fmt(pCraw)})` : ""}</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fees ({fmt(feeBps, 0)} bps)</span><span style={{ color: "#4ade8066" }}>+${fmt(pC * fee)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Costo ARS</span><span style={{ color: "#888" }}>${fmt(compraAllInARS)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontWeight: 600 }}><span>÷ FX Bid {fxExtra > 0 ? `${fmt(brokerBid, 2)} (broker)` : fmt(bid, 2)}</span><span>${fmt(compraAllInUSD, 4)} USD</span></div>
                        {hasSpread && <div style={{ display: "flex", justifyContent: "space-between", color: "#fbbf24" }}><span>+ Spread broker ({spreadMode === "pct" ? fmt(bSpreadPct * 100, 4) + "%" : "$" + fmt(bSpreadUSD, 4)})</span><span>→ ${fmt(clientPriceCompraUSD, 4)} USD al cliente</span></div>}
                      </>
                    )}
                  </>
                ) : modo === "usd" ? (
                  <>
                    {hasV && (
                      <>
                        <div style={{ color: "#f87171", fontWeight: 600, fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Venta → target {fmt(tV, 4)} USD</div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Precio exacto</span><span style={{ color: "#555" }}>${fmt(minVentaRaw)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tick BYMA (↑$0.25)</span><span style={{ color: "#aaa" }}>${fmt(minVentaARS)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>− Fees ({fmt(feeBps, 0)} bps)</span><span style={{ color: "#f8717166" }}>−${fmt(minVentaARS * fee)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontWeight: 600 }}><span>÷ FX Ask {fxExtra > 0 ? `${fmt(brokerAsk, 2)} (broker)` : fmt(ask, 2)}</span><span>= ${fmt(minVentaActualUSD, 4)} USD</span></div>
                      </>
                    )}
                    {hasV && hasC && <div style={{ height: 1, background: "#1c1c1c", margin: "4px 0" }} />}
                    {hasC && (
                      <>
                        <div style={{ color: "#4ade80", fontWeight: 600, fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Compra → target {fmt(tC, 4)} USD</div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Precio exacto</span><span style={{ color: "#555" }}>${fmt(maxCompraRaw)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Tick BYMA (↓$0.25)</span><span style={{ color: "#aaa" }}>${fmt(maxCompraARS)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>+ Fees ({fmt(feeBps, 0)} bps)</span><span style={{ color: "#4ade8066" }}>+${fmt(maxCompraARS * fee)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontWeight: 600 }}><span>÷ FX Bid {fxExtra > 0 ? `${fmt(brokerBid, 2)} (broker)` : fmt(bid, 2)}</span><span>= ${fmt(maxCompraActualUSD, 4)} USD</span></div>
                      </>
                    )}
                  </>
                ) : (
                  /* Reporte detail */
                  <>
                    {hasV && (
                      <>
                        <div style={{ color: "#f87171", fontWeight: 600, fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Venta · Reporte</div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Precio ejecutado</span><span style={{ color: "#888" }}>${fmt(rV)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fees ({fmt(feeBps, 0)} bps)</span><span style={{ color: "#f8717166" }}>−${fmt(rV * fee)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Neto ARS</span><span style={{ color: "#888" }}>${fmt(repVentaNetoARS)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontWeight: 600 }}><span>÷ FX Ask {fxExtra > 0 ? `${fmt(brokerAsk, 2)} (broker)` : fmt(ask, 2)}</span><span>${fmt(repVentaUSD, 4)} USD</span></div>
                        {hasSpread && <div style={{ display: "flex", justifyContent: "space-between", color: "#fbbf24" }}><span>− Spread broker ({spreadMode === "pct" ? fmt(bSpreadPct * 100, 4) + "%" : "$" + fmt(bSpreadUSD, 4)})</span><span>→ ${fmt(clientPriceVentaUSD, 4)} USD al counterparty</span></div>}
                      </>
                    )}
                    {hasV && hasC && <div style={{ height: 1, background: "#1c1c1c", margin: "4px 0" }} />}
                    {hasC && (
                      <>
                        <div style={{ color: "#4ade80", fontWeight: 600, fontSize: 9, textTransform: "uppercase", marginBottom: 2 }}>Compra · Reporte</div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Precio ejecutado</span><span style={{ color: "#888" }}>${fmt(rC)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Fees ({fmt(feeBps, 0)} bps)</span><span style={{ color: "#4ade8066" }}>+${fmt(rC * fee)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between" }}><span>Costo ARS</span><span style={{ color: "#888" }}>${fmt(repCompraCostoARS)} ARS</span></div>
                        <div style={{ display: "flex", justifyContent: "space-between", color: "#aaa", fontWeight: 600 }}><span>÷ FX Bid {fxExtra > 0 ? `${fmt(brokerBid, 2)} (broker)` : fmt(bid, 2)}</span><span>${fmt(repCompraUSD, 4)} USD</span></div>
                        {hasSpread && <div style={{ display: "flex", justifyContent: "space-between", color: "#fbbf24" }}><span>+ Spread broker ({spreadMode === "pct" ? fmt(bSpreadPct * 100, 4) + "%" : "$" + fmt(bSpreadUSD, 4)})</span><span>→ ${fmt(clientPriceCompraUSD, 4)} USD al counterparty</span></div>}
                      </>
                    )}
                  </>
                )}
              </div>
            </details>
          )}
        </div>

        {!hasV && !hasC && (
          <div style={{ textAlign: "center", padding: "36px 0", color: "#222", fontSize: 11 }}>
            {modo === "ars" ? "Ingresá precio de venta y/o compra en ARS"
              : modo === "usd" ? "Ingresá el precio target en USD"
              : "Ingresá el precio ejecutado en ARS"}
          </div>
        )}

        {/* ═══════ EXPORT ═══════ */}
        {(hasV || hasC) && (() => {
          const ts = new Date().toLocaleString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false, day: "2-digit", month: "2-digit" });
          const tk = ticker.trim().toUpperCase() || "—";

          const internalLines = [`${tk} · ${ts}`];
          if (modo === "ars") {
            if (hasV) internalLines.push(`Venta: $${fmt(pV)} ARS → All-in $${fmt(ventaAllInUSD, 4)} USD${hasSpread ? ` → Cliente $${fmt(clientPriceVentaUSD, 4)} USD` : ""}`);
            if (hasC) internalLines.push(`Compra: $${fmt(pC)} ARS → All-in $${fmt(compraAllInUSD, 4)} USD${hasSpread ? ` → Cliente $${fmt(clientPriceCompraUSD, 4)} USD` : ""}`);
          } else if (modo === "usd") {
            if (hasV) internalLines.push(`Venta: target $${fmt(tV, 4)} USD → $${fmt(minVentaARS)} ARS${hasSpread ? ` → Cliente $${fmt(clientPriceVentaUSD, 4)} USD` : ""}`);
            if (hasC) internalLines.push(`Compra: target $${fmt(tC, 4)} USD → $${fmt(maxCompraARS)} ARS${hasSpread ? ` → Cliente $${fmt(clientPriceCompraUSD, 4)} USD` : ""}`);
          } else {
            if (hasV) internalLines.push(`Venta: $${fmt(rV)} ARS ejecutado → $${fmt(repVentaUSD, 4)} USD all-in${hasSpread ? ` → Counterparty $${fmt(clientPriceVentaUSD, 4)} USD` : ""}`);
            if (hasC) internalLines.push(`Compra: $${fmt(rC)} ARS ejecutado → $${fmt(repCompraUSD, 4)} USD all-in${hasSpread ? ` → Counterparty $${fmt(clientPriceCompraUSD, 4)} USD` : ""}`);
          }
          internalLines.push(`FX: Bid ${fmt(bid, 2)} / Ask ${fmt(ask, 2)}${fxExtra > 0 ? ` · Broker: ${fmt(brokerBid, 2)}/${fmt(brokerAsk, 2)}` : ""} · Fees: ${fmt(feeBps, 0)} bps`);
          if (hasSpread) internalLines.push(`Spread broker: ${spreadMode === "pct" ? fmt(bSpreadPct * 100, 4) + "%" : "$" + fmt(bSpreadUSD, 4) + " USD"} · P&L: ${(totalProfitVenta + totalProfitCompra) >= 0 ? "+" : ""}$${fmt(totalProfitVenta + totalProfitCompra, 1)} USD (${cant.toLocaleString("en-US")} acc)`);
          const internalText = internalLines.join("\n");

          const clientLines = [`${tk}`];
          if (modo === "ars") {
            if (hasV) clientLines.push(`Venta: $${fmt(hasSpread ? clientPriceVentaUSD : ventaAllInUSD, 4)} USD`);
            if (hasC) clientLines.push(`Compra: $${fmt(hasSpread ? clientPriceCompraUSD : compraAllInUSD, 4)} USD`);
          } else if (modo === "usd") {
            if (hasV) clientLines.push(`Venta: $${fmt(hasSpread ? clientPriceVentaUSD : minVentaActualUSD, 4)} USD`);
            if (hasC) clientLines.push(`Compra: $${fmt(hasSpread ? clientPriceCompraUSD : maxCompraActualUSD, 4)} USD`);
          } else {
            if (hasV) clientLines.push(`Venta: $${fmt(hasSpread ? clientPriceVentaUSD : repVentaUSD, 4)} USD`);
            if (hasC) clientLines.push(`Compra: $${fmt(hasSpread ? clientPriceCompraUSD : repCompraUSD, 4)} USD`);
          }
          const clientText = clientLines.join("\n");

          const btnStyle = (active) => ({
            flex: 1, padding: "8px 0", border: "none", borderRadius: 6, fontSize: 10, fontWeight: 600,
            fontFamily: "inherit", cursor: "pointer", letterSpacing: "0.05em", transition: "all 0.2s",
            background: active ? "#4ade8030" : "#1a1a1a", color: active ? "#4ade80" : "#666",
          });
          return (
            <>
              <div style={{ height: 1, background: "linear-gradient(90deg, transparent, #222, transparent)", margin: "16px 0 12px" }} />
              <div style={{ fontSize: 9, color: "#444", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8, fontWeight: 600 }}>📋 Exportar</div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => copyText(internalText, "internal")} style={btnStyle(copied === "internal")}>
                  {copied === "internal" ? "✓ Copiado" : "Copiar interno"}
                </button>
                <button onClick={() => copyText(clientText, "client")} style={btnStyle(copied === "client")}>
                  {copied === "client" ? "✓ Copiado" : modo === "reporte" ? "Copiar p/ counterparty" : "Copiar p/ cliente"}
                </button>
              </div>
              <pre style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 8, padding: "10px 12px", fontSize: 10, color: "#555", fontFamily: "'JetBrains Mono', monospace", whiteSpace: "pre-wrap", marginTop: 8, lineHeight: 1.5, userSelect: "all" }}>
{internalText}
              </pre>
            </>
          );
        })()}
      </div>
    </div>
  );
}
