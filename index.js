import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

const cache = {};

// ===============================
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });
      const data = await res.json();
      if (data) return data;
    } catch {}
  }
  return null;
}

// ===============================
// 📈 PRICE
// ===============================
app.get("/api/price", async (req, res) => {
  const symbol = req.query.symbol;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;

  const data = await fetchWithRetry(url);

  let price = null;

  if (data?.chart?.result?.[0]) {
    price = data.chart.result[0].meta.regularMarketPrice;
  }

  if (price) {
    cache[symbol] = price;
  }

  if (!price && cache[symbol]) {
    return res.json({ symbol, price: cache[symbol], source: "CACHE" });
  }

  if (!price) return res.json({ error: "No price" });

  res.json({ symbol, price, source: "LIVE" });
});

// ===============================
// 📊 HISTORY
// ===============================
app.get("/api/history", async (req, res) => {
  const symbol = req.query.symbol;

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`;

  const data = await fetchWithRetry(url);

  if (!data?.chart?.result?.[0]) {
    return res.json({ data: [] });
  }

  const r = data.chart.result[0];

  const timestamps = r.timestamp || [];
  const prices = r.indicators.quote[0].close || [];

  const formatted = timestamps.map((t, i) => ({
    time: new Date(t * 1000),
    price: prices[i]
  })).filter(x => x.price);

  res.json({ data: formatted });
});

// ===============================
// 🧠 PREDICT + SIGNAL ENGINE
// ===============================
app.get("/api/predict", async (req, res) => {
  const symbol = req.query.symbol;

  const priceRes = await fetch(`http://localhost:${PORT}/api/price?symbol=${symbol}`);
  const priceData = await priceRes.json();

  const price = Number(priceData.price);

  if (!price) {
    return res.json({ error: "No base price" });
  }

  // Basic projections
  const hourly = price * 1.002;
  const threeDay = price * 1.01;
  const weekly = price * 1.03;

  const support = price * 0.99;
  const resistance = price * 1.01;

  const confidence = 85;

  // ===============================
  // SIGNAL ENGINE
  // ===============================
  let signal = "HOLD";
  let bias = "SIDEWAYS";
  let risk = "MEDIUM";

  if (hourly > price && price <= support * 1.01) {
    signal = "BUY";
    bias = "BULLISH";
    risk = "LOW";
  } else if (hourly < price && price >= resistance * 0.99) {
    signal = "SELL";
    bias = "BEARISH";
    risk = "HIGH";
  }

  res.json({
    symbol,
    price,
    predictions: {
      hourly: hourly.toFixed(2),
      threeDay: threeDay.toFixed(2),
      weekly: weekly.toFixed(2)
    },
    support: support.toFixed(2),
    resistance: resistance.toFixed(2),
    confidence,
    signal,
    bias,
    risk
  });
});

// ===============================
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
