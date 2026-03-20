'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

let toastId = 0;
let addToastFn: ((type: ToastType, message: string) => void) | null = null;

export function showToast(type: ToastType, message: string) {
  addToastFn?.(type, message);
}

const icons = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors: Record<ToastType, string> = {
  success: 'var(--accent-success)',
  error: 'var(--accent-danger)',
  warning: 'var(--accent-warning)',
  info: 'var(--accent-info)',
};

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    addToastFn = (type: ToastType, message: string) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, type, message }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4000);
    };
    return () => { addToastFn = null; };
  }, []);

  const removeToast = (id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (!mounted) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[10000] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '380px' }}>
      {toasts.map((toast) => {
        const Icon = icons[toast.type];
        return (
          <div
            key={toast.id}
            className="flex items-start gap-3 px-4 py-3 rounded-xl pointer-events-auto animate-slide-in"
            style={{
              background: 'var(--bg-card)',
              border: `1px solid ${colors[toast.type]}30`,
              boxShadow: `0 4px 16px rgba(0,0,0,0.3), 0 0 12px ${colors[toast.type]}20`,
            }}
          >
            <Icon size={18} style={{ color: colors[toast.type], marginTop: '2px', flexShrink: 0 }} />
            <span className="text-sm flex-1" style={{ color: 'var(--text-primary)' }}>{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 rounded cursor-pointer flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}
