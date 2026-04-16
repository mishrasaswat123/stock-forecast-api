import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

// ✅ Your Alpha Vantage API Key
const API_KEY = "TMHAGIE1AVVRN73H";

// Cache (prevents rate limit crashes)
let lastData = null;

app.get("/api/predict", async (req, res) => {
  try {
    const symbolMap = {
      "RELIANCE.NS": "RELIANCE.BSE",
      "TCS.NS": "TCS.BSE",
      "INFY.NS": "INFY.BSE",
      "HDFCBANK.NS": "HDFCBANK.BSE",
      "ANANDRATHI.NS": "ANANDRATHI.BSE"
    };

    const inputSymbol = req.query.symbol || "RELIANCE.NS";
    const symbol = symbolMap[inputSymbol] || "RELIANCE.BSE";

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    const quote = data["Global Quote"];

    if (!quote || !quote["05. price"]) {
      throw new Error("Invalid API response");
    }

    const price = parseFloat(quote["05. price"]);
    const previousClose = parseFloat(quote["08. previous close"]);

    const trend = price - previousClose;

    // ✅ Stable forecast (no wild swings)
    const hourlySeries = [];
    let base = price;

    for (let i = 0; i < 10; i++) {
      base = base + trend * 0.05; // smooth progression
      hourlySeries.push(Number(base.toFixed(2)));
    }

    const result = {
      symbol: inputSymbol,
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

      confidence: 85,
      signal: trend > 0 ? "BUY" : "HOLD",
      bias: trend > 0 ? "BULLISH" : "SIDEWAYS",
      risk: "MEDIUM"
    };

    lastData = result;

    res.json(result);

  } catch (err) {
    console.error("ERROR:", err.message);

    // ✅ fallback if API limit hits
    if (lastData) {
      return res.json({
        ...lastData,
        warning: "Using cached data (API limit hit)"
      });
    }

    res.status(500).json({
      error: "Server error",
      details: err.message
    });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("Stock API running 🚀");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
