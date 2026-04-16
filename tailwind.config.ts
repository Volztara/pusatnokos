import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class', // ✅ WAJIB: aktifkan dark mode berbasis class
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config