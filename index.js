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

    // ===== PREDICTIONS =====
    const hourly = latest * 1.002;
    const threeDay = latest * 1.01;
    const weekly = latest * 1.03;

    // ===== REGIME =====
    let regime = "SIDEWAYS";
    if (latest > avg * 1.01) regime = "BULLISH";
    if (latest < avg * 0.99) regime = "BEARISH";

    // ===== SUPPORT / RESISTANCE =====
    const support = Math.min(...prices);
    const resistance = Math.max(...prices);

    // ===== CONFIDENCE =====
    const confidence = Math.min(95, prices.length * 2);

    // ===== VOLUME SIGNAL (mock for now) =====
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
      confidence: confidence,
      volumeSignal
    });

  } catch (err) {
    res.json({ error: "Prediction failed" });
  }
});
