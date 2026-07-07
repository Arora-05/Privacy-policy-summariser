/**
 * What it does: Summarizes clean privacy policy text into a structured 6-category JSON object using Google Gemini 1.5 Flash.
 * Why it exists: Provides users with an instant, digestible overview of a website's privacy practices on their first visit.
 * Connects to: Google AI Studio (Gemini API), Snapshot model (summary field), and sites summarize endpoint.
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

function getGeminiModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not defined.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });
}

function buildSummarizationPrompt(cleanedText) {
  return `You are an expert privacy auditor. Analyze the following privacy policy text and return strictly a JSON object with exactly these 9 keys:
- bottomLineScore: An integer number from 1 to 10 rating overall user privacy (10 = excellent/minimal tracking, 1 = terrible/invasive selling of user data).
- dataCollected: What personal data is collected? (1-2 sentences)
- thirdPartySharing: Who is data shared with or sold to? (1-2 sentences)
- userRights: What rights do users have (access, delete, opt-out)? (1-2 sentences)
- dataRetention: How long is data retained? (1-2 sentences)
- notableRedFlags: An array of strings containing 2 to 4 specific concerning privacy practices or red flags found in this policy (e.g. ["Sells personal data to advertisers", "Indefinite data retention", "No arbitration opt-out"]). If none, return empty array [].
- retention: How long is data retained? (same as dataRetention)
- cookies: What tracking technologies or cookies are used? (1-2 sentences)
- accountDeletion: How can a user delete their account or data? (1-2 sentences)

Return ONLY valid JSON with exactly these keys and types. Do not include any preamble, markdown formatting, or extra explanations.

Privacy Policy Text:
${cleanedText}`;
}

function parseSummaryResponse(rawResponseText) {
  try {
    let cleanedJsonString = rawResponseText.trim();
    if (cleanedJsonString.startsWith('```')) {
      cleanedJsonString = cleanedJsonString
        .replace(/^```(json)?\n?/, '')
        .replace(/\n?```$/, '')
        .trim();
    }

    const parsedObject = JSON.parse(cleanedJsonString);
    const requiredStringKeys = [
      'dataCollected',
      'thirdPartySharing',
      'userRights',
      'cookies',
      'accountDeletion'
    ];

    for (const key of requiredStringKeys) {
      if (!parsedObject[key] || typeof parsedObject[key] !== 'string') {
        throw new Error(`Missing or invalid required summary field: ${key}`);
      }
      parsedObject[key] = parsedObject[key].trim();
    }

    const bottomLineScore = Number(parsedObject.bottomLineScore) || 5;
    const dataRetention = (parsedObject.dataRetention || parsedObject.retention || 'No data retention period defined.').trim();
    const retention = dataRetention;
    const notableRedFlags = Array.isArray(parsedObject.notableRedFlags)
      ? parsedObject.notableRedFlags.map(f => String(f).trim()).filter(Boolean)
      : [];

    return {
      bottomLineScore,
      dataCollected: parsedObject.dataCollected,
      thirdPartySharing: parsedObject.thirdPartySharing,
      userRights: parsedObject.userRights,
      dataRetention,
      retention,
      notableRedFlags,
      cookies: parsedObject.cookies,
      accountDeletion: parsedObject.accountDeletion
    };
  } catch (error) {
    throw new Error(`Failed to parse Gemini summary response into required schema: ${error.message}`);
  }
}

async function summarizePolicyText(cleanedText) {
  try {
    if (!cleanedText || typeof cleanedText !== 'string') {
      throw new Error('Valid cleaned policy text is required for summarization.');
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
        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig: { responseMimeType: 'application/json' }
        });
        const prompt = buildSummarizationPrompt(cleanedText);
        const result = await model.generateContent(prompt);
        responseText = result.response.text();
        if (responseText) break;
      } catch (err) {
        console.warn(`[Summarizer] Model (${modelName}) busy/unavailable (${err.message.split('\n')[0]}). Trying next fallback...`);
        lastError = err;
      }
    }

    if (!responseText) {
      throw lastError || new Error('All fallback models failed to generate summary.');
    }

    const structuredSummary = parseSummaryResponse(responseText);
    return structuredSummary;
  } catch (error) {
    throw new Error(`[Summarizer Service] ${error.message}`);
  }
}

module.exports = {
  summarizePolicyText,
  parseSummaryResponse,
  buildSummarizationPrompt
};
