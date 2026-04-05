import { w as writeLatestAbyssVersion, a as writeLatestStygianVersion, b as writeAllStygianTeams, c as writeAllAbyssTeams, d as db } from './stores-CzW-3W-X.js';
import './index-BWYQ_Nod.js';
import '@supabase/supabase-js';

async function load() {
  let mapping = /* @__PURE__ */ new Map();
  let characters = [];
  const getCharacterMapping = async () => {
    const { data, error: err } = await db.from("url_to_character_mapping").select("*");
    if (err) {
      throw new Error(err.message);
    } else {
      let arr = data;
      arr.forEach((m) => {
        mapping.set(m.character_name, m.url);
      });
    }
    console.log("got mapping");
  };
  const getCharacterData = async () => {
    const { data, error: err } = await db.from("characters").select("*").order("name", { ascending: true });
    if (err) {
      throw new Error(err.message);
    } else {
      characters = data;
    }
    console.log("got data");
  };
  {
    try {
      await Promise.all([
        writeLatestAbyssVersion(),
        writeLatestStygianVersion(),
        getCharacterMapping(),
        getCharacterData()
      ]);
      await Promise.all([writeAllStygianTeams(), writeAllAbyssTeams()]);
    } catch (e) {
      console.log("unexpected error");
      console.log(e);
    }
  }
  return {
    mapping,
    characters
  };
}

var _layout_ts = /*#__PURE__*/Object.freeze({
  __proto__: null,
  load: load
});

const index = 0;
let component_cache;
const component = async () => component_cache ??= (await import('./_layout.svelte-M5CRlsjB.js')).default;
const universal_id = "src/routes/+layout.ts";
const imports = ["_app/immutable/nodes/0.BoxyTDib.js","_app/immutable/chunks/Db088TTf.js","_app/immutable/chunks/BSb2eMsA.js","_app/immutable/chunks/CgMrI_UP.js","_app/immutable/chunks/DRjqej-u.js","_app/immutable/chunks/CDGjeiwp.js","_app/immutable/chunks/DQ88BSMr.js","_app/immutable/chunks/BAFOR_YK.js","_app/immutable/chunks/D4lZkO77.js","_app/immutable/chunks/DKmbPrPL.js","_app/immutable/chunks/BU6LsiZ-.js","_app/immutable/chunks/Cav0d4se.js"];
const stylesheets = ["_app/immutable/assets/0.DTk_TIgw.css"];
const fonts = [];

export { component, fonts, imports, index, stylesheets, _layout_ts as universal, universal_id };
//# sourceMappingURL=0-ByW7Cz4q.js.map
