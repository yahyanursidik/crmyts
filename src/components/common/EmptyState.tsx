import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Belum Ada Data',
  description = 'Data tidak ditemukan atau belum ada catatan baru.',
  actionText,
  onAction,
  icon,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 text-center bg-white rounded-lg border border-navy-100 shadow-sm ${className}`}>
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-cream-200 text-brand-800 mb-3">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="text-base font-semibold text-navy-900">{title}</h3>
      <p className="mt-1 text-sm text-navy-500 max-w-sm">{description}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          type="button"
          className="mt-4 inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-brand-800 hover:bg-brand-900 rounded-md shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-brand-700 focus:ring-offset-2"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
