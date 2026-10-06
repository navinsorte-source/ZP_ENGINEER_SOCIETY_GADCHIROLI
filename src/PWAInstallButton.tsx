import React, { useState } from 'react';
import { Download, Smartphone, X, WifiOff } from 'lucide-react';
import { usePWAInstall, useOnlineStatus } from './usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  return (
    <>
      <button
        onClick={async () => {
          if (isInstallable) {
            await install();
          } else {
            setShowGuideModal(true);
          }
        }}
        className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3.5 py-2 text-xs font-bold text-white shadow-sm hover:from-amber-600 hover:to-orange-600 transition-all cursor-pointer whitespace-nowrap shrink-0"
        title="मोबाईल किंवा कॉम्प्युटरवर अ‍ॅप इन्स्टॉल करा"
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>अ‍ॅप इन्स्टॉल करा (Free App)</span>
      </button>

      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    मोबाईल / कॉम्प्युटरवर अ‍ॅप इन्स्टॉल करा
                  </h3>
                  <p className="text-xs text-slate-500">100% मोफत आणि लाइफटाईम अ‍ॅप</p>
                </div>
              </div>
              <button
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-700">
              {isIOS ? (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="font-semibold text-slate-900">iPhone / iPad वर इन्स्टॉल करण्यासाठी:</p>
                  <p>1. Safari ब्राउझरमधील खालील <strong>Share</strong> आयकॉनवर टॅप करा.</p>
                  <p>2. खाली स्क्रोल करून <strong>Add to Home Screen</strong> वर टॅप करा.</p>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <p className="font-semibold text-slate-900">Android / Chrome वर इन्स्टॉल करण्यासाठी:</p>
                  <p>1. ब्राउझरच्या कोपऱ्यातील <strong>⋮ (तीन डॉट्स)</strong> किंवा अ‍ॅड्रेस बारमधील इन्स्टॉल आयकॉनवर क्लिक करा.</p>
                  <p>2. <strong>Install App</strong> किंवा <strong>Add to Home screen</strong> निवडा.</p>
                </div>
              )}
              <p className="text-xs text-slate-500">
                टीप: हे अ‍ॅप थेट तुमच्या फोनच्या होम स्क्रीनवर सेव्ह होते आणि नेहमी मोफत चालते.
              </p>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
            >
              समजले (Close)
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-lg">
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>ऑफलाइन मोड — सेव्ह केलेला डेटा वापरला जात आहे</span>
    </div>
  );
};
