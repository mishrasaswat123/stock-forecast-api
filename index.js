import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// 🔥 In-memory cache (very important)
const cache = {};

// ===============================
// 🔁 Retry Function
// ===============================
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" }
      });

      const data = await res.json();

      if (data) return data;
    } catch (e) {
      console.log("Retry attempt:", i + 1);
    }
  }
  return null;
}

// ===============================
// 📈 PRICE API (BULLETPROOF)
// ===============================
app.get("/api/price", async (req, res) => {
  const symbol = req.query.symbol;

  if (!symbol) {
    return res.json({ error: "Symbol required" });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;

  try {
    const data = await fetchWithRetry(url);

    let price = null;
    let marketStatus = "UNKNOWN";

    if (
      data &&
      data.chart &&
      data.chart.result &&
      data.chart.result[0]
    ) {
      const result = data.chart.result[0];

      price = result.meta.regularMarketPrice;
      marketStatus = result.meta.marketState || "UNKNOWN";
    }

    // ✅ If valid → update cache
    if (price) {
      cache[symbol] = {
        price,
        marketStatus,
        time: new Date()
      };
    }

    // ⚠️ If API failed → use cache
    if (!price && cache[symbol]) {
      console.log("Using cached price for", symbol);

      return res.json({
        symbol,
        price: cache[symbol].price,
        marketStatus: cache[symbol].marketStatus,
        source: "CACHE"
      });
    }

    // ❌ If no data at all
    if (!price) {
      return res.json({
        symbol,
        error: "Price unavailable"
      });
    }

    return res.json({
      symbol,
      price,
      marketStatus,
      source: "LIVE"
    });

  } catch (e) {
    console.log("Price API error:", e);

    // Fallback to cache
    if (cache[symbol]) {
      return res.json({
        symbol,
        price: cache[symbol].price,
        marketStatus: cache[symbol].marketStatus,
        source: "CACHE"
      });
    }

    return res.json({
      symbol,
      error: "Failed to fetch price"
    });
  }
});

// ===============================
// 📊 HISTORY API (SAFE)
// ===============================
app.get("/api/history", async (req, res) => {
  const symbol = req.query.symbol;

  if (!symbol) {
    return res.json({ error: "Symbol required" });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=5m&range=1d`;

  try {
    const data = await fetchWithRetry(url);

    if (
      !data ||
      !data.chart ||
      !data.chart.result ||
      !data.chart.result[0]
    ) {
      return res.json({ data: [] });
    }

    const result = data.chart.result[0];

    const timestamps = result.timestamp || [];
    const prices = result.indicators.quote[0].close || [];

    const formatted = timestamps.map((t, i) => ({
      time: new Date(t * 1000),
      price: prices[i]
    })).filter(d => d.price);

    return res.json({
      symbol,
      count: formatted.length,
      data: formatted
    });

  } catch (e) {
    console.log("History error:", e);
    return res.json({ data: [] });
  }
});

// ===============================
// 🔮 PREDICTION API (SAFE)
// ===============================
app.get("/api/predict", async (req, res) => {
  const symbol = req.query.symbol;

  if (!symbol) {
    return res.json({ error: "Symbol required" });
  }

  try {
    const priceRes = await fetch(`http://localhost:${PORT}/api/price?symbol=${symbol}`);
    const priceData = await priceRes.json();

    const basePrice = priceData.price || 0;

    if (!basePrice) {
      return res.json({
        symbol,
        error: "No base price"
      });
    }

    const hourly = basePrice * 1.002;
    const threeDay = basePrice * 1.01;
    const weekly = basePrice * 1.03;

    return res.json({
      symbol,
      predictions: {
        hourly: hourly.toFixed(2),
        threeDay: threeDay.toFixed(2),
        weekly: weekly.toFixed(2)
      },
      regime: "SIDEWAYS",
      support: (basePrice * 0.99).toFixed(2),
      resistance: (basePrice * 1.01).toFixed(2),
      confidence: 90,
      volumeSignal: "NORMAL"
    });

  } catch (e) {
    console.log("Prediction error:", e);

    return res.json({
      symbol,
      error: "Prediction failed"
    });
  }
});

// ===============================
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
