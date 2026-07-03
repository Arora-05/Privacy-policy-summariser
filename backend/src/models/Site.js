/**
 * What it does: Defines the Mongoose schema and model for tracked websites (Site).
 * Why it exists: Stores site identifiers, direct privacy policy URL, denormalized text hash for cron efficiency, and unseen change notification state.
 * Connects to: MongoDB, Snapshot/Change models, sites service/routes, and weekly recheckJob.
 */

const mongoose = require('mongoose');

const siteSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    policyUrl: {
      type: String,
      trim: true
    },
    latestHash: {
      type: String
    },
    lastCheckedAt: {
      type: Date
    },
    hasUnseenChange: {
      type: Boolean,
      default: false
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model('Site', siteSchema);
