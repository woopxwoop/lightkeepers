/**
 * Farming itinerary — group planner costs by domain / boss.
 * Goal subset is local (not part of the saved plan).
 */
import type { CalculatorGoal } from "$lib/types/calculator-goals";
import type {
  UpgradeCostsCatalog,
  UpgradeMaterialSource,
  UpgradeMaterialSourceKind,
  UpgradeMaterialWeekday,
} from "$lib/types/upgrade-costs";

export const ITINERARY_FOCUS_STORAGE_KEY = "plannerItineraryGoalIds";

const FARM_KINDS = ["domain", "weekly", "boss"] as const;
export type FarmPlaceKind = (typeof FARM_KINDS)[number];

const KIND_ORDER: Record<FarmPlaceKind, number> = {
  domain: 0,
  weekly: 1,
  boss: 2,
};

export const FARM_KIND_LABEL: Record<FarmPlaceKind, string> = {
  domain: "Domains",
  weekly: "Weekly bosses",
  boss: "World bosses",
};

const WEEKDAY_ORDER: UpgradeMaterialWeekday[] = [
  "Mon",
  "Tue",
  "Wed",
  "Thu",
  "Fri",
  "Sat",
  "Sun",
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

export type FarmPlaceDayGroup = {
  daysKey: string;
  daysLabel: string | null;
  openToday: boolean;
  places: FarmPlace[];
};

export type FarmPlaceSection = {
  kind: FarmPlaceKind;
  label: string;
  groups: FarmPlaceDayGroup[];
};

export function todayWeekday(now = new Date()): UpgradeMaterialWeekday {
  return JS_DAY_TO_WEEKDAY[now.getDay()] ?? "Sun";
}

function daysKey(days?: UpgradeMaterialWeekday[]): string {
  return days?.length ? days.join("/") : "";
}

function firstWeekdayIndex(days?: UpgradeMaterialWeekday[]): number {
  if (!days?.length) return WEEKDAY_ORDER.length;
  const idx = WEEKDAY_ORDER.indexOf(days[0]!);
  return idx < 0 ? WEEKDAY_ORDER.length : idx;
}

function opensOn(
  days: UpgradeMaterialWeekday[] | undefined,
  today: UpgradeMaterialWeekday,
): boolean {
  return !days?.length || days.includes(today);
}

/** Kind sections; domains split by weekday family, with today's rotation first. */
export function groupFarmPlaces(
  places: FarmPlace[],
  today: UpgradeMaterialWeekday,
): FarmPlaceSection[] {
  const byKind = new Map<FarmPlaceKind, FarmPlace[]>();
  for (const kind of FARM_KINDS) byKind.set(kind, []);
  for (const place of places) {
    byKind.get(place.kind)?.push(place);
  }

  const sections: FarmPlaceSection[] = [];
  for (const kind of FARM_KINDS) {
    const list = byKind.get(kind) ?? [];
    if (list.length === 0) continue;
    if (kind !== "domain") {
      sections.push({
        kind,
        label: FARM_KIND_LABEL[kind],
        groups: [
          {
            daysKey: "",
            daysLabel: null,
            openToday: false,
            places: list,
          },
        ],
      });
      continue;
    }

    const byDays = new Map<string, FarmPlace[]>();
    for (const place of list) {
      const key = daysKey(place.days);
      const bucket = byDays.get(key);
      if (bucket) bucket.push(place);
      else byDays.set(key, [place]);
    }
    const groups: FarmPlaceDayGroup[] = [...byDays.entries()].map(
      ([key, grouped]) => ({
        daysKey: key,
        daysLabel: key || null,
        openToday: grouped.some((p) => opensOn(p.days, today)),
        places: grouped,
      }),
    );
    groups.sort((a, b) => {
      if (a.openToday !== b.openToday) return a.openToday ? -1 : 1;
      return (
        firstWeekdayIndex(a.places[0]?.days) -
        firstWeekdayIndex(b.places[0]?.days)
      );
    });
    sections.push({ kind, label: FARM_KIND_LABEL[kind], groups });
  }
  return sections;
}

export type FarmPlaceMaterial = {
  id: string;
  name: string;
  icon: string;
  count: number;
};

export type FarmPlace = {
  kind: FarmPlaceKind;
  name: string;
  days?: UpgradeMaterialWeekday[];
  icon?: string;
  materials: FarmPlaceMaterial[];
};

function isFarmKind(kind: UpgradeMaterialSourceKind): kind is FarmPlaceKind {
  return (FARM_KINDS as readonly string[]).includes(kind);
}

function placeKey(source: UpgradeMaterialSource): string {
  return `${source.kind}:${source.name}`;
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
    if (!source || !isFarmKind(source.kind)) continue;
    const key = placeKey(source);
    let place = byKey.get(key);
    if (!place) {
      place = { kind: source.kind, name: source.name, materials: [] };
      if (source.days?.length) place.days = source.days;
      if (source.icon) place.icon = source.icon;
      byKey.set(key, place);
    }
    place.materials.push({
      id,
      name: meta?.name ?? `Material ${id}`,
      icon: meta?.icon ?? `UI_ItemIcon_${id}`,
      count,
    });
  }
  for (const place of byKey.values()) {
    place.materials.sort((a, b) => a.name.localeCompare(b.name));
    if (!place.icon && place.materials[0]) {
      place.icon = place.materials[0].icon;
    }
  }
  return [...byKey.values()].sort((a, b) => {
    const kind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
    if (kind !== 0) return kind;
    return a.name.localeCompare(b.name);
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

/** `null` = never saved (treat as all). Otherwise the last explicit subset. */
export function readItineraryFocusIds(): string[] | null {
  try {
    const raw = localStorage.getItem(ITINERARY_FOCUS_STORAGE_KEY);
    if (raw == null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === "string");
  } catch {
    return null;
  }
}

export function writeItineraryFocusIds(ids: string[]): void {
  try {
    localStorage.setItem(ITINERARY_FOCUS_STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* private mode */
  }
}

/**
 * Resolve which goal ids are focused.
 * Unsaved → all. Saved ids are dropped if those goals are gone.
 */
export function resolveItineraryFocus(
  goals: CalculatorGoal[],
  stored: string[] | null,
): Set<string> {
  const valid = new Set(goals.map((g) => g.id));
  if (stored == null) return valid;
  return new Set(stored.filter((id) => valid.has(id)));
}
