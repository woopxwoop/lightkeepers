// Run after the data pipeline refreshes weapons.json: `node split-weapon-data.mjs`
//
// Splits src/lib/data/weapons.json into weapon-index.json (everything but the
// refinement text, loaded wherever a weapon name/icon shows) and
// weapon-refinements.json (id → refinement ranks, loaded only by tooltips).
import { readFileSync, writeFileSync } from "node:fs";

const DATA_DIR = new URL("./src/lib/data/", import.meta.url);

const weapons = JSON.parse(
  readFileSync(new URL("weapons.json", DATA_DIR), "utf8"),
);

const index = weapons.map(({ refinements: _refinements, ...rest }) => rest);

const refinements = {};
for (const weapon of weapons) {
  if (weapon.refinements?.length) refinements[weapon.id] = weapon.refinements;
}

writeFileSync(
  new URL("weapon-index.json", DATA_DIR),
  `${JSON.stringify(index)}\n`,
);
writeFileSync(
  new URL("weapon-refinements.json", DATA_DIR),
  `${JSON.stringify(refinements)}\n`,
);
