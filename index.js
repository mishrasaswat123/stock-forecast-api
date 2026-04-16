import express from "express";
import fetch from "node-fetch";
import cors from "cors";
import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(
  fs.readFileSync("./serviceAccountKey.json", "utf-8")
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const app = express();
app.use(cors());

/* =========================
   PRICE API
========================= */
app.get("/api/price", async (req, res) => {
  const symbol = req.query.symbol;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await fetch(url);
    const data = await response.json();

    const price =
      data.chart.result[0].meta.regularMarketPrice;

    res.json({
      symbol,
      price,
      marketStatus: "CLOSED"
    });

  } catch (err) {
    res.json({ error: "Failed to fetch price" });
  }
});

/* =========================
   SAVE DATA TO FIRESTORE
========================= */
app.get("/api/save", async (req, res) => {
  const symbol = req.query.symbol;

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await fetch(url);
    const data = await response.json();

    const price =
      data.chart.result[0].meta.regularMarketPrice;

    await db.collection("stocks").add({
      symbol,
      price,
      time: new Date().toISOString()
    });

    res.json({ status: "saved" });

  } catch (err) {
    res.json({ error: "Save failed" });
  }
});

/* =========================
   HISTORY API
========================= */
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
    snapshot.forEach(doc => data.push(doc.data()));

    res.json({
      symbol,
      count: data.length,
      data
    });

  } catch (err) {
    res.json({ error: "Failed to fetch history" });
  }
});

/* =========================
   PREDICTION API (FIXED)
========================= */
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
    snapshot.forEach(doc => prices.push(doc.data().price));

    if (prices.length === 0) {
      return res.json({ error: "No data" });
    }

    const latest = prices[0];
    const avg =
      prices.reduce((a, b) => a + b, 0) / prices.length;

    // Predictions
    const hourly = latest * 1.002;
    const threeDay = latest * 1.01;
    const weekly = latest * 1.03;

    // Regime
    let regime = "SIDEWAYS";
    if (latest > avg * 1.01) regime = "BULLISH";
    if (latest < avg * 0.99) regime = "BEARISH";

    // Support / Resistance
    const support = Math.min(...prices);
    const resistance = Math.max(...prices);

    // Confidence
    const confidence = Math.min(95, prices.length * 2);

    // Volume (mock)
    const volumeSignal = "NORMAL";

    res.json({
      symbol,
      predictions: {
        hourly: hourly.toFixed(2),
        threeDay: threeDay.toFixed(2),
        weekly: weekly.toFixed(2)
      },
      regime,
      support: support.toFixed(2),
      resistance: resistance.toFixed(2),
      confidence,
      volumeSignal
    });

  } catch (err) {
    res.json({ error: "Prediction failed" });
  }
});

/* =========================
   SERVER
========================= */
app.listen(3000, () => {
  console.log("Server running...");
});
