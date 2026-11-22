export type Language = 'ja' | 'en';

export const translations = {
  ja: {
    appTitle: 'カラオケ練習マシン',
    compatOk: '環境適合 OK',
    cameraPreviewDesc: '通話用フィルター（ノイズ低減・音量圧縮）を全オフにし、歌声本来のダイナミクスで収録します。',
    btnStartDevices: 'カメラとピュアマイクを起動',
    micLevelTitle: 'マイク入力レベル (dBFS)',
    clipLabel: 'CLIP (0dB)',
    targetMarker: '▲ 目安 -12dB',
    tipsTitle: '推奨レベルと構図の合わせ方',
    tipsDesc: 'サビなどの大声で歌ったときに、緑のマーカー（-12dB 前後）を中心に振れるように調整すると、歪みのないクリアな歌声が録れます。',
    tipsOs: 'Ubuntu / PC: OS設定「サウンド ➔ 入力音量」で微調整してください。',
    tipsMobile: 'スマホ / ノートPC: 胸から上が映る位置（腕を伸ばした 50〜80cm 程度）に離すと、画角も音質もベストになります。',
    monitorTitle: '自分の声をイヤホンでモニター',
    monitorVol: 'モニター音量',
    monitorWarn: '⚠️ 必ずイヤホンを装着してご使用ください（スピーカーではハウリングします）。遅延が気になる場合は片耳イヤホンを推奨します。',
    alertDeviceError: 'カメラまたはマイクの起動に失敗しました。権限を許可してください。',
    unsupportedTitle: '非対応ブラウザです',
    unsupportedDesc: '本アプリは歌声の音質維持とミリ秒単位の同期のため、最新のWeb標準APIを使用しています。',
    recommendedEnv: '【推奨環境】PC (Chrome/Edge/Firefox), iOS 15.4 以降の Safari, Android Chrome',

    // デバイス別推奨ガイド（アコーディオン）
    recGuideTitle: '🎙️ デバイス別の推奨環境・遅延ゼロの歌い方',
    recGuidePcTitle: '💻 PC (パソコン)',
    recGuidePcDesc: '「ダイレクトモニター端子 & ゲイン調整ツマミ付きの USB マイク」が最も快適です。マイク内で遅延0msで声が返るため、ブラウザ側のモニターはOFFで完璧に歌えます。',
    recGuideMobileProTitle: '📱 スマートフォン (本格派)',
    recGuideMobileProDesc: '「イヤホン端子付きの USB-C / Lightning マイク」やスマホ対応インターフェースを使用すると、PC同様に遅延0msの環境が作れます。',
    recGuideMobileCasualTitle: '🎧 スマートフォン (手軽に・機材なし)',
    recGuideMobileCasualDesc: 'アプリのモニターを「OFF」にし、有線イヤホンを【片耳だけ外して】歌うのがプロも使う王道テクニックです。伴奏を片耳で聴きながら、外した耳で自分の生声（完全遅延ゼロ）を直接聴くことで違和感なくピッチをとれます。',
  },
  en: {
    appTitle: 'Karaoke Practice Machine',
    compatOk: 'Compatible',
    cameraPreviewDesc: 'All filters (echo cancellation, noise suppression, AGC) are disabled to capture your pure vocal dynamics.',
    btnStartDevices: 'Start Camera & Pure Mic',
    micLevelTitle: 'Mic Input Level (dBFS)',
    clipLabel: 'CLIP (0dB)',
    targetMarker: '▲ Target -12dB',
    tipsTitle: 'Recommended Framing & Input Level',
    tipsDesc: 'Adjust so that your loud vocals (like in the chorus) peak around the green marker (-12dB) to prevent distortion and sound clear.',
    tipsOs: 'Ubuntu / PC: Adjust in OS "Settings ➔ Sound ➔ Input Volume".',
    tipsMobile: 'Phone / Laptop: Keep it at arm\'s length (50–80 cm, upper body in frame) for both ideal shot framing and vocal clarity.',
    monitorTitle: 'Monitor Vocal in Headphones',
    monitorVol: 'Monitor Volume',
    monitorWarn: '⚠️ Use headphones only (speakers will cause acoustic feedback loop). If latency is bothersome, single-ear listening is recommended.',
    alertDeviceError: 'Failed to access camera or microphone. Please check permissions.',
    unsupportedTitle: 'Unsupported Browser',
    unsupportedDesc: 'This app requires modern Web APIs for high-fidelity audio and millisecond-accurate sync.',
    recommendedEnv: 'Recommended: PC (Chrome/Edge/Firefox), Safari on iOS 15.4+, Android Chrome',

    // Recommended Guides (Accordion)
    recGuideTitle: '🎙️ Recommended Setups & Zero-Latency Tips',
    recGuidePcTitle: '💻 PC / Laptop',
    recGuidePcDesc: 'A USB microphone with "Direct Monitoring & Hardware Gain Knob" is best. It returns your voice with 0ms latency directly inside the mic (keep app monitor OFF).',
    recGuideMobileProTitle: '📱 Smartphone (Pro / Dedicated Gear)',
    recGuideMobileProDesc: 'Use a USB-C / Lightning microphone with a built-in headphone jack or an audio interface for a hardware-level zero-latency monitor.',
    recGuideMobileCasualTitle: '🎧 Smartphone (Casual / Free Technique)',
    recGuideMobileCasualDesc: 'Turn app monitor "OFF" and take out one earphone ("One-Ear Style"). Listen to the backing track in one ear while hearing your natural voice with zero latency in the free ear—a standard trick used by pro vocalists.',
  },
};

export function getInitialLanguage(): Language {
  const saved = localStorage.getItem('karaoke_lang') as Language;
  if (saved === 'ja' || saved === 'en') {
    return saved;
  }
  const browserLang = navigator.language || (navigator.languages && navigator.languages[0]) || '';
  return browserLang.toLowerCase().startsWith('ja') ? 'ja' : 'en';
}
