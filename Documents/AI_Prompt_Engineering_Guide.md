# CHOWKAR - AI Prompt Engineering Guide

## 1. AI Philosophy
The AI in CHOWKAR is not a "Chatbot". It is an **Infrastructure Utility**. It acts as a translator and secretary for users who may not be comfortable typing formal text.
*   **Model:** `gemini-2.5-flash` (Chosen for speed/cost).
*   **Persona:** Professional, Simple, Direct. No flowery language.

---

## 2. Prompt Registry

### 2.1 Job Description Enhancer
**Context:** User provides raw, broken text. AI formats it.
**Current Prompt:**
```text
You are an assistant for a job posting app in rural India. 
A user wants to post a job in the category "${category}". 
Their raw input is: "${shortInput}".

Rewrite this into a clear, professional, yet simple job description in ${langName} that attracts workers. 
If the input is in a mix of languages (Hinglish), fully convert it to proper ${langName}.
Keep it under 60 words. Do not add formatting like markdown bolding. Just plain text.
```
**Tuning Notes:**
*   *Issue:* Sometimes generates headers like "Job Title: ...".
*   *Fix:* Add negative constraint: "Do not include a title or subject line."

### 2.2 Wage Estimator
**Context:** Provide price guidance.
**Current Prompt:**
```text
You are a labor market expert in India. 
Estimate the typical daily wage (8 hours) in Indian Rupees (INR) for a "${title}" job in the category "${category}" located in "${location}".
Consider tier-2/3 city rates.
Return ONLY a single number representing the average (e.g. 500). Do not provide a range, do not add text, do not add currency symbols.
```
**Tuning Notes:**
*   *Safety:* If the location is obscure, Gemini defaults to Delhi rates.
*   *Adjustment:* Add "If location is unknown, assume rural Maharashtra rates."

### 2.3 Image Analysis
**Context:** User uploads photo to auto-fill details.
**Current Prompt:**
```text
Analyze this image...
1. Write a short, clear job description (max 2 sentences)... in ${langName}.
2. Suggest the best category from: [List]... MUST remain in English.
If unsure, default to 'Other'.
```
**Tuning Notes:**
*   *JSON Mode:* Ensure `responseMimeType: "application/json"` is always set in the config, or the app will crash parsing the text.

---

## 3. Localization Strategy (Hinglish)
Our target users often type Hindi using English characters (Hinglish).
*   **Rule:** If the user input is Hinglish, and the target language is **English**, the AI must translate the *meaning*, not just transliterate.
*   **Rule:** If the target language is **Hindi**, the AI must output Devanagari script.

**Example Test:**
*   *Input:* "Khet me kaam hai"
*   *Target English:* "Farm work available." (Correct) / "Work in khet." (Incorrect)
*   *Target Hindi:* "खेत में काम उपलब्ध है।" (Correct)

## 4. Safety Guidelines
1.  **PII Filtering:** Ensure AI does not accidentally repeat phone numbers found in input text if rewriting descriptions (though job posts usually allow contact info, we might want to mask it until hiring).
2.  **Category Guardrails:** If an image contains unsafe content (weapons, nudity), the AI should return a specific error code or default to a safe fallback, effectively blocking the post creation.
