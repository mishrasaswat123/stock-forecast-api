import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

const API_KEY = "TMHAGIE1AVVRN73H";

let cache = {};
const CACHE_DURATION = 60000; // 1 minute

app.get("/api/predict", async (req, res) => {
  try {
    const symbolMap = {
      "RELIANCE.NS": "RELIANCE.BSE",
      "TCS.NS": "TCS.BSE",
      "INFY.NS": "INFY.BSE",
      "ANANDRATHI.NS": "ANANDRATHI.BSE"
    };

    const inputSymbol = req.query.symbol || "RELIANCE.NS";
    const symbol = symbolMap[inputSymbol] || "RELIANCE.BSE";

    const now = Date.now();

    // ✅ Return cache if exists (always safe)
    if (cache[inputSymbol] && (now - cache[inputSymbol].time < CACHE_DURATION)) {
      return res.json({
        ...cache[inputSymbol].data,
        cached: true
      });
    }

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;

    const response = await fetch(url);
    const data = await response.json();

    const quote = data["Global Quote"];

    // ✅ HANDLE API FAILURE WITHOUT CRASH
    if (!quote || !quote["05. price"]) {
      console.log("Alpha Vantage limit hit / bad response");

      if (cache[inputSymbol]) {
        return res.json({
          ...cache[inputSymbol].data,
          warning: "Using cached data (API limit hit)"
        });
      }

      // fallback dummy (only first time)
      return res.json({
        symbol: inputSymbol,
        price: 3000,
        previousClose: 2950,
        warning: "Fallback data (API limit)"
      });
    }

    const price = parseFloat(quote["05. price"]);
    const previousClose = parseFloat(quote["08. previous close"]);

    const trend = price - previousClose;

    const hourlySeries = [];
    let base = price;

    for (let i = 0; i < 10; i++) {
      base = base + trend * 0.05;
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

    // ✅ Save cache
    cache[inputSymbol] = {
      data: result,
      time: now
    };

    res.json(result);

  } catch (err) {
    console.error("ERROR:", err.message);

    // ✅ ALWAYS fallback
    if (cache[req.query.symbol]) {
      return res.json({
        ...cache[req.query.symbol].data,
        warning: "Recovered from error"
      });
    }

    res.json({
      symbol: "ERROR",
      price: 0,
      warning: "Temporary failure"
    });
  }
});

app.get("/", (req, res) => {
  res.send("API running 🚀");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
