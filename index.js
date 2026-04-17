import express from "express";
import cors from "cors";
import axios from "axios";
import crypto from "crypto";

const app = express();
app.use(cors());

// 🔐 YOUR CREDENTIALS
const API_KEY = "~1)q=1C6152a1@09m169TS93X4890spL";
const SECRET_KEY = "37L51z(y3383u4C45D6y909&1L1Rm725";
const SESSION_TOKEN = "55329070";

// ✅ Generate timestamp (exact format required)
function getTimestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

// ✅ Generate checksum
function generateChecksum(timestamp) {
  const data = timestamp + API_KEY;
  return crypto
    .createHmac("sha256", SECRET_KEY)
    .update(data)
    .digest("hex");
}

// 👉 Fetch Breeze
async function fetchBreeze(symbol) {
  const timestamp = getTimestamp();
  const checksum = generateChecksum(timestamp);

  const res = await axios.get(
    "https://api.icicidirect.com/breezeapi/api/v1/quotes",
    {
      headers: {
        "X-AppKey": API_KEY,
        "X-SessionToken": SESSION_TOKEN,
        "X-Timestamp": timestamp,
        "X-Checksum": checksum
      },
      params: {
        stock_code: symbol,
        exchange_code: "NSE",
        product_type: "cash"
      }
    }
  );

  return res.data?.Success?.[0];
}

// 👉 Prediction (clean + deterministic)
function generatePredictions(price, prev) {
  const trend = price - prev;

  const hourlySeries = [];
  let current = price;

  for (let i = 0; i < 10; i++) {
    current += trend * 0.08;
    hourlySeries.push(Number(current.toFixed(2)));
  }

  return {
    hourly: hourlySeries[1],
    hourlySeries,
    day1: Number((price + trend * 0.5).toFixed(2)),
    day2: Number((price + trend * 0.8).toFixed(2)),
    day3: Number((price + trend * 1.2).toFixed(2)),
    weekly: Number((price + trend * 2).toFixed(2))
  };
}

// 👉 API
app.get("/api/predict", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "RELIANCE").replace(".NS", "");

    const data = await fetchBreeze(symbol);

    if (!data) throw new Error("No Breeze data");

    const price = parseFloat(data.ltp);
    const prev = parseFloat(data.close);

    const predictions = generatePredictions(price, prev);

    res.json({
      symbol,
      price,
      previousClose: prev,
      predictions,
      support: Number((price * 0.98).toFixed(2)),
      resistance: Number((price * 1.02).toFixed(2)),
      signal: price > prev ? "BUY" : "HOLD",
      bias: price > prev ? "BULLISH" : "SIDEWAYS",
      risk: "MEDIUM"
    });

  } catch (err) {
    console.log("FULL ERROR:", err.response?.data || err.message);

    res.json({
      error: "Server error",
      details: err.response?.data || err.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("Breeze Production API running");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
