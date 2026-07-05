/**
 * What it does: Compares two policy text strings at the sentence level and extracts added/removed diff chunks.
 * Why it exists: Reduces AI API costs by isolating only modified sentences instead of sending entire policy texts for classification.
 * Connects to: diff npm package, scraper service (input), classifier service (output), and weekly recheckJob.
 */

const diff = require('diff');

function splitIntoSentences(text) {
  if (!text || typeof text !== 'string') {
    return [];
  }
  return text
    .split('. ')
    .map(sentence => sentence.trim())
    .filter(sentence => sentence.length > 0);
}

function formatDiffChunk(chunk) {
  const chunkText = Array.isArray(chunk.value)
    ? chunk.value.join('. ')
    : String(chunk.value);

  const chunkType = chunk.added ? 'added' : 'removed';

  return {
    text: chunkText.trim(),
    type: chunkType
  };
}

function detectPolicyChanges(oldText, newText) {
  try {
    const oldSentences = splitIntoSentences(oldText);
    const newSentences = splitIntoSentences(newText);

    const rawDiffChunks = diff.diffArrays(oldSentences, newSentences);

    const meaningfulChanges = rawDiffChunks
      .filter(chunk => chunk.added || chunk.removed)
      .map(formatDiffChunk)
      .filter(chunk => chunk.text.length > 0);

    return meaningfulChanges;
  } catch (error) {
    throw new Error(`[Differ Service] Failed to detect sentence-level changes: ${error.message}`);
  }
}

module.exports = {
  detectPolicyChanges,
  splitIntoSentences,
  formatDiffChunk
};
