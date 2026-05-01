import { createHash } from "node:crypto";

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface TeamMember {
  game_id: number;
  name_id: string;
}

export interface AbyssTeam {
  versionNumber: number;
  members: TeamMember[];
  field1Rate: number | null;
  field2Rate: number | null;
  usageRate: number;
  usageTotal: number;
  hasTotal: number;
  teamKey: string;
}

export interface StygianTeam extends AbyssTeam {
  field3Rate: number | null;
}

// ─── Raw API shapes ───────────────────────────────────────────────────────────

interface RawRole {
  avatar: string;
  star: number;
}

interface RawTeamEntry {
  role: RawRole[];
  use: number;
  has: number;
  up_use: number | null;
  down_use: number | null;
  mid_use?: number | null;
}

interface ApiCharacterTier {
  list: { avatar: string; ename: string; star: number }[];
}

export interface ApiResponse {
  has_list: { avatar: string; name: string }[];
  history_list: { title: string; value: string }[];
  result: ApiCharacterTier[][];
  [key: string]: unknown;
}

// ─── API ──────────────────────────────────────────────────────────────────────

const HEADERS = {
  accept: "*/*",
  "content-type": "application/json",
  origin: "https://app.yshelper.com",
  referer: "https://app.yshelper.com/",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
};

export async function fetchYsHelper(
  baseUrl: string,
  role = "all",
  lang = "en",
  version?: number,
): Promise<ApiResponse> {
  const params = new URLSearchParams({ star: "all", role, lang });
  if (version !== undefined) params.set("version", String(version));
  const res = await fetch(`${baseUrl}?${params}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20_000),
  }).catch((e: unknown) => {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error(`Timeout fetching ${baseUrl} role=${role} after 20s`);
    }
    throw e;
  });
  if (!res.ok)
    throw new Error(`HTTP ${res.status} fetching ${baseUrl} role=${role}`);
  return res.json() as Promise<ApiResponse>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function isNullableRate(v: unknown): boolean {
  return v == null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
}

function isRawTeamEntry(t: unknown): t is RawTeamEntry {
  if (!t || typeof t !== "object") return false;
  const { role, use, has, up_use, down_use, mid_use } = t as Record<
    string,
    unknown
  >;
  return (
    typeof use === "number" &&
    Number.isFinite(use) &&
    use >= 0 &&
    typeof has === "number" &&
    Number.isFinite(has) &&
    has >= 0 &&
    isNullableRate(up_use) &&
    isNullableRate(down_use) &&
    isNullableRate(mid_use) &&
    Array.isArray(role) &&
    role.length > 0 &&
    role.every(
      (r) =>
        r &&
        typeof r === "object" &&
        typeof (r as Record<string, unknown>).avatar === "string" &&
        typeof (r as Record<string, unknown>).star === "number",
    )
  );
}

export function extractTeams(data: ApiResponse): RawTeamEntry[] {
  const teams: RawTeamEntry[] = [];
  for (const v of Object.values(data)) {
    if (!Array.isArray(v)) continue;
    for (const item of v) {
      if (!Array.isArray(item)) continue;
      for (const t of item) {
        if (isRawTeamEntry(t)) teams.push(t);
      }
    }
  }
  return teams;
}

export function getCurrentVersion(data: ApiResponse): number {
  if (!Array.isArray(data.history_list) || data.history_list.length === 0) {
    throw new Error("getCurrentVersion: history_list is missing or empty");
  }
  const n = parseInt(data.history_list[0].value, 10);
  if (!Number.isFinite(n)) {
    throw new Error(
      `getCurrentVersion: invalid version value "${data.history_list[0].value}"`,
    );
  }
  return n;
}

export function extractVersionEntries(
  data: ApiResponse,
): { versionName: string; versionNumber: number }[] {
  if (!Array.isArray(data.history_list)) {
    throw new Error(
      "extractVersionEntries: history_list is missing or not an array",
    );
  }
  return data.history_list.flatMap((e) => {
    const n = parseInt(e.value, 10);
    return Number.isFinite(n) ? [{ versionName: e.title, versionNumber: n }] : [];
  });
}

// YSHelper uses different names for some characters than Enka does.
const YSHELPER_NAME_OVERRIDES: Record<string, string> = {
  Ambor: "Amber",
};

// Builds avatar URL → TeamMember from a pre-fetched characters list.
// Accepts the characters table rows so callers control the DB fetch.
export function buildCharMapping(
  ysCharacters: { name: string; avatar: string }[],
  dbChars: { game_id: number; name_id: string; name: string | null }[],
): { mapping: Map<string, TeamMember>; unmapped: string[] } {
  const nameToChar = new Map(
    dbChars.map((c) => [c.name?.toLowerCase(), { game_id: c.game_id, name_id: c.name_id }]),
  );
  const mapping = new Map<string, TeamMember>();
  const unmapped: string[] = [];
  for (const { name, avatar } of ysCharacters) {
    const corrected = YSHELPER_NAME_OVERRIDES[name] ?? name;
    const member = nameToChar.get(corrected.toLowerCase());
    if (member) mapping.set(avatar, member);
    else unmapped.push(name);
  }
  return { mapping, unmapped };
}

// YSHelper uses this URL for Traveler in team role data, regardless of element.
const TRAVELER_AVATAR =
  "https://upload-bbs.mihoyo.com/game_record/genshin/character_icon/UI_AvatarIcon_PlayerGirl.png";

// Returns character names from YSHelper result tiers (used to build the avatar→name mapping)
export function extractCharacterNames(data: ApiResponse): { name: string; avatar: string }[] {
  const result0 = Array.isArray(data.result) ? data.result[0] : undefined;
  return (Array.isArray(result0) ? result0 : [])
    .filter(Boolean)
    .flatMap((tier) =>
      Array.isArray(tier.list)
        ? tier.list.map((c) => ({
            name: c.ename,
            avatar: c.ename === "Traveler" ? TRAVELER_AVATAR : c.avatar,
          }))
        : [],
    );
}

// ─── Team mapping ─────────────────────────────────────────────────────────────

// Team key is a hash of sorted game_ids — stable across name changes.
function generateTeamKey(gameIds: number[]): string {
  const sorted = [...gameIds].sort((a, b) => a - b).join("-");
  return createHash("sha256").update(sorted, "utf8").digest("hex");
}

export function mapAbyssTeam(
  raw: RawTeamEntry,
  versionNumber: number,
  // avatar URL → {game_id, name_id} from the characters table
  charMapping: Map<string, TeamMember>,
): AbyssTeam | null {
  const members: TeamMember[] = [];
  for (const r of raw.role) {
    const member = charMapping.get(r.avatar);
    if (!member) return null; // skip teams with unrecognised characters
    members.push(member);
  }
  const usageRate = raw.has > 0 ? (raw.use / raw.has) * 100 : 0;
  return {
    versionNumber,
    members,
    field1Rate: raw.up_use ?? null,
    field2Rate: raw.down_use ?? null,
    usageRate,
    usageTotal: raw.use,
    hasTotal: raw.has,
    teamKey: generateTeamKey(members.map((m) => m.game_id)),
  };
}

export function mapStygianTeam(
  raw: RawTeamEntry,
  versionNumber: number,
  charMapping: Map<string, TeamMember>,
): StygianTeam | null {
  const base = mapAbyssTeam(raw, versionNumber, charMapping);
  if (!base) return null;
  return { ...base, field3Rate: raw.mid_use ?? null };
}
