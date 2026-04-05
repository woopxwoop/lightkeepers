import { e as escape_html } from './async-DQWyIeIz.js';
import { s as store_get, b as attr_style, a as attr, u as unsubscribe_stores, c as stringify } from './index2-D5WVixXB.js';
import { e as charactersOwned, n as nearMissStygianLoaded, i as nearMissPairLoaded, h as teamsOwnedStygian } from './stores-CzW-3W-X.js';
import { f as favicon } from './favicon-CEPX-Z9J.js';
import './index-BWYQ_Nod.js';
import '@supabase/supabase-js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    var $$store_subs;
    let { data } = $$props;
    data.mapping;
    let pageState = "idle";
    let ownedCount = store_get($$store_subs ??= {}, "$charactersOwned", charactersOwned).filter((c) => c.isOwned).length;
    let nearMissReady = store_get($$store_subs ??= {}, "$nearMissStygianLoaded", nearMissStygianLoaded) && store_get($$store_subs ??= {}, "$nearMissPairLoaded", nearMissPairLoaded) || store_get($$store_subs ??= {}, "$teamsOwnedStygian", teamsOwnedStygian).length === 0;
    $$renderer2.push(`<main class="w-[92%] md:w-[80%] pb-20 flex flex-col gap-8"><div class="flex flex-col gap-1"><div class="flex items-center justify-between"><div class="flex flex-col gap-1"><h2 class="tracking-widest uppercase text-(--intermediate-color)">Pull Suggestions</h2> <p class="text-(--intermediate-color)">Based on your ${escape_html(ownedCount)} characters — Stygian Onslaught</p></div> <div class="text-xs px-2 py-1 rounded bg-red-900/40 text-red-300 font-mono"${attr_style(`display: ${stringify("none")};`)}><div>ready: ${escape_html(nearMissReady)}</div> <div>single: ${escape_html(store_get($$store_subs ??= {}, "$nearMissStygianLoaded", nearMissStygianLoaded))}</div> <div>pair: ${escape_html(store_get($$store_subs ??= {}, "$nearMissPairLoaded", nearMissPairLoaded))}</div> <div>state: ${escape_html(pageState)}</div></div></div></div> `);
    {
      $$renderer2.push("<!--[-->");
      $$renderer2.push(`<div class="rounded-2xl p-8 flex flex-col items-center gap-6 text-center" style="background: var(--surface-color); border: 0.5px solid var(--surface-border);"><img${attr("src", favicon)} alt="Lightkeepers" class="w-14 h-14"/> <div class="flex flex-col gap-2 max-w-sm"><p class="text-(--foreground-color) font-medium">Which characters are worth pulling?</p> <p class="text-(--intermediate-color)">We'll find single characters and synergistic pairs you don't own that
          would most improve your Stygian teams.</p></div> <button${attr("disabled", !nearMissReady, true)} class="px-6 py-2.5 rounded-lg font-medium transition-opacity"${attr_style(`background: color-mix(in srgb, var(--secondary-color) 10%, transparent); border: 0.5px solid color-mix(in srgb, var(--secondary-color) 35%, transparent); color: var(--secondary-color); opacity: ${stringify(nearMissReady ? "1" : "0.45")}; cursor: ${stringify(nearMissReady ? "pointer" : "default")};`)}>${escape_html(nearMissReady ? "Calculate suggestions" : "Loading data…")}</button></div>`);
    }
    $$renderer2.push(`<!--]--></main>`);
    if ($$store_subs) unsubscribe_stores($$store_subs);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-DP32FG4u.js.map
