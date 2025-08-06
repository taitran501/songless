#!/usr/bin/env node

// Check environment variables for deployment
const requiredEnvVars = [
  'SPOTIFY_CLIENT_ID',
  'SPOTIFY_CLIENT_SECRET',
  'SPOTIFY_REDIRECT_URI'
]

console.log('🔍 Checking environment variables...')

const missingVars = []
const presentVars = []

requiredEnvVars.forEach(varName => {
  if (process.env[varName]) {
    presentVars.push(varName)
    console.log(`✅ ${varName}: ${process.env[varName].substring(0, 10)}...`)
  } else {
    missingVars.push(varName)
    console.log(`❌ ${varName}: MISSING`)
  }
})

console.log('\n📊 Summary:')
console.log(`✅ Present: ${presentVars.length}/${requiredEnvVars.length}`)
console.log(`❌ Missing: ${missingVars.length}/${requiredEnvVars.length}`)

if (missingVars.length > 0) {
  console.log('\n⚠️  Missing environment variables:')
  missingVars.forEach(varName => {
    console.log(`   - ${varName}`)
  })
  console.log('\n💡 Add these to your Vercel environment variables!')
  process.exit(1)
} else {
  console.log('\n🎉 All environment variables are set! Ready to deploy!')
  process.exit(0)
} 