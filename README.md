# Privacy Policy Tracker

An AI-powered system that automatically summarizes website privacy policies on your first visit and tracks them over time to alert you whenever silent, privacy-invasive updates occur.

## Core Engineering Differentiator
While standard legal tools focus purely on one-off summarization, **Privacy Policy Tracker** is designed around **cost-aware change detection over time**.
When a website updates its privacy policy, our backend strips away boilerplate formatting and performs **sentence-level diffing**. Instead of re-summarizing an entire 10,000-word legal document from scratch, the system isolates only the added and removed sentence chunks and sends *only those diffs* to **Google Gemini 1.5 Flash**. The AI evaluates the exact privacy implications and classifies the update as:
- 🔴 **`more_invasive`**: Expands data collection, increases third-party sharing/selling, or weakens user rights.
- 🟢 **`less_invasive`**: Reduces data tracking, enhances user privacy rights, or shortens data retention limits.
- ⚪ **`cosmetic`**: Typographical, grammatical, formatting, or legal boilerplate changes that do not alter privacy practices.

---

## System Architecture

```
[Chrome Extension (MV3)]  <-- HTTP / JSON -->  [Express API Server]  <-- Mongoose -->  [MongoDB Database]
  ├── popup.html/js                              ├── Routes (/api/sites)                 ├── Sites
  ├── content.js (Link Scanner)                  ├── Services (Scraper, Differ)          ├── Snapshots
  └── background.js (Badge Alerts)               └── Cron Scheduler (Weekly Recheck)     └── Changes
                                                            │
                                                            ▼
                                                 [Google Gemini 1.5 Flash]
                                                 (Structured JSON & Classification)
```

1. **Chrome Extension (Manifest V3)**:
   - **`content.js`**: Runs silently on webpage load, scanning DOM anchor tags case-insensitively for terms like `"privacy"`, `"terms"`, `"policy"`, or `"legal"`.
   - **`popup.html` / `popup.js`**: A sleek dark-mode UI with two primary flows:
     - **Flow A (Untracked Site)**: Displays the detected policy link and lets users trigger an AI analysis with one click (`✨ Analyze & Track Policy`).
     - **Flow B (Tracked Site)**: Immediately renders the stored **6-category summary card** (Data Collected, Third-Party Sharing, User Rights, Data Retention, Notable Red Flags, Bottom-Line Score) and a **Change History timeline** with color-coded classification badges and sentence diff previews.
   - **`background.js`**: Monitors tab navigation and displays a real-time toolbar badge alert (`!`) in red (`#d50000`) whenever a visited website has an unseen privacy policy update.

2. **Backend API (`localhost:5000`)**:
   - Built with **Node.js, Express, and Mongoose**.
   - **`scraper.js`**: Distills raw HTML into clean, readable text using Mozilla's `@mozilla/readability` and `jsdom`.
   - **`differ.js`**: Performs sentence-level comparisons using the `diff` library, filtering out whitespace and formatting noise.
   - **`summarizer.js` & `classifier.js`**: Connects to Google AI Studio (`gemini-1.5-flash`) with strict JSON schema enforcement and defensive error fallbacks.
   - **`recheckJob.js`**: A `node-cron` background scheduler that runs every Sunday at midnight to automatically re-evaluate all tracked platforms.
   - **`rateLimiter.js`**: Restricts summarization requests to 10 requests per 15-minute window per IP to prevent API abuse.

---

## Prerequisites
- **Node.js**: Version 18.0.0 or higher.
- **MongoDB**: A running local instance (`mongodb://127.0.0.1:27017/privacy_tracker`) or a MongoDB Atlas connection string.
- **Google AI Studio API Key**: An active API key for Gemini 1.5 Flash (`GEMINI_API_KEY`).

---

## Setup Instructions

### 1. Backend Server Setup
1. Open your terminal and navigate to the `backend/` directory:
   ```powershell
   cd backend
   ```
2. Install all required dependencies:
   ```powershell
   npm install
   ```
3. Configure your environment variables by copying `.env.example` to `.env`:
   ```powershell
   copy .env.example .env
   ```
   Open `.env` in your text editor and insert your actual `MONGO_URI` and `GEMINI_API_KEY`.
4. Run the database seed script to pre-populate 15 major technology platforms (Google, Meta, Spotify, Netflix, Amazon, Twitter/X, Reddit, LinkedIn, WhatsApp, Apple, Microsoft, YouTube, OpenAI, GitHub, Uber):
   ```powershell
   npm run seed
   ```
