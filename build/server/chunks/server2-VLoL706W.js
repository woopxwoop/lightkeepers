import { f as resolve_route, i as initial_base, b as base } from './routing-Cz2vwfLK.js';
import { t as try_get_request_store } from './event-ByDKS2H7.js';

function resolve(id, params) {
  const resolved = resolve_route(
    id,
    /** @type {Record<string, string>} */
    params
  );
  {
    const store = try_get_request_store();
    if (store && !store.state.prerendering?.fallback) {
      const after_base = store.event.url.pathname.slice(initial_base.length);
      const segments = after_base.split("/").slice(2);
      const prefix = segments.map(() => "..").join("/") || ".";
      return prefix + resolved;
    }
  }
  return base + resolved;
}

export { resolve as r };
//# sourceMappingURL=server2-VLoL706W.js.map
