import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

app.get("/", (req, res) => {
  res.send("Stock Forecast API Running 🚀");
});

app.get("/api/predict", async (req, res) => {
  try {
    const symbol = req.query.symbol || "TCS.NS";

    // Simulated current price (replace later with real API)
    const price = Math.random() * 1000 + 2500;

    // Generate hourly forecast curve (next 7 points)
    const hourlySeries = [];
    let base = price;

    for (let i = 0; i < 7; i++) {
      base = base + (Math.random() - 0.5) * 10;
      hourlySeries.push(Number(base.toFixed(2)));
    }

    // 3-day breakdown
    const day1 = price + Math.random() * 20;
    const day2 = day1 + Math.random() * 20;
    const day3 = day2 + Math.random() * 20;

    res.json({
      symbol,
      price: Number(price.toFixed(2)),
      marketStatus: "LIVE",
      timestamp: new Date(),

      predictions: {
        hourly: Number(hourlySeries[0].toFixed(2)),
        hourlySeries,
        day1: Number(day1.toFixed(2)),
        day2: Number(day2.toFixed(2)),
        day3: Number(day3.toFixed(2)),
        weekly: Number((day3 + Math.random() * 50).toFixed(2))
      },

      support: Number((price - 30).toFixed(2)),
      resistance: Number((price + 30).toFixed(2)),
      confidence: Math.floor(Math.random() * 40) + 60,

      signal: "HOLD",
      bias: "SIDEWAYS",
      risk: "MEDIUM"
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Internal Server Error"
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
