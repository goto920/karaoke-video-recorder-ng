import React from 'react';
import { X, HelpCircle, AlertCircle, Headphones, Bluetooth } from 'lucide-react';
import { translations, type Language } from '../i18n';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
}

export const HelpModal: React.FC<Props> = ({ isOpen, onClose, lang }) => {
  if (!isOpen) return null;
  const t = translations[lang];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-base">
            <HelpCircle className="w-5 h-5" />
            <span>{t.helpTitle}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. レベル & 構図 Tips */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 space-y-2 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{t.tipsTitle}</span>
          </div>
          <p className="text-slate-300 leading-relaxed">{t.tipsDesc}</p>
          <div className="border-t border-slate-800/60 pt-2 space-y-1 text-slate-400">
            <p>• {t.tipsOs}</p>
            <p>• {t.tipsMobile}</p>
          </div>
        </div>

        {/* 2. ヘッドホン接続の注意 */}
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 text-xs text-amber-300/90 leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-amber-400">
            <Headphones className="w-4 h-4" />
            <span>イヤホン接続時の注意点</span>
          </div>
          <p>{t.headphoneNotice}</p>
        </div>

        {/* 3. デバイス別推奨環境 */}
        <div className="space-y-3 text-xs">
          <p className="font-bold text-slate-300 text-sm">🎙️ デバイス別の推奨歌唱スタイル</p>

          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5 space-y-1">
            <p className="font-semibold text-indigo-300">{t.recGuidePcTitle}</p>
            <p className="text-slate-400 leading-relaxed">{t.recGuidePcDesc}</p>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5 space-y-1">
            <p className="font-semibold text-emerald-300">{t.recGuideMobileCasualTitle}</p>
            <p className="text-slate-400 leading-relaxed">{t.recGuideMobileCasualDesc}</p>
          </div>

          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5 space-y-1">
            <p className="font-semibold text-amber-300">{t.recGuideMobileProTitle}</p>
            <p className="text-slate-400 leading-relaxed">{t.recGuideMobileProDesc}</p>
          </div>

          {/* Bluetooth ガイド */}
          <div className="bg-slate-950/40 border border-slate-800/60 rounded-xl p-3.5 space-y-1">
            <p className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <Bluetooth className="w-3.5 h-3.5" />
              <span>{t.recGuideBtTitle}</span>
            </p>
            <p className="text-slate-400 leading-relaxed">{t.recGuideBtDesc}</p>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2.5 rounded-xl transition text-xs cursor-pointer"
        >
          {t.helpClose}
        </button>
      </div>
    </div>
  );
};
