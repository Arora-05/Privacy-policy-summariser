/**
 * What it does: Fetches web page HTML and extracts clean readable plain text using Readability and jsdom.
 * Why it exists: Strips navigation, ads, footers, and boilerplate HTML from privacy policies so only clean policy text is processed by AI.
 * Connects to: External web servers via axios, summarizer/differ services, sites route handlers, and weekly recheckJob.
 */

const axios = require('axios');
const { JSDOM } = require('jsdom');
const { Readability } = require('@mozilla/readability');

const SCRAPE_TIMEOUT_MS = Number(process.env.SCRAPE_TIMEOUT_MS) || 10000;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function fetchHtml(url) {
  try {
    const response = await axios.get(url, {
      timeout: SCRAPE_TIMEOUT_MS,
      headers: {
        'User-Agent': process.env.SCRAPER_USER_AGENT || DEFAULT_USER_AGENT
      }
    });
    return response.data;
  } catch (error) {
    const failureReason = error.code === 'ECONNABORTED'
      ? `Request timed out after ${SCRAPE_TIMEOUT_MS / 1000} seconds`
      : error.message;
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
    const htmlContent = await fetchHtml(url);
    const cleanText = extractCleanText(htmlContent, url);
    return cleanText;
  } catch (error) {
    throw new Error(`[Scraper Service] ${error.message}`);
  }
}

module.exports = {
  scrapePolicyText,
  fetchHtml,
  extractCleanText
};
