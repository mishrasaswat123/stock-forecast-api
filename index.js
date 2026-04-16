import express from "express";
import cors from "cors";
import admin from "firebase-admin";

const app = express();
app.use(cors());

// 🔥 Load Firebase Key from ENV
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

// 🔥 Fix private key formatting
serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");

// 🔥 Init Firebase
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
// GET DATA
// ----------------------
app.get("/api/data", async (req, res) => {
  const snapshot = await db.collection("stocks").limit(50).get();
  const data = snapshot.docs.map(doc => doc.data());
  res.json(data);
});

// ----------------------
// PRICE API
// ----------------------
app.get("/api/price", async (req, res) => {
  const symbol = req.query.symbol || "ANANDRATHI.NS";

  let price = Math.floor(3000 + Math.random() * 700);

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
