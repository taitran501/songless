#!/usr/bin/env node

// Check environment variables for deployment
const requiredEnvVars = [
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REDIRECT_URI'
]

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

console.log('\nSummary:')
console.log(`Present: ${presentVars.length}/${requiredEnvVars.length}`)
console.log(`Missing: ${missingVars.length}/${requiredEnvVars.length}`)

if (missingVars.length > 0) {
  console.log('\nMissing environment variables:')
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`)
  })
  console.log('\nAdd these to your Vercel environment variables.')
  process.exit(1)
} else {
  console.log('\nAll environment variables are set. Ready to deploy.')
  process.exit(0)
}
