import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// =========================
// 🕒 MARKET HOURS
// =========================
function isMarketOpen() {
  const now = new Date();
  const indiaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const h = indiaTime.getHours();
  const m = indiaTime.getMinutes();

  return (
    (h > 9 || (h === 9 && m >= 15)) &&
    (h < 15 || (h === 15 && m <= 30))
  );
}

// =========================
// 💾 SAVE DATA
// =========================
function saveDataPoint(symbol, ltp, volume) {
  const fileName = `data-${symbol}.json`;

  const now = new Date();
  const indiaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const data = {
    date: indiaTime.toISOString().split("T")[0],
    hour: indiaTime.getHours(),
    price: ltp,
    volume,
    synthetic: false
  };

  let history = [];
  try {
    history = JSON.parse(fs.readFileSync(fileName));
  } catch {}

  history.push(data);
  fs.writeFileSync(fileName, JSON.stringify(history, null, 2));
}

// =========================
// 📊 FETCH DATA
// =========================
async function fetchStockData(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=max&interval=1d`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json"
    }
  });

  const json = await response.json();
  const result = json.chart.result[0];
  const quotes = result.indicators.quote[0];

  return { result, quotes };
}

// =========================
// 📈 TREND DETECTION
// =========================
function detectTrend(closes) {
  const short = closes.slice(-5);
  const mid = closes.slice(-15);

  const avgShort = short.reduce((a, b) => a + b, 0) / short.length;
  const avgMid = mid.reduce((a, b) => a + b, 0) / mid.length;

  if (avgShort > avgMid * 1.01) return "BULLISH";
  if (avgShort < avgMid * 0.99) return "BEARISH";
  return "SIDEWAYS";
}

// =========================
// 📉 PATTERN DETECTION
// =========================
function detectPattern(closes) {
  const last = closes.slice(-10);

  const max = Math.max(...last);
  const min = Math.min(...last);

  // Double Top
  const peaks = last.filter(p => p > max * 0.98);
  if (peaks.length >= 2) return "DOUBLE_TOP";

  // Double Bottom
  const bottoms = last.filter(p => p < min * 1.02);
  if (bottoms.length >= 2) return "DOUBLE_BOTTOM";

  // Breakout
  if (last.at(-1) > max * 1.01) return "BREAKOUT";

  return "NONE";
}

// =========================
// 🧠 SIGNAL ENGINE
// =========================
function generateSignal(trend, pattern) {
  let signal = "HOLD";
  let confidence = 50;
  let reasons = [];

  if (trend === "BULLISH") {
    confidence += 15;
    reasons.push("Uptrend forming");
  }

  if (trend === "BEARISH") {
    confidence -= 15;
    reasons.push("Downtrend forming");
  }

  if (pattern === "DOUBLE_BOTTOM") {
    signal = "BUY";
    confidence += 20;
    reasons.push("Double bottom reversal");
  }

  if (pattern === "DOUBLE_TOP") {
    signal = "SELL";
    confidence += 20;
    reasons.push("Double top resistance");
  }

  if (pattern === "BREAKOUT") {
    signal = "BUY";
    confidence += 25;
    reasons.push("Price breakout detected");
  }

  confidence = Math.max(0, Math.min(100, confidence));

  return { signal, confidence, reasons };
}

// =========================
// 🚀 PRICE API (UNCHANGED)
// =========================
app.get("/api/price", async (req, res) => {
  try {
    const symbol = req.query.symbol || "ANANDRATHI.NS";

    const { quotes } = await fetchStockData(symbol);

    const closes = quotes.close.filter(x => x);
    const volumes = quotes.volume.filter(x => x);

    const ltp = closes.at(-1);
    const prev = closes.at(-2);

    if (isMarketOpen()) {
      saveDataPoint(symbol, ltp, volumes.at(-1));
    }

    res.json({
      symbol,
      ltp: Math.round(ltp),
      marketStatus: isMarketOpen() ? "OPEN" : "CLOSED"
    });

  } catch (err) {
    res.json({ ok: false });
  }
});

// =========================
// 🔥 SIGNAL API (NEW)
// =========================
app.get("/api/signal", async (req, res) => {
  try {
    const symbol = req.query.symbol || "ANANDRATHI.NS";

    const { quotes } = await fetchStockData(symbol);

    const closes = quotes.close.filter(x => x);

    const trend = detectTrend(closes);
    const pattern = detectPattern(closes);

    const { signal, confidence, reasons } = generateSignal(trend, pattern);

    res.json({
      symbol,
      trend,
      pattern,
      signal,
      confidence,
      reasons
    });

  } catch (err) {
    res.json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
