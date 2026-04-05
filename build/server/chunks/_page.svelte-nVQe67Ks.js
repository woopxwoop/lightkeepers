import { e as escape_html } from './async-DQWyIeIz.js';
import { e as ensure_array_like, b as attr_style } from './index2-D5WVixXB.js';
import './stores-CzW-3W-X.js';
import './index-BWYQ_Nod.js';
import '@supabase/supabase-js';

function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let tempCharactersOwned = [];
    let rarityFilter = "all";
    let search = "";
    let visibleCharacters = tempCharactersOwned.filter((c) => {
      const matchesSearch = search === "";
      return matchesSearch;
    });
    let ownedCount = tempCharactersOwned.filter((c) => c.isOwned).length;
    let totalCount = tempCharactersOwned.length;
    visibleCharacters.filter((c) => c.isOwned).length;
    $$renderer2.push(`<main class="w-[92%] md:w-[80%] pb-20 flex flex-col gap-6"><div class="flex items-center justify-between"><div class="flex flex-col gap-1"><h2 class="tracking-widest uppercase text-(--intermediate-color)">Roster</h2> <p class="text-xs text-(--faint-color)">${escape_html(ownedCount)} of ${escape_html(totalCount)} characters selected</p></div> <div class="flex items-center gap-1"><!--[-->`);
    const each_array = ensure_array_like([["all", "All"], ["5", "5★"], ["4", "4★"]]);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let [val, label] = each_array[$$index];
      $$renderer2.push(`<button class="text-xs px-3 py-1 rounded-lg transition-colors"${attr_style(rarityFilter === val ? "background: color-mix(in srgb, var(--secondary-color) 15%, transparent); color: var(--secondary-color); border: 0.5px solid color-mix(in srgb, var(--secondary-color) 40%, transparent);" : "background: transparent; color: var(--faint-color); border: 0.5px solid var(--surface-border);")}>${escape_html(label)}</button>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    {
      $$renderer2.push("<!--[!-->");
      $$renderer2.push(`<div class="flex items-center justify-center min-h-[40vh]"><p class="text-(--intermediate-color)">Loading…</p></div>`);
    }
    $$renderer2.push(`<!--]--></main>`);
  });
}

export { _page as default };
//# sourceMappingURL=_page.svelte-nVQe67Ks.js.map
