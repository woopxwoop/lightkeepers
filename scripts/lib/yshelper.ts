import { createHash } from 'node:crypto'

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface Character {
  name: string
  rarity: number | null
  icon: string | null
}

export interface AbyssTeam {
  versionNumber: number
  members: Character[]
  usageRateTop: number | null
  usageRateBottom: number | null
  usageTotal: number
  teamKey: string
  has: number
  use: number
}

export interface StygianTeam extends AbyssTeam {
  usageRateMiddle: number | null
}

// ─── Raw API shapes ───────────────────────────────────────────────────────────

interface RawRole {
  avatar: string
  star: number
}

interface RawTeamEntry {
  role: RawRole[]
  use: number
  has: number
  up_use: number | null
  down_use: number | null
  mid_use?: number | null
}

interface ApiCharacterTier {
  list: { avatar: string; ename: string; star: number }[]
}

export interface ApiResponse {
  has_list: { avatar: string; name: string }[]
  history_list: { title: string; value: string }[]
  result: ApiCharacterTier[][]
  [key: string]: unknown
}

// ─── API ──────────────────────────────────────────────────────────────────────

const HEADERS = {
  accept: '*/*',
  'content-type': 'application/json',
  origin: 'https://app.yshelper.com',
  referer: 'https://app.yshelper.com/',
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
}

export async function fetchYsHelper(
  baseUrl: string,
  role = 'all',
  lang = 'en',
  version?: number,
): Promise<ApiResponse> {
  const params = new URLSearchParams({ star: 'all', role, lang })
  if (version !== undefined) params.set('version', String(version))
  const res = await fetch(`${baseUrl}?${params}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20_000),
  }).catch((e: unknown) => {
    if (e instanceof Error && e.name === 'TimeoutError') {
      throw new Error(`Timeout fetching ${baseUrl} role=${role} after 20s`)
    }
    throw e
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${baseUrl} role=${role}`)
  return res.json() as Promise<ApiResponse>
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ─── Parsing ──────────────────────────────────────────────────────────────────

function isRawTeamEntry(t: unknown): t is RawTeamEntry {
  if (!t || typeof t !== 'object') return false
  const { role } = t as Record<string, unknown>
  return (
    Array.isArray(role) &&
    role.length > 0 &&
    role.every(
      (r) => r && typeof r === 'object' &&
        typeof (r as Record<string, unknown>).avatar === 'string' &&
        typeof (r as Record<string, unknown>).star === 'number',
    )
  )
}

// Finds team objects by walking the nested-list structure of the API response.
export function extractTeams(data: ApiResponse): RawTeamEntry[] {
  const teams: RawTeamEntry[] = []
  for (const v of Object.values(data)) {
    if (!Array.isArray(v)) continue
    for (const item of v) {
      if (!Array.isArray(item)) continue
      for (const t of item) {
        if (isRawTeamEntry(t)) teams.push(t)
      }
    }
  }
  return teams
}

export function getCurrentVersion(data: ApiResponse): number {
  if (!Array.isArray(data.history_list) || data.history_list.length === 0) {
    throw new Error('getCurrentVersion: history_list is missing or empty')
  }
  const n = parseInt(data.history_list[0].value, 10)
  if (!Number.isFinite(n)) {
    throw new Error(`getCurrentVersion: invalid version value "${data.history_list[0].value}"`)
  }
  return n
}

export function extractVersionEntries(
  data: ApiResponse,
): { version: string; versionNumber: number }[] {
  if (!Array.isArray(data.history_list)) {
    throw new Error('extractVersionEntries: history_list is missing or not an array')
  }
  return data.history_list.flatMap((e) => {
    const n = parseInt(e.value, 10)
    return Number.isFinite(n) ? [{ version: e.title, versionNumber: n }] : []
  })
}

// Returns {name (English), rarity, icon} for all characters in result[0] tiers.
export function extractCharacters(
  data: ApiResponse,
): { name: string; rarity: number; icon: string }[] {
  const TRAVELER_ICON =
    'https://upload-bbs.mihoyo.com/game_record/genshin/character_icon/UI_AvatarIcon_PlayerGirl.png'
  return (Array.isArray(data.result) ? data.result[0] ?? [] : []).flatMap((tier) =>
    tier.list.map((c) => ({
      name: c.ename,
      rarity: c.star,
      icon: c.ename === 'Traveler' ? TRAVELER_ICON : c.avatar,
    })),
  )
}

// ─── Team mapping ─────────────────────────────────────────────────────────────

function generateTeamKey(memberNames: string[]): string {
  const sorted = [...memberNames].sort().join('-')
  return createHash('sha256').update(sorted, 'utf8').digest('hex')
}

export function mapAbyssTeam(
  raw: RawTeamEntry,
  versionNumber: number,
  charMapping: Map<string, string>,
): AbyssTeam {
  const members: Character[] = raw.role.map((r) => ({
    name: charMapping.get(r.avatar) ?? 'Unknown',
    rarity: r.star,
    icon: r.avatar,
  }))
  return {
    versionNumber,
    members,
    usageRateTop: raw.up_use ?? null,
    usageRateBottom: raw.down_use ?? null,
    usageTotal: raw.has > 0 ? (raw.use / raw.has) * 100 : 0,
    teamKey: generateTeamKey(raw.role.map((r) => r.avatar)),
    has: raw.has,
    use: raw.use,
  }
}

export function mapStygianTeam(
  raw: RawTeamEntry,
  versionNumber: number,
  charMapping: Map<string, string>,
): StygianTeam {
  return {
    ...mapAbyssTeam(raw, versionNumber, charMapping),
    usageRateMiddle: raw.mid_use ?? null,
  }
}

export function getCharacterNames(charMapping: Map<string, string>): string[] {
  return Array.from(new Set(charMapping.values()))
}
