export interface AudioStartDetection {
  detectedAudioStartSeconds: number
  confidence: number
  status: "approved" | "needs_review" | "failed"
  reason: string
}

export interface AudioStartDetectionOptions {
  sampleRate?: number
  frameSize?: number
  hopSize?: number
  sustainedSeconds?: number
  preferEarlyStart?: boolean
}

interface AudioFrameFeature {
  time: number
  rms: number
  flux: number
  zcr: number
}

const DEFAULT_SAMPLE_RATE = 22050
const DEFAULT_FRAME_SIZE = 1024
const DEFAULT_HOP_SIZE = 512
const DEFAULT_SUSTAINED_SECONDS = 1.6
const DEFAULT_AUDIBLE_SECONDS = 0.45

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * ratio)))
  return sorted[index]
}

function buildHannWindow(size: number) {
  const window = new Float64Array(size)
  for (let index = 0; index < size; index++) {
    window[index] = 0.5 * (1 - Math.cos((2 * Math.PI * index) / (size - 1)))
  }
  return window
}

function findAudibleStart(features: AudioFrameFeature[], threshold: number, hopDuration: number) {
  const audibleFrames = Math.max(3, Math.ceil(DEFAULT_AUDIBLE_SECONDS / hopDuration))

  for (let index = 0; index + audibleFrames <= features.length; index++) {
    if (features[index].rms < threshold * 0.75) continue

    const window = features.slice(index, index + audibleFrames)
    const averageRms = window.reduce((total, feature) => total + feature.rms, 0) / window.length
    const audibleRatio = window.filter((feature) => feature.rms >= threshold).length / window.length

    if (averageRms >= threshold && audibleRatio >= 0.65) {
      return Math.max(0, features[index].time - 0.04)
    }
  }

  return null
}

function fftMagnitudes(samples: Float64Array) {
  const size = samples.length
  const real = new Float64Array(samples)
  const imag = new Float64Array(size)

  let reverseIndex = 0
  for (let index = 1; index < size; index++) {
    let bit = size >> 1
    for (; reverseIndex & bit; bit >>= 1) reverseIndex ^= bit
    reverseIndex ^= bit
    if (index < reverseIndex) {
      const realValue = real[index]
      real[index] = real[reverseIndex]
      real[reverseIndex] = realValue
    }
  }

  for (let length = 2; length <= size; length <<= 1) {
    const angle = (-2 * Math.PI) / length
    const cosStep = Math.cos(angle)
    const sinStep = Math.sin(angle)

    for (let start = 0; start < size; start += length) {
      let cos = 1
      let sin = 0
      const half = length >> 1

      for (let offset = 0; offset < half; offset++) {
        const even = start + offset
        const odd = even + half
        const oddReal = real[odd] * cos - imag[odd] * sin
        const oddImag = real[odd] * sin + imag[odd] * cos

        real[odd] = real[even] - oddReal
        imag[odd] = imag[even] - oddImag
        real[even] += oddReal
        imag[even] += oddImag

        const nextCos = cos * cosStep - sin * sinStep
        sin = cos * sinStep + sin * cosStep
        cos = nextCos
      }
    }
  }

  const magnitudes = new Float64Array(size / 2)
  for (let index = 0; index < magnitudes.length; index++) {
    magnitudes[index] = Math.hypot(real[index], imag[index])
  }
  return magnitudes
}

export function extractAudioFeatures(
  samples: Float32Array | number[],
  options: AudioStartDetectionOptions = {}
) {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE
  const frameSize = options.frameSize ?? DEFAULT_FRAME_SIZE
  const hopSize = options.hopSize ?? DEFAULT_HOP_SIZE
  const window = buildHannWindow(frameSize)
  const features: AudioFrameFeature[] = []
  let previousMagnitudes: Float64Array | null = null

  for (let start = 0; start + frameSize <= samples.length; start += hopSize) {
    let sumSquares = 0
    let zeroCrossings = 0
    const frame = new Float64Array(frameSize)

    for (let offset = 0; offset < frameSize; offset++) {
      const current = samples[start + offset] || 0
      const previous = offset > 0 ? samples[start + offset - 1] || 0 : current
      if ((current >= 0 && previous < 0) || (current < 0 && previous >= 0)) zeroCrossings++
      sumSquares += current * current
      frame[offset] = current * window[offset]
    }

    const magnitudes = fftMagnitudes(frame)
    let flux = 0
    if (previousMagnitudes) {
      for (let index = 0; index < magnitudes.length; index++) {
        flux += Math.max(0, magnitudes[index] - previousMagnitudes[index])
      }
      flux /= magnitudes.length
    }
    previousMagnitudes = magnitudes

    features.push({
      time: start / sampleRate,
      rms: Math.sqrt(sumSquares / frameSize),
      flux,
      zcr: zeroCrossings / frameSize,
    })
  }

  return features
}

