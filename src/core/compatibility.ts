export interface CompatibilityResult {
  supported: boolean;
  reasons: string[];
}

export function checkBrowserSupport(): CompatibilityResult {
  const reasons: string[] = [];

  // 1. getUserMedia の存在確認
  if (!navigator?.mediaDevices?.getUserMedia) {
    reasons.push('カメラ・マイクへのアクセス API (getUserMedia) が利用できません。HTTPS 接続でアクセスしているかご確認ください。');
  }

  // 2. AudioWorklet の存在確認 (iOS 14.5未満を弾く)
  const hasAudioWorklet =
    typeof AudioWorkletNode !== 'undefined' &&
    typeof AudioContext !== 'undefined' &&
    'audioWorklet' in AudioContext.prototype;
  if (!hasAudioWorklet) {
    reasons.push('低遅延オーディオ処理（AudioWorklet）に対応していません。iOS 14.5 / Android Chrome 以降が必要です。');
  }

  // 3. MediaRecorder の存在確認
  if (typeof window.MediaRecorder === 'undefined') {
    reasons.push('ブラウザ内録画機能（MediaRecorder）に対応していません。');
  }

  // 4. BigInt の存在確認 (mp4-muxer に必須)
  if (typeof BigInt === 'undefined') {
    reasons.push('MP4合成処理に必要な JavaScript 機能（BigInt）に対応していません。');
  }

  return {
    supported: reasons.length === 0,
    reasons,
  };
}
