# CHOWKAR - Localization (i18n) Guide

## 1. Strategy
We currently support **English (en)** and **Hindi (hi)**.
The architecture is designed to support 10+ Indian languages (Marathi, Tamil, Bengali, etc.) in the future.

---

## 2. Translation JSON Structure
All static strings must reside in `constants.ts` or a dedicated locale folder. **No hardcoded strings in components.**

### 2.1 Data Structure
```typescript
export const TRANSLATIONS = {
  en: {
    hello: "Hello",
    role_worker: "Worker",
    dynamic_msg: "You have {count} bids" // Use placeholders
  },
  hi: {
    hello: "नमस्ते",
    role_worker: "मजदूर",
    dynamic_msg: "आपके पास {count} बोलियाँ हैं"
  }
};
```

### 2.2 Handling Dynamic Content
For sentences with variables, avoid string concatenation (`"You have " + count + " bids"`).
**Why?** Word order changes in Indian languages.
*   *English:* "Posted by Raj"
*   *Hindi:* "Raj द्वारा पोस्ट किया गया" (Name comes first)
*   **Solution:** Use a replacement helper function:
    ```typescript
    t('posted_by', { name: 'Raj' })
    ```

---

## 3. Adding a New Language (e.g., Marathi)

1.  **Update Types:** Add `'mr'` to the `Language` type definition.
2.  **Add Keys:** Copy the `en` object in `TRANSLATIONS` and rename to `mr`.
3.  **Translate:**
    *   Use native script (Devanagari for Marathi).
    *   **Context matters:** "Labor" can translate to "Hard work" (Mehnat) or "Worker" (Majdoor). Ensure the context of *Worker Role* is used.
4.  **Update Gemini Prompts:**
    *   In `geminiService.ts`, add a mapping: `const langName = language === 'mr' ? 'Marathi' : ...`
    *   Ensure the AI prompt explicitly asks for output in Marathi script.

---

## 4. Voice Support Matrix
Not all browsers support TTS (Text-to-Speech) for all Indian languages.

| Language | Code | Android Support | iOS Support | Fallback |
| :--- | :--- | :--- | :--- | :--- |
| Hindi | `hi-IN` | Excellent | Good | English |
| Marathi | `mr-IN` | Good | Limited | Hindi |
| Tamil | `ta-IN` | Good | Good | English |

**Logic:** If `window.speechSynthesis.getVoices()` does not contain the target lang, show a toast: *"Voice not supported on this device"* and hide the speaker icon.
