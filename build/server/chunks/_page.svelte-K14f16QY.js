import './async-DQWyIeIz.js';
import { s as store_get, u as unsubscribe_stores } from './index2-D5WVixXB.js';
import { r as resolve } from './server2-VLoL706W.js';
import { e as charactersOwned, f as allTeamsAbyss, t as teamsOwned, g as allTeamsStygian, h as teamsOwnedStygian } from './stores-CzW-3W-X.js';
import { s as solveAbyssWithFallback, a as solveStygianWithFallback } from './solver-my5EzbqM.js';
import './index-BWYQ_Nod.js';
import './routing-Cz2vwfLK.js';
import './event-ByDKS2H7.js';
import '@supabase/supabase-js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data } = $$props;
    data.mapping;
    let ownedNames = new Set(store_get($$store_subs ??= {}, "$charactersOwned", charactersOwned).filter((c) => c.isOwned).map((c) => c.name));
    solveAbyssWithFallback(store_get($$store_subs ??= {}, "$teamsOwned", teamsOwned), store_get($$store_subs ??= {}, "$allTeamsAbyss", allTeamsAbyss), ownedNames, 1)[0] ?? null;
    solveStygianWithFallback(store_get($$store_subs ??= {}, "$teamsOwnedStygian", teamsOwnedStygian), store_get($$store_subs ??= {}, "$allTeamsStygian", allTeamsStygian), ownedNames, 1)[0] ?? null;
    store_get($$store_subs ??= {}, "$charactersOwned", charactersOwned).filter((c) => c.isOwned).length;
    resolve("/settings");
    resolve("/abyss");
    resolve("/stygian");
    $$renderer2.push(`<main class="w-[92%] md:w-[80%] pb-20">`);
    {
      $$renderer2.push("<!--[-->");
    }
    $$renderer2.push(`<!--]--></main>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-K14f16QY.js.map
