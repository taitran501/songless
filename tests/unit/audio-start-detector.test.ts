import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { detectAudioStart } from "@/lib/audio-start-detector"

const sampleRate = 8000

function createSamples(seconds: number) {
  return new Float32Array(Math.floor(seconds * sampleRate))
}

function addSine(samples: Float32Array, startSeconds: number, durationSeconds: number, frequency = 440, volume = 0.35) {
  const start = Math.floor(startSeconds * sampleRate)
  const end = Math.min(samples.length, start + Math.floor(durationSeconds * sampleRate))
  for (let index = start; index < end; index++) {
    const time = index / sampleRate
    samples[index] += Math.sin(2 * Math.PI * frequency * time) * volume
    samples[index] += Math.sin(2 * Math.PI * frequency * 1.5 * time) * volume * 0.45
  }
}

function addFadeInSine(
  samples: Float32Array,
  startSeconds: number,
  durationSeconds: number,
  fadeSeconds = 1,
  frequency = 440,
  volume = 0.35
) {
  const start = Math.floor(startSeconds * sampleRate)
  const end = Math.min(samples.length, start + Math.floor(durationSeconds * sampleRate))
  for (let index = start; index < end; index++) {
    const time = index / sampleRate
    const elapsed = time - startSeconds
    const fade = Math.min(1, Math.max(0, elapsed / fadeSeconds))
    samples[index] += Math.sin(2 * Math.PI * frequency * time) * volume * fade
    samples[index] += Math.sin(2 * Math.PI * frequency * 1.5 * time) * volume * 0.45 * fade
  }
}

function addNoiseBurst(samples: Float32Array, startSeconds: number, durationSeconds: number, volume = 0.45) {
  const start = Math.floor(startSeconds * sampleRate)
  const end = Math.min(samples.length, start + Math.floor(durationSeconds * sampleRate))
  for (let index = start; index < end; index++) {
    const pseudoRandom = Math.sin(index * 12.9898) * 43758.5453
    samples[index] += (pseudoRandom - Math.floor(pseudoRandom) - 0.5) * volume
  }
}

function detect(samples: Float32Array) {
  return detectAudioStart(samples, {
    sampleRate,
    frameSize: 512,
    hopSize: 128,
    sustainedSeconds: 1,
  })
}

describe("audio start detector", () => {
  it("detects music after leading silence", () => {
    const samples = createSamples(7)
    addSine(samples, 2, 4)

    const result = detect(samples)

    assert.equal(result.status, "approved")
    assert.ok(result.detectedAudioStartSeconds >= 1.7)
    assert.ok(result.detectedAudioStartSeconds <= 2.2)
  })

  it("does not pick a short noise burst before the song", () => {
    const samples = createSamples(8)
    addNoiseBurst(samples, 0.8, 0.2)
    addSine(samples, 3, 4)

    const result = detect(samples)

    assert.equal(result.status, "approved")
    assert.ok(result.detectedAudioStartSeconds >= 2.7)
    assert.ok(result.detectedAudioStartSeconds <= 3.2)
  })

  it("waits through low ambient intro before sustained music", () => {
    const samples = createSamples(8)
    addNoiseBurst(samples, 0, 2, 0.03)
    addSine(samples, 2.6, 4)

    const result = detect(samples)

    assert.equal(result.status, "approved")
    assert.ok(result.detectedAudioStartSeconds >= 2.3)
    assert.ok(result.detectedAudioStartSeconds <= 2.9)
  })

  it("can approve audio-first sources from the beginning", () => {
    const samples = createSamples(5)
    addSine(samples, 0, 4, 330, 0.04)

    const result = detectAudioStart(samples, {
      sampleRate,
      frameSize: 512,
      hopSize: 128,
      sustainedSeconds: 1,
      preferEarlyStart: true,
    })

    assert.equal(result.status, "approved")
    assert.equal(result.detectedAudioStartSeconds, 0)
  })

  it("skips inaudible fade-in before audio-first sources become clear", () => {
    const samples = createSamples(5)
    addFadeInSine(samples, 0, 4, 1)

    const result = detectAudioStart(samples, {
      sampleRate,
      frameSize: 512,
      hopSize: 128,
      sustainedSeconds: 1,
      preferEarlyStart: true,
    })

    assert.equal(result.status, "approved")
    assert.ok(result.detectedAudioStartSeconds >= 0.35)
    assert.ok(result.detectedAudioStartSeconds <= 1.1)
  })
})
