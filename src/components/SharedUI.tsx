import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Clock, XCircle, AlertCircle, X, Info } from 'lucide-react';

export function StatusText({ status }: { status: string }) {
  const s = status || '';
  if (
    [
      'Placed',
      'Selected',
      'Active',
      'Joined',
      'Accepted',
      'Matched',
      'Eligible',
      'Approved',
      'Connected',
      'Verified Source Sync',
    ].includes(s)
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{s}</span>
      </span>
    );
  }
  if (
    [
      'Shortlisted',
      'Assessment',
      'Interview',
      'In Process',
      'Planned',
      'Offered',
      'Pending',
      'Needs Improvement',
      'Important',
    ].includes(s)
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400 whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{s}</span>
      </span>
    );
  }
  if (['Rejected', 'Cancelled', 'Declined', 'Missing', 'Not Eligible', 'Urgent', 'Inactive'].includes(s)) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700 dark:text-red-400 whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{s}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#718096] dark:text-slate-400 whitespace-nowrap">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{s}</span>
    </span>
  );
}

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Modal({ open, title, onClose, children, maxWidth = 'max-w-xl' }: ModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101827]/70 p-4 backdrop-blur-[2px]">
      <div
        className={`w-full ${maxWidth} max-h-[90vh] flex flex-col bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700/70 rounded-xl shadow-xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700/70">
          <h3 className="text-base font-semibold text-[#172033] dark:text-slate-100">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal open={open} title={title} onClose={onCancel} maxWidth="max-w-md">
      <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-6">{message}</p>
      <div className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

/* ==================== TOAST NOTIFICATION SYSTEM ==================== */
type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  tone: ToastTone;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = 'success') => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start gap-2.5 px-4 py-3 rounded-xl border shadow-lg text-xs font-medium transition-all ${
              t.tone === 'success'
                ? 'bg-white dark:bg-[#18243A] border-emerald-300 dark:border-emerald-800 text-[#172033] dark:text-slate-100'
                : t.tone === 'error'
                ? 'bg-white dark:bg-[#18243A] border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                : 'bg-white dark:bg-[#18243A] border-[#246BFD]/40 text-[#172033] dark:text-slate-100'
            }`}
          >
            {t.tone === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
            {t.tone === 'error' && <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />}
            {t.tone === 'info' && <Info className="w-4 h-4 text-[#246BFD] shrink-0 mt-0.5" />}
            <span className="flex-1 leading-relaxed">{t.message}</span>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

export const inputCls =
  'w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#101827] text-[#172033] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#246BFD]/30 focus:border-[#246BFD] transition-colors';

export const labelCls =
  'block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5';

export const cardCls =
  'bg-white dark:bg-[#18243A] border border-slate-200 dark:border-slate-700/70 rounded-xl';
