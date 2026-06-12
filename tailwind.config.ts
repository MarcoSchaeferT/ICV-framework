import type { Config } from "tailwindcss";

/**
 * Tailwind v4 — minimal compat stub.
 *
 * All theme customisations (colors, fonts, breakpoints, keyframes,
 * grid columns, border-radius) have been migrated to the CSS-first
 * approach in src/app/globals.css using @theme, @variant, @keyframes
 * and @plugin directives.
 *
 * This file is intentionally left minimal. Only keep options here that
 * cannot yet be expressed in CSS (e.g. complex plugin config objects).
 */
const config: Config = {
	// class-based dark mode — kept here so shadcn/radix components that
	// read tailwind.config.ts at build time get the correct strategy.
	darkMode: ["class", "dark"],
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
	],
};

export default config;
