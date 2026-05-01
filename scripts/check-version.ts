/**
 * Checks whether the yshelper API has a newer version than what's in the DB.
 * Writes `is_new=true/false` to $GITHUB_OUTPUT when running in CI.
 *
 * Usage:
 *   PUBLIC_SUPABASE_URL=... PRIVATE_SUPABASE_KEY=... npx tsx scripts/check-version.ts
 */

import { appendFileSync } from 'node:fs'
import 'dotenv/config'
import { supabase } from './lib/supabase.js'
import { fetchYsHelper, getCurrentVersion } from './lib/yshelper.js'

const ABYSS_URL = 'https://api.yshelper.com/ys/getAbyssRank.php'

const [apiData, { data: dbRows, error }] = await Promise.all([
  fetchYsHelper(ABYSS_URL),
  supabase
    .from('abyss_versions')
    .select('version_number')
    .order('version_number', { ascending: false })
    .limit(1),
])

if (error) throw error

const apiVersion = getCurrentVersion(apiData)
const dbVersion = dbRows?.[0]?.version_number ?? 0
const isNew = apiVersion > dbVersion

console.log(`API version: ${apiVersion}  DB version: ${dbVersion}  New: ${isNew}`)

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `is_new=${isNew}\n`)
}
