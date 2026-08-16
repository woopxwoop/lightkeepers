/**
 * Farming itinerary — group planner costs by domain / boss.
 * Starred goals from the saved plan are the itinerary set.
 */
import type { CalculatorGoal } from "$lib/types/calculator-goals";
import { costsForGoal } from "$lib/calculator-goals";
import { assetUrl } from "$lib/asset-urls";
import { getCharacterPortrait } from "$lib/utils";
import type {
  UpgradeCostsCatalog,
  UpgradeMaterialMeta,
  UpgradeMaterialSource,
  UpgradeMaterialWeekday,
} from "$lib/types/upgrade-costs";

const FARM_KINDS = ["domain", "weekly", "boss"] as const;
export type FarmPlaceKind = (typeof FARM_KINDS)[number];

const KIND_ORDER: Record<FarmPlaceKind, number> = {
  domain: 0,
  weekly: 1,
  boss: 2,
};

export const FARM_KIND_LABEL: Record<
  Exclude<FarmPlaceKind, "domain">,
  string
> = {
  weekly: "Weekly bosses",
  boss: "World bosses",
};

/** craftIntoId → lower-rank material ids (cached per catalog object). */
const craftFromByCatalog = new WeakMap<
  UpgradeCostsCatalog,
  Map<number, string[]>
>();

function craftFromIndex(catalog: UpgradeCostsCatalog): Map<number, string[]> {
  const cached = craftFromByCatalog.get(catalog);
  if (cached) return cached;
  const index = new Map<number, string[]>();
  for (const row of Object.values(catalog.materials)) {
    if (row.craftIntoId == null) continue;
    const list = index.get(row.craftIntoId) ?? [];
    list.push(String(row.id));
    index.set(row.craftIntoId, list);
  }
  craftFromByCatalog.set(catalog, index);
  return index;
}

function materialInCraftChain(
  id: number,
  catalog: UpgradeCostsCatalog,
): boolean {
  const meta = catalog.materials[String(id)];
  if (meta?.craftIntoId != null) return true;
  return craftFromIndex(catalog).has(id);
}

