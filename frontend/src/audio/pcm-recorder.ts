/**
 * Browser Audio Capture & PCM16-LE Encoder.
 * Streams real-time 16kHz mono 16-bit linear PCM chunks from user's microphone.
 */

export interface PcmRecorderOptions {
  sampleRate?: number; // Target sample rate, defaults to 16000
  bufferSize?: number; // Target samples per emitted chunk (e.g. 2048 samples = ~128ms at 16kHz)
  onAudioChunk: (chunk: ArrayBuffer) => void;
  onVolumeChange?: (rms: number) => void; // Normalized volume 0.0 - 1.0 for audio level indicator
  onError?: (err: Error) => void;
}

export class PcmRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private isRecording = false;

  private targetSampleRate: number;
  private onAudioChunk: (chunk: ArrayBuffer) => void;
  private onVolumeChange?: (rms: number) => void;
  private onError?: (err: Error) => void;

  constructor(options: PcmRecorderOptions) {
    this.targetSampleRate = options.sampleRate || 16000;
    this.onAudioChunk = options.onAudioChunk;
    this.onVolumeChange = options.onVolumeChange;
    this.onError = options.onError;
  }

  public get active(): boolean {
    return this.isRecording;
  }

  public async start(): Promise<void> {
    if (this.isRecording) return;

    try {
      // Request mic with single mono channel and telephony optimizations
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });

      // Try creating AudioContext at target 16kHz
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      try {
        this.audioContext = new AudioCtx({ sampleRate: this.targetSampleRate });
      } catch {
        // Fallback to default sample rate if browser doesn't permit custom sampleRate
        this.audioContext = new AudioCtx();
      }

      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Buffer size: 4096 gives ~85-256ms chunk depending on hardware sample rate
      const bufferSize = 4096;
      this.processorNode = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      const actualSampleRate = this.audioContext.sampleRate;

      this.processorNode.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputChannelData = event.inputBuffer.getChannelData(0);

        // Compute RMS volume for live audio activity visualization
        if (this.onVolumeChange) {
          let sumSquares = 0;
          for (let i = 0; i < inputChannelData.length; i++) {
            sumSquares += inputChannelData[i] * inputChannelData[i];
          }
          const rms = Math.min(1, Math.sqrt(sumSquares / inputChannelData.length) * 4);
          this.onVolumeChange(rms);
        }

        // Resample to targetSampleRate if hardware context doesn't match 16kHz
        let resampled: Float32Array;
        if (actualSampleRate === this.targetSampleRate) {
          resampled = inputChannelData;
        } else {
          resampled = this.resampleLinear(inputChannelData, actualSampleRate, this.targetSampleRate);
        }

        // Convert Float32 [-1.0, 1.0] to signed 16-bit linear PCM (little-endian)
        const pcm16Buffer = this.floatToPcm16LE(resampled);
        this.onAudioChunk(pcm16Buffer);
      };

      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);
      this.isRecording = true;
    } catch (err) {
      this.stop();
      const error = err instanceof Error ? err : new Error(String(err));
      if (this.onError) {
        this.onError(error);
      } else {
        throw error;
      }
    }
  }

  public stop(): void {
    this.isRecording = false;

    if (this.processorNode) {
      this.processorNode.disconnect();
      this.processorNode.onaudioprocess = null;
      this.processorNode = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    if (this.onVolumeChange) {
      this.onVolumeChange(0);
    }
  }

  /**
   * Resamples single-channel Float32 audio using linear interpolation.
   */
  private resampleLinear(
    input: Float32Array,
    fromRate: number,
    toRate: number
  ): Float32Array {
    if (fromRate === toRate) return input;

    const ratio = fromRate / toRate;
    const outputLength = Math.round(input.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const position = i * ratio;
      const index = Math.floor(position);
      const frac = position - index;

      const s0 = input[index] || 0;
      const s1 = input[index + 1] !== undefined ? input[index + 1] : s0;
      output[i] = s0 + frac * (s1 - s0);
    }

    return output;
  }

  /**
   * Converts Float32Array [-1.0, 1.0] to an ArrayBuffer containing signed 16-bit little-endian PCM integers.
   */
  private floatToPcm16LE(samples: Float32Array): ArrayBuffer {
    const buffer = new ArrayBuffer(samples.length * 2);
    const view = new DataView(buffer);

    for (let i = 0; i < samples.length; i++) {
      // Clamp between -1.0 and 1.0
      let s = Math.max(-1, Math.min(1, samples[i]));
      // Map to 16-bit signed integer range [-32768, 32767]
      const int16 = s < 0 ? s * 0x8000 : s * 0x7fff;
      view.setInt16(i * 2, int16, true); // true = little-endian
    }

    return buffer;
  }
}
