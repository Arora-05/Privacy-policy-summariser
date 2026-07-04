/**
 * What it does: Defines the Mongoose schema and model for detected privacy policy changes (Change).
 * Why it exists: Records sentence-level diffs between two snapshots and stores AI classifications of change severity.
 * Connects to: MongoDB, Site/Snapshot models, differ/classifier services, sites history endpoint, and recheckJob.
 */

const mongoose = require('mongoose');

const diffChunkSchema = new mongoose.Schema(
  {
    text: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['added', 'removed']
    }
  },
  { _id: false }
);

const changeSchema = new mongoose.Schema(
  {
    siteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Site',
      required: true,
      index: true
    },
    fromSnapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Snapshot',
      required: true
    },
    toSnapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Snapshot',
      required: true
    },
    diffChunks: {
      type: [diffChunkSchema],
      required: true
    },
    classification: {
      type: String,
      required: true,
      enum: ['more_invasive', 'less_invasive', 'cosmetic']
    },
    detectedAt: {
      type: Date,
      default: Date.now
    }
  }
);

module.exports = mongoose.model('Change', changeSchema);
