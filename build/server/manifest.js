const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["flins.png","robots.txt","thumbnail.png"]),
	mimeTypes: {".png":"image/png",".txt":"text/plain"},
	_: {
		client: {start:"_app/immutable/entry/start.BWIqpNP1.js",app:"_app/immutable/entry/app.eQDjmmxN.js",imports:["_app/immutable/entry/start.BWIqpNP1.js","_app/immutable/chunks/mHdhyLiY.js","_app/immutable/chunks/BjVHow7k.js","_app/immutable/chunks/CdO4tD-R.js","_app/immutable/chunks/CZBCpV8R.js","_app/immutable/entry/app.eQDjmmxN.js","_app/immutable/chunks/BjVHow7k.js","_app/immutable/chunks/DCqgLpfE.js","_app/immutable/chunks/CZBCpV8R.js","_app/immutable/chunks/CPZxMTfN.js","_app/immutable/chunks/BW1RHa-F.js","_app/immutable/chunks/VFqGNdSS.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-BSA6cMsS.js')),
			__memo(() => import('./chunks/1-Dz5qIw81.js')),
			__memo(() => import('./chunks/2-m16jYuiR.js')),
			__memo(() => import('./chunks/3-B57ZX9wY.js')),
			__memo(() => import('./chunks/4-I8tbAG9H.js')),
			__memo(() => import('./chunks/5-BKSBTr6S.js')),
			__memo(() => import('./chunks/6-HZAjU1n1.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/abyss",
				pattern: /^\/abyss\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/api/nearmiss",
				pattern: /^\/api\/nearmiss\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CcP0LOej.js'))
			},
			{
				id: "/api/static",
				pattern: /^\/api\/static\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-DTng7doR.js'))
			},
			{
				id: "/api/teams",
				pattern: /^\/api\/teams\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./chunks/_server.ts-CApTHDbj.js'))
			},
			{
				id: "/pulls",
				pattern: /^\/pulls\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 4 },
				endpoint: null
			},
			{
				id: "/settings",
				pattern: /^\/settings\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 5 },
				endpoint: null
			},
			{
				id: "/stygian",
				pattern: /^\/stygian\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 6 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

const prerendered = new Set([]);

const base = "";

export { base, manifest, prerendered };
//# sourceMappingURL=manifest.js.map
