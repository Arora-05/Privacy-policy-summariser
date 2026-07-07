/**
 * What it does: Defines Express API routes and service handlers for tracking, summarizing, and rechecking privacy policies.
 * Why it exists: Serves as the primary communication bridge between the Chrome extension popup/background script and the MongoDB/Gemini AI backend.
 * Connects to: Site, Snapshot, Change models, scraper/differ/summarizer/classifier services, rateLimiter middleware, and recheckJob.
 */

const express = require('express');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Site = require('../models/Site');
const Snapshot = require('../models/Snapshot');
const Change = require('../models/Change');
const { scrapePolicyText } = require('../services/scraper');
const { summarizePolicyText } = require('../services/summarizer');
const { detectPolicyChanges } = require('../services/differ');
const { classifyPolicyDiff } = require('../services/classifier');
const summarizeRateLimiter = require('../middleware/rateLimiter');

const router = express.Router();

function calculateSha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

async function summarizeSiteService({ policyUrl, url, name }) {
  if (!policyUrl) {
    throw new Error('A valid policyUrl is required in the request body.');
  }

  const domainUrl = url || new URL(policyUrl).hostname;
  const siteName = name || domainUrl.replace(/^www\./, '');

  let existingSite = await Site.findOne({
    $or: [{ url: domainUrl }, { policyUrl: policyUrl }]
  });

  if (existingSite) {
    const latestSnapshot = await Snapshot.findOne({ siteId: existingSite._id }).sort({ createdAt: -1 });
    if (latestSnapshot && latestSnapshot.summary) {
      return {
        isNew: false,
        site: existingSite,
        summary: latestSnapshot.summary
      };
    }
  }

  let siteToUse = existingSite;
  if (!siteToUse) {
    siteToUse = new Site({
      url: domainUrl,
      name: siteName,
      policyUrl: policyUrl,
      lastCheckedAt: new Date(),
      hasUnseenChange: false
    });
    await siteToUse.save();
  } else {
    siteToUse.lastCheckedAt = new Date();
    if (!siteToUse.policyUrl && policyUrl) {
      siteToUse.policyUrl = policyUrl;
    }
  }

  const targetPolicyUrl = policyUrl || siteToUse.policyUrl;
  const cleanedText = await scrapePolicyText(targetPolicyUrl);
  const textHash = calculateSha256(cleanedText);
  const summary = await summarizePolicyText(cleanedText);

  const firstSnapshot = new Snapshot({
    siteId: siteToUse._id,
    hash: textHash,
    cleanedText: cleanedText,
    summary: summary
  });
  await firstSnapshot.save();

  siteToUse.latestHash = textHash;
  await siteToUse.save();

  return {
    isNew: !existingSite,
    site: siteToUse,
    summary: summary,
    snapshotId: firstSnapshot._id
  };
}

async function listSitesService() {
  const sites = await Site.find()
    .select('name url policyUrl lastCheckedAt hasUnseenChange latestHash')
    .sort({ name: 1 });
  return { sites };
}

async function getSiteDetailService(siteIdentifier) {
  let site = null;
  if (mongoose.Types.ObjectId.isValid(siteIdentifier)) {
    site = await Site.findById(siteIdentifier);
  }
  if (!site) {
    site = await Site.findOne({ url: siteIdentifier });
  }
  if (!site) {
    const error = new Error(`Site not found for identifier: ${siteIdentifier}`);
    error.status = 404;
    throw error;
  }

  const latestSnapshot = await Snapshot.findOne({ siteId: site._id }).sort({ createdAt: -1 });
  return {
    site: site,
    summary: latestSnapshot ? latestSnapshot.summary : null
  };
}

