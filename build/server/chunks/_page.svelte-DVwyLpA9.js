import './async-DQWyIeIz.js';
import { s as store_get, u as unsubscribe_stores } from './index2-D5WVixXB.js';
import { e as charactersOwned, f as allTeamsAbyss, t as teamsOwned } from './stores-CzW-3W-X.js';
import { s as solveAbyssWithFallback } from './solver-my5EzbqM.js';
import './index-BWYQ_Nod.js';
import '@supabase/supabase-js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data } = $$props;
    data.mapping;
    let ownedNames = new Set(store_get($$store_subs ??= {}, "$charactersOwned", charactersOwned).filter((c) => c.isOwned).map((c) => c.name));
    solveAbyssWithFallback(store_get($$store_subs ??= {}, "$teamsOwned", teamsOwned), store_get($$store_subs ??= {}, "$allTeamsAbyss", allTeamsAbyss), ownedNames, 3);
    $$renderer2.push(`<main class="w-[80%] pb-20 flex flex-col gap-6">`);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<p class="text-(--intermediate-color)">Loading teams…</p>`);
    }
    $$renderer2.push(`<!--]--></main>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DVwyLpA9.js.map
