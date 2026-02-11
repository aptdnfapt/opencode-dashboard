import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		// Static SPA — nginx serves index.html for all routes
		adapter: adapter({
			fallback: 'index.html'  // SPA fallback for client-side routing
		})
	}
};

export default config;
