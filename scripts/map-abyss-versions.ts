/**
 * Map yshelper <-> lunaris.moe abyss schedule versions.
 *
 * yshelper (api.yshelper.com/ys/getAbyssRank.php) uses its own version
 * numbering (0..N) covering ~Sep 2022 – present, with 8 intermittent gaps
 * in 2023–2024.
 *
 * lunaris.moe (api.lunaris.moe/data/<ver>/en/tower/) uses scheduleId
 * (1..N) covering Jul 2020 – present.
 *
 * Relationship: lunaris_scheduleId ≈ yshelper_version + 53, shifted by
 * +1 for each of the 8 gaps passed.
 *
 * Output: a JSON lookup table written to stdout.
 */

const YSHELPER_BASE = "https://api.yshelper.com/ys/getAbyssRank.php?star=4&role=all&lang=en&version=";
const LUNARIS_VERSION_URL = "https://api.lunaris.moe/data/version.json";
const LUNARIS_TOWER = (version: string, id: number) =>
  `https://api.lunaris.moe/data/${version}/en/tower/${id}.json`;

interface YshelperEntry {
  version: number;
  startDate: string;
  periodRaw: string;
  title: string;
}

interface LunarisEntry {
  scheduleId: number;
  openTime: string;
  closeTime: string;
}

interface MapRow {
  lunarisScheduleId: number;
  yshelperVersion: number | null;
  lunarisOpen: string;
  lunarisClose: string;
  yshelperPeriod: string;
  yshelperTitle: string;
  gap: boolean;
}

function parseDate(str: string): Date {
  const d = new Date(str);
  if (isNaN(d.getTime())) throw new Error(`bad date: ${str}`);
  return d;
}

async function fetchYshelper(ver: number): Promise<YshelperEntry | null> {
  const url = `${YSHELPER_BASE}${ver}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (!data.update) return null;
  const m = data.update.match(/Period:\s*(\d{4}-\d{2}-\d{2})/);
  if (!m) return null;
  return {
    version: ver,
    startDate: m[1],
    periodRaw: data.update,
    title: data.title ?? "",
  };
}

async function fetchLunaris(version: string, id: number): Promise<LunarisEntry | null> {
  const url = LUNARIS_TOWER(version, id);
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return {
    scheduleId: data.scheduleId,
    openTime: data.openTime,
    closeTime: data.closeTime,
  };
}

async function getLunarisVersion(): Promise<string> {
  const res = await fetch(LUNARIS_VERSION_URL);
  if (!res.ok) throw new Error(`Lunaris version: HTTP ${res.status}`);
  return ((await res.json()) as { version: string }).version;
}

/** Fetch the latest yshelper response to discover the highest version number. */
async function getMaxYshelperVersion(): Promise<number> {
  const res = await fetch(YSHELPER_BASE.replace("&version=", ""));
  if (!res.ok) return 59; // fallback
  const data = await res.json();
  const list = data.history_list as { value: number }[] | undefined;
  if (!list || list.length === 0) return 59;
  return Math.max(...list.map((h) => h.value));
}

function daysBetween(a: Date, b: Date): number {
  return Math.abs((a.getTime() - b.getTime()) / 86_400_000);
}

async function main() {
  // Get current Lunaris version
  const lunarisVer = await getLunarisVersion();
  console.error(`Lunaris data version: ${lunarisVer}`);

  // Find the highest existing schedule ID
  console.error("Finding max schedule ID...");
  let maxId = 1;
  while (await fetchLunaris(lunarisVer, maxId + 1)) maxId++;
  console.error(`Latest Lunaris schedule: ${maxId}`);

  // Fetch all yshelper versions
  const maxYsVer = await getMaxYshelperVersion();
  console.error(`Latest yshelper version: ${maxYsVer}`);

  const yshelper = new Map<number, YshelperEntry>();
  for (let v = 0; v <= maxYsVer; v++) {
    const entry = await fetchYshelper(v);
    if (entry) yshelper.set(v, entry);
    process.stderr.write(`\ryshelper: ${v + 1}/${maxYsVer + 1}`);
  }
  console.error();

  // Fetch all lunaris scheduleIds
  const lunaris = new Map<number, LunarisEntry>();
  for (let id = 1; id <= maxId; id++) {
    const entry = await fetchLunaris(lunarisVer, id);
    if (entry) lunaris.set(id, entry);
    process.stderr.write(`\rlunaris: ${id}/${maxId}`);
  }
  console.error();

  // Cross-reference
  const table: MapRow[] = [];
  const matchedLunaris = new Set<number>();

  for (const [lid, l] of lunaris) {
    const lOpen = parseDate(l.openTime);
    let best: number | null = null;
    let bestDiff = Infinity;

    for (const [yv, y] of yshelper) {
      const yStart = parseDate(y.startDate);
      const diff = daysBetween(lOpen, yStart);
      if (diff <= 1.5 && diff < bestDiff) {
        best = yv;
        bestDiff = diff;
      }
    }

    if (best !== null) {
      matchedLunaris.add(lid);
      const y = yshelper.get(best)!;
      table.push({
        lunarisScheduleId: lid,
        yshelperVersion: best,
        lunarisOpen: l.openTime,
        lunarisClose: l.closeTime,
        yshelperPeriod: y.periodRaw,
        yshelperTitle: y.title,
        gap: false,
      });
    } else {
      table.push({
        lunarisScheduleId: lid,
        yshelperVersion: null,
        lunarisOpen: l.openTime,
        lunarisClose: l.closeTime,
        yshelperPeriod: "NOT IN YSHELPER",
        yshelperTitle: "",
        gap: true,
      });
    }
  }

  // Print results
  const matched = table.filter((r) => !r.gap);
  const gaps = table.filter((r) => r.gap);

  console.log(JSON.stringify({ table, matched, gaps }, null, 2));

  // Summary
  console.error(`\nMatched: ${matched.length}, Gaps: ${gaps.length}`);
  console.error(
    `Pre-yshelper (before 2022-09-01): ${gaps.filter((g) => g.lunarisOpen < "2022-09-01").length}`
  );
  console.error(
    `Intermittent gaps within range: ${gaps.filter((g) => g.lunarisOpen >= "2022-09-01").length}`
  );
}

main().catch(console.error);
