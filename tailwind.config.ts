import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'primary-brand': 'var(--primary-brand)',
        'primary-brand-hover': 'var(--primary-brand-hover)',
        'destructive': 'var(--destructive)',
        'destructive-hover': 'var(--destructive-hover)',
        'text-primary': 'var(--text-primary)',
        'text-secondary': 'var(--text-secondary)',
        'card-background': 'var(--card-background)',
        'border-color': 'var(--border-color)',
        'background': 'var(--background)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
