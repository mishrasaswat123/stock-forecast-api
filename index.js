import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import admin from "firebase-admin";

// 🔥 Initialize Firebase
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(cors());

/* ===============================
   🔹 HELPER: GET LIVE PRICE
   =============================== */
async function getLivePrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await fetch(url);
    const data = await response.json();

    const result = data.chart.result[0];

    // ✅ Use LAST CANDLE CLOSE (more accurate than regularMarketPrice)
    const closePrices = result.indicators.quote[0].close;
    const price = closePrices[closePrices.length - 1];

    return price;
  } catch (err) {
    console.log("Error fetching price:", err);
    return null;
  }
}

/* ===============================
   🔹 STORE DATA IN FIREBASE
   =============================== */
async function storePrice(symbol, price) {
  try {
    await db.collection("stocks").add({
      symbol,
      price,
      time: new Date().toISOString()
    });
  } catch (err) {
    console.log("Error storing data:", err);
  }
}

/* ===============================
   🔹 API: GET PRICE
   =============================== */
app.get("/api/price", async (req, res) => {
  const symbol = req.query.symbol;

  if (!symbol) {
    return res.json({ error: "Symbol required" });
  }

  const price = await getLivePrice(symbol);

  if (!price) {
    return res.json({ error: "Failed to fetch price" });
  }

  // 🔥 Save to Firebase
  await storePrice(symbol, price);

  res.json({
    symbol,
    price,
    marketStatus: "CLOSED" // (we’ll improve later)
  });
});

/* ===============================
   🔹 API: HEALTH CHECK
   =============================== */
app.get("/", (req, res) => {
  res.send("Stock API Running ✅");
});

/* ===============================
   🔹 START SERVER
   =============================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
