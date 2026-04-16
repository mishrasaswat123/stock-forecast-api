import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import fs from "fs";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

let lastResult = null;
let lastSavedTime = null;

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
// 💾 SAVE REAL DATA
// =========================
function saveDataPoint(ltp, volume) {
  const now = new Date();

  if (lastSavedTime && now - lastSavedTime < 60 * 60 * 1000) return;

  const indiaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const data = {
    date: indiaTime.toISOString().split("T")[0],
    hour: indiaTime.getHours(),
    price: ltp,
    volume: volume,
    synthetic: false
  };

  let history = [];
  try {
    history = JSON.parse(fs.readFileSync("data.json"));
  } catch {}

  history.push(data);
  fs.writeFileSync("data.json", JSON.stringify(history, null, 2));

  lastSavedTime = now;
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
// 🔗 MERGE DATASET
// =========================
function mergeDatasets(synthetic, real) {
  const combined = [...synthetic, ...real];

  // Remove duplicates
  const unique = {};
  combined.forEach(d => {
    const key = `${d.date}-${d.hour}`;
    unique[key] = d;
  });

  const result = Object.values(unique);

  // Sort
  result.sort((a, b) => {
    if (a.date === b.date) return a.hour - b.hour;
    return new Date(a.date) - new Date(b.date);
  });

  return result;
}

// =========================
// 🚀 MAIN API
// =========================
app.get("/api/price", async (req, res) => {
  try {
    const marketOpen = isMarketOpen();

    if (!marketOpen && lastResult) {
      return res.json(lastResult);
    }

    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/ANANDRATHI.NS?range=max&interval=1d";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json"
      }
    });

    const json = await response.json();
    const result = json.chart.result[0];
    const quotes = result.indicators.quote[0];

    const closes = quotes.close.filter(x => x);
    const volumes = quotes.volume.filter(x => x);

    const ltp = closes.at(-1);
    const prev = closes.at(-2);
    const changePct = (ltp - prev) / prev;

    if (marketOpen) {
      saveDataPoint(ltp, volumes.at(-1));
    }

    // Indicators
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      let diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rsi = 100 - 100 / (1 + gains / (losses || 1));

    function ema(data, p) {
      let k = 2 / (p + 1);
      let arr = [data[0]];
      for (let i = 1; i < data.length; i++) {
        arr.push(data[i] * k + arr[i - 1] * (1 - k));
      }
      return arr;
    }

    const macd = ema(closes, 12).map((v, i) => v - ema(closes, 26)[i]);
    const signal = ema(macd, 9);
    const macdTrend = macd.at(-1) > signal.at(-1) ? "BULLISH" : "BEARISH";

    const support = Math.min(...closes.slice(-20));
    const resistance = Math.max(...closes.slice(-20));

    let momentum = changePct;
    if (rsi > 70) momentum -= 0.01;
    if (rsi < 30) momentum += 0.01;
    if (macdTrend === "BULLISH") momentum += 0.005;
    else momentum -= 0.005;

    const regime =
      momentum > 0.01 ? "BULLISH" :
      momentum < -0.01 ? "BEARISH" : "SIDEWAYS";

    const volatility = Math.max(0.008, Math.abs(momentum) * 1.5);
    const confidence = Math.min(90, Math.max(55, Math.round(Math.abs(momentum) * 200)));

    // Forecast
    let hourly = [], base = ltp;
    for (let i = 1; i <= 6; i++) {
      base *= 1 + momentum;
      hourly.push({
        hour: `${10 + i}:00`,
        price: Math.round(base),
        min: Math.round(base * (1 - volatility / 2)),
        max: Math.round(base * (1 + volatility / 2)),
        confidence
      });
    }

    const finalResult = {
      ltp: Math.round(ltp),
      regime,
      confidence,
      hourly,
      support: Math.round(support),
      resistance: Math.round(resistance),
      marketStatus: marketOpen ? "OPEN" : "CLOSED"
    };

    lastResult = finalResult;
    res.json(finalResult);

  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// =========================
// 📊 REAL DATA API
// =========================
app.get("/api/realdata", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync("data.json"));
    res.json(data.slice(-50));
  } catch {
    res.json([]);
  }
});

// =========================
// 📊 DATASET API
// =========================
app.get("/api/dataset", async (req, res) => {
  try {
    const url =
      "https://query1.finance.yahoo.com/v8/finance/chart/ANANDRATHI.NS?range=max&interval=1d";

    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Accept: "application/json"
      }
    });

    const json = await response.json();
    const result = json.chart.result[0];
    const quotes = result.indicators.quote[0];

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
      real = JSON.parse(fs.readFileSync("data.json"));
    } catch {}

    const dataset = mergeDatasets(synthetic, real);

    res.json(dataset.slice(-200));
  } catch (err) {
    res.json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
