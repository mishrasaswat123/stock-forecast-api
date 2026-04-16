import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

// 🔥 in-memory cache (simple but effective)
let lastGoodData = null;
let lastFetchTime = 0;

app.get("/api/predict", async (req, res) => {
  try {
    const symbol = req.query.symbol || "RELIANCE.NS";

    // ⏱ throttle: avoid hitting Yahoo too often
    const now = Date.now();
    if (now - lastFetchTime < 15000 && lastGoodData) {
      return res.json({ ...lastGoodData, cached: true });
    }

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;

    const response = await fetch(url);

    // ❗ Handle rate limit
    if (!response.ok) {
      throw new Error(`Yahoo error: ${response.status}`);
    }

    const data = await response.json();
    const quote = data.quoteResponse.result[0];

    if (!quote) {
      throw new Error("Invalid symbol");
    }

    const price = quote.regularMarketPrice;
    const previousClose = quote.regularMarketPreviousClose;

    const trend = price - previousClose;

    const hourlySeries = [];
    let base = price;

    for (let i = 0; i < 10; i++) {
      base = base + trend * 0.05 + Math.sin(i) * 0.1;
      hourlySeries.push(Number(base.toFixed(2)));
    }

    const result = {
      symbol,
      price,
      previousClose,
      marketStatus: "LIVE",
      timestamp: new Date(),

      predictions: {
        hourly: hourlySeries[0],
        hourlySeries,
        day1: Number((price + trend * 0.5).toFixed(2)),
        day2: Number((price + trend * 0.8).toFixed(2)),
        day3: Number((price + trend * 1.2).toFixed(2)),
        weekly: Number((price + trend * 2).toFixed(2))
      },

      support: Number((price * 0.98).toFixed(2)),
      resistance: Number((price * 1.02).toFixed(2)),

      confidence: 85,
      signal: trend > 0 ? "BUY" : "HOLD",
      bias: trend > 0 ? "BULLISH" : "SIDEWAYS",
      risk: "MEDIUM"
    };

    // ✅ save cache
    lastGoodData = result;
    lastFetchTime = now;

    res.json(result);

  } catch (err) {
    console.error("ERROR:", err.message);

    // ✅ fallback instead of crash
    if (lastGoodData) {
      return res.json({
        ...lastGoodData,
        warning: "Using cached data due to API limit"
      });
    }

    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

// root
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
