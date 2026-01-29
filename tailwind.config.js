/** @type {import('tailwindcss').Config} */
export default {
    darkMode: 'class',
    content: [
        "./index.html",
        "./{components,pages,contexts,hooks,lib,services}/**/*.{js,ts,jsx,tsx}",
        "./*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'Noto Sans Devanagari', 'Noto Sans Gurmukhi', 'system-ui', 'sans-serif'],
                heading: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
                hindi: ['Noto Sans Devanagari', 'sans-serif'],
                punjabi: ['Noto Sans Gurmukhi', 'sans-serif'],
            },
            colors: {
                // Semantic Colors (Mapped to CSS Variables)
                background: 'var(--bg-base)',
                surface: 'var(--bg-card)',
                primary: 'var(--primary)',
                'primary-foreground': '#ffffff',
                border: 'var(--border-subtle)',
                muted: 'var(--text-muted)',
                'text-primary': 'var(--text-primary)',
                'text-secondary': 'var(--text-secondary)',
            },
            borderRadius: {
                'squircle': '1.25rem', // ~20px
                '2xl': '1rem',
                '3xl': '1.5rem',
            },
            boxShadow: {
                'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.12)',
                'elevation': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            }
        },
    },
    plugins: [],
}