5. Start the development server:
   ```powershell
   npm run dev
   ```
   *The API server will begin listening on port 5000.*

### 2. Chrome Extension Setup
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** by toggling the switch in the top-right corner.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the `extension/` folder located inside this project directory.
5. Pin the **Privacy Policy Tracker** icon (🛡️) to your Chrome toolbar for easy access!

---

## End-to-End Verification Checklist

Use this step-by-step checklist to confirm that the entire data pipeline—from browser DOM scanning to database persistence and AI summarization—works seamlessly:

- [ ] **Step 1: Verify API Health Check**
  - Open your browser or curl and visit `http://localhost:5000/`.
  - Confirm it returns a JSON response with `"status": "healthy"`.

- [ ] **Step 2: Verify Database Seeding**
  - Visit `http://localhost:5000/api/sites`.
  - Confirm the JSON payload lists the 15 pre-populated platforms (e.g., Google, Meta, Apple, Microsoft).

- [ ] **Step 3: Test Flow B (Already Tracked Site)**
  - Open a new tab in Chrome and navigate to `https://www.google.com` or `https://www.youtube.com`.
  - Click the **Privacy Policy Tracker** toolbar icon.
  - Verify that the popup instantly loads the stored **6-category summary card**, displays the domain badge (`google.com`), shows status **Active**, and renders a color-coded **Privacy Bottom-Line Score**.

- [ ] **Step 4: Test Flow A (Untracked Site Analysis)**
  - Navigate to a website that is *not* in your database (for example, `https://www.bbc.com`, `https://www.wikipedia.org`, or any blog with a privacy link in the footer).
  - Click the extension icon. Notice that it displays **"Site Not Tracked Yet"** and displays the auto-detected privacy policy link found by `content.js`.
  - Click the **✨ Analyze & Track Policy** button.
  - Verify that the loading spinner appears ("Analyzing with Gemini AI...") and that within 3–6 seconds, the view dynamically transitions to displaying your newly generated 6-category summary card!
  - Refresh `http://localhost:5000/api/sites` and confirm that this new site has been permanently saved to MongoDB.

- [ ] **Step 5: Test Manual Recheck & Diff Classification**
  - In your PowerShell terminal, manually trigger a recheck against one of your tracked sites (replace `<siteId>` with an actual MongoDB ID from your `/api/sites` list):
    ```powershell
    curl -X POST http://localhost:5000/api/sites/recheck/<siteId>
    ```
  - Confirm the API returns either `"status": "no_change"` (if the policy text hasn't changed today) or `"status": "change_detected"` with a classification rating.

- [ ] **Step 6: Test Change History Timeline & Badge Alert Reset**
  - In the extension popup for a tracked site, click the **[Change History]** toggle button.
  - Verify that the vertical timeline renders cleanly. If changes occurred over time, confirm they display date stamps, uppercase classification badges (`MORE INVASIVE`, `LESS INVASIVE`, `COSMETIC`), and color-coded sentence diffs (`+` in green, `-` in red).
  - Confirm that viewing the history timeline automatically clears any red warning banners in the popup and resets the toolbar icon badge back to green (`#00c853`)!

---

## Project Structure

```text
Privacy policy project/
├── .gitignore
├── README.md
├── backend/
│   ├── .env
│   ├── .env.example
│   ├── package.json
│   ├── server.js
│   └── src/
│       ├── jobs/
│       │   └── recheckJob.js       # Weekly node-cron recheck scheduler
│       ├── middleware/
│       │   ├── errorHandler.js     # Global JSON error handler
│       │   └── rateLimiter.js      # 10 req/15min IP rate limiter
│       ├── models/
│       │   ├── Change.js           # Diff timeline & classification schema
│       │   ├── Site.js             # Tracked domain metadata schema
│       │   └── Snapshot.js         # Stored HTML text & summary schema
│       ├── routes/
│       │   └── sites.js            # Express API endpoints (/api/sites)
│       ├── scripts/
│       │   └── seed.js             # Batch seed script for 15 platforms
│       └── services/
│           ├── classifier.js       # Gemini diff severity classifier
│           ├── differ.js           # Sentence-level diffing engine
│           ├── scraper.js          # Readability HTML text extractor
│           └── summarizer.js       # Gemini structured JSON summarizer
└── extension/
    ├── background.js               # MV3 service worker & badge controller
    ├── content.js                  # DOM anchor scanner for legal links
    ├── manifest.json               # Chrome Extension V3 manifest
    ├── popup.html                  # Sleek dark-mode popup layout
    └── popup.js                    # Popup view controller & API client
```
