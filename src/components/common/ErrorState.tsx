import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  title?: string;
  message?: string;
  requestId?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Gagal Memuat Data',
  message = 'Terjadi gangguan saat menghubungkan ke server. Silakan coba kembali.',
  requestId,
  onRetry,
  className = '',
}) => {
  return (
    <div className={`p-6 bg-red-50/70 border border-red-200 rounded-lg text-center ${className}`}>
      <div className="flex justify-center mb-3">
        <AlertCircle className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-base font-semibold text-red-900">{title}</h3>
      <p className="mt-1 text-sm text-red-700 max-w-md mx-auto">{message}</p>
      
      {requestId && (
        <div className="mt-3 text-xs text-navy-500 font-mono">
          ID Permintaan: <span className="select-all bg-white px-1.5 py-0.5 rounded border">{requestId}</span>
        </div>
      )}

      {onRetry && (
        <button
          onClick={onRetry}
          type="button"
          className="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-red-800 bg-red-100 hover:bg-red-200 rounded-md transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Coba Lagi
        </button>
      )}
    </div>
  );
};
