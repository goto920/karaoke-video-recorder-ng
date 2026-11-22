// src/App.tsx
import { useEffect, useRef, useState } from 'react';
import { checkBrowserSupport } from './core/compatibility';
import { UnsupportedNotice } from './components/UnsupportedNotice';
import { translations, getInitialLanguage, type Language } from './i18n';
import { Mic, Video, Volume2, Headphones, AlertCircle, Globe, ChevronDown } from 'lucide-react';

export default function App() {
  const [lang, setLang] = useState<Language>(getInitialLanguage);
  const t = translations[lang];

  const [support, setSupport] = useState<{ supported: boolean; reasons: string[] } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [vuDb, setVuDb] = useState(-60);
  const [isClipped, setIsClipped] = useState(false);

  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [monitorVolume, setMonitorVolume] = useState(0.5);
  const [showGuide, setShowGuide] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const clipTimerRef = useRef<number | null>(null);

  useEffect(() => {
    setSupport(checkBrowserSupport());
  }, []);

  const handleLanguageChange = (newLang: Language) => {
    setLang(newLang);
    localStorage.setItem('karaoke_lang', newLang);
  };

  useEffect(() => {
    if (monitorGainRef.current) {
      monitorGainRef.current.gain.value = monitorEnabled ? monitorVolume : 0;
    }
  }, [monitorEnabled, monitorVolume]);

  const startDevices = async () => {
    try {
      const videoStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = videoStream;
      }

      const audioCtx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
      await audioCtx.audioWorklet.addModule(`/audio-recorder-worklet.js?t=${Date.now()}`);
      audioCtxRef.current = audioCtx;

      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      const micSource = audioCtx.createMediaStreamSource(micStream);
      const workletNode = new AudioWorkletNode(audioCtx, 'audio-recorder-worklet');

      const monitorGain = audioCtx.createGain();
      monitorGain.gain.value = monitorEnabled ? monitorVolume : 0;
      monitorGainRef.current = monitorGain;

      micSource.connect(monitorGain);
      monitorGain.connect(audioCtx.destination);

      workletNode.port.onmessage = (e) => {
        if (e.data.type === 'VU') {
          let currentDb = -60;
          if (typeof e.data.db === 'number') {
            currentDb = e.data.db;
          } else if (typeof e.data.level === 'number' && e.data.level > 0.0001) {
            currentDb = 20 * Math.log10(e.data.level);
          }
          setVuDb(currentDb);

          if (e.data.clipped) {
            setIsClipped(true);
            if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
            clipTimerRef.current = window.setTimeout(() => {
              setIsClipped(false);
            }, 1500);
          }
        }
      };
      micSource.connect(workletNode);

      setIsReady(true);
    } catch (err) {
      console.error(err);
      alert(t.alertDeviceError);
    }
  };

  if (!support) return null;
  if (!support.supported) {
    return <UnsupportedNotice reasons={support.reasons} />;
  }

  const safeDb = typeof vuDb === 'number' ? vuDb : -60;
  const minDb = -48;
  const maxDb = 0;
  const meterPercent = Math.min(
    100,
    Math.max(0, Math.round(((safeDb - minDb) / (maxDb - minDb)) * 100))
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 flex flex-col items-center">
      <header className="w-full max-w-2xl flex items-center justify-between py-4 border-b border-slate-800 mb-6">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <span>🎤</span> {t.appTitle}
        </h1>

        <div className="flex items-center gap-3">
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium hidden sm:inline-block">
            {t.compatOk}
          </span>

          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-1.5 mr-1" />
            <button
              onClick={() => handleLanguageChange('ja')}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${
                lang === 'ja'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              日本語
            </button>
            <button
              onClick={() => handleLanguageChange('en')}
              className={`px-2 py-1 rounded-md font-medium transition cursor-pointer ${
                lang === 'en'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              EN
            </button>
          </div>
        </div>
      </header>

      <main className="w-full max-w-2xl flex flex-col gap-5">
        {/* カメラビューポート */}
        <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />
          {!isReady && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm gap-4 p-6 text-center">
              <div className="flex gap-4 text-slate-400">
                <Video className="w-8 h-8 animate-pulse" />
                <Mic className="w-8 h-8 animate-pulse" />
              </div>
              <p className="text-sm text-slate-300 max-w-xs leading-relaxed">
                {t.cameraPreviewDesc}
              </p>
              <button
                onClick={startDevices}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-2.5 rounded-xl transition shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer"
              >
                {t.btnStartDevices}
              </button>
            </div>
          )}
        </div>

        {isReady && (
          <div className="space-y-4">
            {/* VUメーター & dB レベル */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-slate-300 font-medium">
                  <Volume2 className="w-4 h-4 text-indigo-400" />
                  <span>{t.micLevelTitle}</span>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider transition-all duration-150 ${
                      isClipped
                        ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/50'
                        : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {t.clipLabel}
                  </span>

                  <span className={`w-16 text-right font-bold ${safeDb >= -6 ? 'text-red-400' : safeDb >= -18 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {safeDb <= -50 ? '-∞ dB' : `${safeDb.toFixed(1)} dB`}
                  </span>
                </div>
              </div>

              <div className="relative pt-1 pb-4">
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full transition-all duration-100 ease-out ${
                      isClipped || safeDb >= -3
                        ? 'bg-red-500'
                        : safeDb >= -18
                        ? 'bg-emerald-400'
                        : 'bg-slate-600'
                    }`}
                    style={{ width: `${meterPercent}%` }}
                  />
                </div>

                <div className="absolute top-4 left-[75%] -translate-x-1/2 flex flex-col items-center">
                  <div className="w-0.5 h-1.5 bg-emerald-500" />
                  <span className="text-[10px] font-mono text-emerald-400 font-bold whitespace-nowrap">
                    {t.targetMarker}
                  </span>
                </div>

                <div className="absolute top-4 left-0 text-[9px] font-mono text-slate-500">-48</div>
                <div className="absolute top-4 left-[50%] -translate-x-1/2 text-[9px] font-mono text-slate-500">-24</div>
                <div className="absolute top-4 right-0 text-[9px] font-mono text-slate-500">0dB</div>
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-950/60 rounded-lg p-3 border border-slate-800/80 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
                  <AlertCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t.tipsTitle}</span>
                </div>
                <p>{t.tipsDesc}</p>
                <div className="text-[10.5px] text-slate-400 border-t border-slate-800/60 pt-1.5 mt-1 space-y-0.5">
                  <p>• {t.tipsOs}</p>
                  <p>• {t.tipsMobile}</p>
                </div>
              </div>
            </div>

            {/* マイクモニター設定（イヤホン専用） */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-indigo-400" />
                  <span className="text-sm font-medium">{t.monitorTitle}</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={monitorEnabled}
                    onChange={(e) => setMonitorEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {monitorEnabled && (
                <div className="space-y-2 pt-2 border-t border-slate-800/60">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{t.monitorVol}</span>
                    <span className="font-mono">{Math.round(monitorVolume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={monitorVolume}
                    onChange={(e) => setMonitorVolume(parseFloat(e.target.value))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                  <p className="text-[11px] text-amber-400/80">
                    {t.monitorWarn}
                  </p>
                </div>
              )}
            </div>

            {/* デバイス別推奨ガイド（開閉アコーディオン） */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden text-xs">
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="w-full flex items-center justify-between p-3.5 text-left text-slate-300 hover:text-slate-100 hover:bg-slate-800/40 transition cursor-pointer font-medium"
              >
                <span>{t.recGuideTitle}</span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                    showGuide ? 'rotate-180 text-indigo-400' : ''
                  }`}
                />
              </button>

              {showGuide && (
                <div className="p-4 pt-1 border-t border-slate-800/60 space-y-3 text-slate-300 leading-relaxed bg-slate-950/40">
                  <div className="space-y-1">
                    <p className="font-semibold text-indigo-300">{t.recGuidePcTitle}</p>
                    <p className="text-[11px] text-slate-400">{t.recGuidePcDesc}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-300">{t.recGuideMobileCasualTitle}</p>
                    <p className="text-[11px] text-slate-400">{t.recGuideMobileCasualDesc}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-amber-300">{t.recGuideMobileProTitle}</p>
                    <p className="text-[11px] text-slate-400">{t.recGuideMobileProDesc}</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
