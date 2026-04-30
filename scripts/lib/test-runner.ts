let passed = 0
let failed = 0

export function ok(label: string, detail?: string) {
  console.log(`  ✓ ${label}${detail ? `  (${detail})` : ''}`)
  passed++
}

export function fail(label: string, err?: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  console.log(`  ✗ ${label}${msg ? `  — ${msg}` : ''}`)
  failed++
}

// ok() should be called inside fn() to include a detail string.
// If fn() throws, the error is caught and recorded as a failure.
export async function check(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e) {
    fail(label, e)
  }
}

export function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

export function summary(title = 'Results') {
  const total = passed + failed
  console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 30 - title.length))} ${total} checks`)
  console.log(`  passed: ${passed}`)
  if (failed > 0) console.log(`  failed: ${failed}`)
  if (failed > 0) process.exit(1)
}