export function detectAudioStart(
  samples: Float32Array | number[],
  options: AudioStartDetectionOptions = {}
): AudioStartDetection {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE
  const hopSize = options.hopSize ?? DEFAULT_HOP_SIZE
  const sustainedSeconds = options.sustainedSeconds ?? DEFAULT_SUSTAINED_SECONDS
  const features = extractAudioFeatures(samples, { ...options, sampleRate, hopSize })

  if (features.length === 0) {
    return {
      detectedAudioStartSeconds: 0,
      confidence: 0,
      status: "failed",
      reason: "No audio frames could be analyzed.",
    }
  }

  const rmsValues = features.map((feature) => feature.rms)
  const fluxValues = features.map((feature) => feature.flux)
  const earlyFrames = Math.max(1, Math.round(10 / (hopSize / sampleRate)))
  const noiseFloor = percentile(rmsValues.slice(0, earlyFrames), 0.25)
  const activeRms = percentile(rmsValues, 0.78)
  const activeFlux = percentile(fluxValues, 0.65)
  const rmsThreshold = Math.max(0.008, noiseFloor * 3.2, activeRms * 0.22)
  const audibleThreshold = Math.max(0.012, activeRms * 0.22)
  const fluxThreshold = Math.max(0.0004, activeFlux * 0.35)
  const sustainedFrames = Math.max(3, Math.ceil(sustainedSeconds / (hopSize / sampleRate)))

  if (options.preferEarlyStart) {
    const hopDuration = hopSize / sampleRate
    const earlyFeatures = features.slice(0, Math.max(sustainedFrames, Math.round(1.25 / hopDuration)))
    const clearEarlyThreshold = Math.max(0.012, activeRms * 0.6)
    const lowEarlyThreshold = Math.max(0.008, activeRms * 0.18)
    const clearEarlyStart = findAudibleStart(earlyFeatures, clearEarlyThreshold, hopDuration)
    const lowEarlyStart = findAudibleStart(earlyFeatures, lowEarlyThreshold, hopDuration)

    if (clearEarlyStart !== null) {
      return {
        detectedAudioStartSeconds: Math.round(clearEarlyStart * 100) / 100,
        confidence: 0.88,
        status: "approved",
        reason: "Source is audio-first and reaches audible level near the beginning.",
      }
    }

    if (lowEarlyStart !== null) {
      return {
        detectedAudioStartSeconds: Math.round(lowEarlyStart * 100) / 100,
        confidence: 0.86,
        status: "approved",
        reason: "Source is audio-first and has an audible soft intro near the beginning.",
      }
    }
  }

  let best:
    | {
        index: number
        score: number
        energyRatio: number
        fluxRatio: number
        zcrScore: number
      }
    | null = null

  for (let index = 0; index + sustainedFrames <= features.length; index++) {
    if (features[index].rms < rmsThreshold * 0.6) continue

    const window = features.slice(index, index + sustainedFrames)
    const energyRatio = window.filter((feature) => feature.rms >= rmsThreshold).length / sustainedFrames
    if (energyRatio < 0.72) continue

    const onsetWindow = features.slice(index, Math.min(features.length, index + Math.max(3, Math.floor(sustainedFrames / 3))))
    const maxOnsetFlux = Math.max(...onsetWindow.map((feature) => feature.flux))
    const fluxRatio = Math.min(1, maxOnsetFlux / fluxThreshold)
    const averageZcr = window.reduce((total, feature) => total + feature.zcr, 0) / sustainedFrames
    const zcrScore = averageZcr >= 0.01 && averageZcr <= 0.38 ? 1 : averageZcr < 0.01 ? 0.65 : 0.45
    const score = energyRatio * 0.55 + fluxRatio * 0.25 + zcrScore * 0.2

    if (score >= 0.62) {
      best = { index, score, energyRatio, fluxRatio, zcrScore }
      break
    }
  }

  if (!best) {
    return {
      detectedAudioStartSeconds: 0,
      confidence: 0.42,
      status: "failed",
      reason: "Could not find a sustained music-like onset.",
    }
  }

  const audibleStart = findAudibleStart(features.slice(best.index), audibleThreshold, hopSize / sampleRate)
  const detectedAudioStartSeconds =
    audibleStart !== null
      ? audibleStart
      : Math.max(0, features[best.index].time - 0.04)
  const thresholdMargin = Math.min(1, Math.max(0, (features[best.index].rms - rmsThreshold) / Math.max(rmsThreshold, 0.001)))
  const confidence = Math.min(
    0.99,
    Math.max(0.8, best.score * 0.58 + thresholdMargin * 0.2 + best.energyRatio * 0.22)
  )
  const roundedConfidence = Math.round(confidence * 100) / 100
  const status = roundedConfidence >= 0.8 ? "approved" : roundedConfidence >= 0.55 ? "needs_review" : "failed"

  return {
    detectedAudioStartSeconds: Math.round(detectedAudioStartSeconds * 100) / 100,
    confidence: roundedConfidence,
    status,
    reason: `Detected sustained onset with energy ratio ${best.energyRatio.toFixed(2)} and flux ratio ${best.fluxRatio.toFixed(2)}.`,
  }
}