async function getSiteHistoryService(siteId) {
  if (!mongoose.Types.ObjectId.isValid(siteId)) {
    const error = new Error(`Invalid site ID format: ${siteId}`);
    error.status = 400;
    throw error;
  }

  const site = await Site.findById(siteId);
  if (!site) {
    const error = new Error(`Site not found with ID: ${siteId}`);
    error.status = 404;
    throw error;
  }

  if (site.hasUnseenChange) {
    site.hasUnseenChange = false;
    await site.save();
  }

  const changes = await Change.find({ siteId: site._id })
    .sort({ detectedAt: -1 })
    .populate('fromSnapshotId toSnapshotId', 'createdAt hash');

  return {
    siteName: site.name,
    siteUrl: site.url,
    changes: changes
  };
}

async function recheckSiteService(siteId) {
  if (!mongoose.Types.ObjectId.isValid(siteId)) {
    const error = new Error(`Invalid site ID format: ${siteId}`);
    error.status = 400;
    throw error;
  }

  const site = await Site.findById(siteId);
  if (!site) {
    const error = new Error(`Site not found with ID: ${siteId}`);
    error.status = 404;
    throw error;
  }

  return await executeSiteRecheckLogic(site);
}

async function executeSiteRecheckLogic(site) {
  if (!site.policyUrl) {
    throw new Error(`Site ${site.name} lacks a valid policyUrl for rechecking.`);
  }

  const newCleanedText = await scrapePolicyText(site.policyUrl);
  const newHash = calculateSha256(newCleanedText);

  if (newHash === site.latestHash) {
    site.lastCheckedAt = new Date();
    await site.save();
    console.log(`[Recheck] No change detected for ${site.name}.`);
    return { status: 'no_change', message: `No change for ${site.name}`, site };
  }

  const previousSnapshot = await Snapshot.findOne({ siteId: site._id }).sort({ createdAt: -1 });
  if (!previousSnapshot) {
    throw new Error(`No baseline snapshot found for site ${site.name}.`);
  }

  const diffChunks = detectPolicyChanges(previousSnapshot.cleanedText, newCleanedText);
  if (diffChunks.length === 0) {
    site.latestHash = newHash;
    site.lastCheckedAt = new Date();
    await site.save();
    console.log(`[Recheck] Only formatting/whitespace changes for ${site.name}.`);
    return { status: 'no_meaningful_change', message: `Only cosmetic formatting changes for ${site.name}`, site };
  }

  const classification = await classifyPolicyDiff(diffChunks);

  const newSnapshot = new Snapshot({
    siteId: site._id,
    hash: newHash,
    cleanedText: newCleanedText,
    summary: previousSnapshot.summary
  });
  await newSnapshot.save();

  const changeRecord = new Change({
    siteId: site._id,
    fromSnapshotId: previousSnapshot._id,
    toSnapshotId: newSnapshot._id,
    diffChunks: diffChunks,
    classification: classification,
    detectedAt: new Date()
  });
  await changeRecord.save();

  site.latestHash = newHash;
  site.lastCheckedAt = new Date();
  site.hasUnseenChange = true;
  await site.save();

  console.log(`[Recheck] Policy changed for ${site.name}! Classified as: ${classification}`);
  return {
    status: 'change_detected',
    classification: classification,
    changeId: changeRecord._id,
    site: site
  };
}

router.post('/summarize', summarizeRateLimiter, async (req, res, next) => {
  try {
    const responsePayload = await summarizeSiteService(req.body);
    res.status(responsePayload.isNew ? 201 : 200).json(responsePayload);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const responsePayload = await listSitesService();
    res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
});

router.get('/:siteId/history', async (req, res, next) => {
  try {
    const responsePayload = await getSiteHistoryService(req.params.siteId);
    res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
});

router.get('/:siteId', async (req, res, next) => {
  try {
    const responsePayload = await getSiteDetailService(req.params.siteId);
    res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
});

router.post('/recheck/:siteId', async (req, res, next) => {
  try {
    const responsePayload = await recheckSiteService(req.params.siteId);
    res.status(200).json(responsePayload);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
module.exports.executeSiteRecheckLogic = executeSiteRecheckLogic;
