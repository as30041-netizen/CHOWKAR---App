import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

let aiInstance: GoogleGenerativeAI | null = null;

const getAI = (): GoogleGenerativeAI | null => {
  if (!aiInstance) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey || apiKey === 'your-api-key-here') {
      console.warn('[GeminiService] Gemini API key not configured - AI features will be disabled');
      return null;
    }
    aiInstance = new GoogleGenerativeAI(apiKey);
  }
  return aiInstance;
};

export const enhanceJobDescriptionStream = async (
  shortInput: string,
  category: string,
  language: 'en' | 'hi' = 'en',
  onUpdate: (text: string) => void
): Promise<void> => {
  try {
    const ai = getAI();
    if (!ai) {
      console.warn('[GeminiService] AI not available, using original text');
      onUpdate(shortInput);
      return;
    }

    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const langName = language === 'hi' ? 'Hindi' : 'English';

    const prompt = `
      You are an assistant for a job posting app in rural India.
      A user wants to post a job in the category "${category}".
      Their raw input is: "${shortInput}".

      Rewrite this into a clear, professional, yet simple job description in ${langName} that attracts workers.
      If the input is in a mix of languages (Hinglish), fully convert it to proper ${langName}.
      Keep it under 60 words. Do not add formatting like markdown bolding. Just plain text.
    `;

    const result = await model.generateContentStream(prompt);

    let fullText = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;
      onUpdate(fullText);
    }
  } catch (error) {
    console.error("Error generating description:", error);
    onUpdate(shortInput); // Fallback to original
  }
};

export const estimateWage = async (title: string, category: string, location: string): Promise<string> => {
  try {
    const ai = getAI();
    if (!ai) {
      console.warn('[GeminiService] AI not available, cannot estimate wage');
      return '';
    }

    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
      You are a labor market expert in India.
      Estimate the typical daily wage (8 hours) in Indian Rupees (INR) for a "${title}" job in the category "${category}" located in "${location}".
      Consider tier-2/3 city rates.
      Return ONLY a single number representing the average (e.g. 500). Do not provide a range, do not add text, do not add currency symbols.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    const text = response.text().trim();
    // Extract number from response just in case
    const match = text.match(/\d+/);
    return match ? match[0] : '';
  } catch (error) {
    console.error("Error estimating wage:", error);
    return '';
  }
};

export const enhanceBidMessageStream = async (
  draft: string,
  jobTitle: string,
  language: 'en' | 'hi' = 'en',
  onUpdate: (text: string) => void
): Promise<void> => {
  try {
    const ai = getAI();
    if (!ai) {
      console.warn('[GeminiService] AI not available, using original text');
      onUpdate(draft);
      return;
    }

    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const langName = language === 'hi' ? 'Hindi' : 'English';

    const prompt = `
      You are an assistant helping a worker apply for a job.
      The job title is "${jobTitle}".
      The worker's draft message is: "${draft}".

      Rewrite this message in ${langName} to be polite, professional, and convincing.
      Highlight reliability and willingness to work hard.
      Keep it short (under 30 words).
      Do not add placeholders like [Your Name]. Just the message content.
    `;

    const result = await model.generateContentStream(prompt);

    let fullText = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      fullText += text;
      onUpdate(fullText);
    }
  } catch (error) {
    console.error("Error generating bid message:", error);
    onUpdate(draft);
  }
};

export const translateText = async (text: string, targetLanguage: 'en' | 'hi' = 'en'): Promise<string> => {
  try {
    const ai = getAI();
    if (!ai) {
      console.warn('[GeminiService] AI not available, returning original text');
      return text;
    }

    const model = ai.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const langName = targetLanguage === 'hi' ? 'Hindi' : 'English';

    const prompt = `
      Translate the following text to ${langName}.
      Keep the tone casual and conversational suitable for a chat between a worker and an employer.
      Text: "${text}"
      Return ONLY the translated text. No explanations.
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;

    return response.text() || text;
  } catch (error) {
    console.error("Error translating text:", error);
    return text;
  }
};

export const analyzeImageForJob = async (
  base64Data: string,
  mimeType: string,
  language: 'en' | 'hi' = 'en'
): Promise<{ description: string; category: string } | null> => {
  try {
    const ai = getAI();
    if (!ai) {
      console.warn('[GeminiService] AI not available, cannot analyze image');
      return null;
    }

    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            description: { type: SchemaType.STRING },
            category: { type: SchemaType.STRING }
          }
        }
      }
    });
    const langName = language === 'hi' ? 'Hindi' : 'English';

    const prompt = `
      Analyze this image of a potential job site or task.
      1. Write a short, clear job description (max 2 sentences) describing the work needed based on what you see (e.g. "Fix broken PVC pipe", "Harvest wheat field").
         - Write the description in ${langName}.
      2. Suggest the best category from: Farm Labor, Construction, Plumbing, Electrical, Driver, Cleaning, Delivery, Other.
         - The category MUST remain in English (e.g., 'Farm Labor', not translated) to match system keys.
      If unsure, default to 'Other'.
    `;

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: mimeType,
          data: base64Data
        }
      },
      { text: prompt }
    ]);

    const response = await result.response;
    const text = response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error("Image Analysis failed", e);
    return null;
  }
};

export const matchJobToWorker = async (
  workerSkills: string[],
  workerBio: string,
  jobTitle: string,
  jobDescription: string
): Promise<{ score: number; reason: string } | null> => {
  try {
    const ai = getAI();
    if (!ai) return null;

    const model = ai.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            score: { type: SchemaType.NUMBER },
            reason: { type: SchemaType.STRING }
          }
        }
      }
    });

    const prompt = `
      Compare this Worker to this Job for a labor marketplace in India.
      Worker Skills: ${workerSkills.join(', ')}
      Worker Bio: ${workerBio}
      
      Job Title: ${jobTitle}
      Job Description: ${jobDescription}
      
      Calculate a compatibility score from 0 to 100.
      Also provide a 1-sentence reason in simple English (e.g. "You have all the required farming skills").
      Return as JSON with keys "score" and "reason".
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error("Magic Match failed", e);
    return null;
  }
};