import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Clock, LogOut, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useTheme } from '@/lib/themeContext';

interface InactivityAutoLogoutGuardProps {
  /**
   * Total inactivity time in minutes before auto-logout occurs.
   * Default: 30 minutes
   */
  timeoutMinutes?: number;

  /**
   * Warning dialog countdown time in seconds.
   * Default: 60 seconds
   */
  warningSeconds?: number;

  children?: React.ReactNode;
}

export function InactivityAutoLogoutGuard({
  timeoutMinutes = 30,
  warningSeconds = 60,
  children,
}: InactivityAutoLogoutGuardProps) {
  const { currentTheme } = useTheme();

  const [showWarning, setShowWarning] = useState(false);
  const [remainingSecs, setRemainingSecs] = useState(warningSeconds);
  const lastActivityRef = useRef<number>(Date.now());
  const isWarningOpenRef = useRef<boolean>(false);

  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = warningSeconds * 1000;

  const performLogout = useCallback(() => {
    setShowWarning(false);
    isWarningOpenRef.current = false;
    localStorage.removeItem('crm_user_token');
    localStorage.removeItem('crm_user_session');
    // Redirect to login with reason
    window.location.href = '/login?reason=inactivity';
  }, []);

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (isWarningOpenRef.current) {
      isWarningOpenRef.current = false;
      setShowWarning(false);
    }
  }, []);

  // Set up user activity listeners (throttled)
  useEffect(() => {
    let lastThrottledTime = 0;

    const handleUserActivity = () => {
      // If warning modal is open, don't reset just on mousemove; require explicit button click
      if (isWarningOpenRef.current) return;

      const now = Date.now();
      if (now - lastThrottledTime > 2000) {
        lastThrottledTime = now;
        lastActivityRef.current = now;
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];
    events.forEach((evt) => {
      window.addEventListener(evt, handleUserActivity, { passive: true });
    });

    return () => {
      events.forEach((evt) => {
        window.removeEventListener(evt, handleUserActivity);
      });
    };
  }, []);

  // Main countdown timer loop
  useEffect(() => {
    const timerInterval = setInterval(() => {
      // If document is in background/minimized, still track time elapsed accurately
      const now = Date.now();
      const elapsedMs = now - lastActivityRef.current;
      const timeLeftMs = timeoutMs - elapsedMs;

      if (timeLeftMs <= 0) {
        // Time expired -> Auto-Logout!
        clearInterval(timerInterval);
        performLogout();
      } else if (timeLeftMs <= warningMs) {
        // Within warning window
        isWarningOpenRef.current = true;
        setShowWarning(true);
        setRemainingSecs(Math.max(0, Math.ceil(timeLeftMs / 1000)));
      } else {
        // Normal active state
        if (isWarningOpenRef.current) {
          isWarningOpenRef.current = false;
          setShowWarning(false);
        }
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [timeoutMs, warningMs, performLogout]);

  return (
    <>
      {children}

      {/* Inactivity Warning Dialog Modal */}
      {showWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-white border border-amber-300 rounded-3xl shadow-2xl p-6 sm:p-7 space-y-5 animate-in zoom-in-95 duration-200 text-center"
            role="alertdialog"
            aria-modal="true"
          >
            {/* Header Emblem */}
            <div className="w-16 h-16 rounded-3xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto text-amber-600 shadow-sm relative">
              <Clock className="w-8 h-8 animate-pulse text-amber-600" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-amber-500 text-[9px] text-white font-bold items-center justify-center">
                  !
                </span>
              </span>
            </div>

            {/* Content Text */}
            <div className="space-y-2">
              <h3 className="text-xl font-black text-slate-900 font-display">
                Peringatan: Sesi Akan Berakhir
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
                Anda tidak melakukan aktivitas selama <b>{timeoutMinutes - 1} menit</b>. Demi perlindungan data donatur dan efisiensi sistem, akun akan otomatis keluar dalam:
              </p>
            </div>

            {/* Countdown Badge */}
            <div className="py-3 px-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center justify-center gap-3">
              <span className="text-3xl font-black text-amber-900 font-mono tracking-wider">
                00:{remainingSecs < 10 ? `0${remainingSecs}` : remainingSecs}
              </span>
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                Detik
              </span>
            </div>

            {/* Security note */}
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <ShieldAlert className="w-3.5 h-3.5 text-brand-700 shrink-0" />
              <span>Otomatis mengunci sesi saat perangkat ditinggal.</span>
            </div>

            {/* Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                type="button"
                onClick={resetActivity}
                className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 active:scale-95 ${currentTheme.colors.primaryBtnBg} ${currentTheme.colors.primaryBtnText}`}
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Tetap Masuk & Lanjutkan</span>
              </button>

              <button
                type="button"
                onClick={performLogout}
                className="py-3 px-4 rounded-xl font-bold text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <LogOut className="w-4 h-4 text-slate-500" />
                <span>Keluar Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
