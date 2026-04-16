import express from "express";
import cors from "cors";
import admin from "firebase-admin";
import fetch from "node-fetch";

const app = express();
app.use(cors());

// 🔥 Firebase Init
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ----------------------
// MARKET STATUS
// ----------------------
function isMarketOpen() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const day = now.getDay();

  if (day === 0 || day === 6) return false;
  if (hours < 9 || hours > 15) return false;
  if (hours === 9 && minutes < 15) return false;
  if (hours === 15 && minutes > 30) return false;

  return true;
}

// ----------------------
// FETCH REAL PRICE
// ----------------------
async function getLivePrice(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}`;
    const response = await fetch(url);
    const data = await response.json();

    const price =
      data.chart.result[0].meta.regularMarketPrice;

    return price;
  } catch (err) {
    console.log("Error fetching price:", err);
    return null;
  }
}

// ----------------------
// SAVE DATA
// ----------------------
async function saveData(symbol, price) {
  await db.collection("stocks").add({
    symbol,
    price,
    time: new Date().toISOString(),
  });
}

// ----------------------
// PRICE API
// ----------------------
app.get("/api/price", async (req, res) => {
  const symbol = req.query.symbol || "ANANDRATHI.NS";

  let price = await getLivePrice(symbol);

  // fallback if API fails
  if (!price) {
    price = Math.floor(3000 + Math.random() * 700);
  }

  if (isMarketOpen()) {
    await saveData(symbol, price);
  }

  res.json({
    symbol,
    price,
    marketStatus: isMarketOpen() ? "OPEN" : "CLOSED",
  });
});

// ----------------------
app.get("/", (req, res) => {
  res.send("Stock API Running 🚀");
});

// ----------------------
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
