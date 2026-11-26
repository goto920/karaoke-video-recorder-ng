import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Download,
  Sliders,
  Volume2,
  Mic,
  ChevronDown,
  Sparkles,
  SlidersHorizontal,
  SkipBack,
} from 'lucide-react';
import { translations, type Language } from '../i18n';

type ScaleMode = 200 | 500 | 1000;

interface Props {
  videoBlob: Blob | null;
  vocalData: Float32Array;
  bgmBuffer: AudioBuffer | null;
  audioCtx: AudioContext;
  lang: Language;
  bgmVol: number;
  setBgmVol: (vol: number) => void;
  onReset: () => void;
  onExport: (offsetMs: number, bgmGain: number, vocalGain: number) => void;
}

export const PreviewPlayer: React.FC<Props> = ({
  videoBlob,
  vocalData,
  bgmBuffer,
  audioCtx,
  lang,
  bgmVol,
  setBgmVol,
  onReset,
  onExport,
}) => {
  const t = translations[lang];

  const [isPlaying, setIsPlaying] = useState(false);
  const [scaleMode, setScaleMode] = useState<ScaleMode>(500); // 200, 500, 1000ms
  const [offsetMs, setOffsetMs] = useState(-60);
  const [vocalVol, setVocalVol] = useState(1.4);
  const [masterVol, setMasterVol] = useState(1.0);

  // 再生プログレス（シークバー）
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const animFrameRef = useRef<number | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const startOffsetRef = useRef<number>(0);

  // エフェクトラック
  const [showFxRack, setShowFxRack] = useState(false);
  const [clarity, setClarity] = useState(50);
  const [comp, setComp] = useState(50);
  const [reverb, setReverb] = useState(30);
  const [delay, setDelay] = useState(0);
  const [maximizer, setMaximizer] = useState<'off' | 'natural' | 'loud'>('natural');

  const videoRef = useRef<HTMLVideoElement>(null);
  const videoUrlRef = useRef<string>('');

  const bgmSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const vocalSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const bgmGainRef = useRef<GainNode | null>(null);
  const vocalGainRef = useRef<GainNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const vocalDelayRef = useRef<DelayNode | null>(null);
  const vocalBufferRef = useRef<AudioBuffer | null>(null);

  // 全体時間の計算（動画、ボーカル、伴奏の最大値）
  useEffect(() => {
    const vocalSec = vocalData.length / audioCtx.sampleRate;
    const bgmSec = bgmBuffer ? bgmBuffer.duration : 0;
    const maxDur = Math.max(vocalSec, bgmSec);
    setDuration(maxDur);

    if (videoBlob) {
      videoUrlRef.current = URL.createObjectURL(videoBlob);
      if (videoRef.current) {
        videoRef.current.src = videoUrlRef.current;
        videoRef.current.defaultMuted = true;
        videoRef.current.muted = true;
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current?.duration) {
            setDuration((prev) => Math.max(prev, videoRef.current?.duration || 0));
          }
        };
      }
    }

    const vBuf = audioCtx.createBuffer(1, vocalData.length, audioCtx.sampleRate);
    vBuf.getChannelData(0).set(vocalData);
    vocalBufferRef.current = vBuf;

    return () => {
      if (videoUrlRef.current) URL.revokeObjectURL(videoUrlRef.current);
      stopAudio();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [videoBlob, vocalData]);

  // 音量変更
  useEffect(() => {
    if (bgmGainRef.current) bgmGainRef.current.gain.value = bgmVol;
    if (vocalGainRef.current) vocalGainRef.current.gain.value = vocalVol;
    if (masterGainRef.current) masterGainRef.current.gain.value = masterVol;
  }, [bgmVol, vocalVol, masterVol]);

  // ★1.2秒（1200ms）のベース遅延マージンで、1000ms戻しも完全にカバー
  const BASE_DELAY_SEC = 1.2;

  useEffect(() => {
    if (vocalDelayRef.current && audioCtx) {
      const targetDelaySec = Math.max(0, BASE_DELAY_SEC + offsetMs / 1000);
      vocalDelayRef.current.delayTime.setTargetAtTime(targetDelaySec, audioCtx.currentTime, 0.03);
    }
  }, [offsetMs, audioCtx]);

  // プログレスバーの更新ループ
  const updateProgress = () => {
    if (!isPlaying) return;
    const elapsed = audioCtx.currentTime - playbackStartTimeRef.current;
    const cur = startOffsetRef.current + elapsed;
    if (cur >= duration && duration > 0) {
      pauseAll();
      setCurrentTime(0);
      startOffsetRef.current = 0;
    } else {
      setCurrentTime(cur);
      animFrameRef.current = requestAnimationFrame(updateProgress);
    }
  };

  const stopAudio = () => {
    try {
      bgmSourceRef.current?.stop();
      vocalSourceRef.current?.stop();
    } catch {}
    bgmSourceRef.current = null;
    vocalSourceRef.current = null;
  };

  const playAll = (fromOffset = currentTime) => {
    stopAudio();
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    const now = audioCtx.currentTime + 0.05;
    playbackStartTimeRef.current = now;
    startOffsetRef.current = fromOffset;

    const masterGain = audioCtx.createGain();
    masterGain.gain.value = masterVol;
    masterGain.connect(audioCtx.destination);
    masterGainRef.current = masterGain;

    const bgmGain = audioCtx.createGain();
    bgmGain.gain.value = bgmVol;
    bgmGain.connect(masterGain);
    bgmGainRef.current = bgmGain;

    const vocalGain = audioCtx.createGain();
    vocalGain.gain.value = vocalVol;
    vocalGain.connect(masterGain);
    vocalGainRef.current = vocalGain;

    const vocalDelay = audioCtx.createDelay(2.5); // 最大2.5秒まで許容
    vocalDelay.delayTime.value = Math.max(0, BASE_DELAY_SEC + offsetMs / 1000);
    vocalDelay.connect(vocalGain);
    vocalDelayRef.current = vocalDelay;

    if (bgmBuffer && fromOffset < bgmBuffer.duration) {
      const bgmSrc = audioCtx.createBufferSource();
      bgmSrc.buffer = bgmBuffer;
      bgmSrc.connect(bgmGain);
      bgmSrc.start(now + BASE_DELAY_SEC, fromOffset);
      bgmSourceRef.current = bgmSrc;
    }

    if (vocalBufferRef.current && fromOffset < vocalBufferRef.current.duration) {
      const vocalSrc = audioCtx.createBufferSource();
      vocalSrc.buffer = vocalBufferRef.current;
      vocalSrc.connect(vocalDelay);
      vocalSrc.start(now, fromOffset);
      vocalSourceRef.current = vocalSrc;
    }

    if (videoRef.current) {
      videoRef.current.currentTime = fromOffset;
      setTimeout(() => {
        videoRef.current?.play().catch(() => {});
      }, 50 + BASE_DELAY_SEC * 1000);
    }

    setIsPlaying(true);
    animFrameRef.current = requestAnimationFrame(updateProgress);
  };

  const pauseAll = () => {
    stopAudio();
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    setIsPlaying(false);
  };

  const togglePlay = () => {
    if (isPlaying) {
      pauseAll();
    } else {
      playAll(currentTime);
    }
  };

  // 先頭巻き戻し
  const handleRewind = () => {
    pauseAll();
    setCurrentTime(0);
    startOffsetRef.current = 0;
    if (videoRef.current) videoRef.current.currentTime = 0;
  };

  // シーク
  const handleSeek = (newTime: number) => {
    setCurrentTime(newTime);
    startOffsetRef.current = newTime;
    if (videoRef.current) videoRef.current.currentTime = newTime;
    if (isPlaying) {
      playAll(newTime);
    }
  };

  // スケールに応じた最小値・最大値の計算
  const getScaleRange = () => {
    switch (scaleMode) {
      case 200:
        return { min: -200, max: 30 };
      case 500:
        return { min: -500, max: 50 };
      case 1000:
        return { min: -1000, max: 50 };
    }
  };
  const { min: minRange, max: maxRange } = getScaleRange();

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* プレビュービューポート */}
      <div className="relative aspect-video bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
        {videoBlob ? (
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover -scale-x-100"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 text-center p-6">
            <div className={`w-20 h-20 rounded-full bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 ${isPlaying ? 'scale-110 shadow-lg shadow-indigo-500/30' : ''} transition-transform duration-300`}>
              <Mic className={`w-10 h-10 ${isPlaying ? 'animate-pulse text-indigo-300' : ''}`} />
            </div>
            <div>
              <p className="text-base font-bold text-white">🎙️ 音声プレビュー</p>
              <p className="text-xs text-slate-400 mt-1">伴奏とのタイミングと音量バランスを整えて保存します</p>
            </div>
          </div>
        )}
      </div>

      {/* シークバー（プログレスバー） */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1.5">
        <div className="flex justify-between text-[11px] font-mono text-slate-400">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
        <input
          type="range"
          min="0"
          max={duration || 100}
          step="0.1"
          value={currentTime}
          onChange={(e) => handleSeek(parseFloat(e.target.value))}
          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
        />
      </div>

      {/* コントロールバー */}
      <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* 先頭巻き戻し */}
          <button
            onClick={handleRewind}
            title={t.btnRewind}
            className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition active:scale-95 cursor-pointer"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* 再生 / 一時停止 */}
          <button
            onClick={togglePlay}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-4 py-2 rounded-lg transition active:scale-95 cursor-pointer shadow"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? '一時停止' : '再生'}</span>
          </button>

          {/* 録り直し */}
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 text-xs px-2.5 py-2 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.btnReRecord}</span>
          </button>
        </div>

        {/* ダウンロード */}
        <button
          onClick={() => onExport(offsetMs, bgmVol, vocalVol)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2 rounded-lg transition active:scale-95 cursor-pointer shadow text-xs sm:text-sm"
        >
          <Download className="w-4 h-4" />
          <span>{videoBlob ? t.btnExport : t.btnExportAudio}</span>
        </button>
      </div>

      {/* 基本コントロール（タイミング & バランス） */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-4">
        {/* タイミング調整ヘッダー & スケール切替 */}
        <div className="space-y-2 pb-3 border-b border-slate-800/60">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-300">
              <Sliders className="w-3.5 h-3.5 text-indigo-400" />
              <span>{videoBlob ? t.syncOffsetVideoTitle : t.syncOffsetTitle}</span>
              <span className="font-mono text-indigo-400 font-bold ml-1">
                {offsetMs > 0 ? `+${offsetMs}` : offsetMs} ms
              </span>
            </span>

            {/* スケール切替ボタン [ 200 | 500 | 1000 ] */}
            <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[10px] font-mono self-start sm:self-auto">
              <span className="text-slate-500 px-1.5">Scale:</span>
              <button
                onClick={() => setScaleMode(200)}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  scaleMode === 200 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                200
              </button>
              <button
                onClick={() => setScaleMode(500)}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  scaleMode === 500 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                500
              </button>
              <button
                onClick={() => setScaleMode(1000)}
                className={`px-2 py-0.5 rounded transition cursor-pointer ${
                  scaleMode === 1000 ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                1000
              </button>
            </div>
          </div>

          {/* スライダー & ステッパー [-5ms] [+5ms] */}
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => setOffsetMs((prev) => Math.max(minRange, prev - 5))}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded-lg transition active:scale-95 shrink-0 cursor-pointer"
            >
              -5ms
            </button>

            <div className="flex-1 space-y-1">
              <input
                type="range"
                min={minRange}
                max={maxRange}
                step="5"
                value={offsetMs}
                onChange={(e) => setOffsetMs(parseInt(e.target.value, 10))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span className="text-indigo-400">◀ 歌を進める・早くする ({minRange}ms)</span>
                <span>0ms</span>
                <span>+{maxRange}ms ▶</span>
              </div>
            </div>

            <button
              onClick={() => setOffsetMs((prev) => Math.min(maxRange, prev + 5))}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono font-bold rounded-lg transition active:scale-95 shrink-0 cursor-pointer"
            >
              +5ms
            </button>
          </div>
        </div>

        {/* 音量バランス調整 (3本: 伴奏, 歌声, マスター) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span>{t.bgmVolume}</span>
              <span className="font-mono">{Math.round(bgmVol * 100)}%</span>
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

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1">
                <Mic className="w-3 h-3 text-indigo-400" />
                <span>{t.vocalVolume}</span>
              </span>
              <span className="font-mono text-indigo-300">{Math.round(vocalVol * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="3.0"
              step="0.05"
              value={vocalVol}
              onChange={(e) => setVocalVol(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.masterVolume}</span>
              </span>
              <span className="font-mono text-emerald-400 font-bold">{Math.round(masterVol * 100)}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={masterVol}
              onChange={(e) => setMasterVol(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* 🎛️ スタジオ・エフェクトラック（開閉式） */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-xs">
        <button
          onClick={() => setShowFxRack(!showFxRack)}
          className="w-full flex items-center justify-between p-3.5 text-left text-slate-300 hover:text-slate-100 hover:bg-slate-800/40 transition cursor-pointer font-medium"
        >
          <div className="flex items-center gap-2 text-indigo-300 font-semibold">
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
            <span>{t.fxRackTitle}</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
              showFxRack ? 'rotate-180 text-indigo-400' : ''
            }`}
          />
        </button>

        {showFxRack && (
          <div className="p-4 pt-2 border-t border-slate-800/60 space-y-5 bg-slate-950/60">
            {/* 1. ボーカル専用チャンネルストリップ */}
            <div className="space-y-3">
              <p className="text-[11px] font-bold text-indigo-400 tracking-wider uppercase flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{t.fxRackVocalHeader}</span>
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>{t.fxClarity}</span>
                    <span className="font-mono text-indigo-300">{clarity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={clarity}
                    onChange={(e) => setClarity(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>{t.fxComp}</span>
                    <span className="font-mono text-indigo-300">{comp}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={comp}
                    onChange={(e) => setComp(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>{t.fxReverb}</span>
                    <span className="font-mono text-indigo-300">{reverb}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={reverb}
                    onChange={(e) => setReverb(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>

                <div className="bg-slate-900/90 border border-slate-800 p-2.5 rounded-lg space-y-1.5">
                  <div className="flex justify-between text-slate-400">
                    <span>{t.fxDelay}</span>
                    <span className="font-mono text-indigo-300">{delay}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={delay}
                    onChange={(e) => setDelay(parseInt(e.target.value, 10))}
                    className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                  />
                </div>
              </div>
            </div>

            {/* 2. マスタリング & 3バンドマキシマイザー */}
            <div className="space-y-3 pt-3 border-t border-slate-800/60">
              <p className="text-[11px] font-bold text-emerald-400 tracking-wider uppercase">
                {t.fxRackMasterHeader}
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 border border-slate-800 p-3 rounded-lg">
                <div className="space-y-0.5">
                  <span className="text-xs font-medium text-slate-200">{t.fxMaximizer}</span>
                  <p className="text-[10.5px] text-slate-400">オケとボーカルをプロ音圧で一体化接着</p>
                </div>

                <div className="flex items-center bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-xs">
                  <button
                    onClick={() => setMaximizer('off')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                      maximizer === 'off' ? 'bg-slate-800 text-white font-bold' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.fxPresetOff}
                  </button>
                  <button
                    onClick={() => setMaximizer('natural')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                      maximizer === 'natural' ? 'bg-indigo-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.fxPresetNatural}
                  </button>
                  <button
                    onClick={() => setMaximizer('loud')}
                    className={`px-3 py-1 rounded-md transition cursor-pointer ${
                      maximizer === 'loud' ? 'bg-emerald-600 text-white font-bold shadow' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {t.fxPresetLoud}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
