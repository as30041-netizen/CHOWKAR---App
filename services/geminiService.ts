import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

const getAI = (): GoogleGenAI => {
  if (!aiInstance) {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[GeminiService] Missing VITE_GEMINI_API_KEY environment variable');
      throw new Error('Gemini API key not configured');
    }
    aiInstance = new GoogleGenAI({ apiKey });
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
    const model = 'gemini-2.5-flash';
    const langName = language === 'hi' ? 'Hindi' : 'English';
    
    const prompt = `
      You are an assistant for a job posting app in rural India. 
      A user wants to post a job in the category "${category}". 
      Their raw input is: "${shortInput}".
      
      Rewrite this into a clear, professional, yet simple job description in ${langName} that attracts workers. 
      If the input is in a mix of languages (Hinglish), fully convert it to proper ${langName}.
      Keep it under 60 words. Do not add formatting like markdown bolding. Just plain text.
    `;

    const response = await getAI().models.generateContentStream({
      model: model,
      contents: prompt,
    });

    let fullText = '';
    for await (const chunk of response) {
      const text = chunk.text || '';
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
    const model = 'gemini-2.5-flash';
    const prompt = `
      You are a labor market expert in India. 
      Estimate the typical daily wage (8 hours) in Indian Rupees (INR) for a "${title}" job in the category "${category}" located in "${location}".
      Consider tier-2/3 city rates.
      Return ONLY a single number representing the average (e.g. 500). Do not provide a range, do not add text, do not add currency symbols.
    `;

    const response = await getAI().models.generateContent({
      model: model,
      contents: prompt,
    });

    const text = response.text?.trim() || '';
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
    const model = 'gemini-2.5-flash';
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

    const response = await getAI().models.generateContentStream({
      model: model,
      contents: prompt,
    });

    let fullText = '';
    for await (const chunk of response) {
        const text = chunk.text || '';
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
    const model = 'gemini-2.5-flash';
    const langName = targetLanguage === 'hi' ? 'Hindi' : 'English';
    
    const prompt = `
      Translate the following text to ${langName}. 
      Keep the tone casual and conversational suitable for a chat between a worker and an employer.
      Text: "${text}"
      Return ONLY the translated text. No explanations.
    `;

    const response = await getAI().models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || text;
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
    // Use gemini-2.5-flash for multimodal analysis with JSON output support.
    const model = 'gemini-2.5-flash';
    const langName = language === 'hi' ? 'Hindi' : 'English';
    
    const prompt = `
      Analyze this image of a potential job site or task. 
      1. Write a short, clear job description (max 2 sentences) describing the work needed based on what you see (e.g. "Fix broken PVC pipe", "Harvest wheat field").
         - Write the description in ${langName}.
      2. Suggest the best category from: Farm Labor, Construction, Plumbing, Electrical, Driver, Cleaning, Delivery, Other.
         - The category MUST remain in English (e.g., 'Farm Labor', not translated) to match system keys.
      If unsure, default to 'Other'.
    `;

    const response = await getAI().models.generateContent({
      model: model,
      contents: {
        parts: [
            {
                inlineData: {
                    mimeType: mimeType,
                    data: base64Data
                }
            },
            { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                description: { type: Type.STRING },
                category: { type: Type.STRING }
            }
        }
      }
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (e) {
    console.error("Image Analysis failed", e);
    return null;
  }
};