/**
 * What it does: Pre-populates MongoDB with 15 major technology platforms and their direct privacy policy URLs.
 * Why it exists: Provides an immediate baseline dataset of high-profile sites to track without requiring manual user additions.
 * Connects to: MongoDB via Mongoose and Site model.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const Site = require('../models/Site');

const SEED_SITES = [
  { name: 'Google', url: 'google.com', policyUrl: 'https://policies.google.com/privacy' },
  { name: 'Meta', url: 'meta.com', policyUrl: 'https://www.meta.com/privacy/policy/' },
  { name: 'Spotify', url: 'spotify.com', policyUrl: 'https://www.spotify.com/us/legal/privacy-policy/' },
  { name: 'Netflix', url: 'netflix.com', policyUrl: 'https://help.netflix.com/legal/privacy' },
  { name: 'Amazon', url: 'amazon.com', policyUrl: 'https://www.amazon.com/gp/help/customer/display.html?nodeId=GX7NJQ4ZB8MHFRNJ' },
  { name: 'Twitter/X', url: 'x.com', policyUrl: 'https://x.com/en/privacy' },
  { name: 'Reddit', url: 'reddit.com', policyUrl: 'https://www.reddit.com/policies/privacy-policy' },
  { name: 'LinkedIn', url: 'linkedin.com', policyUrl: 'https://www.linkedin.com/legal/privacy-policy' },
  { name: 'WhatsApp', url: 'whatsapp.com', policyUrl: 'https://www.whatsapp.com/legal/privacy-policy' },
  { name: 'Apple', url: 'apple.com', policyUrl: 'https://www.apple.com/legal/privacy/en-ww/' },
  { name: 'Microsoft', url: 'microsoft.com', policyUrl: 'https://privacy.microsoft.com/en-us/privacystatement' },
  { name: 'YouTube', url: 'youtube.com', policyUrl: 'https://policies.google.com/privacy' },
  { name: 'OpenAI', url: 'openai.com', policyUrl: 'https://openai.com/policies/privacy-policy' },
  { name: 'GitHub', url: 'github.com', policyUrl: 'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement' },
  { name: 'Uber', url: 'uber.com', policyUrl: 'https://www.uber.com/legal/en/document/?name=privacy-notice' }
];

async function seedDatabase() {
  console.log('[Seed Script] Establishing connection to MongoDB...');
  try {
    const databaseConnectionUri = process.env.MONGO_URI;
    if (!databaseConnectionUri) {
      throw new Error('MONGO_URI environment variable is not defined.');
    }
    await mongoose.connect(databaseConnectionUri);
    console.log('[Seed Script] Connected successfully.');

    console.log(`[Seed Script] Attempting to insert ${SEED_SITES.length} initial platforms...`);
    const insertedSites = await Site.insertMany(SEED_SITES, { ordered: false });
    console.log(`[Seed Script] Successfully inserted ${insertedSites.length} platforms!`);
  } catch (error) {
    if (error.code === 11000 || error.name === 'BulkWriteError') {
      const insertedDocsCount = error.insertedDocs ? error.insertedDocs.length : 0;
      console.log(`[Seed Script] Batch completed with duplicates skipped. Successfully inserted: ${insertedDocsCount} new platforms.`);
    } else {
      console.error(`[Seed Script Error] Fatal error during database seeding: ${error.message}`);
    }
  } finally {
    await mongoose.connection.close();
    console.log('[Seed Script] Database connection closed.');
    process.exit(0);
  }
}

seedDatabase();
