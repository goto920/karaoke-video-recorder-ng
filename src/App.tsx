// src/App.tsx
import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { checkBrowserSupport } from './core/compatibility';
import { UnsupportedNotice } from './components/UnsupportedNotice';
import { PreviewPlayer } from './components/PreviewPlayer';
import { ReloadPrompt } from './components/ReloadPrompt';
import { HelpModal } from './components/HelpModal';
import { createSafeMediaRecorder } from './core/video/mediaRecorderHelper';
import { translations, getInitialLanguage, type Language } from './i18n';
import {
  Mic,
  Video,
  Volume2,
  Headphones,
  Globe,
  Music,
  Square,
  CircleDot,
  Settings2,
  RotateCw,
  HelpCircle,
} from 'lucide-react';

type AppState = 'IDLE' | 'COUNTDOWN' | 'RECORDING' | 'PREVIEW';
type RecordMode = 'video' | 'audio';

export default function App() {
  const [lang, setLang] = useState<Language>(getInitialLanguage);
  const t = translations[lang];

  const [support, setSupport] = useState<{ supported: boolean; reasons: string[] } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [appState, setAppState] = useState<AppState>('IDLE');
  const [recordMode, setRecordMode] = useState<RecordMode>('video');
  const [countdown, setCountdown] = useState(3);
  const [isHelpOpen, setIsHelpOpen] = useState(false); // ★ヘルプモーダル

  // デバイス一覧
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>('');
  const [selectedCamId, setSelectedCamId] = useState<string>('');

  // マイク & VU
  const [vuDb, setVuDb] = useState(-60);
  const [isClipped, setIsClipped] = useState(false);
  const [monitorEnabled, setMonitorEnabled] = useState(false);
  const [monitorVolume, setMonitorVolume] = useState(0.5);

  // 音源（BGM）
  const [bgmName, setBgmName] = useState<string>('');
  const [bgmVol, setBgmVol] = useState(0.8);
  const bgmBufferRef = useRef<AudioBuffer | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);

  // 録音・録画データ
  const recordedChunksRef = useRef<Float32Array[]>([]);
  const [recordedVocal, setRecordedVocal] = useState<Float32Array | null>(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);

  // 参照
  const videoRef = useRef<HTMLVideoElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const monitorGainRef = useRef<GainNode | null>(null);
  const clipTimerRef = useRef<number | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const videoBlobsRef = useRef<Blob[]>([]);
  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);

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

  useEffect(() => {
    if (bgmGainRef.current) {
      bgmGainRef.current.gain.value = bgmVol;
    }
  }, [bgmVol]);

  useEffect(() => {
    if (appState === 'IDLE' && isReady && videoRef.current && videoStreamRef.current && recordMode === 'video') {
      videoRef.current.srcObject = videoStreamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [appState, isReady, recordMode]);

  const refreshDevices = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const mics = devices.filter((d) => d.kind === 'audioinput');
    const cams = devices.filter((d) => d.kind === 'videoinput');
    setAudioDevices(mics);
    setVideoDevices(cams);
  };

  const startDevices = async () => {
    try {
      const combinedStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      const videoTrack = combinedStream.getVideoTracks()[0];
      const audioTrack = combinedStream.getAudioTracks()[0];

      setSelectedCamId(videoTrack.getSettings().deviceId || '');
      setSelectedMicId(audioTrack.getSettings().deviceId || '');

      const videoStream = new MediaStream([videoTrack]);
      videoStreamRef.current = videoStream;
      if (videoRef.current && recordMode === 'video') {
        videoRef.current.srcObject = videoStream;
        await videoRef.current.play().catch(() => {});
      }

      const audioCtx = new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' });
      const workletUrl = `${import.meta.env.BASE_URL}audio-recorder-worklet.js?t=${Date.now()}`;
      await audioCtx.audioWorklet.addModule(workletUrl);
      audioCtxRef.current = audioCtx;

      const micStream = new MediaStream([audioTrack]);
      const micSource = audioCtx.createMediaStreamSource(micStream);
      micSourceRef.current = micSource;

      const workletNode = new AudioWorkletNode(audioCtx, 'audio-recorder-worklet');
      workletNodeRef.current = workletNode;

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
            clipTimerRef.current = window.setTimeout(() => setIsClipped(false), 1500);
          }
        } else if (e.data.type === 'DATA') {
          recordedChunksRef.current.push(new Float32Array(e.data.buffer));
        }
      };
      micSource.connect(workletNode);

      await refreshDevices();
      setIsReady(true);
    } catch (err: unknown) {
      console.error(err);
      const errorMsg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      alert(`${t.alertDeviceError}\n(${errorMsg})`);
    }
  };

  const handleMicChange = async (deviceId: string) => {
    setSelectedMicId(deviceId);
    if (!audioCtxRef.current || !workletNodeRef.current || !monitorGainRef.current) return;

    try {
      const newMicStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          deviceId: { exact: deviceId },
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
        video: false,
      });

      micSourceRef.current?.disconnect();
      const newSource = audioCtxRef.current.createMediaStreamSource(newMicStream);
      newSource.connect(monitorGainRef.current);
      newSource.connect(workletNodeRef.current);
      micSourceRef.current = newSource;
    } catch (err) {
      console.error('Failed to change mic:', err);
    }
  };

  const handleCameraChange = async (deviceId: string) => {
    setSelectedCamId(deviceId);
    try {
      const newCamStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });

      videoStreamRef.current?.getTracks().forEach((t) => t.stop());
      videoStreamRef.current = newCamStream;
      if (videoRef.current && recordMode === 'video') {
        videoRef.current.srcObject = newCamStream;
        await videoRef.current.play().catch(() => {});
      }
    } catch (err) {
      console.error('Failed to change camera:', err);
    }
  };

  const handleBgmFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !audioCtxRef.current) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const decoded = await audioCtxRef.current.decodeAudioData(arrayBuffer);
      bgmBufferRef.current = decoded;
      setBgmName(file.name);
    } catch (err) {
      console.error(err);
      alert('音声ファイルのデコードに失敗しました。対応形式: MP3, WAV, AAC, MP4');
    }
  };

  const handleStartCountdown = () => {
    setAppState('COUNTDOWN');
    setCountdown(3);

    let count = 3;
    const timer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setCountdown(count);
      } else {
        clearInterval(timer);
        startRecording();
      }
    }, 1000);
  };

  const startRecording = () => {
    if (!audioCtxRef.current || !workletNodeRef.current) return;
    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    setAppState('RECORDING');
    recordedChunksRef.current = [];
    videoBlobsRef.current = [];

    if (recordMode === 'video' && videoStreamRef.current) {
      const recorder = createSafeMediaRecorder(videoStreamRef.current);
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          videoBlobsRef.current.push(e.data);
        }
      };
      recorder.start(100);
      mediaRecorderRef.current = recorder;
    }

    workletNodeRef.current.port.postMessage({ command: 'START' });

    if (bgmBufferRef.current) {
      const bgmSource = ctx.createBufferSource();
      bgmSource.buffer = bgmBufferRef.current;

      const bgmGain = ctx.createGain();
      bgmGain.gain.value = bgmVol;
      bgmGain.connect(ctx.destination);
      bgmGainRef.current = bgmGain;

      bgmSource.connect(bgmGain);
      bgmSource.start();
      bgmSourceRef.current = bgmSource;
    }
  };

  const stopRecording = () => {
    try {
      bgmSourceRef.current?.stop();
    } catch {}
    bgmSourceRef.current = null;

    workletNodeRef.current?.port.postMessage({ command: 'STOP' });

    const totalLength = recordedChunksRef.current.reduce((acc, c) => acc + c.length, 0);
    const mergedVocal = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of recordedChunksRef.current) {
      mergedVocal.set(chunk, offset);
      offset += chunk.length;
    }
    setRecordedVocal(mergedVocal);

    if (recordMode === 'video' && mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.onstop = () => {
        const mimeType = mediaRecorderRef.current?.mimeType || 'video/webm';
        const fullBlob = new Blob(videoBlobsRef.current, { type: mimeType });
        setRecordedVideoBlob(fullBlob);
        setAppState('PREVIEW');
      };
      mediaRecorderRef.current.stop();
    } else {
      setRecordedVideoBlob(null);
      setAppState('PREVIEW');
    }
  };

  const handleResetToIdle = () => {
    setRecordedVideoBlob(null);
    setRecordedVocal(null);
    videoBlobsRef.current = [];
    recordedChunksRef.current = [];
    setAppState('IDLE');
  };

  const handleExport = (offsetMs: number, bgmGain: number, vocalGain: number) => {
    const modeText = recordMode === 'video' ? 'MP4 動画' : 'M4A 音声';
    alert(`エクスポート準備完了!\n形式: ${modeText}\nオフセット: ${offsetMs}ms\nBGM音量: ${Math.round(bgmGain * 100)}%\nボーカル音量: ${Math.round(vocalGain * 100)}%`);
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
      {/* ヘッダーエリア */}
      <header className="w-full max-w-2xl flex items-center justify-between py-4 border-b border-slate-800 mb-6">
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <span>🎤</span> {t.appTitle}
        </h1>

        <div className="flex items-center gap-2">
          <span className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2.5 py-1 rounded-full font-medium hidden sm:inline-block">
            {t.compatOk}
          </span>

          {/* ★右上の丸囲みヘルプボタン [ ? ] */}
          <button
            onClick={() => setIsHelpOpen(true)}
            title="使い方・推奨環境"
            className="p-1.5 text-slate-400 hover:text-indigo-300 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4 text-indigo-400" />
          </button>

          {/* 手動リロードボタン */}
          <button
            onClick={() => window.location.reload()}
            title={t.reloadTooltip}
            className="p-1.5 text-slate-400 hover:text-slate-200 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800 transition active:scale-95 cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>

          {/* 言語切り替え */}
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
        {/* モード切替タブ */}
        {appState === 'IDLE' && (
          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl self-center w-full sm:w-auto text-xs font-semibold">
            <button
              onClick={() => setRecordMode('video')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${
                recordMode === 'video'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Video className="w-3.5 h-3.5" />
              <span>{t.modeVideo}</span>
            </button>
            <button
              onClick={() => setRecordMode('audio')}
              className={`flex-1 sm:flex-none px-5 py-2 rounded-lg transition cursor-pointer flex items-center justify-center gap-2 ${
                recordMode === 'audio'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mic className="w-3.5 h-3.5" />
              <span>{t.modeAudio}</span>
            </button>
          </div>
        )}

        {appState === 'PREVIEW' && recordedVocal && audioCtxRef.current ? (
          <PreviewPlayer
            videoBlob={recordedVideoBlob}
            vocalData={recordedVocal}
            bgmBuffer={bgmBufferRef.current}
            audioCtx={audioCtxRef.current}
            lang={lang}
            bgmVol={bgmVol}
            setBgmVol={setBgmVol}
            onReset={handleResetToIdle}
            onExport={handleExport}
          />
        ) : (
          <>
            <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
              {recordMode === 'video' ? (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 text-center p-6">
                  <div className="w-20 h-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
                    <Mic className="w-10 h-10" />
                  </div>
                  <p className="text-sm font-semibold text-slate-300">{t.audioOnlyActive}</p>
                </div>
              )}

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

              {appState === 'COUNTDOWN' && (
                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                  <span className="text-8xl font-black text-indigo-400 animate-ping font-mono">
                    {countdown}
                  </span>
                </div>
              )}

              {appState === 'RECORDING' && (
                <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-600/90 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-lg animate-pulse">
                  <CircleDot className="w-4 h-4" />
                  <span>{recordMode === 'video' ? t.recordingBadge : t.recordingBadgeAudio}</span>
                </div>
              )}
            </div>

            {isReady && (
              <div className="space-y-4">
                {/* 伴奏選択 ＆ 録音中BGM音量 ＆ 録音ボタン */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col gap-3">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                    <label className="flex items-center gap-2.5 text-xs text-slate-300 bg-slate-800/80 hover:bg-slate-800 px-3.5 py-2.5 rounded-lg border border-slate-700 cursor-pointer w-full sm:w-auto transition">
                      <Music className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span className="truncate max-w-[200px]">
                        {bgmName ? bgmName : t.selectBgm}
                      </span>
                      <input
                        type="file"
                        accept="audio/*,.wav,.mp3,.aac,.m4a,.opus,.webm,video/*,.mp4"
                        onChange={handleBgmFileChange}
                        className="hidden"
                      />
                    </label>

                    {appState === 'IDLE' ? (
                      <button
                        onClick={handleStartCountdown}
                        className="w-full sm:w-auto bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-2.5 rounded-xl transition shadow-lg shadow-red-600/20 active:scale-95 cursor-pointer flex items-center justify-center gap-2"
                      >
                        <CircleDot className="w-4 h-4" />
                        <span>{t.btnRecordStart}</span>
                      </button>
                    ) : appState === 'RECORDING' ? (
                      <button
                        onClick={stopRecording}
                        className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-white font-bold px-6 py-2.5 rounded-xl transition border border-red-500/50 shadow-lg active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-red-400"
                      >
                        <Square className="w-4 h-4 fill-current" />
                        <span>{t.btnRecordStop}</span>
                      </button>
                    ) : null}
                  </div>

                  {bgmBufferRef.current && (
                    <div className="pt-2 border-t border-slate-800/60 space-y-1">
                      <div className="flex justify-between text-xs text-slate-400">
                        <span>カラオケ伴奏の音量（イヤホン）</span>
                        <span className="font-mono text-indigo-400">{Math.round(bgmVol * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="1.5"
                        step="0.05"
                        value={bgmVol}
                        onChange={(e) => setBgmVol(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                      />
                    </div>
                  )}
                </div>

                {/* デバイス選択 */}
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
                    <Settings2 className="w-4 h-4 text-indigo-400" />
                    <span>{t.deviceSelectTitle}</span>
                  </div>

                  <div className={`grid gap-3 text-xs ${recordMode === 'video' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                    <div className="space-y-1">
                      <label className="text-slate-400 flex items-center gap-1">
                        <Mic className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{t.micSelect}</span>
                      </label>
                      <select
                        value={selectedMicId}
                        onChange={(e) => handleMicChange(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none focus:border-indigo-500 transition cursor-pointer"
                      >
                        {audioDevices.map((d, i) => (
                          <option key={d.deviceId || i} value={d.deviceId}>
                            {d.label || `マイク ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {recordMode === 'video' && (
                      <div className="space-y-1">
                        <label className="text-slate-400 flex items-center gap-1">
                          <Video className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{t.cameraSelect}</span>
                        </label>
                        <select
                          value={selectedCamId}
                          onChange={(e) => handleCameraChange(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-200 outline-none focus:border-indigo-500 transition cursor-pointer"
                        >
                          {videoDevices.map((d, i) => (
                            <option key={d.deviceId || i} value={d.deviceId}>
                              {d.label || `カメラ ${i + 1}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* VUメーター */}
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
                </div>

                {/* マイクモニター設定 */}
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
              </div>
            )}
          </>
        )}
      </main>

      <footer className="w-full max-w-2xl text-center py-6 text-[10px] text-slate-600 font-mono">
        Build: {__BUILD_DATE__}
      </footer>

      {/* ヘルプモーダル (？ボタンで開く) */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} lang={lang} />

      {/* PWA 更新通知 */}
      <ReloadPrompt lang={lang} />
    </div>
  );
}
