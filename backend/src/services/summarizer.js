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
    model: 'gemini-1.5-flash',
    generationConfig: {
      responseMimeType: 'application/json'
    }
  });
}

function buildSummarizationPrompt(cleanedText) {
  return `You are an expert privacy auditor. Analyze the following privacy policy text and return strictly a JSON object with exactly these 6 keys:
- dataCollected: What personal data is collected? (1-2 sentences)
- thirdPartySharing: Who is data shared with or sold to? (1-2 sentences)
- retention: How long is data retained? (1-2 sentences)
- userRights: What rights do users have (access, delete, opt-out)? (1-2 sentences)
- cookies: What tracking technologies or cookies are used? (1-2 sentences)
- accountDeletion: How can a user delete their account or data? (1-2 sentences)

Return ONLY valid JSON with exactly these 6 keys and string values. Do not include any preamble, markdown formatting, or extra explanations.

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
    const requiredKeys = [
      'dataCollected',
      'thirdPartySharing',
      'retention',
      'userRights',
      'cookies',
      'accountDeletion'
    ];

    for (const key of requiredKeys) {
      if (!parsedObject[key] || typeof parsedObject[key] !== 'string') {
        throw new Error(`Missing or invalid required summary field: ${key}`);
      }
      parsedObject[key] = parsedObject[key].trim();
    }

    return {
      dataCollected: parsedObject.dataCollected,
      thirdPartySharing: parsedObject.thirdPartySharing,
      retention: parsedObject.retention,
      userRights: parsedObject.userRights,
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

    const model = getGeminiModel();
    const prompt = buildSummarizationPrompt(cleanedText);

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

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
