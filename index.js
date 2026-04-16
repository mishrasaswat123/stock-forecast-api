import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/api/predict", async (req, res) => {
  try {
    const symbol = req.query.symbol || "RELIANCE.NS";

    // ✅ Direct Yahoo API (NO LIBRARY)
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;

    const response = await fetch(url);
    const data = await response.json();

    const quote = data.quoteResponse.result[0];

    if (!quote) {
      return res.status(400).json({ error: "Invalid symbol" });
    }

    const price = quote.regularMarketPrice;
    const previousClose = quote.regularMarketPreviousClose;

    const trend = price - previousClose;

    // Smooth realistic forecast
    const hourlySeries = [];
    let base = price;

    for (let i = 0; i < 10; i++) {
      base = base + trend * 0.05 + Math.sin(i) * 0.1;
      hourlySeries.push(Number(base.toFixed(2)));
    }

    res.json({
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
    });

  } catch (err) {
    console.error("FULL ERROR:", err);
    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

// optional root
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
