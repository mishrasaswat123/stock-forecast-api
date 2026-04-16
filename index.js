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
// 💾 SAVE DATA
// =========================
function saveDataPoint(ltp, volume) {
  const now = new Date();

  if (lastSavedTime && now - lastSavedTime < 60 * 60 * 1000) return;

  const indiaTime = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" })
  );

  const data = {
    timestamp: now.toISOString(),
    hour: indiaTime.getHours(),
    day: indiaTime.getDay(),
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

    // =========================
    // DAILY DATA
    // =========================
    const timestamps = result.timestamp;

    const historicalDaily = timestamps.map((t, i) => ({
      date: new Date(t * 1000).toISOString().split("T")[0],
      open: quotes.open[i],
      high: quotes.high[i],
      low: quotes.low[i],
      close: quotes.close[i],
      volume: quotes.volume[i]
    })).filter(x => x.close);

    const syntheticHourly = generateSyntheticHourly(historicalDaily);

    // =========================
    // RSI
    // =========================
    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      let diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rs = gains / (losses || 1);
    const rsi = 100 - 100 / (1 + rs);

    // =========================
    // MACD
    // =========================
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

    const macdTrend =
      macd.at(-1) > signal.at(-1) ? "BULLISH" : "BEARISH";

    // =========================
    // SUPPORT / RESISTANCE
    // =========================
    const recent = closes.slice(-20);
    const support = Math.min(...recent);
    const resistance = Math.max(...recent);

    // =========================
    // VOLUME SIGNAL
    // =========================
    const recentVol =
      volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
    const avgVol =
      volumes.reduce((a, b) => a + b, 0) / volumes.length;

    let volumeSignal = "NORMAL";
    if (recentVol > avgVol * 1.2) volumeSignal = "ACCUMULATION";
    if (recentVol < avgVol * 0.8) volumeSignal = "DISTRIBUTION";

    // =========================
    // MOMENTUM
    // =========================
    let momentum = changePct;

    if (rsi > 70) momentum -= 0.01;
    if (rsi < 30) momentum += 0.01;
    if (macdTrend === "BULLISH") momentum += 0.005;
    else momentum -= 0.005;
    if (volumeSignal === "ACCUMULATION") momentum += 0.005;
    if (volumeSignal === "DISTRIBUTION") momentum -= 0.005;

    let regime = "SIDEWAYS";
    if (momentum > 0.01) regime = "BULLISH";
    else if (momentum < -0.01) regime = "BEARISH";

    const volatility = Math.max(0.008, Math.abs(momentum) * 1.5);
    const confidence = Math.min(
      90,
      Math.max(55, Math.round(Math.abs(momentum) * 200))
    );

    // =========================
    // FORECASTS
    // =========================
    let hourly = [], base = ltp;

    for (let i = 1; i <= 6; i++) {
      const noise = marketOpen ? (Math.random() - 0.5) * volatility : 0;
      base = base * (1 + momentum + noise);

      hourly.push({
        hour: `${10 + i}:00`,
        price: Math.round(base),
        min: Math.round(base * (1 - volatility / 2)),
        max: Math.round(base * (1 + volatility / 2)),
        confidence: confidence - (6 - i) * 2
      });
    }

    let forecast3d = [], temp = ltp;

    for (let d = 1; d <= 3; d++) {
      const noise = marketOpen ? (Math.random() - 0.5) * volatility : 0;
      temp = temp * (1 + momentum + noise);

      forecast3d.push({
        day: d,
        low: Math.round(temp * (1 - volatility)),
        high: Math.round(temp * (1 + volatility)),
        direction: regime,
        confidence: confidence + d * 3
      });
    }

    let weekly = [], baseW = ltp;

    for (let i = 1; i <= 5; i++) {
      const noise = marketOpen
        ? (Math.random() - 0.5) * volatility * 1.5
        : 0;

      baseW = baseW * (1 + momentum + noise);

      weekly.push({
        day: `D${i}`,
        low: Math.round(baseW * (1 - volatility * 1.2)),
        high: Math.round(baseW * (1 + volatility * 1.2))
      });
    }

    const finalResult = {
      ltp: Math.round(ltp),
      regime,
      confidence,
      hourly,
      forecast3d,
      weekly,
      support: Math.round(support),
      resistance: Math.round(resistance),
      volumeSignal,
      marketStatus: marketOpen ? "OPEN" : "CLOSED",
      lastUpdated: new Date().toLocaleString("en-IN")
    };

    lastResult = finalResult;

    res.json(finalResult);
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// =========================
// DEBUG ENDPOINT
// =========================
app.get("/api/synthetic", async (req, res) => {
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

    const syntheticHourly = generateSyntheticHourly(historicalDaily);

    res.json(syntheticHourly.slice(-50));
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});