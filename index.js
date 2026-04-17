import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());

const API_KEY = "TMHAGIE1AVVRN73H";

app.get("/api/predict", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "RELIANCE").replace(".NS", "") + ".BSE";

    const url = `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${API_KEY}`;

    const response = await axios.get(url);

    const data = response.data["Global Quote"];

    if (!data || !data["05. price"]) {
      return res.json({
        error: "Invalid API response",
        raw: response.data
      });
    }

    const price = parseFloat(data["05. price"]);
    const prevClose = parseFloat(data["08. previous close"]);

    // 📈 Stable forecast (NO wild swings)
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
    console.log("ERROR:", err.message);

    res.json({
      error: "Server error",
      details: err.message
    });
  }
});

app.get("/", (req, res) => {
  res.send("API running");
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
