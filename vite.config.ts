import { defineConfig } from "vite";

const { resolve } = import.meta;

export default defineConfig({
	build: {
		rollupOptions: {
			input: {
				main: resolve("./index.html"),
				studio: resolve("./studio/index.html"),
			},
		},
	},
});
