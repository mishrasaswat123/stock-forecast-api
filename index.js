import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());

// 🔐 YOUR CREDENTIALS
const API_KEY = "~1)q=1C6152a1@09m169TS93X4890spL";
const SESSION_TOKEN = "55329070";

// 👉 SIMPLE Breeze call (no checksum required)
async function fetchBreeze(symbol) {
  const url = "https://api.icicidirect.com/breezeapi/api/v1/quotes";

  const res = await axios.get(url, {
    headers: {
      "X-AppKey": API_KEY,
      "X-SessionToken": SESSION_TOKEN
    },
    params: {
      stock_code: symbol,
      exchange_code: "NSE",
      product_type: "cash"
    }
  });

  return res.data?.Success?.[0];
}

// 👉 Prediction (stable)
function generatePredictions(price) {
  const hourlySeries = [];
  let current = price;

  for (let i = 0; i < 10; i++) {
    current += price * 0.001;
    hourlySeries.push(Number(current.toFixed(2)));
  }

  return {
    hourly: hourlySeries[1],
    hourlySeries,
    day1: Number((price * 1.005).toFixed(2)),
    day2: Number((price * 1.01).toFixed(2)),
    day3: Number((price * 1.015).toFixed(2)),
    weekly: Number((price * 1.02).toFixed(2))
  };
}

// 👉 API
app.get("/api/predict", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "RELIANCE").replace(".NS", "");

    const data = await fetchBreeze(symbol);

    if (!data) {
      throw new Error("No Breeze data");
    }

    const price = parseFloat(data.ltp);
    const prev = parseFloat(data.close);

    const predictions = generatePredictions(price);

    res.json({
      symbol,
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
    console.log("ERROR:", err.response?.data || err.message);

    res.json({
      error: "Server error",
      details: err.response?.data || err.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("Breeze API running");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));
