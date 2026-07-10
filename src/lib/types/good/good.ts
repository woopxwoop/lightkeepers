// Genshin Open Object Description (GOOD)
// GOOD is a data format description to map Genshin Data into a parsable JSON. This is intended to be a standardized format to allow Genshin developers/programmers to transfer data without needing manual conversion.

// As of version 6.0.0, Genshin Optimizer's database export conforms to this format.

// The keys in the GOOD format, like Artifact sets, weapon keys, character keys, are all in PascalCase. This makes the name easy to derive from the in-game text, assuming no renames occur. If a rename is needed, then the standard will have to increment versions. (Last change was in 1.2 when the Prototype weapons were renamed)

// To derive the PascalKey from a specific name, remove all symbols from the name, and Capitalize each word:
// Gladiator's Finale  GladiatorsFinale
// Spirit Locket of Boreas  SpiritLocketOfBoreas
// "The Catch"  TheCatch

import type { ArtifactSetKey as SetKey } from "./artifactSetKey";
import type { WeaponKey } from "./weaponKey";
import type { MaterialKey } from "./materialKey";
import type { CharacterKey } from "./characterKey";
import type { StatKey } from "./statKey";

interface IGOOD {
  format: "GOOD"; // A way for people to recognize this format.
  version: number; // GOOD API version.
  source: string; // The app that generates this data.
  characters?: ICharacter[];
  artifacts?: IArtifact[];
  weapons?: IWeapon[];
  materials?: Partial<Record<MaterialKey, number>>;
}

// Artifact data representation
interface IArtifact {
  setKey: SetKey; //e.g. "GladiatorsFinale"
  slotKey: SlotKey; //e.g. "plume"
  level: number; //0-20 inclusive
  rarity: number; //1-5 inclusive
  mainStatKey: StatKey;
  location: CharacterKey | ""; //where "" means not equipped.
  lock: boolean; //Whether the artifact is locked in game.
  substats: ISubstat[];
  // Below are new to GOOD 3
  totalRolls?: number; // 3-9 for valid 5* artifacts; includes starting rolls
  astralMark?: boolean; // Favorite star in-game
  elixirCrafted?: boolean; // Flag for if the artifact was created using Sanctifying Elixir. This guarantees the main stat + 2 additional rolls on the first 2 substats
  unactivatedSubstats?: ISubstat[]; // Unactivated substat(s). Once a substat is activated, it should be moved to `substats` instead
}
interface ISubstat {
  key: StatKey; //e.g. "critDMG_"
  value: number; //e.g. 19.4
  // Below is new to GOOD 3
  initialValue?: number; // Initial roll of the artifact, if it is known. This includes the first roll of this stat, even if it was not revealed initially e.g. from `unactivatedSubstats`
}
type SlotKey = "flower" | "plume" | "sands" | "goblet" | "circlet";

// Weapon data representation

interface IWeapon {
  key: WeaponKey; //"CrescentPike"
  level: number; //1-90 inclusive
  ascension: number; //0-6 inclusive. need to disambiguate 80/90 or 80/80
  refinement: number; //1-5 inclusive
  location: CharacterKey | ""; //where "" means not equipped.
  lock: boolean; //Whether the weapon is locked in game.
}

// Character data representation

interface ICharacter {
  key: CharacterKey; //e.g. "Rosaria"
  level: number; //1-100 inclusive
  constellation: number; //0-6 inclusive
  ascension: number; //0-6 inclusive. need to disambiguate 80/90 or 80/80
  talent: {
    //does not include boost from constellations. 1-15 inclusive
    auto: number;
    skill: number;
    burst: number;
  };
}
