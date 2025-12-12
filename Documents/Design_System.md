# CHOWKAR - Design System & Accessibility Standards

## 1. Core Philosophy: "Sunlight & Thumbs"
Our users often access the app outdoors in direct sunlight, on low-end smartphones with cracked screens.
*   **Contrast is King:** Text must be readable in glare.
*   **Big Targets:** Buttons must be tappable with rough/calloused hands.
*   **Visual > Text:** Icons should convey meaning without reading.

---

## 2. Color Palette (Tailwind Tokens)

### Primary (Trust & Agriculture)
*   **Emerald 600 (`#059669`)**: Primary Action Buttons. High contrast against white.
*   **Emerald 50 (`#ecfdf5`)**: Backgrounds. Reduces eye strain compared to pure white outdoors.

### Status Indicators
*   **Amber 500**: "Pending" or "Counter Offer". (Use stripes/patterns for colorblindness).
*   **Red 600**: "Rejected" or "Error".
*   **Blue 600**: "Info" or "AI Suggestion".

### Neutral
*   **Gray 900**: Headings.
*   **Gray 600**: Body text. (Never go lighter than Gray 500 for text).

---

## 3. Typography
**Font:** Inter (Sans-serif) for clean readability.
**Fallback:** System Sans.

### Hierarchy
1.  **Page Title:** 24px (Bold).
2.  **Card Title:** 18px (Bold).
3.  **Body Text:** 14px (Regular). **Minimum size.**
4.  **Meta Text:** 12px (Medium). *Avoid 10px unless absolutely necessary.*

---

## 4. Accessibility Guidelines (WCAG 2.1 AA+)

### 4.1 Touch Targets
*   **Minimum Size:** 48x48px for all interactive elements.
*   **Spacing:** Minimum 8px gap between buttons to prevent "Fat Finger" errors.

### 4.2 Non-Text Indicators
*   Do not rely on color alone.
*   *Bad:* Green border for "Accepted".
*   *Good:* Green border + Checkmark Icon + Text label "Accepted".

### 4.3 Voice & Audio
*   **TTS Indicator:** Use a pulsing animation when reading text aloud so the user knows the app is "speaking".
*   **Microphone:** Provide haptic feedback (vibration) when recording starts/stops.

### 4.4 Low-End Device Optimization
*   **Animations:** Use `transform` and `opacity` only. Avoid layout shifts.
*   **Images:** Lazy load all images. Provide distinct placeholders while loading (not just a spinner).
*   **Gradients:** Use minimal CSS gradients; they can cause banding on cheap screens.