export const WEEKDAY_ORDER: UpgradeMaterialWeekday[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

/** Domain rotations share Mon/Thu, Tue/Fri, Wed/Sat (Sunday is every book). */
export const FARM_WEEK_PAIRS: readonly {
  label: string;
  days: readonly [UpgradeMaterialWeekday, UpgradeMaterialWeekday];
}[] = [
  { label: "Mon / Thu", days: ["Mon", "Thu"] },
  { label: "Tue / Fri", days: ["Tue", "Fri"] },
  { label: "Wed / Sat", days: ["Wed", "Sat"] },
];

const JS_DAY_TO_WEEKDAY: UpgradeMaterialWeekday[] = [
  "Sun",
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
];

export type FarmPlaceMaterial = {
  id: string;
  name: string;
  icon: string;
  count: number;
  rankLevel: number;
};

export type FarmPlace = {
  kind: FarmPlaceKind;
  name: string;
  days?: UpgradeMaterialWeekday[];
  icon?: string;
  materials: FarmPlaceMaterial[];
};

export type FarmWeekDay = {
  /** Column heading — a weekday, or "Mon / Thu" when the week is expanded. */
  day: string;
  today: boolean;
  places: FarmPlace[];
};

export function todayWeekday(now = new Date()): UpgradeMaterialWeekday {
  return JS_DAY_TO_WEEKDAY[now.getDay()] ?? "Sun";
}

function daysKey(days?: UpgradeMaterialWeekday[]): string {
  return days?.length ? days.join("/") : "";
}

function opensOn(
  days: UpgradeMaterialWeekday[] | undefined,
  today: UpgradeMaterialWeekday,
): boolean {
  return !days?.length || days.includes(today);
}

/** Paired Mon–Sat columns used when the week is expanded. Sunday is not a column. */
export function farmWeekDays(
  places: FarmPlace[],
  today: UpgradeMaterialWeekday,
): FarmWeekDay[] {
  const domains = places.filter((p) => p.kind === "domain");
  return FARM_WEEK_PAIRS.map(({ label, days }) => ({
    day: label,
    today: days.includes(today),
    places: domains.filter((p) => days.some((d) => opensOn(p.days, d))),
  }));
}

/** Collapsed “today” strip — Sunday includes every rotation. */
export function farmTodayColumn(
  places: FarmPlace[],
  today: UpgradeMaterialWeekday,
): FarmWeekDay {
  const domains = places.filter((p) => p.kind === "domain");
  return {
    day: today,
    today: true,
    places: domains.filter((p) => opensOn(p.days, today)),
  };
}

export function farmPlacesOfKind(
  places: FarmPlace[],
  kind: Exclude<FarmPlaceKind, "domain">,
): FarmPlace[] {
  return places.filter((p) => p.kind === kind);
}

/** Unique contributing faces for these places, name-sorted. */
export function uniqueGoalsOnPlaces(
  places: FarmPlace[],
  contributors: Map<string, FarmGoalRef[]>,
): FarmGoalRef[] {
  const seen = new Map<string, FarmGoalRef>();
  for (const place of places) {
    for (const mat of place.materials) {
      for (const g of contributors.get(mat.id) ?? []) {
        const key = farmGoalFaceKey(g);
        if (!seen.has(key)) seen.set(key, g);
      }
    }
  }
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * One material badge for a face on these places — highest rank when a goal
 * needs several ranks of the same farm (e.g. Guide + Philosophies).
 */
export function faceMaterialOnPlaces(
  goal: FarmGoalRef,
  places: FarmPlace[],
  contributors: Map<string, FarmGoalRef[]>,
): FarmPlaceMaterial | null {
  const faceKey = farmGoalFaceKey(goal);
  let best: FarmPlaceMaterial | null = null;
  for (const place of places) {
    for (const mat of place.materials) {
      const goals = contributors.get(mat.id) ?? [];
      if (!goals.some((g) => farmGoalFaceKey(g) === faceKey)) continue;
      if (
        !best ||
        mat.rankLevel > best.rankLevel ||
        (mat.rankLevel === best.rankLevel &&
          mat.name.localeCompare(best.name) < 0)
      ) {
        best = mat;
      }
    }
  }
  return best;
}

function farmPlaceKind(
  source: UpgradeMaterialSource,
  meta: UpgradeMaterialMeta | undefined,
  catalog: UpgradeCostsCatalog,
): FarmPlaceKind | null {
  if (source.kind === "domain" || source.kind === "weekly") return source.kind;
  if (source.kind !== "boss") return null;
  // CDN tags Lupus Boreas weekly talent mats as world bosses. Promote only
  // isolated 5★ drops — craft-chain gemstones stay world bosses.
  const rank = meta?.rankLevel ?? 1;
  if (rank >= 5 && meta && !materialInCraftChain(meta.id, catalog)) {
    return "weekly";
  }
  return "boss";
}

function placeKey(kind: FarmPlaceKind, source: UpgradeMaterialSource): string {
  const days = daysKey(source.days);
  if (kind === "domain" && days) {
    return `${kind}:${source.name}:${days}`;
  }
  return `${kind}:${source.name}`;
}

/** Group a material bag into domains, weekly bosses, then world bosses. */
export function farmPlacesFromMaterials(
  materials: Record<string, number>,
  catalog: UpgradeCostsCatalog,
): FarmPlace[] {
  const byKey = new Map<string, FarmPlace>();
  for (const [id, count] of Object.entries(materials)) {
    if (count <= 0) continue;
    const meta = catalog.materials[id];
    const source = meta?.sources?.[0];
    if (!source) continue;
    const kind = farmPlaceKind(source, meta, catalog);
    if (!kind) continue;
    const key = placeKey(kind, source);
    let place = byKey.get(key);
    if (!place) {
      place = { kind, name: source.name, materials: [] };
      if (source.days?.length) place.days = source.days;
      if (source.icon) place.icon = source.icon;
      byKey.set(key, place);
    }
    place.materials.push({
      id,
      name: meta?.name ?? `Material ${id}`,
      icon: meta?.icon ?? `UI_ItemIcon_${id}`,
      count,
      rankLevel: meta?.rankLevel ?? 1,
    });
  }
  for (const place of byKey.values()) {
    place.materials.sort((a, b) => {
      const rank = b.rankLevel - a.rankLevel;
      if (rank !== 0) return rank;
      return a.name.localeCompare(b.name);
    });
    if (!place.icon && place.materials[0]) {
      place.icon = place.materials[0].icon;
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const kind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kind !== 0) return kind;
    const name = a.name.localeCompare(b.name);
    if (name !== 0) return name;
    return daysKey(a.days).localeCompare(daysKey(b.days));
  });
}

export function itineraryGoalLabel(
  goal: CalculatorGoal,
  catalog: UpgradeCostsCatalog | null,
): string {
  if (goal.kind === "character") {
    return (
      catalog?.characters.find((c) => c.name_id === goal.name_id)?.name ??
      goal.name_id
    );
  }
  return (
    catalog?.weapons.find((w) => w.id === goal.weapon_id)?.name ??
    `Weapon ${goal.weapon_id}`
  );
}

/** Tall gacha splash stem (`UI_Gacha_EquipIcon_*`) from a square equip icon. */
export function weaponGachaIconName(icon: string): string {
  if (!icon.startsWith("UI_EquipIcon_")) return icon;
  return `UI_Gacha_EquipIcon_${icon.slice("UI_EquipIcon_".length)}`;
}

function weaponCatalogIcon(
  goal: CalculatorGoal,
  catalog: UpgradeCostsCatalog | null,
): string | null {
  if (goal.kind !== "weapon") return null;
  return catalog?.weapons.find((w) => w.id === goal.weapon_id)?.icon ?? null;
}

export function itineraryGoalIcon(
  goal: CalculatorGoal,
  catalog: UpgradeCostsCatalog | null,
): string | null {
  if (goal.kind === "character") return getCharacterPortrait(goal.name_id);
  const icon = weaponCatalogIcon(goal, catalog);
  if (!icon) return null;
  return assetUrl(weaponGachaIconName(icon)) ?? assetUrl(icon);
}

/** Square equip icon — used if the gacha splash 404s. */
export function itineraryGoalFallbackIcon(
  goal: CalculatorGoal,
  catalog: UpgradeCostsCatalog | null,
): string | null {
  return assetUrl(weaponCatalogIcon(goal, catalog));
}

export type FarmGoalRef = {
  id: string;
  name: string;
  icon: string | null;
  /** Square weapon icon if the gacha splash is missing. */
  fallbackIcon?: string | null;
  /** Character goals — UI renders TCG/portrait via CharacterIcon. */
  name_id?: string;
  /** Weapon goals — gacha splash lookup / calendar identity. */
  weapon_id?: number;
};

/** Same face even when two planner goals share a character or weapon. */
export function farmGoalFaceKey(g: FarmGoalRef): string {
  if (g.name_id) return `c:${g.name_id}`;
  if (g.weapon_id != null) return `w:${g.weapon_id}`;
  return `g:${g.id}`;
}

export function farmGoalRef(
  goal: CalculatorGoal,
  catalog: UpgradeCostsCatalog | null,
): FarmGoalRef {
  const icon = itineraryGoalIcon(goal, catalog);
  const fallbackIcon = itineraryGoalFallbackIcon(goal, catalog);
  return {
    id: goal.id,
    name: itineraryGoalLabel(goal, catalog),
    icon,
    ...(fallbackIcon && fallbackIcon !== icon ? { fallbackIcon } : {}),
    ...(goal.kind === "character" ? { name_id: goal.name_id } : {}),
    ...(goal.kind === "weapon" ? { weapon_id: goal.weapon_id } : {}),
  };
}

/** Displayed rank this raw material id maps onto (craft-up or craft-down). */
export function displayedMaterialId(
  id: string,
  displayed: Record<string, number>,
  catalog: UpgradeCostsCatalog,
): string | null {
  if ((displayed[id] ?? 0) > 0) return id;
  const craftFrom = craftFromIndex(catalog);
  const seen = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (seen.has(cur)) continue;
    seen.add(cur);
    if ((displayed[cur] ?? 0) > 0) return cur;
    const meta = catalog.materials[cur];
    if (meta?.craftIntoId != null) queue.push(String(meta.craftIntoId));
    const n = Number(cur);
    for (const lower of craftFrom.get(n) ?? []) queue.push(lower);
  }
  return null;
}

/** Goals whose start→target bag feeds each displayed material id. */
export function farmMaterialContributors(
  goals: CalculatorGoal[],
  catalog: UpgradeCostsCatalog,
  displayed: Record<string, number>,
): Map<string, FarmGoalRef[]> {
  const byMat = new Map<string, FarmGoalRef[]>();
  for (const goal of goals) {
    const ref = farmGoalRef(goal, catalog);
    const bag = costsForGoal(goal, catalog).materials;
    const seen = new Set<string>();
    for (const [id, count] of Object.entries(bag)) {
      if (!(count > 0)) continue;
      const target = displayedMaterialId(id, displayed, catalog);
      if (!target || seen.has(target)) continue;
      seen.add(target);
      const list = byMat.get(target) ?? [];
      if (!list.some((g) => g.id === ref.id)) list.push(ref);
      byMat.set(target, list);
    }
  }
  return byMat;
}
