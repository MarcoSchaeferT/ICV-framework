import type { Config } from "tailwindcss";

const config: Config = {
	darkMode: ["class", "dark"],
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
		//"./node_modules/@material-tailwind/react/**/*.{js,ts,jsx,tsx}"
	],
	theme: {
		extend: {
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))'
			},
			screens: {
				lg: '1100px'
			},
			fontFamily: {
				sans: ['Lato', 'sans-serif'],
				serif: ['DM Serif Display', 'serif']
			},
			colors: {
				accent: '#426DD0',
				sidebar: '#262626',
				'sidebar-foreground': '#FFFFFF',
				'sidebar-primary': '#171717',
				'sidebar-primary-foreground': '#FFFFFF',
				'sidebar-accent': '#426DD0',
				'sidebar-accent-foreground': '#FFFFFF',
				'sidebar-border': '#171717',
				'sidebar-ring': '#426DD0',
				background: '#DCDDD9',
				foreground: '#747474',
				text: {
					default: '#272829',
					dark: '#000000',
					light: '#D8D9DA',
					foreground: '#61677A'
				},
				surface: {
					default: '#f5f6f3',
					dark: '#b8b9b6',
					light: '#fefefe',
					foreground: '#dddddb'
				},
				primary: {
					default: '#9b9b9b',
					dark: '#747474',
					light: '#f5f5f5',
					foreground: '#e0e0e0'
				},
				secondary: {
					default: '#E5E7EB',
					dark: '#2D2B34',
					light: '#F9FAFB',
					foreground: '#030712'
				},
				info: {
					default: '#2563EB',
					dark: '#1D4ED8',
					light: '#3B82F6',
					foreground: '#F9FAFB'
				},
				success: {
					default: '#16A34A',
					dark: '#15803D',
					light: '#22C55E',
					foreground: '#F9FAFB'
				},
				warning: {
					default: '#EAB308',
					dark: '#CA8A04',
					light: '#FACC15',
					foreground: '#030712'
				},
				error: {
					default: '#DC2626',
					dark: '#B91C1C',
					light: '#EF4444',
					foreground: '#F9FAFB'
				}
			},
			darkColors: {
				background: '#030712',
				foreground: '#9CA3AF',
				text: {
					default: '#272829',
					dark: '#000000',
					light: '#D8D9DA',
					foreground: '#61677A'
				},
				surface: {
					default: '#1F2937',
					dark: '#F9FAFB',
					light: '#111827',
					foreground: '#E5E7EB'
				},
				primary: {
					default: '#F3F4F6',
					dark: '#E5E7EB',
					light: '#F9FAFB',
					foreground: '#030712'
				},
				secondary: {
					default: '#1F2937',
					dark: '#111827',
					light: '#374151',
					foreground: '#F9FAFB'
				},
				info: {
					default: '#3B82F6',
					dark: '#60A5FA',
					light: '#2563EB',
					foreground: '#030712'
				},
				success: {
					default: '#22C55E',
					dark: '#16A34A',
					light: '#4ADE80',
					foreground: '#030712'
				},
				warning: {
					default: '#FACC15',
					dark: '#EABC08',
					light: '#FDE047',
					foreground: '#030712'
				},
				error: {
					default: '#EF4444',
					dark: '#DC2626',
					light: '#F87171',
					foreground: '#030712'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				"accordion-down": "accordion-down 300ms ease-out ",
				"accordion-up": "accordion-up 300ms ease-out ",
			}
		}
	},
	plugins: [
		require("tailwindcss-animate"),
		require('@tailwindcss/typography')
	],
};
export default config;
