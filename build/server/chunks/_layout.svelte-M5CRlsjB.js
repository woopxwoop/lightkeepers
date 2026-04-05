import './async-DQWyIeIz.js';
import { h as head, a as attr } from './index2-D5WVixXB.js';
import { f as favicon } from './favicon-CEPX-Z9J.js';
import { p as page } from './index3-Dsc1_8rU.js';
import { r as resolve } from './server2-VLoL706W.js';
import './stores-CzW-3W-X.js';
import './index-BWYQ_Nod.js';
import './event-ByDKS2H7.js';
import './exports-CVNDNXAt.js';
import './routing-Cz2vwfLK.js';
import '@supabase/supabase-js';

function _layout($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let { data, children } = $$props;
    data.characters;
    const homePath = resolve("/");
    const abyssPath = resolve("/abyss");
    const stygianPath = resolve("/stygian");
    const pullsPath = resolve("/pulls");
    const settingsPath = resolve("/settings");
    head("12qhfyh", $$renderer2, ($$renderer3) => {
      $$renderer3.push(`<link rel="icon"${attr("href", favicon)} type="image/svg+xml"/>`);
    });
    $$renderer2.push(`<div class="w-full flex flex-col items-center"><nav class="nav-bar w-full fixed top-0 z-10 flex items-center justify-between px-4 md:px-8 h-12"><a${attr("href", homePath)} class="nav-logo shrink-0"${attr("aria-current", page.url.pathname === homePath ? "page" : void 0)}>LIGHTKEEPERS</a> <div class="flex items-center gap-3 md:gap-6 relative"><a${attr("href", abyssPath)} class="nav-link"${attr("aria-current", page.url.pathname === abyssPath ? "page" : void 0)}>Abyss</a> <a${attr("href", stygianPath)} class="nav-link"${attr("aria-current", page.url.pathname === stygianPath ? "page" : void 0)}>Stygian</a> <a${attr("href", pullsPath)} class="nav-link"${attr("aria-current", page.url.pathname === pullsPath ? "page" : void 0)}>Pulls</a> <a${attr("href", settingsPath)} class="nav-link"${attr("aria-current", page.url.pathname === settingsPath ? "page" : void 0)}>Settings</a> `);
    {
      $$renderer2.push("<!--[!-->");
    }
    $$renderer2.push(`<!--]--></div></nav> <div class="h-12 w-full"></div> <div class="w-full flex flex-col items-center pt-6 md:pt-8"><!---->`);
    {
      $$renderer2.push(`<div class="w-full flex flex-col items-center">`);
      children($$renderer2);
      $$renderer2.push(`<!----></div>`);
    }
    $$renderer2.push(`<!----></div></div>`);
  });
}

export { _layout as default };
//# sourceMappingURL=_layout.svelte-M5CRlsjB.js.map
