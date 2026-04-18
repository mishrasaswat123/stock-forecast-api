from breeze_connect import BreezeConnect
import json
import sys

API_KEY = sys.argv[1]
SECRET_KEY = sys.argv[2]
SESSION_TOKEN = sys.argv[3]
SYMBOL = sys.argv[4]

try:
    print("Step 1: Init Breeze")

    breeze = BreezeConnect(api_key=API_KEY)

    print("Step 2: Generate session")

    breeze.generate_session(
        api_secret=SECRET_KEY,
        session_token=SESSION_TOKEN
    )

    print("Step 3: Fetch data")

    data = breeze.get_quotes(
        stock_code=SYMBOL,
        exchange_code="NSE",
        product_type="cash"
    )

    print("Step 4: Raw response:")
    print(data)

    print("Step 5: JSON output:")
    print(json.dumps(data))

except Exception as e:
    print("ERROR OCCURRED:")
    print(str(e))