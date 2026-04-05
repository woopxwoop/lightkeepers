import './async-DQWyIeIz.js';
import { s as store_get, u as unsubscribe_stores } from './index2-D5WVixXB.js';
import { e as charactersOwned, g as allTeamsStygian, h as teamsOwnedStygian } from './stores-CzW-3W-X.js';
import { a as solveStygianWithFallback } from './solver-my5EzbqM.js';
import './index-BWYQ_Nod.js';
import '@supabase/supabase-js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data } = $$props;
    data.mapping;
    let ownedNames = new Set(store_get($$store_subs ??= {}, "$charactersOwned", charactersOwned).filter((c) => c.isOwned).map((c) => c.name));
    solveStygianWithFallback(store_get($$store_subs ??= {}, "$teamsOwnedStygian", teamsOwnedStygian), store_get($$store_subs ??= {}, "$allTeamsStygian", allTeamsStygian), ownedNames, 3);
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
//# sourceMappingURL=_page.svelte-Dj0RY4F3.js.map
