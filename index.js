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
// 💾 SAVE DATA
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
// 📈 TREND FUNCTION
// =========================
function getTrend(closes, period) {
  const slice = closes.slice(-period);
  const avg1 =
    slice.slice(-5).reduce((a, b) => a + b, 0) / 5;

  const avg2 =
    slice.reduce((a, b) => a + b, 0) / slice.length;

  if (avg1 > avg2 * 1.01) return "BULLISH";
  if (avg1 < avg2 * 0.99) return "BEARISH";
  return "SIDEWAYS";
}

// =========================
// 📉 RSI
// =========================
function calculateRSI(closes) {
  let gains = 0, losses = 0;

  for (let i = closes.length - 14; i < closes.length; i++) {
    let diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }

  const rs = gains / (losses || 1);
  return 100 - 100 / (1 + rs);
}

// =========================
// 📊 VOLATILITY
// =========================
function calculateVolatility(closes) {
  let sum = 0;

  for (let i = closes.length - 10; i < closes.length; i++) {
    sum += Math.abs(closes[i] - closes[i - 1]) / closes[i - 1];
  }

  return sum / 10;
}

// =========================
// 📉 PATTERN
// =========================
function detectPattern(closes) {
  const last = closes.slice(-10);
  const max = Math.max(...last);
  const min = Math.min(...last);

  if (last.filter(p => p > max * 0.98).length >= 2)
    return "DOUBLE_TOP";

  if (last.filter(p => p < min * 1.02).length >= 2)
    return "DOUBLE_BOTTOM";

  if (last.at(-1) > max * 1.01)
    return "BREAKOUT";

  return "NONE";
}

// =========================
// 🧠 CONFLUENCE ENGINE
// =========================
function confluenceEngine(short, medium, long) {
  let score = 0;

  if (short === "BULLISH") score++;
  if (medium === "BULLISH") score++;
  if (long === "BULLISH") score++;

  if (short === "BEARISH") score--;
  if (medium === "BEARISH") score--;
  if (long === "BEARISH") score--;

  let confluence = "LOW";
  if (Math.abs(score) === 3) confluence = "HIGH";
  else if (Math.abs(score) === 2) confluence = "MEDIUM";

  return { score, confluence };
}

// =========================
// 🧠 FINAL SIGNAL
// =========================
function generateSignal(data) {
  let score = 50;
  let reasons = [];

  const { trendShort, trendMedium, trendLong, pattern, rsi, volatility, conf } = data;

  // Confluence
  if (conf.score >= 2) {
    score += 15;
    reasons.push("Bullish alignment");
  }
  if (conf.score <= -2) {
    score -= 15;
    reasons.push("Bearish alignment");
  }

  // Pattern
  if (pattern === "DOUBLE_BOTTOM") {
    score += 15;
    reasons.push("Double bottom");
  }
  if (pattern === "DOUBLE_TOP") {
    score -= 15;
    reasons.push("Double top");
  }

  // RSI
  if (rsi < 35) {
    score += 10;
    reasons.push("Oversold");
  }
  if (rsi > 70) {
    score -= 10;
    reasons.push("Overbought");
  }

  // Volatility
  let risk = "LOW";
  if (volatility > 0.02) {
    score -= 5;
    risk = "HIGH";
    reasons.push("High volatility");
  } else if (volatility > 0.01) {
    risk = "MEDIUM";
  }

  let signal = "HOLD";
  if (score > 65) signal = "BUY";
  if (score < 35) signal = "SELL";

  let strength =
    score > 75 ? "STRONG" :
    score > 60 ? "MODERATE" :
    "WEAK";

  return { signal, confidence: score, strength, risk, reasons };
}

// =========================
// 🔥 SIGNAL API
// =========================
app.get("/api/signal", async (req, res) => {
  try {
    const symbol = req.query.symbol || "ANANDRATHI.NS";

    const { quotes } = await fetchStockData(symbol);
    const closes = quotes.close.filter(x => x);
    const volumes = quotes.volume.filter(x => x);

    if (isMarketOpen()) {
      saveDataPoint(symbol, closes.at(-1), volumes.at(-1));
    }

    const trendShort = getTrend(closes, 10);
    const trendMedium = getTrend(closes, 25);
    const trendLong = getTrend(closes, 60);

    const conf = confluenceEngine(trendShort, trendMedium, trendLong);
    const pattern = detectPattern(closes);
    const rsi = calculateRSI(closes);
    const volatility = calculateVolatility(closes);

    const result = generateSignal({
      trendShort,
      trendMedium,
      trendLong,
      pattern,
      rsi,
      volatility,
      conf
    });

    res.json({
      symbol,
      timeframes: {
        short: trendShort,
        medium: trendMedium,
        long: trendLong
      },
      confluence: conf.confluence,
      alignmentScore: conf.score,
      rsi: Math.round(rsi),
      volatility,
      pattern,
      ...result
    });

  } catch (err) {
    res.json({ ok: false });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
