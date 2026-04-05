// eslint-disable-next-line n/prefer-global/process
const IN_WEBCONTAINER = !!globalThis.process?.versions?.webcontainer;

/** @import { RequestEvent } from '@sveltejs/kit' */
/** @import { RequestStore } from 'types' */
/** @import { AsyncLocalStorage } from 'node:async_hooks' */


/** @type {RequestStore | null} */
let sync_store = null;

/** @type {AsyncLocalStorage<RequestStore | null> | null} */
let als;

import('node:async_hooks')
	.then((hooks) => (als = new hooks.AsyncLocalStorage()))
	.catch(() => {
		// can't use AsyncLocalStorage, but can still call getRequestEvent synchronously.
		// this isn't behind `supports` because it's basically just StackBlitz (i.e.
		// in-browser usage) that doesn't support it AFAICT
	});

function try_get_request_store() {
	return sync_store ?? als?.getStore() ?? null;
}

/**
 * @template T
 * @param {RequestStore | null} store
 * @param {() => T} fn
 */
function with_request_store(store, fn) {
	try {
		sync_store = store;
		return als ? als.run(store, fn) : fn();
	} finally {
		// Since AsyncLocalStorage is not working in webcontainers, we don't reset `sync_store`
		// and handle only one request at a time in `src/runtime/server/index.js`.
		if (!IN_WEBCONTAINER) {
			sync_store = null;
		}
	}
}

export { try_get_request_store as t, with_request_store as w };
//# sourceMappingURL=event-ByDKS2H7.js.map
