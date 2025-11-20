/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
            },
            colors: {
                background: "var(--bg-body)",
                sidebar: "var(--bg-sidebar)",
                card: "var(--bg-card)",
                primary: "var(--text-primary)",
                secondary: "var(--text-secondary)",
                accent: "var(--accent)",
            }
        },
    },
    plugins: [],
}
