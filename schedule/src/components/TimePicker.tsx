'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Clock, ChevronUp, ChevronDown } from 'lucide-react';

interface TimePickerProps {
  value: string; // "HH:mm"
  onChangeAction: (value: string) => void;
  label?: string;
}

export default function TimePicker({ value, onChangeAction, label }: TimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hour, minute] = value.split(':').map(Number);

  const setHour = useCallback((h: number) => {
    const newH = ((h % 24) + 24) % 24;
    onChangeAction(`${String(newH).padStart(2, '0')}:${String(minute).padStart(2, '0')}`);
  }, [minute, onChangeAction]);

  const setMinute = useCallback((m: number) => {
    const newM = ((m % 60) + 60) % 60;
    onChangeAction(`${String(hour).padStart(2, '0')}:${String(newM).padStart(2, '0')}`);
  }, [hour, onChangeAction]);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const formatDisplay = (h: number, m: number) => {
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return { h12: String(h12).padStart(2, '0'), m: String(m).padStart(2, '0'), period };
  };

  const display = formatDisplay(hour, minute);

  // Quick presets
  const presets = [
    { label: '06:00', h: 6, m: 0 },
    { label: '07:00', h: 7, m: 0 },
    { label: '08:00', h: 8, m: 0 },
    { label: '09:00', h: 9, m: 0 },
    { label: '10:00', h: 10, m: 0 },
    { label: '12:00', h: 12, m: 0 },
    { label: '14:00', h: 14, m: 0 },
    { label: '15:00', h: 15, m: 0 },
    { label: '17:00', h: 17, m: 0 },
    { label: '18:00', h: 18, m: 0 },
    { label: '20:00', h: 20, m: 0 },
    { label: '22:00', h: 22, m: 0 },
  ];

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
      )}

      {/* Display button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 cursor-pointer group"
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${isOpen ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          color: 'var(--text-primary)',
        }}
      >
        <Clock size={16} style={{ color: isOpen ? 'var(--accent-primary)' : 'var(--text-muted)' }} />
        <span className="flex items-center gap-1 text-base font-mono font-semibold tracking-wider">
          <span style={{ color: 'var(--accent-primary)' }}>{display.h12}</span>
          <span style={{ color: 'var(--text-muted)' }}>:</span>
          <span style={{ color: 'var(--accent-secondary)' }}>{display.m}</span>
          <span className="text-xs font-sans ml-1.5 px-1.5 py-0.5 rounded" style={{
            background: hour >= 12 ? 'rgba(139, 92, 246, 0.15)' : 'rgba(99, 102, 241, 0.15)',
            color: hour >= 12 ? 'var(--accent-secondary)' : 'var(--accent-primary)',
          }}>
            {display.period}
          </span>
        </span>
        <span className="ml-auto text-xs" style={{ color: 'var(--text-muted)' }}>
          ({String(hour).padStart(2, '0')}:{String(minute).padStart(2, '0')})
        </span>
      </button>

      {/* Dropdown picker */}
      {isOpen && (
        <div
          className="absolute z-50 left-0 right-0 mt-2 rounded-2xl overflow-hidden animate-scale-in"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-active)',
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5), 0 0 24px rgba(99, 102, 241, 0.1)',
          }}
        >
          {/* Spinner section */}
          <div className="flex items-center justify-center gap-2 px-6 py-5">
            {/* Hour spinner */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest mb-2 font-semibold" style={{ color: 'var(--text-muted)' }}>
                ชั่วโมง
              </span>
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setHour(hour + 1)}
                  className="p-1.5 rounded-lg cursor-pointer transition-all duration-150 hover:scale-110"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <ChevronUp size={20} />
                </button>

                <div
                  className="w-16 h-16 flex items-center justify-center rounded-xl text-2xl font-mono font-bold my-1"
                  style={{
                    background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.1))',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: 'var(--accent-primary)',
                    boxShadow: '0 2px 12px rgba(99, 102, 241, 0.15)',
                  }}
                >
                  {String(hour).padStart(2, '0')}
                </div>

                <button
                  type="button"
                  onClick={() => setHour(hour - 1)}
                  className="p-1.5 rounded-lg cursor-pointer transition-all duration-150 hover:scale-110"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-primary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <ChevronDown size={20} />
                </button>
              </div>
            </div>

            {/* Separator */}
            <div className="flex flex-col items-center gap-2 pt-7">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-primary)', opacity: 0.6 }} />
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent-primary)', opacity: 0.6 }} />
            </div>

            {/* Minute spinner */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-widest mb-2 font-semibold" style={{ color: 'var(--text-muted)' }}>
                นาที
              </span>
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setMinute(minute + 5)}
                  className="p-1.5 rounded-lg cursor-pointer transition-all duration-150 hover:scale-110"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <ChevronUp size={20} />
                </button>

                <div
                  className="w-16 h-16 flex items-center justify-center rounded-xl text-2xl font-mono font-bold my-1"
                  style={{
                    background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15), rgba(168, 85, 247, 0.1))',
                    border: '1px solid rgba(139, 92, 246, 0.3)',
                    color: 'var(--accent-secondary)',
                    boxShadow: '0 2px 12px rgba(139, 92, 246, 0.15)',
                  }}
                >
                  {String(minute).padStart(2, '0')}
                </div>

                <button
                  type="button"
                  onClick={() => setMinute(minute - 5)}
                  className="p-1.5 rounded-lg cursor-pointer transition-all duration-150 hover:scale-110"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-secondary)'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <ChevronDown size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div
            className="px-4 py-3"
            style={{ borderTop: '1px solid var(--border-color)' }}
          >
            <p className="text-[10px] uppercase tracking-widest font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
              เวลาที่ใช้บ่อย
            </p>
            <div className="grid grid-cols-4 gap-1.5">
              {presets.map((p) => {
                const isActive = hour === p.h && minute === p.m;
                return (
                  <button
                    type="button"
                    key={p.label}
                    onClick={() => {
                      onChangeAction(`${String(p.h).padStart(2, '0')}:${String(p.m).padStart(2, '0')}`);
                      setIsOpen(false);
                    }}
                    className="px-2 py-1.5 rounded-lg text-xs font-mono font-medium transition-all duration-150 cursor-pointer"
                    style={{
                      background: isActive ? 'var(--accent-primary)' : 'var(--bg-surface)',
                      color: isActive ? 'white' : 'var(--text-secondary)',
                      border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = 'var(--accent-primary)';
                        e.currentTarget.style.color = 'var(--accent-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.borderColor = 'var(--border-color)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                      }
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Done button */}
          <div className="px-4 pb-4 pt-1">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer transition-all duration-200 hover:opacity-90"
              style={{ background: 'var(--gradient-primary)' }}
            >
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
