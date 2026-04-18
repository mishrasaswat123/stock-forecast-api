import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = 10000;

// 🧠 MOCK ENGINE (temporary)
function fetchMock(symbol) {
  const basePrices = {
    RELIANCE: 2450,
    TCS: 3800,
    INFY: 1500
  };

  const base = basePrices[symbol] || 1000;

  const random = () => (Math.random() * 20 - 10).toFixed(2);

  const price = base + parseFloat(random());

  return {
    price: price.toFixed(2),
    signal: price > base ? "BUY" : "SELL",
    bias: price > base ? "Bullish" : "Bearish",
    risk: "Medium",
    support: (price - 20).toFixed(2),
    resistance: (price + 20).toFixed(2),
    predictions: {
      hourly: (price + 5).toFixed(2),
      day1: (price + 15).toFixed(2),
      day2: (price + 25).toFixed(2),
      day3: (price + 35).toFixed(2),
      weekly: (price + 60).toFixed(2),
      hourlySeries: Array.from({ length: 10 }, () =>
        (price + (Math.random() * 10 - 5)).toFixed(2)
      )
    }
  };
}

// 🚀 API ROUTE
app.get("/api/predict", (req, res) => {
  const symbol = req.query.symbol || "RELIANCE";

  try {
    const data = fetchMock(symbol);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});