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
		client: {start:"_app/immutable/entry/start.DNJw0MGR.js",app:"_app/immutable/entry/app.B-Kxbeeb.js",imports:["_app/immutable/entry/start.DNJw0MGR.js","_app/immutable/chunks/DKmbPrPL.js","_app/immutable/chunks/BSb2eMsA.js","_app/immutable/chunks/BU6LsiZ-.js","_app/immutable/chunks/DRjqej-u.js","_app/immutable/entry/app.B-Kxbeeb.js","_app/immutable/chunks/BSb2eMsA.js","_app/immutable/chunks/CgMrI_UP.js","_app/immutable/chunks/DRjqej-u.js","_app/immutable/chunks/CDGjeiwp.js","_app/immutable/chunks/DQ88BSMr.js","_app/immutable/chunks/BgLDB_s0.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./chunks/0-ByW7Cz4q.js')),
			__memo(() => import('./chunks/1-JpOILyvT.js')),
			__memo(() => import('./chunks/2-BNDzf8ND.js')),
			__memo(() => import('./chunks/3-CrDeZtAu.js')),
			__memo(() => import('./chunks/4-Dvy9BmhO.js')),
			__memo(() => import('./chunks/5-BMNxujas.js')),
			__memo(() => import('./chunks/6-DJfOPPFQ.js'))
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
