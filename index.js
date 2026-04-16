import express from "express";
import fetch from "node-fetch";
import cors from "cors";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

app.get("/api/price", async (req, res) => {
  try {
    const url = "https://query1.finance.yahoo.com/v8/finance/chart/ANANDRATHI.NS?range=2y&interval=1d";
    const response = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0",
    "Accept": "application/json"
  }
});
    const json = await response.json();

    const result = json.chart.result[0];
    const closes = result.indicators.quote[0].close.filter(x => x);
    const volumes = result.indicators.quote[0].volume.filter(x => x);

    const ltp = closes.at(-1);
    const prev = closes.at(-2);
    const changePct = (ltp - prev) / prev;

    let gains = 0, losses = 0;
    for (let i = closes.length - 14; i < closes.length; i++) {
      let diff = closes[i] - closes[i - 1];
      if (diff > 0) gains += diff;
      else losses -= diff;
    }
    const rs = gains / (losses || 1);
    const rsi = 100 - (100 / (1 + rs));

    function ema(data, period) {
      let k = 2 / (period + 1);
      let emaArr = [data[0]];
      for (let i = 1; i < data.length; i++) {
        emaArr.push(data[i] * k + emaArr[i - 1] * (1 - k));
      }
      return emaArr;
    }

    const ema12 = ema(closes, 12);
    const ema26 = ema(closes, 26);
    const macdLine = ema12.map((v, i) => v - ema26[i]);
    const signalLine = ema(macdLine, 9);

    const macdTrend = macdLine.at(-1) > signalLine.at(-1) ? "BULLISH" : "BEARISH";

    const recent = closes.slice(-20);
    const support = Math.min(...recent);
    const resistance = Math.max(...recent);

    const recentVol = volumes.slice(-5).reduce((a,b)=>a+b,0)/5;
    const avgVol = volumes.reduce((a,b)=>a+b,0)/volumes.length;

    let volumeSignal = "NORMAL";
    if (recentVol > avgVol * 1.2) volumeSignal = "ACCUMULATION";
    if (recentVol < avgVol * 0.8) volumeSignal = "DISTRIBUTION";

    let momentum = changePct;

    if (rsi > 70) momentum -= 0.01;
    if (rsi < 30) momentum += 0.01;
    if (macdTrend === "BULLISH") momentum += 0.005;
    else momentum -= 0.005;
    if (volumeSignal === "ACCUMULATION") momentum += 0.005;
    if (volumeSignal === "DISTRIBUTION") momentum -= 0.005;

    let regime = "SIDEWAYS";
    if (momentum > 0.01) regime = "BULLISH";
    else if (momentum < -0.01) regime = "BEARISH";

    const volatility = Math.max(0.008, Math.abs(momentum) * 1.5);
    const confidence = Math.min(90, Math.max(55, Math.round(Math.abs(momentum) * 200)));

    let hourly = [], base = ltp;

    for (let i=1;i<=6;i++){
      base = base * (1 + momentum + (Math.random()-0.5)*volatility);
      hourly.push({
        hour: `${10+i}:00`,
        price: Math.round(base),
        min: Math.round(base*(1-volatility/2)),
        max: Math.round(base*(1+volatility/2)),
        confidence: confidence - (6-i)*2
      });
    }

    let forecast3d = [], temp = ltp;

    for (let d=1; d<=3; d++){
      temp = temp * (1 + momentum + (Math.random()-0.5)*volatility);
      forecast3d.push({
        day: d,
        low: Math.round(temp*(1-volatility)),
        high: Math.round(temp*(1+volatility)),
        direction: regime,
        confidence: confidence + d*3
      });
    }

    let weekly = [], baseW = ltp;

    for (let i=1;i<=5;i++){
      baseW = baseW * (1 + momentum + (Math.random()-0.5)*volatility*1.5);
      weekly.push({
        day: `D${i}`,
        low: Math.round(baseW*(1-volatility*1.2)),
        high: Math.round(baseW*(1+volatility*1.2))
      });
    }

    res.json({
      ltp: Math.round(ltp),
      regime,
      confidence,
      hourly,
      forecast3d,
      weekly,
      support: Math.round(support),
      resistance: Math.round(resistance),
      volumeSignal
    });

  } catch (err) {
    res.status(500).json({ ok:false });
  }
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
