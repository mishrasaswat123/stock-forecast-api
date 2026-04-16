import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import admin from "firebase-admin";

// 🔥 Firebase Init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(cors());

/* ===============================
   🔹 GET LIVE PRICE
   =============================== */
async function getLivePrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;

    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });

    const data = await response.json();

    if (!data.chart || !data.chart.result || !data.chart.result[0]) {
      return null;
    }

    const result = data.chart.result[0];

    const closePrices = result.indicators?.quote?.[0]?.close;
    if (closePrices) {
      return closePrices[closePrices.length - 1];
    }

    return result.meta?.regularMarketPrice || null;

  } catch (err) {
    console.log("Price fetch error:", err);
    return null;
  }
}

/* ===============================
   🔹 STORE IN FIREBASE
   =============================== */
async function storePrice(symbol, price) {
  try {
    await db.collection("stocks").add({
      symbol,
      price,
      time: new Date().toISOString()
    });
  } catch (err) {
    console.log("Firebase error:", err);
  }
}

/* ===============================
   🔹 API: PRICE
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

  await storePrice(symbol, price);

  res.json({
    symbol,
    price,
    marketStatus: "CLOSED"
  });
});

/* ===============================
   🔹 API: HISTORY (FIXED)
   =============================== */
app.get("/api/history", async (req, res) => {
  const symbol = req.query.symbol;

  if (!symbol) {
    return res.json({ error: "Symbol required" });
  }

  try {
    const snapshot = await db
      .collection("stocks")
      .where("symbol", "==", symbol)
      .get();

    let data = [];

    snapshot.forEach(doc => {
      data.push(doc.data());
    });

    // 🔥 SORT IN BACKEND (NO FIRESTORE INDEX NEEDED)
    data.sort((a, b) => new Date(a.time) - new Date(b.time));

    // 🔥 LIMIT LAST 50
    data = data.slice(-50);

    res.json({
      symbol,
      count: data.length,
      data
    });

  } catch (err) {
    console.log("History error:", err);
    res.json({ error: "Failed to fetch history" });
  }
});

/* ===============================
   🔹 ROOT
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
