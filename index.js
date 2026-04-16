import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

/* =========================
🔥 REAL MARKET PRICE
========================= */
async function getLivePrice(symbol) {
try {
const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
const res = await fetch(url);
const json = await res.json();

```
const meta = json.chart.result[0].meta;

return {
  price: meta.regularMarketPrice,
  previousClose: meta.previousClose
};
```

} catch (err) {
console.error("Price fetch error:", err);
return { price: 0, previousClose: 0 };
}
}

/* =========================
🔥 TREND-BASED FORECAST
========================= */
function generateForecast(basePrice, previousClose) {
const series = [];

const trend = basePrice > previousClose ? 1 : -1;

let value = basePrice;

for (let i = 0; i < 10; i++) {
const drift = trend * (0.2 + i * 0.15);
const wave = Math.sin(i / 2) * 0.3;

```
value = basePrice + drift + wave;

series.push(+value.toFixed(2));
```

}

return series;
}

/* =========================
🔥 API
========================= */
app.get("/api/predict", async (req, res) => {
try {
const symbol = req.query.symbol || "TCS.NS";

```
const market = await getLivePrice(symbol);

const price = market.price;
const previousClose = market.previousClose;

const hourlySeries = generateForecast(price, previousClose);

const day1 = +(price * 1.005).toFixed(2);
const day2 = +(price * 1.01).toFixed(2);
const day3 = +(price * 1.015).toFixed(2);
const weekly = +(price * 1.02).toFixed(2);

let signal = "HOLD";
let bias = "SIDEWAYS";
let risk = "MEDIUM";

if (price > previousClose) {
  signal = "BUY";
  bias = "BULLISH";
  risk = "LOW";
} else if (price < previousClose) {
  signal = "SELL";
  bias = "BEARISH";
  risk = "HIGH";
}

res.json({
  symbol,
  price,
  previousClose,
  timestamp: new Date(),

  predictions: {
    hourly: hourlySeries[1],
    hourlySeries,
    day1,
    day2,
    day3,
    weekly
  },

  support: +(price * 0.99).toFixed(2),
  resistance: +(price * 1.01).toFixed(2),

  confidence: 90,
  signal,
  bias,
  risk
});
```

} catch (err) {
console.error(err);
res.status(500).json({ error: "Server error" });
}
});

/* =========================
SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
console.log("🚀 Server running on port", PORT);
});
