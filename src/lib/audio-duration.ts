export function mp3DurationSeconds(buffer: Buffer): number | null {
  const bitratesV1 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
  const sampleRatesV1 = [44100, 48000, 32000]
  const bitratesV2 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
  const sampleRatesV2 = [22050, 24000, 16000]

  let offset = 0
  let totalSamples = 0
  let sampleRate = 24000

  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff || (buffer[offset + 1]! & 0xe0) !== 0xe0) {
      offset += 1
      continue
    }

    const version = (buffer[offset + 1]! >> 3) & 0x03
    const layer = (buffer[offset + 1]! >> 1) & 0x03
    if (layer !== 1) {
      offset += 1
      continue
    }

    const bitrateIndex = (buffer[offset + 2]! >> 4) & 0x0f
    const sampleRateIndex = (buffer[offset + 2]! >> 2) & 0x03
    const padding = (buffer[offset + 2]! >> 1) & 0x01

    const mpeg1 = version === 3
    const bitrates = mpeg1 ? bitratesV1 : bitratesV2
    const sampleRates = mpeg1 ? sampleRatesV1 : sampleRatesV2
    const bitrate = bitrates[bitrateIndex] ?? 0
    const rate = sampleRates[sampleRateIndex] ?? 0
    if (!bitrate || !rate) {
      offset += 1
      continue
    }

    sampleRate = rate
    const frameLength = Math.floor(((mpeg1 ? 144 : 72) * bitrate * 1000) / rate) + padding
    if (frameLength <= 0) {
      offset += 1
      continue
    }

    totalSamples += mpeg1 ? 1152 : 576
    offset += frameLength
  }

  if (totalSamples === 0 || sampleRate === 0) return null
  return Math.max(1, Math.round(totalSamples / sampleRate))
}

export function wavDurationSeconds(buffer: Buffer): number | null {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') return null
  const byteRate = buffer.readUInt32LE(28)
  if (!byteRate) return null

  const dataOffset = buffer.indexOf('data', 12)
  if (dataOffset >= 0 && dataOffset + 8 <= buffer.length) {
    const dataSize = buffer.readUInt32LE(dataOffset + 4)
    return Math.max(1, Math.round(dataSize / byteRate))
  }

  return Math.max(1, Math.round((buffer.length - 44) / byteRate))
}

export function audioDurationSeconds(buffer: Buffer): number | null {
  if (buffer.toString('ascii', 0, 4) === 'RIFF') return wavDurationSeconds(buffer)
  return mp3DurationSeconds(buffer)
}

/**
 * Trims a WAV buffer to approximately `seconds` of audio by slicing the data
 * chunk. Lyria returns ~32.8s clips regardless of prompt length.
 */
export function trimWavSeconds(buffer: Buffer, seconds: number): Buffer {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF') {
    return buffer
  }

  const byteRate = buffer.readUInt32LE(28)
  if (!byteRate || seconds <= 0) return buffer

  const targetBytes = Math.max(1, Math.floor(byteRate * seconds))

  let offset = 12
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4)
    const chunkSize = buffer.readUInt32LE(offset + 4)
    const chunkDataStart = offset + 8

    if (chunkId === 'data') {
      const trimmedSize = Math.min(chunkSize, targetBytes, buffer.length - chunkDataStart)
      const outLength = chunkDataStart + trimmedSize
      const out = Buffer.alloc(outLength)

      buffer.copy(out, 0, 0, chunkDataStart)
      buffer.copy(out, chunkDataStart, chunkDataStart, chunkDataStart + trimmedSize)
      out.writeUInt32LE(trimmedSize, offset + 4)
      out.writeUInt32LE(outLength - 8, 4)

      return out
    }

    offset = chunkDataStart + chunkSize + (chunkSize % 2)
  }

  return buffer
}
