/**
 * What it does: Limits IP addresses to a maximum of 10 requests per 15-minute window for policy summarization.
 * Why it exists: Prevents denial-of-service attacks, abuse, and excessive Gemini API token consumption on expensive scraping/AI routes.
 * Connects to: express-rate-limit package and POST /api/sites/summarize route in src/routes/sites.js.
 */

const rateLimit = require('express-rate-limit');

const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 10;

const summarizeRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next, options) => {
    res.status(options.statusCode).json({
      error: 'Too many summarization requests from this IP address. Please try again after 15 minutes.',
      status: options.statusCode
    });
  }
});

module.exports = summarizeRateLimiter;
