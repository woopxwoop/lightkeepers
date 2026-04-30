/**
 * Stygian cron pipeline — equivalent of the Python /cron/stygian endpoint.
 *
 * Steps (in order):
 *   1. Update abyss + stygian version tables from the API
 *   2. Upsert characters and refresh url_to_character_mapping
 *   3. Fetch stygian teams per-character, deduplicate, batch-upsert to Supabase
 *   4. Refresh the stygian materialized views
 *
 * Usage:
 *   PUBLIC_SUPABASE_URL=... PRIVATE_SUPABASE_KEY=... npx tsx scripts/cron-stygian.ts
 */

import 'dotenv/config'
import { supabase } from './lib/supabase.js'
import {
  fetchYsHelper,
  extractTeams,
  getCurrentVersion,
  extractVersionEntries,
  extractCharacters,
  mapStygianTeam,
  getCharacterNames,
  sleep,
  type StygianTeam,
} from './lib/yshelper.js'

const ABYSS_URL = 'https://api.yshelper.com/ys/getAbyssRank.php'
const STYGIAN_URL = 'https://api.lelaer.com/ys/getAbyssRank2.php'
const BATCH_SIZE = 10

// ─── Steps ────────────────────────────────────────────────────────────────────

async function updateVersions(): Promise<void> {
  console.log('Updating versions...')
  const [abyssData, stygianData] = await Promise.all([
    fetchYsHelper(ABYSS_URL),
    fetchYsHelper(STYGIAN_URL),
  ])

  const abyssEntries = extractVersionEntries(abyssData)
  const stygianEntries = extractVersionEntries(stygianData)

  const { error: e1 } = await supabase
    .from('versions')
    .upsert(abyssEntries.map((e) => ({ version: e.version, version_number: e.versionNumber })))
  if (e1) throw e1

  const { error: e2 } = await supabase
    .from('stygian_versions')
    .upsert(stygianEntries.map((e) => ({ version: e.version, version_number: e.versionNumber })))
  if (e2) throw e2

  console.log(`  ${abyssEntries.length} abyss versions, ${stygianEntries.length} stygian versions`)
}

async function updateCharacters(): Promise<void> {
  console.log('Updating characters...')
  const data = await fetchYsHelper(STYGIAN_URL)
  const characters = extractCharacters(data)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcErr } = await (supabase.rpc as any)('upsert_characters', {
    p_characters: characters,
  })
  if (rpcErr) throw rpcErr

  const mappingRows = characters.map((c) => ({ url: c.icon, character_name: c.name }))
  const { error: mapErr } = await supabase.from('url_to_character_mapping').upsert(mappingRows)
  if (mapErr) throw mapErr

  console.log(`  ${characters.length} characters, ${mappingRows.length} url mappings`)
}

async function updateTeams(): Promise<void> {
  console.log('Updating stygian teams...')
  const { data: rows, error } = await supabase
    .from('url_to_character_mapping')
    .select('url, character_name')
  if (error) throw error
  const charMapping = new Map(rows.map((r) => [r.url, r.character_name]))

  const firstData = await fetchYsHelper(STYGIAN_URL)
  const versionNumber = getCurrentVersion(firstData)
  const characterNames = getCharacterNames(charMapping)
  console.log(`  Version ${versionNumber}, ${characterNames.length} characters`)

  const seenKeys = new Set<string>()
  let batch: StygianTeam[] = []
  let batchIdx = 0
  let total = 0

  for (const charName of characterNames) {
    const data = await fetchYsHelper(STYGIAN_URL, charName, 'en', versionNumber)
    await sleep(300)

    for (const raw of extractTeams(data)) {
      const team = mapStygianTeam(raw, versionNumber, charMapping)
      if (seenKeys.has(team.teamKey)) continue
      seenKeys.add(team.teamKey)
      batch.push(team)

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch, ++batchIdx)
        total += batch.length
        batch = []
      }
    }
  }

  if (batch.length > 0) {
    await flushBatch(batch, ++batchIdx)
    total += batch.length
  }

  console.log(`  Total: ${total} teams`)
}

async function flushBatch(batch: StygianTeam[], idx: number): Promise<void> {
  const payload = batch.map((t) => ({
    team_key: t.teamKey,
    members: t.members.map((m) => m.name),
    version_number: t.versionNumber,
    usage_rate_top: t.usageRateTop,
    usage_rate_middle: t.usageRateMiddle,
    usage_rate_bottom: t.usageRateBottom,
    usage_total: t.usageTotal,
    use: t.use,
    has: t.has,
  }))
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('upsert_stygian_teams_batch', { p_teams: payload })
  if (error) throw error
  console.log(`  Batch ${idx}: ${batch.length} teams`)
}

async function refreshViews(): Promise<void> {
  console.log('Refreshing stygian views...')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.rpc as any)('refresh_stygian_views')
  if (error) throw error
  console.log('  Done')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

console.log('=== Stygian cron start ===')
await updateVersions()
await updateCharacters()
await updateTeams()
await refreshViews()
console.log('=== Stygian cron complete ===')
