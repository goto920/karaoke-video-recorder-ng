export interface RecorderConfig {
  mimeType: string;
  videoBitsPerSecond?: number;
}

export function getOptimalRecorderConfig(): RecorderConfig {
  const candidates = [
    'video/mp4;codecs=avc1.42E01E',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',
    'video/webm;codecs=vp8',
    'video/webm',
  ];

  let selectedMimeType = '';
  for (const mime of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
      selectedMimeType = mime;
      break;
    }
  }

  return {
    mimeType: selectedMimeType,
    videoBitsPerSecond: 2_500_000, // 720pに最適化された 2.5Mbps
  };
}

export function createSafeMediaRecorder(stream: MediaStream): MediaRecorder {
  const { mimeType, videoBitsPerSecond } = getOptimalRecorderConfig();
  try {
    if (mimeType) {
      return new MediaRecorder(stream, { mimeType, videoBitsPerSecond });
    }
  } catch (err) {
    console.warn('Failed with preferred options, fallback to mimeType only:', err);
  }

  try {
    if (mimeType) {
      return new MediaRecorder(stream, { mimeType });
    }
  } catch (err) {
    console.warn('Failed with mimeType, fallback to default:', err);
  }

  return new MediaRecorder(stream);
}
