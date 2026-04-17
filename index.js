import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

// 👉 Simple Yahoo Finance fetch (no library, no breakage)
async function getStockPrice(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;

  const res = await fetch(url);
  const data = await res.json();

  const result = data?.quoteResponse?.result?.[0];

  if (!result) throw new Error("Invalid Yahoo response");

  return {
    price: result.regularMarketPrice,
    previousClose: result.regularMarketPreviousClose
  };
}

// 👉 Prediction engine (stable + smooth)
function generatePredictions(price) {
  const hourlySeries = [];

  let current = price;

  for (let i = 0; i < 10; i++) {
    const change = (Math.random() - 0.5) * 0.005 * price; // very small moves
    current += change;
    hourlySeries.push(Number(current.toFixed(2)));
  }

  return {
    hourly: hourlySeries[1],
    hourlySeries,
    day1: Number((price * 1.005).toFixed(2)),
    day2: Number((price * 1.01).toFixed(2)),
    day3: Number((price * 1.015).toFixed(2)),
    weekly: Number((price * 1.03).toFixed(2))
  };
}

app.get("/api/predict", async (req, res) => {
  try {
    let symbol = req.query.symbol || "RELIANCE.NS";

    // 👉 Ensure proper Yahoo format
    if (!symbol.includes(".")) {
      symbol = symbol + ".NS";
    }

    const stock = await getStockPrice(symbol);

    const predictions = generatePredictions(stock.price);

    res.json({
      symbol,
      price: stock.price,
      previousClose: stock.previousClose,
      predictions,
      support: Number((stock.price * 0.98).toFixed(2)),
      resistance: Number((stock.price * 1.02).toFixed(2)),
      signal: "HOLD",
      bias: "SIDEWAYS",
      risk: "MEDIUM"
    });

  } catch (err) {
    console.error("ERROR:", err.message);

    res.json({
      error: "Server error",
      details: err.message
    });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
