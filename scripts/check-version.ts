/**
 * Checks whether the yshelper / lelaer APIs have a newer abyss or stygian
 * version than what's stored in the DB. Writes `is_new=true/false` (true when
 * either mode has a new version) to $GITHUB_OUTPUT when running in CI, plus
 * per-mode flags `is_new_abyss` and `is_new_stygian` for more granular gating.
 *
 * Usage:
 *   PUBLIC_SUPABASE_URL=... PRIVATE_SUPABASE_KEY=... npx tsx scripts/check-version.ts
 */

import { appendFileSync } from 'node:fs'
import 'dotenv/config'
import { supabase } from './lib/supabase.js'
import { fetchYsHelper, getCurrentVersion } from './lib/yshelper.js'

const ABYSS_URL = 'https://api.yshelper.com/ys/getAbyssRank.php'
const STYGIAN_URL = 'https://api.lelaer.com/ys/getAbyssRank2.php'

async function latestDbVersion(table: 'abyss_versions' | 'stygian_versions'): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select('version_number')
    .order('version_number', { ascending: false })
    .limit(1)

  if (error) throw error
  return data?.[0]?.version_number ?? 0
}

const [abyssData, stygianData, dbAbyssVersion, dbStygianVersion] =
  await Promise.all([
    fetchYsHelper(ABYSS_URL),
    fetchYsHelper(STYGIAN_URL),
    latestDbVersion('abyss_versions'),
    latestDbVersion('stygian_versions'),
  ])

const apiAbyssVersion = getCurrentVersion(abyssData)
const apiStygianVersion = getCurrentVersion(stygianData)

const isNewAbyss = apiAbyssVersion > dbAbyssVersion
const isNewStygian = apiStygianVersion > dbStygianVersion
const isNew = isNewAbyss || isNewStygian

console.log(
  `Abyss  — API: ${apiAbyssVersion}  DB: ${dbAbyssVersion}  New: ${isNewAbyss}`,
)
console.log(
  `Stygian — API: ${apiStygianVersion}  DB: ${dbStygianVersion}  New: ${isNewStygian}`,
)
console.log(`Overall new: ${isNew}`)

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `is_new=${isNew}\nis_new_abyss=${isNewAbyss}\nis_new_stygian=${isNewStygian}\n`,
  )
}
