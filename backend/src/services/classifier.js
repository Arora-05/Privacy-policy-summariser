/**
 * What it does: Classifies sentence-level privacy policy diffs as more_invasive, less_invasive, or cosmetic using Gemini 1.5 Flash.
 * Why it exists: Provides users with an immediate severity rating when a policy updates, highlighting alarming privacy regressions.
 * Connects to: Google AI Studio (Gemini API), differ service (input), Change model (classification field), and weekly recheckJob.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not defined.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash'
  });
}

function formatDiffChunksForPrompt(diffChunks) {
  if (!Array.isArray(diffChunks) || diffChunks.length === 0) {
    return 'No changes detected.';
  }
  return diffChunks
    .map((chunk, index) => `[Change ${index + 1} - ${chunk.type.toUpperCase()}]\n${chunk.text}`)
    .join('\n\n');
}

function buildClassificationPrompt(formattedChunks) {
  return `You are an expert privacy evaluator evaluating modifications to a website's privacy policy.
Below is a list of added and removed sentence chunks from a policy update.
Analyze the privacy implications for users and classify the overall update into exactly ONE of these three categories:
- more_invasive: The changes expand data collection, increase third-party sharing or selling, add tracking cookies, or weaken user rights and retention limits.
- less_invasive: The changes reduce data collection or sharing, strengthen user privacy rights, or shorten data retention periods.
- cosmetic: The changes are purely typographical, grammatical, formatting, rephrasing, or legal boilerplate without modifying actual privacy practices.

Return ONLY ONE EXACT STRING from the three options above: more_invasive, less_invasive, or cosmetic. Do not include any punctuation, quotes, markdown, or explanations.

Diff Chunks:
${formattedChunks}`;
}

function parseClassificationResponse(rawResponseText) {
  const cleanedText = (rawResponseText || '').trim().toLowerCase();
  if (cleanedText.includes('more_invasive')) {
    return 'more_invasive';
  }
  if (cleanedText.includes('less_invasive')) {
    return 'less_invasive';
  }
  if (cleanedText.includes('cosmetic')) {
    return 'cosmetic';
  }
  return 'cosmetic';
}

async function classifyPolicyDiff(diffChunks) {
  try {
    if (!Array.isArray(diffChunks) || diffChunks.length === 0) {
      return 'cosmetic';
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not defined.');
    }
    const genAI = new GoogleGenerativeAI(apiKey);

    const modelsToTry = [
      process.env.GEMINI_MODEL || 'gemini-3.5-flash',
      'gemini-flash-latest',
      'gemini-2.5-flash'
    ];

    let responseText;
    let lastError;
    for (const modelName of modelsToTry) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const formattedChunks = formatDiffChunksForPrompt(diffChunks);
        const prompt = buildClassificationPrompt(formattedChunks);
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        if (responseText) break;
      } catch (err) {
        console.warn(`[Classifier] Model (${modelName}) busy/unavailable (${err.message.split('\n')[0]}). Trying next fallback...`);
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error('All fallback models failed to classify diff.');
    }

    return parseClassificationResponse(responseText);
  } catch (error) {
    console.error(`[Classifier Service Error] API call failed (${error.message}). Defaulting classification to 'cosmetic'.`);
    return 'cosmetic';
  }
}

module.exports = {
  classifyPolicyDiff,
  formatDiffChunksForPrompt,
  parseClassificationResponse,
  buildClassificationPrompt
};
