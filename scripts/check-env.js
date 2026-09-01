#!/usr/bin/env node

// Check environment variables for deployment
const requiredEnvVars = []
const vercelEnvironment = process.env.VERCEL_ENV
// Vercel sets NODE_ENV=production for both Preview and Production builds.
// Prefer VERCEL_ENV when it is available so Preview does not inherit the
// Production-only Redis/cron gate.
const isProduction = vercelEnvironment
  ? vercelEnvironment === 'production'
  : process.env.NODE_ENV === 'production'
const isVercelPreview = vercelEnvironment === 'preview'

const redisConfigured =
  Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) ||
  Boolean(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN)

// Preview can still deploy without Redis so non-Daily flows remain reviewable.
// The Daily API itself fails closed until a managed snapshot store is present;
// Production remains blocked at build time when the store is not configured.
const deploymentEnvVars = isProduction
  ? [
      ...(redisConfigured ? [] : ['UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (or KV_REST_API_URL + KV_REST_API_TOKEN)']),
      ...(isProduction && !process.env.CRON_SECRET ? ['CRON_SECRET'] : []),
    ]
  : []

console.log('Checking environment variables...')

const missingVars = []
const presentVars = []

requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    presentVars.push(varName)
    console.log(`OK ${varName}: set`)
  } else {
    missingVars.push(varName)
    console.log(`MISSING ${varName}`)
  }
})

if (isVercelPreview && !redisConfigured) {
  console.log('WARNING Daily Redis is not configured for Preview; /api/daily will fail closed until it is provisioned.')
}

deploymentEnvVars.forEach(varName => {
  missingVars.push(varName)
  console.log(`MISSING ${varName}`)
})

console.log('\nSummary:')
const totalChecks = requiredEnvVars.length + deploymentEnvVars.length
console.log(`Present: ${presentVars.length}/${totalChecks}`)
console.log(`Missing: ${missingVars.length}/${totalChecks}`)

if (missingVars.length > 0) {
  console.log('\nMissing environment variables:')
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`)
  })
  console.log('\nAdd these to your Vercel environment variables before deploying.')
  process.exit(1)
} else {
  console.log('\nAll environment variables are set. Ready to deploy.')
  process.exit(0)
}
