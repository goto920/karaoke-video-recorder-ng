import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';
import { translations, type Language } from '../i18n';

interface Props {
  lang: Language;
}

export const ReloadPrompt: React.FC<Props> = ({ lang }) => {
  const t = translations[lang];

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setNeedRefresh(false);
  };

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md">
      {/* バウンスさせず、ピタッと安定したダークトースト */}
      <div className="bg-slate-900 border border-indigo-500/50 text-slate-100 p-4 rounded-2xl shadow-2xl shadow-indigo-950/80 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-600/20 text-indigo-400 flex items-center justify-center shrink-0">
            <RefreshCw className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">{t.updateAvailableTitle}</p>
            <p className="text-[11px] text-slate-400">{t.updateAvailableDesc}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => updateServiceWorker(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition active:scale-95 cursor-pointer shadow"
          >
            {t.btnUpdateNow}
          </button>
          <button
            onClick={close}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
