import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

// simple cache
let lastData = null;
let lastFetch = 0;

app.get("/api/predict", async (req, res) => {
  try {
    const symbol = req.query.symbol || "RELIANCE.NS";

    const now = Date.now();

    // ⏱ prevent hitting Yahoo too frequently
    if (now - lastFetch < 20000 && lastData) {
      return res.json({ ...lastData, cached: true });
    }

    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;
    const response = await fetch(url);

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

    // smooth forecast (NOT random jumps)
    const hourlySeries = [];
    let base = price;

    for (let i = 0; i < 10; i++) {
      base = base + trend * 0.03 + Math.sin(i) * 0.05;
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
        day1: Number((price + trend * 0.4).toFixed(2)),
        day2: Number((price + trend * 0.7).toFixed(2)),
        day3: Number((price + trend * 1.0).toFixed(2)),
        weekly: Number((price + trend * 1.8).toFixed(2))
      },

      support: Number((price * 0.98).toFixed(2)),
      resistance: Number((price * 1.02).toFixed(2)),

      confidence: 80,
      signal: trend > 0 ? "BUY" : "HOLD",
      bias: trend > 0 ? "BULLISH" : "SIDEWAYS",
      risk: "MEDIUM"
    };

    // save cache
    lastData = result;
    lastFetch = now;

    res.json(result);

  } catch (err) {
    console.error("ERROR:", err.message);

    // fallback to last good data
    if (lastData) {
      return res.json({
        ...lastData,
        warning: "Using cached data (Yahoo limit)"
      });
    }

    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

// root check
app.get("/", (req, res) => {
  res.send("Stock API running 🚀");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
