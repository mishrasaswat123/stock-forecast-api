import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// =========================
// 🕒 MARKET HOURS
// =========================
function isMarketOpen() {
  const now = new Date();
  const indiaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const h = indiaTime.getHours();
  const m = indiaTime.getMinutes();

  return (
    (h > 9 || (h === 9 && m >= 15)) &&
    (h < 15 || (h === 15 && m <= 30))
  );
}

// =========================
// 💾 SAVE REAL DATA (PER STOCK)
// =========================
function saveDataPoint(symbol, ltp, volume) {
  const fileName = `data-${symbol}.json`;

  const now = new Date();
  const indiaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const data = {
    date: indiaTime.toISOString().split("T")[0],
    hour: indiaTime.getHours(),
    price: ltp,
    volume,
    synthetic: false
  };

  let history = [];
  try {
    history = JSON.parse(fs.readFileSync(fileName));
  } catch {}

  history.push(data);
  fs.writeFileSync(fileName, JSON.stringify(history, null, 2));
}

// =========================
// 🧠 SYNTHETIC ENGINE
// =========================
function generateSyntheticHourly(data) {
  const synthetic = [];

  data.forEach((d) => {
    const range = d.high - d.low;
    const step = range / 6;

    let prices = [
      d.open,
      d.open + step * 0.8,
      d.open + step * 0.5,
      d.open + step * 0.3,
      d.open + step * 1.2,
      d.close
    ];

    prices = prices.map(p =>
      Math.min(d.high, Math.max(d.low, p))
    );

    prices.forEach((p, i) => {
      synthetic.push({
        date: d.date,
        hour: 10 + i,
        price: Math.round(p),
        volume: Math.round(d.volume / 6),
        synthetic: true
      });
    });
  });

  return synthetic;
}

// =========================
// 🔗 MERGE DATA
// =========================
function mergeDatasets(synthetic, real) {
  const combined = [...synthetic, ...real];

  const unique = {};
  combined.forEach(d => {
    const key = `${d.date}-${d.hour}`;
    unique[key] = d;
  });

  const result = Object.values(unique);

  result.sort((a, b) => {
    if (a.date === b.date) return a.hour - b.hour;
    return new Date(a.date) - new Date(b.date);
  });

  return result;
}

// =========================
// 📊 FETCH DATA
// =========================
async function fetchStockData(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=max&interval=1d`;

  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "application/json"
    }
  });

  const json = await response.json();
  const result = json.chart.result[0];
  const quotes = result.indicators.quote[0];

  return { result, quotes };
}

// =========================
// 🚀 PRICE API
// =========================
app.get("/api/price", async (req, res) => {
  try {
    const symbol = req.query.symbol || "ANANDRATHI.NS";

    const { result, quotes } = await fetchStockData(symbol);

    const closes = quotes.close.filter(x => x);
    const volumes = quotes.volume.filter(x => x);

    const ltp = closes.at(-1);
    const prev = closes.at(-2);
    const changePct = (ltp - prev) / prev;

    if (isMarketOpen()) {
      saveDataPoint(symbol, ltp, volumes.at(-1));
    }

    const support = Math.min(...closes.slice(-20));
    const resistance = Math.max(...closes.slice(-20));

    const momentum = changePct;

    const regime =
      momentum > 0.01 ? "BULLISH" :
      momentum < -0.01 ? "BEARISH" : "SIDEWAYS";

    const volatility = Math.max(0.008, Math.abs(momentum) * 1.5);

    let hourly = [], base = ltp;

    for (let i = 1; i <= 6; i++) {
      base *= 1 + momentum;
      hourly.push({
        hour: `${10 + i}:00`,
        price: Math.round(base),
        min: Math.round(base * (1 - volatility / 2)),
        max: Math.round(base * (1 + volatility / 2))
      });
    }

    res.json({
      symbol,
      ltp: Math.round(ltp),
      regime,
      hourly,
      support: Math.round(support),
      resistance: Math.round(resistance),
      marketStatus: isMarketOpen() ? "OPEN" : "CLOSED"
    });

  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// =========================
// 📊 DATASET API
// =========================
app.get("/api/dataset", async (req, res) => {
  try {
    const symbol = req.query.symbol || "ANANDRATHI.NS";

    const { result, quotes } = await fetchStockData(symbol);

    const timestamps = result.timestamp;

    const historicalDaily = timestamps.map((t, i) => ({
      date: new Date(t * 1000).toISOString().split("T")[0],
      open: quotes.open[i],
      high: quotes.high[i],
      low: quotes.low[i],
      close: quotes.close[i],
      volume: quotes.volume[i]
    })).filter(x => x.close);

    const synthetic = generateSyntheticHourly(historicalDaily);

    let real = [];
    try {
      real = JSON.parse(fs.readFileSync(`data-${symbol}.json`));
    } catch {}

    const dataset = mergeDatasets(synthetic, real);

    res.json(dataset.slice(-200));

  } catch (err) {
    res.json({ ok: false });
  }
});

// =========================
// 📊 REAL DATA API
// =========================
app.get("/api/realdata", (req, res) => {
  try {
    const symbol = req.query.symbol || "ANANDRATHI.NS";
    const data = JSON.parse(fs.readFileSync(`data-${symbol}.json`));
    res.json(data.slice(-50));
  } catch {
    res.json([]);
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
