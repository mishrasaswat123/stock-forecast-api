import express from "express";
import cors from "cors";
import axios from "axios";
import crypto from "crypto";

const app = express();
app.use(cors());

// 🔐 ====== PASTE YOUR KEYS HERE ======
const API_KEY = "~1)q=1C6152a1@09m169TS93X4890spL";
const SECRET_KEY = "37L51z(y3383u4C45D6y909&1L1Rm725";
const SESSION_TOKEN = "55328733";
// ====================================


// 🔁 Generate checksum (ICICI requirement)
function generateChecksum(timestamp) {
  const data = timestamp + API_KEY;
  return crypto
    .createHmac("sha256", SECRET_KEY)
    .update(data)
    .digest("hex");
}


// 📊 MAIN API
app.get("/api/predict", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "RELIANCE").replace(".NS", "");

    const timestamp = new Date().toISOString();
    const checksum = generateChecksum(timestamp);

    const response = await axios.get(
      "https://api.icicidirect.com/breezeapi/api/v1/quotes",
      {
        headers: {
          "X-Checksum": checksum,
          "X-Timestamp": timestamp,
          "X-AppKey": API_KEY,
          "X-SessionToken": SESSION_TOKEN,
        },
        params: {
          stock_code: symbol,
          exchange_code: "NSE",
          product_type: "cash",
        },
      }
    );

    const data = response.data?.Success?.[0];

    if (!data) {
      return res.json({ error: "Invalid API response" });
    }

    const price = parseFloat(data.ltp);
    const prevClose = parseFloat(data.close);

    // 📈 STABLE FORECAST (no wild swings)
    const hourlySeries = Array.from({ length: 10 }, (_, i) =>
      +(price * (1 + 0.001 * i)).toFixed(2)
    );

    res.json({
      symbol,
      price,
      previousClose: prevClose,
      predictions: {
        hourly: hourlySeries[1],
        hourlySeries,
        day1: +(price * 1.005).toFixed(2),
        day2: +(price * 1.01).toFixed(2),
        day3: +(price * 1.015).toFixed(2),
        weekly: +(price * 1.02).toFixed(2),
      },
      support: +(price * 0.98).toFixed(2),
      resistance: +(price * 1.02).toFixed(2),
      signal: "HOLD",
      bias: "SIDEWAYS",
      risk: "MEDIUM",
    });

  } catch (err) {
    console.log("FULL ERROR:", err.response?.data || err.message);

    res.json({
      error: "Server error",
      details: err.response?.data || err.message,
    });
  }
});


// ✅ Health check
app.get("/", (req, res) => {
  res.send("Breeze API running");
});


const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
