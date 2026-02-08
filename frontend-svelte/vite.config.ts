import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit(), tailwindcss()],
	server: {
		host: '0.0.0.0',
		port: 5173,
		proxy: {
			'/api': 'http://localhost:3000',
			'/health': 'http://localhost:3000'
		}
	}
});
