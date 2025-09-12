import type { Config } from "tailwindcss";

/**
 * Tailwind CSS Configuration
 * 
 * This configuration centralizes all theme colors for the mini app.
 * To change the app's color scheme, simply update the 'primary' color value below.
 * 
 * Example theme changes:
 * - Blue theme: primary: "#3182CE"
 * - Green theme: primary: "#059669" 
 * - Red theme: primary: "#DC2626"
 * - Orange theme: primary: "#EA580C"
 */
export default {
    darkMode: "media",
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			'sans': ['Inter', 'system-ui', 'sans-serif'],
  			'display': ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
  			'body': ['Inter', 'system-ui', 'sans-serif'],
  		},
  		colors: {
  			// Done Drinks inspired colorful theme
  			primary: "#FF6B9D", // Vibrant pink
  			"primary-light": "#FFB3D1", // Light pink
  			"primary-dark": "#E91E63", // Deep pink
  			
  			// Secondary colorful palette
  			secondary: "#FFE4E1", // Light pink background
  			"secondary-dark": "#1a1a1a", // Dark background
  			
  			// Accent colors inspired by Done Drinks
  			accent: {
  				orange: "#FF8A65",
  				yellow: "#FFD54F", 
  				green: "#81C784",
  				blue: "#64B5F6",
  				purple: "#BA68C8",
  				coral: "#FFAB91",
  			},
  			
  			// Background gradients
  			gradient: {
  				pink: "linear-gradient(135deg, #FF6B9D 0%, #FFB3D1 100%)",
  				colorful: "linear-gradient(135deg, #FF6B9D 0%, #FF8A65 25%, #FFD54F 50%, #81C784 75%, #64B5F6 100%)",
  				warm: "linear-gradient(135deg, #FFE4E1 0%, #FFF0F5 100%)",
  			},
  			
  			// Legacy CSS variables for backward compatibility
  			background: 'var(--background)',
  			foreground: 'var(--foreground)'
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		// Custom spacing for consistent layout
  		spacing: {
  			'18': '4.5rem',
  			'88': '22rem',
  		},
  		// Custom container sizes
  		maxWidth: {
  			'xs': '20rem',
  			'sm': '24rem',
  			'md': '28rem',
  			'lg': '32rem',
  			'xl': '36rem',
  			'2xl': '42rem',
  		}
  	}
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
