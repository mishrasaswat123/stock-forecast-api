import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import admin from "firebase-admin";

// 🔐 Firebase init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const app = express();
app.use(cors());

// ==========================
// PRICE API
// ==========================
app.get("/api/price", async (req, res) => {
  const symbol = req.query.symbol;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await fetch(url);
    const data = await response.json();

    const price =
      data.chart.result[0].meta.regularMarketPrice;

    const marketState =
      data.chart.result[0].meta.marketState;

    // Save to Firebase
    await db.collection("stocks").add({
      symbol,
      price,
      time: new Date().toISOString(),
    });

    res.json({
      symbol,
      price,
      marketStatus: marketState,
    });
  } catch (err) {
    res.json({ error: "Failed to fetch price" });
  }
});

// ==========================
// HISTORY API
// ==========================
app.get("/api/history", async (req, res) => {
  const symbol = req.query.symbol;

  try {
    const snapshot = await db
      .collection("stocks")
      .where("symbol", "==", symbol)
      .orderBy("time", "desc")
      .limit(50)
      .get();

    const data = [];

    snapshot.forEach((doc) => data.push(doc.data()));

    res.json({
      symbol,
      count: data.length,
      data,
    });
  } catch (err) {
    res.json({ error: "Failed to fetch history" });
  }
});

// ==========================
// 🔥 PREDICTION ENGINE
// ==========================
app.get("/api/predict", async (req, res) => {
  const symbol = req.query.symbol;

  try {
    const snapshot = await db
      .collection("stocks")
      .where("symbol", "==", symbol)
      .orderBy("time", "desc")
      .limit(50)
      .get();

    const prices = [];

    snapshot.forEach((doc) => {
      prices.push(doc.data().price);
    });

    if (prices.length < 5) {
      return res.json({ error: "Not enough data" });
    }

    // Reverse to oldest → newest
    prices.reverse();

    const latest = prices[prices.length - 1];
    const avg =
      prices.reduce((a, b) => a + b, 0) / prices.length;

    const momentum =
      latest - prices[prices.length - 5];

    // 🔥 Prediction logic
    const hourly = latest + momentum * 0.5;
    const threeDay = latest + momentum * 2;
    const weekly = latest + momentum * 5;

    let confidence = "LOW";
    if (Math.abs(momentum) > 10) confidence = "MEDIUM";
    if (Math.abs(momentum) > 25) confidence = "HIGH";

    res.json({
      symbol,
      current: latest,
      avg: avg.toFixed(2),
      momentum: momentum.toFixed(2),
      predictions: {
        hourly: hourly.toFixed(2),
        threeDay: threeDay.toFixed(2),
        weekly: weekly.toFixed(2),
      },
      confidence,
    });
  } catch (err) {
    res.json({ error: "Prediction failed" });
  }
});

// ==========================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
