import { useState, useRef, useEffect } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, isToday } from 'date-fns';
import { th } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';

interface DatePickerProps {
  value: Date;
  onChange: (date: Date) => void;
  minDate?: Date;
  className?: string;
}

export default function DatePicker({ value, onChange, minDate, className }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [calMonth, setCalMonth] = useState(value);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm outline-none transition-all duration-200"
        style={{
          background: 'var(--bg-surface)',
          border: `1px solid ${isOpen ? 'var(--accent-primary)' : 'var(--border-color)'}`,
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-center gap-2">
          <CalendarIcon size={16} style={{ color: 'var(--text-muted)' }} />
          <span>{format(value, 'd MMMM yyyy', { locale: th })}</span>
        </div>
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 top-full left-0 mt-2 p-4 rounded-xl shadow-xl w-[280px] animate-fade-in"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center justify-between px-2 mb-4">
            <button 
              type="button"
              onClick={() => setCalMonth(subMonths(calMonth, 1))}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <ChevronLeft size={18} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              {format(calMonth, 'MMMM yyyy', { locale: th })}
            </h4>
            <button 
              type="button"
              onClick={() => setCalMonth(addMonths(calMonth, 1))}
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <ChevronRight size={18} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'].map(d => (
              <div key={d} className="text-[10px] font-bold" style={{ color: 'var(--text-muted)' }}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}
            {days.map((day, i) => {
              const selected = isSameDay(day, value);
              const today = isToday(day);
              const disabled = minDate && day < startOfMonth(minDate) && !isSameDay(day, minDate);

              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    onChange(day);
                    setIsOpen(false);
                    setCalMonth(day);
                  }}
                  className={`h-8 rounded-lg text-xs font-semibold flex items-center justify-center transition-all ${
                    selected 
                      ? 'bg-indigo-500 text-white shadow-md' 
                      : today 
                        ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' 
                        : 'hover:bg-black/5 dark:hover:bg-white/5'
                  } ${disabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={!selected && !today ? { color: 'var(--text-primary)' } : {}}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
