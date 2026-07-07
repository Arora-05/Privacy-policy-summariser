/**
 * What it does: Fetches web page HTML and extracts clean readable plain text using Readability and jsdom.
 * Why it exists: Strips navigation, ads, footers, and boilerplate HTML from privacy policies so only clean policy text is processed by AI.
 * Connects to: External web servers via axios, summarizer/differ services, sites route handlers, and weekly recheckJob.
 */

const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const SCRAPE_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS) || 10000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchHtml(url) {
  try {
    const response = await axios.get(url, {
      timeout: SCRAPE_TIMEOUT_MS,
      headers: {
        'User-Agent': process.env.SCRAPER_USER_AGENT || DEFAULT_USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1'
      }
    });
    return response.data;
  } catch (error) {
    const failureReason = error.code === 'ECONNABORTED'
      ? `Request timed out after ${SCRAPE_TIMEOUT_MS / 1000} seconds`
      : (error.response ? `HTTP ${error.response.status} (${error.message})` : error.message);
    throw new Error(`Failed to fetch HTML from ${url}: ${failureReason}`);
  }
}

function extractCleanText(htmlContent, sourceUrl) {
  try {
    const dom = new JSDOM(htmlContent, { url: sourceUrl });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.textContent || !article.textContent.trim()) {
      throw new Error('Readability returned null or empty content; document may lack recognizable article text.');
    }

    return article.textContent.trim();
  } catch (error) {
    throw new Error(`Failed to extract clean text from ${sourceUrl}: ${error.message}`);
  }
}

async function scrapePolicyText(url) {
  try {
    if (!url) {
      throw new Error('A valid target URL must be provided for scraping.');
    }

    // Attempt 1: Direct fetch with realistic browser headers + Readability extraction
    try {
      const htmlContent = await fetchHtml(url);
      const cleanText = extractCleanText(htmlContent, url);
      if (cleanText && cleanText.length > 50) {
        return cleanText;
      }
    } catch (directErr) {
      console.warn(`[Scraper] Direct fetch blocked or failed for ${url} (${directErr.message}). Attempting Cloudflare bypass proxy (Jina Reader)...`);
    }

    // Attempt 2: Fallback to Jina AI Reader proxy for Cloudflare/bot-protected sites (like LeetCode)
    try {
      const proxyUrl = `https://r.jina.ai/${url}`;
      const proxyResponse = await axios.get(proxyUrl, {
        timeout: SCRAPE_TIMEOUT_MS,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT
        }
      });
      if (proxyResponse.data && typeof proxyResponse.data === 'string' && proxyResponse.data.trim().length > 50) {
        return proxyResponse.data.trim();
      }
    } catch (proxyErr) {
      console.warn(`[Scraper] Proxy fetch also failed for ${url}: ${proxyErr.message}`);
    }

    throw new Error(`Failed to extract readable policy text from ${url} (both direct fetch and Cloudflare bypass proxy were blocked or returned empty content).`);
  } catch (error) {
    throw new Error(`[Scraper Service] ${error.message}`);
  }
}

module.exports = {
  scrapePolicyText,
  fetchHtml,
  extractCleanText
};
