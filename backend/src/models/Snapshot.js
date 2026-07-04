/**
 * What it does: Defines the Mongoose schema and model for privacy policy snapshots (Snapshot).
 * Why it exists: Archives historical versions of cleaned policy text and stores structured 6-category AI summaries.
 * Connects to: MongoDB, Site model (via siteId), Change model, summarizer service, and recheckJob.
 */

const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema(
  {
    dataCollected: { type: String, required: true },
    thirdPartySharing: { type: String, required: true },
    retention: { type: String, required: true },
    userRights: { type: String, required: true },
    cookies: { type: String, required: true },
    accountDeletion: { type: String, required: true }
  },
  { _id: false }
);

const snapshotSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: true,
      index: true
    },
    hash: {
      type: String,
      required: true
    },
    cleanedText: {
      type: String,
      required: true
    },
    summary: {
      type: summarySchema,
      required: true
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }
);

module.exports = mongoose.model('Snapshot', snapshotSchema);
