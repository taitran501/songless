import { searchYouTubeVideo } from "../lib/youtube"

function readArgument(name: string) {
  const index = process.argv.indexOf(`--${name}`)
  return index >= 0 ? process.argv[index + 1]?.trim() : undefined
}

async function main() {
  const title = readArgument("title")
  const artists = readArgument("artists")

  if (!title || !artists) {
    console.error('Usage: npm run smoke:youtube -- --title "Song title" --artists "Artist name"')
    process.exitCode = 1
    return
  }

  try {
    const match = await searchYouTubeVideo(title, artists)
    console.log(JSON.stringify(match, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  }
}

void main()
