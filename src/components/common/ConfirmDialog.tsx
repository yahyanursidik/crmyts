import React from 'react';
import { X, Trash2, AlertTriangle, AlertCircle, RefreshCw } from 'lucide-react';

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Ya, Hapus',
  cancelLabel = 'Batal',
  variant = 'danger',
  loading = false,
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          iconBg: 'bg-rose-100 text-rose-700 border-rose-200',
          icon: <Trash2 className="w-6 h-6 text-rose-600" />,
          btnBg: 'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-rose-600/20',
          badgeText: 'Konfirmasi Penghapusan',
          badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
        };
      case 'warning':
        return {
          iconBg: 'bg-amber-100 text-amber-800 border-amber-200',
          icon: <AlertTriangle className="w-6 h-6 text-amber-600" />,
          btnBg: 'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white shadow-amber-600/20',
          badgeText: 'Peringatan Sistem',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        };
      case 'info':
      default:
        return {
          iconBg: 'bg-brand-100 text-brand-900 border-brand-200',
          icon: <AlertCircle className="w-6 h-6 text-brand-700" />,
          btnBg: 'bg-brand-800 hover:bg-brand-900 active:bg-brand-950 text-white shadow-brand-900/20',
          badgeText: 'Konfirmasi Tindakan',
          badgeClass: 'bg-brand-50 text-brand-900 border-brand-200',
        };
    }
  };

  const vStyles = getVariantStyles();

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-surface-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="bg-[#fbfaf6] rounded-3xl max-w-md w-full p-6 shadow-2xl border border-cream-300 relative space-y-5 animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={loading}
          className="absolute top-4 right-4 p-2 text-surface-400 hover:text-surface-700 hover:bg-cream-100 rounded-xl transition-colors disabled:opacity-50"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header with Icon */}
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center border shrink-0 shadow-2xs ${vStyles.iconBg}`}
          >
            {vStyles.icon}
          </div>

          <div className="space-y-1 pr-6">
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${vStyles.badgeClass}`}
            >
              {vStyles.badgeText}
            </span>
            <h3 className="text-base font-black text-brand-950 font-display leading-snug">
              {title}
            </h3>
          </div>
        </div>

        {/* Message Content */}
        <div className="text-xs text-surface-600 leading-relaxed bg-white p-4 rounded-2xl border border-cream-200/80">
          {typeof message === 'string' ? <p>{message}</p> : message}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-cream-300 bg-white hover:bg-cream-100 text-surface-700 text-xs font-bold transition-all shadow-2xs active:scale-95 disabled:opacity-50"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold shadow-sm transition-all flex items-center gap-2 active:scale-95 disabled:opacity-50 ${vStyles.btnBg}`}
          >
            {loading ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Memproses...</span>
              </>
            ) : (
              <span>{confirmLabel}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
