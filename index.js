import express from "express";
import cors from "cors";

const app = express();
app.use(cors());

// 👉 Fetch from Yahoo
async function fetchYahoo(symbol) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbol}`;

  const res = await fetch(url);
  const data = await res.json();

  return data?.quoteResponse?.result?.[0];
}

// 👉 Smart symbol resolver (NS → BO fallback)
async function getStock(symbolInput) {
  let symbol = symbolInput;

  if (!symbol.includes(".")) {
    // Try NSE first
    let data = await fetchYahoo(symbol + ".NS");
    if (data && data.regularMarketPrice) {
      return { ...data, symbol: symbol + ".NS" };
    }

    // fallback to BSE
    data = await fetchYahoo(symbol + ".BO");
    if (data && data.regularMarketPrice) {
      return { ...data, symbol: symbol + ".BO" };
    }

    throw new Error("Symbol not found");
  }

  const data = await fetchYahoo(symbol);
  if (!data || !data.regularMarketPrice) {
    throw new Error("Invalid Yahoo response");
  }

  return data;
}

// 👉 Smooth prediction (no wild jumps)
function generatePredictions(price) {
  const hourlySeries = [];
  let current = price;

  for (let i = 0; i < 10; i++) {
    const change = (Math.random() - 0.5) * 0.002 * price; // smoother
    current += change;
    hourlySeries.push(Number(current.toFixed(2)));
  }

  return {
    hourly: hourlySeries[1],
    hourlySeries,
    day1: Number((price * 1.003).toFixed(2)),
    day2: Number((price * 1.006).toFixed(2)),
    day3: Number((price * 1.01).toFixed(2)),
    weekly: Number((price * 1.02).toFixed(2))
  };
}

app.get("/api/predict", async (req, res) => {
  try {
    const input = req.query.symbol || "RELIANCE";

    const stock = await getStock(input);

    const price = stock.regularMarketPrice;
    const prev = stock.regularMarketPreviousClose;

    const predictions = generatePredictions(price);

    res.json({
      symbol: stock.symbol,
      price,
      previousClose: prev,
      predictions,
      support: Number((price * 0.98).toFixed(2)),
      resistance: Number((price * 1.02).toFixed(2)),
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
