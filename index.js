import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

/**
 * MARKET STATUS LOGIC (IST)
 */
function getMarketStatus() {
  const now = new Date();

  const istOffset = 5.5 * 60 * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffset);

  const hours = istTime.getUTCHours();
  const minutes = istTime.getUTCMinutes();

  const totalMinutes = hours * 60 + minutes;

  const marketOpen = 9 * 60 + 15;   // 9:15 AM
  const marketClose = 15 * 60 + 30; // 3:30 PM
  const postMarket = 16 * 60 + 30;  // 4:30 PM

  if (totalMinutes >= marketOpen && totalMinutes <= marketClose) {
    return "LIVE";
  } else if (totalMinutes > marketClose && totalMinutes < postMarket) {
    return "POST";
  } else {
    return "FORECAST";
  }
}

/**
 * GENERATE FORECAST CURVE
 */
function generateForecastSeries(price) {
  const series = [];
  let base = price;

  for (let i = 0; i < 10; i++) {
    base += (Math.random() - 0.4) * 8; // slight upward bias
    series.push(Number(base.toFixed(2)));
  }

  return series;
}

/**
 * ROOT
 */
app.get("/", (req, res) => {
  res.send("Stock Forecast API Running 🚀");
});

/**
 * MAIN API
 */
app.get("/api/predict", async (req, res) => {
  try {
    const symbol = req.query.symbol || "TCS.NS";

    // Simulated price (replace later with real market API)
    const price = Math.random() * 1000 + 2500;

    const marketStatus = getMarketStatus();

    const hourlySeries = generateForecastSeries(price);

    // 3-day structured forecast
    const day1 = price + Math.random() * 20;
    const day2 = day1 + Math.random() * 15;
    const day3 = day2 + Math.random() * 15;

    res.json({
      symbol,
      price: Number(price.toFixed(2)),
      marketStatus,
      timestamp: new Date(),

      predictions: {
        hourly: Number(hourlySeries[0].toFixed(2)),
        hourlySeries,

        day1: Number(day1.toFixed(2)),
        day2: Number(day2.toFixed(2)),
        day3: Number(day3.toFixed(2)),

        weekly: Number((day3 + Math.random() * 40).toFixed(2))
      },

      support: Number((price - 30).toFixed(2)),
      resistance: Number((price + 30).toFixed(2)),
      confidence: Math.floor(Math.random() * 30) + 70,

      signal: "HOLD",
      bias: "SIDEWAYS",
      risk: "MEDIUM"
    });

  } catch (err) {
    console.error("ERROR:", err);
    res.status(500).json({
      error: "Internal Server Error"
    });
  }
});

/**
 * START SERVER
 */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
