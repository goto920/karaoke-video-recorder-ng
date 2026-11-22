class AudioRecorderWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.isRecording = false;

    // 平滑化用（時定数フィルター）
    this.smoothedRms = 0;
    this.sampleCount = 0;
    this.accumulatedSum = 0;
    this.hasClippedInWindow = false;

    this.port.onmessage = (event) => {
      const { command } = event.data;
      if (command === 'START') {
        this.isRecording = true;
      } else if (command === 'STOP') {
        this.isRecording = false;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (input && input.length > 0) {
      const channelData = input[0];

      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        const val = channelData[i];
        sum += val * val;
        if (val >= 0.98 || val <= -0.98) {
          this.hasClippedInWindow = true;
        }
      }

      this.accumulatedSum += sum;
      this.sampleCount += channelData.length;

      // 約 40ms ごと（1920サンプル @ 48kHz）にUIへ通知
      if (this.sampleCount >= 1920) {
        const instantRms = Math.sqrt(this.accumulatedSum / this.sampleCount);

        // 指数平滑化 (アタック速め、リリース緩やか)
        const alpha = instantRms > this.smoothedRms ? 0.35 : 0.15;
        this.smoothedRms = alpha * instantRms + (1 - alpha) * this.smoothedRms;

        // dBFS 計算 (下限 -60dB)
        let db = -60;
        if (this.smoothedRms > 0.0001) {
          db = 20 * Math.log10(this.smoothedRms);
        }

        this.port.postMessage({
          type: 'VU',
          db: Math.max(-60, Math.round(db * 10) / 10),
          clipped: this.hasClippedInWindow
        });

        // リセット
        this.accumulatedSum = 0;
        this.sampleCount = 0;
        this.hasClippedInWindow = false;
      }

      if (this.isRecording) {
        const bufferCopy = new Float32Array(channelData);
        this.port.postMessage(
          { type: 'DATA', buffer: bufferCopy.buffer },
          [bufferCopy.buffer]
        );
      }
    }
    return true;
  }
}

registerProcessor('audio-recorder-worklet', AudioRecorderWorklet);
