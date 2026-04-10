import { sentrySvelteKit } from "@sentry/sveltekit";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [
    sentrySvelteKit({
      org: "andrew-lou",
      project: "lightkeepers",
      authToken: process.env.SENTRY_AUTH_TOKEN,
    }),
    tailwindcss(),
    sveltekit(),
  ],
  build: {
    sourcemap: true,
  },
});
