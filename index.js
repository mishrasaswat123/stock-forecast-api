import express from "express";
import cors from "cors";
import yahooFinance from "yahoo-finance2";

const app = express();
app.use(cors());

app.get("/api/predict", async (req, res) => {
  try {
    const symbol = req.query.symbol || "RELIANCE.NS";

    // ✅ Correct universal call
    const quote = await yahooFinance.quote(symbol);

    const price = quote.regularMarketPrice;
    const previousClose = quote.regularMarketPreviousClose;

    if (!price || !previousClose) {
      return res.status(400).json({ error: "Invalid market data" });
    }

    const trend = price - previousClose;

    const hourlySeries = [];
    let base = price;

    for (let i = 0; i < 10; i++) {
      base = base + trend * 0.05 + Math.sin(i) * 0.2;
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
    console.error("FULL ERROR:", err); // 🔥 important for debugging
    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server running on port", PORT));
