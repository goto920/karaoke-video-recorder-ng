// src/core/video/mediaRecorderHelper.ts

export interface RecorderConfig {
  mimeType: string;
  videoBitsPerSecond?: number;
}

/**
 * 実行環境（Safari, Chrome, Firefox, Android, iOS）に応じて
 * 最も安全かつ高画質な MediaRecorder のオプションを自動決定する
 */
export function getOptimalRecorderConfig(): RecorderConfig {
  // 優先順位リスト（上から順にサポート確認）
  // 1. MP4 (H.264): Safari(iOS/macOS) で必須、最近の Chrome でも対応
  // 2. WebM (VP9/VP8): Chrome, Android, Firefox で最も綺麗で安定
  const candidates = [
    'video/mp4;codecs=avc1.42E01E', // Baseline H.264 (iPhone/iPad/PC 全方位で最も安全)
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9',        // Chrome / Firefox の最高画質
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

  // 万が一どれも通らない場合はブラウザのデフォルトに任せる（空文字）
  const config: RecorderConfig = {
    mimeType: selectedMimeType,
  };

  // ビットレート指定（2.5Mbps: 720pに最適）
  // ※ iOS Safari など一部ブラウザで例外が出るのを防ぐため try-catch 可能な形で持たせる
  config.videoBitsPerSecond = 2_500_000;

  return config;
}

/**
 * 安全に MediaRecorder インスタンスを生成するラッパー関数
 */
export function createSafeMediaRecorder(stream: MediaStream): MediaRecorder {
  const { mimeType, videoBitsPerSecond } = getOptimalRecorderConfig();

  // 1. まず最適設定でインスタンス化を試みる
  try {
    if (mimeType) {
      return new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond,
      });
    }
  } catch (err) {
    console.warn('Failed to initialize MediaRecorder with preferred config, falling back:', err);
  }

  // 2. 失敗した場合は mimeType のみで試す
  try {
    if (mimeType) {
      return new MediaRecorder(stream, { mimeType });
    }
  } catch (err) {
    console.warn('Failed to initialize MediaRecorder with mimeType only:', err);
  }

  // 3. 最後の砦: オプションなし（ブラウザ標準）で初期化
  return new MediaRecorder(stream);
}
