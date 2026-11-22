// src/components/UnsupportedNotice.tsx
import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  reasons: string[];
}

export const UnsupportedNotice: React.FC<Props> = ({ reasons }) => {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-800 border border-red-500/30 rounded-2xl p-6 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold text-red-400">非対応ブラウザです</h1>
        <p className="text-sm text-slate-300">
          本アプリは歌声の音質維持とミリ秒単位の同期のため、最新のWeb標準APIを使用しています。
        </p>
        <div className="bg-slate-950/60 rounded-xl p-4 text-left text-xs text-red-300/90 space-y-2">
          {reasons.map((r, i) => (
            <div key={i} className="flex items-start gap-2">
              <span>•</span>
              <span>{r}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400">
          【推奨環境】PC (Chrome/Edge/Firefox), iOS 15.4 以降の Safari, Android Chrome
        </p>
      </div>
    </div>
  );
};
