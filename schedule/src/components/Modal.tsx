'use client';

import { useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, title, children, maxWidth = '480px' }: ModalProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setVisible(true);
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  if (!isOpen && !visible) return null;
  if (!mounted) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-transparent"
      onClick={handleClose}
    >
      <div
        className={`w-full rounded-2xl ${visible && isOpen ? 'animate-scale-in' : 'opacity-0'}`}
        style={{
          maxWidth,
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-active)',
          boxShadow: '0 8px 48px rgba(0, 0, 0, 0.5), 0 0 32px rgba(99, 102, 241, 0.1)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(139, 92, 246, 0.04))',
            borderBottom: '1px solid var(--border-color)',
          }}
        >
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
          <button
            onClick={handleClose}
            className="p-2 rounded-xl transition-all duration-200 cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.color = 'var(--accent-danger)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-h-[80vh] overflow-y-visible">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
