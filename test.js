import pkg from "breezeconnect";
const { BreezeConnect } = pkg;

const breeze = new BreezeConnect({
  api_key: process.env.API_KEY
});

async function run() {
  try {
    await breeze.generateSession(
      process.env.SECRET_KEY,
      process.env.SESSION_TOKEN
    );

    const data = await breeze.getQuotes({
      stock_code: "RELIANCE",
      exchange_code: "NSE",
      product_type: "cash"
    });

    console.log("SUCCESS:", data);

  } catch (err) {
    console.log("ERROR:", err);
  }
}

run();