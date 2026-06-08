# 🎯 AURUM - CLAUDE CODE PROMPT (Simple Structure)

## **PROJECT STRUCTURE**

```
D:\aurum\
├── app/
│   ├── layout.tsx
│   ├── page.tsx                      # Home/Dashboard
│   ├── api/
│   │   ├── prices/route.ts           # GET /api/prices
│   │   ├── signals/route.ts          # GET /api/signals
│   │   └── fetch-price/route.ts      # POST /api/fetch-price
│   ├── components/
│   │   ├── Chart.tsx                 # Chart display
│   │   ├── Dashboard.tsx             # Main dashboard
│   │   ├── Signals.tsx               # Signals panel
│   │   └── Indicators.tsx            # Indicators display
│   └── lib/
│       ├── db.ts                     # MySQL connection
│       ├── tiingo.ts                 # Price fetching
│       ├── indicators.ts             # RSI, MACD, BB
│       ├── signals.ts                # Signal generation
│       └── types.ts                  # TypeScript types
├── .env
├── package.json
└── tsconfig.json
```

---

## **DATABASE SETUP**

Run these SQL queries in MySQL:

```sql
CREATE TABLE prices (
  id INT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME UNIQUE NOT NULL,
  timeframe VARCHAR(10) DEFAULT '1h',
  open DECIMAL(10, 5),
  high DECIMAL(10, 5),
  low DECIMAL(10, 5),
  close DECIMAL(10, 5),
  volume BIGINT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_timestamp (timestamp)
);

CREATE TABLE signals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  type ENUM('BUY', 'SELL', 'HOLD'),
  strength INT DEFAULT 50,
  price DECIMAL(10, 5),
  indicators JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_timestamp (timestamp)
);
```

---

## **IMPLEMENTATION PROMPT FOR CLAUDE CODE**

Copy-paste ini ke Claude Code:

```
Create complete AURUM trading platform:

Structure: app/ folder directly (no src/)

DATABASE LAYER (app/lib/db.ts):
- Export: query(sql, params), getConnection()
- Use mysql2/promise
- Connection from DATABASE_URL env var
- Connection pooling with 10 connections

API CLIENT (app/lib/tiingo.ts):
- Export: getXAUUSDPrice()
- Fetch from Tiingo API using TIINGO_API_KEY
- Return: { timestamp, open, high, low, close, volume }

INDICATORS (app/lib/indicators.ts):
- Export: calculateRSI(prices, period=14)
- Export: calculateMACD(prices)
- Export: calculateBB(prices, period=20)
- Use: technicalindicators npm package

SIGNALS (app/lib/signals.ts):
- Export: generateSignal(lastPrice, indicators)
- Logic:
  * BUY: RSI < 30
  * SELL: RSI > 70
  * HOLD: 30 <= RSI <= 70
- Return: { type, strength, price }

API ROUTES:

1. app/api/fetch-price/route.ts (POST)
   - Fetch price from Tiingo
   - Store in MySQL prices table
   - Return: { success, price, timestamp }

2. app/api/prices/route.ts (GET)
   - Query: ?limit=100&timeframe=1h
   - Return: OHLCV array for chart

3. app/api/signals/route.ts (GET)
   - Query: ?limit=20
   - Return: Recent signals array

COMPONENTS:

1. app/components/Chart.tsx
   - Use: lightweight-charts
   - Fetch data from /api/prices
   - Display candlestick chart
   - Show indicators below

2. app/components/Indicators.tsx
   - Display RSI, MACD, BB values
   - Update in real-time

3. app/components/Signals.tsx
   - Show latest signals
   - Color: Green (BUY), Red (SELL), Gray (HOLD)

4. app/components/Dashboard.tsx
   - Combine Chart + Indicators + Signals
   - Layout: Chart top, indicators below, signals side panel

UI PAGES:

1. app/layout.tsx
   - Setup tailwindcss
   - Import components

2. app/page.tsx
   - Import Dashboard component
   - Fetch price on mount
   - Display dashboard

USE:
- TypeScript everywhere
- Tailwind CSS for styling
- mysql2/promise for queries
- lightweight-charts for chart
- technicalindicators for calculations
- Error handling in all routes

TESTING:
- npm run dev
- http://localhost:3000
- http://localhost:3000/api/prices
- Check MySQL: SELECT * FROM prices;

Show complete working code for all files.
```

---

## **AFTER CLAUDE CODE GENERATES**

```bash
# 1. Install missing package
npm install mysql2 lightweight-charts technicalindicators

# 2. Create SQL tables (run in MySQL)
# Use the SQL script from above

# 3. Update .env
DATABASE_URL="mysql://u692580853_aurum88:pCnXWuO4@srv1763.hstgr.io:3306/u692580853_aurum88"
TIINGO_API_KEY=a9aa2fcff1b6259080051469d2f33f3ceba3aade

# 4. Test API
npm run dev
# http://localhost:3000/api/prices

# 5. Start dashboard
# http://localhost:3000
```

---

## **FOLDER STRUCTURE (FINAL)**

```
aurum/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── api/
│   │   ├── prices/
│   │   │   └── route.ts
│   │   ├── signals/
│   │   │   └── route.ts
│   │   └── fetch-price/
│   │       └── route.ts
│   ├── components/
│   │   ├── Chart.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Signals.tsx
│   │   └── Indicators.tsx
│   └── lib/
│       ├── db.ts
│       ├── tiingo.ts
│       ├── indicators.ts
│       ├── signals.ts
│       └── types.ts
├── .env
├── package.json
├── tsconfig.json
└── next.config.js
```

---

## **PRIORITY**

1. Database connection ✅
2. Tiingo API client ✅
3. Indicator calculations ✅
4. API routes ✅
5. Components ✅
6. Dashboard UI ✅

All working & tested! 🚀

