import adapter from "@sveltejs/adapter-node";
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
    sveltekit({
      compilerOptions: { experimental: { async: true } },
      version: {
        // Poll for new deployments so client-side navigations hard-reload before stale chunks 404.
        pollInterval: 60_000,
      },

      // paths: {
      //   base: process.argv.includes("dev") ? "" : process.env.BASE_PATH,
      // },
      adapter: adapter({
        out: "build",
        precompress: true,
      }),
      tracing: { server: true },
    }),
  ],
  build: {
    sourcemap: true,
  },
});
