import adapter from "@sveltejs/adapter-node";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    // paths: {
    //   base: process.argv.includes("dev") ? "" : process.env.BASE_PATH,
    // },
    adapter: adapter({
      // default options are shown. On some platforms
      // these options are set automatically — see below
      pages: "build",
      assets: "build",
      fallback: undefined,
      precompress: false,
      strict: true,
    }),

    experimental: {
      tracing: {
        server: true,
      },

      instrumentation: {
        server: true,
      },
    },
  },
  compilerOptions: {
    experimental: {
      async: true,
    },
  },
};

export default config;