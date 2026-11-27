// Tests for unified central recording flow, VAD auto-stop, and first-use consent.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  startCloudRecording,
  MAX_RECORDING_MS,
  INITIAL_SILENCE_TIMEOUT_MS,
} from '../services/cloudSpeech'

describe('unified cloud recording with VAD', () => {
  let mockTracks: { stop: ReturnType<typeof vi.fn> }[]
  let mockStream: { getTracks: () => typeof mockTracks }
  let mockRecorder: {
    state: string
    start: ReturnType<typeof vi.fn>
    stop: ReturnType<typeof vi.fn>
    ondataavailable: ((e: { data: Blob }) => void) | null
    onstart: (() => void) | null
    onstop: (() => void) | null
    onerror: (() => void) | null
  }

  beforeEach(() => {
    vi.useFakeTimers()
    mockTracks = [{ stop: vi.fn() }]
    mockStream = { getTracks: () => mockTracks }

    const mockStart = vi.fn((timeslice?: number) => {
      void timeslice
      mockRecorder.state = 'recording'
      mockRecorder.onstart?.()
    })
    const mockStop = vi.fn(() => {
      mockRecorder.state = 'inactive'
      mockRecorder.onstop?.()
    })

    mockRecorder = {
      state: 'inactive',
      start: mockStart,
      stop: mockStop,
      ondataavailable: null,
      onstart: null,
      onstop: null,
      onerror: null,
    }

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      },
    })

    class FakeMediaRecorder {
      static isTypeSupported = vi.fn().mockReturnValue(true)
      state = 'inactive'
      ondataavailable: ((e: { data: Blob }) => void) | null = null
      onstart: (() => void) | null = null
      onstop: (() => void) | null = null
      onerror: (() => void) | null = null
      start = vi.fn((timeslice?: number) => {
        this.state = 'recording'
        mockStart(timeslice)
        this.onstart?.()
      })
      stop = vi.fn(() => {
        this.state = 'inactive'
        mockStop()
        this.onstop?.()
      })
    }

    vi.stubGlobal('MediaRecorder', FakeMediaRecorder)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('starts recording and triggers started callback', async () => {
    const started = vi.fn()
    const stopped = vi.fn()
    const failed = vi.fn()

    startCloudRecording('audio/mp4', {
      started,
      stopped,
      failed,
      tick: vi.fn(),
    })

    await vi.advanceTimersByTimeAsync(10)
    expect(started).toHaveBeenCalledOnce()
    expect(mockRecorder.start).toHaveBeenCalledWith(250)
  })

  it('automatically stops after initial silence timeout if no speech detected', async () => {
    const started = vi.fn()
    const stopped = vi.fn()
    const failed = vi.fn()

    startCloudRecording('audio/mp4', {
      started,
      stopped,
      failed,
      tick: vi.fn(),
    })

    await vi.advanceTimersByTimeAsync(10)
    expect(started).toHaveBeenCalledOnce()

    // Advance past INITIAL_SILENCE_TIMEOUT_MS
    await vi.advanceTimersByTimeAsync(INITIAL_SILENCE_TIMEOUT_MS + 50)
    expect(mockRecorder.stop).toHaveBeenCalled()
  })

  it('automatically stops at 8-second maximum', async () => {
    const started = vi.fn()
    const stopped = vi.fn()
    const failed = vi.fn()

    startCloudRecording('audio/mp4', {
      started,
      stopped,
      failed,
      tick: vi.fn(),
    })

    await vi.advanceTimersByTimeAsync(10)
    await vi.advanceTimersByTimeAsync(MAX_RECORDING_MS + 100)
    expect(mockRecorder.stop).toHaveBeenCalled()
  })

  it('allows manual stop before maximum duration', async () => {
    const started = vi.fn()
    const stopped = vi.fn()

    const session = startCloudRecording('audio/mp4', {
      started,
      stopped,
      failed: vi.fn(),
      tick: vi.fn(),
    })

    await vi.advanceTimersByTimeAsync(10)
    session.stop()
    expect(mockRecorder.stop).toHaveBeenCalled()
  })

  it('releases microphone tracks on cancellation', async () => {
    const session = startCloudRecording('audio/mp4', {
      started: vi.fn(),
      stopped: vi.fn(),
      failed: vi.fn(),
      tick: vi.fn(),
    })

    await vi.advanceTimersByTimeAsync(10)
    session.cancel()
    expect(mockTracks[0].stop).toHaveBeenCalled()
  })
})
