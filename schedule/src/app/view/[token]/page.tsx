'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ScheduleWithDetails, Shift } from '@/lib/types';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { format, addDays, isToday, parseISO, getDay } from 'date-fns';
import { th } from 'date-fns/locale';
import DatePicker from '@/components/DatePicker';

export default function PublicViewPage() {
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Table view: daily navigation
  const [viewDate, setViewDate] = useState(() => new Date());

  const loadData = useCallback(async () => {
    const [shiftRes, schedRes] = await Promise.all([
      supabase.from('shifts').select('*').order('start_time'),
      supabase.from('schedules').select(`
        *,
        shift:shifts(*),
        assignments:schedule_assignments(*, employee:employees(*))
      `).eq('is_published', true).order('work_date'),
    ]);

    setShifts(shiftRes.data ?? []);
    setSchedules((schedRes.data as ScheduleWithDetails[]) ?? []);
    setLoading(false);
    
    // Load store holidays safely without breaking the page if table doesn't exist yet
    supabase.from('store_settings').select('setting_value').eq('setting_key', 'store_holidays').single().then(({ data }) => {
      if (data?.setting_value) setStoreHolidays(new Set(data.setting_value));
    });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ============ TABLE VIEW HELPERS ============
  const viewDateStr = format(viewDate, 'yyyy-MM-dd');

  const getScheduleForCell = (dateStr: string, shiftId: string) =>
    schedules.find((s) => s.work_date === dateStr && s.shift_id === shiftId);

  const navigateDate = (direction: number) => {
    setViewDate((prev) => addDays(prev, direction));
  };
  
  const [storeHolidays, setStoreHolidays] = useState<Set<number>>(new Set());
  const isHoliday = storeHolidays.has(getDay(viewDate));
  const hasAnySchedulesToday = shifts.some((shift) => getScheduleForCell(viewDateStr, shift.id));

  const shiftColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div
      className="min-h-screen"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-10 px-4 sm:px-6 py-4 backdrop-blur-xl"
        style={{
          background: 'rgba(10, 10, 15, 0.85)',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-lg text-white font-bold text-sm"
              style={{ background: 'var(--gradient-primary)' }}
            >
              SF
            </div>
            <div>
              <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                ShiftFlow
              </h1>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ตารางลงเวลาพนักงาน</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6 animate-fade-in">
        {/* Date Navigation */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateDate(-1)}
              className="p-2 rounded-lg cursor-pointer transition-colors hover:opacity-80"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => navigateDate(1)}
              className="p-2 rounded-lg cursor-pointer transition-colors hover:opacity-80"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <ChevronRight size={18} />
            </button>
            <h2 className="text-lg font-semibold ml-2" style={{ color: 'var(--text-primary)' }}>
              {format(viewDate, 'EEEE ที่ d MMMM yyyy', { locale: th })}
            </h2>
            {isToday(viewDate) && (
              <span className="ml-2 px-2 py-0.5 rounded-md text-xs font-medium" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--accent-primary)' }}>
                วันนี้
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
             <div className="w-[180px]">
               <DatePicker 
                 value={viewDate} 
                 onChange={setViewDate} 
               />
             </div>
             <button
               onClick={() => setViewDate(new Date())}
               className="px-4 py-2 rounded-xl text-sm font-medium cursor-pointer transition-colors hover:opacity-80"
               style={{ color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
             >
               ไปที่วันนี้
             </button>
          </div>
        </div>

        {/* Schedule Table */}
        <div
          className="rounded-xl overflow-hidden mb-8"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          {loading ? (
            <div className="text-center py-20 flex flex-col items-center">
              <CalendarDays size={40} className="mb-4 animate-pulse" style={{ color: 'var(--text-muted)' }} />
              <p style={{ color: 'var(--text-muted)' }}>กำลังโหลดตารางงาน...</p>
            </div>
          ) : isHoliday && !hasAnySchedulesToday ? (
            <div className="text-center py-24 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full mb-5 flex justify-center items-center" style={{ background: 'var(--accent-danger)' }}>
                <CalendarDays size={32} color="white" />
              </div>
              <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>วันหยุดประจำสัปดาห์</h3>
              <p style={{ color: 'var(--text-secondary)' }}>ร้านปิดทำการในวันนี้ ไม่มีพนักงานลงปฏิบัติงาน</p>
            </div>
          ) : shifts.length === 0 ? (
            <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
              ยังไม่มีข้อมูลกะการทำงาน
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left whitespace-nowrap">
                <thead>
                  <tr style={{ background: 'var(--bg-surface)' }}>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>กะการทำงาน</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>เวลา</th>
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>พนักงานที่ปฏิบัติงาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                  {shifts.map((shift, si) => {
                    const sched = getScheduleForCell(viewDateStr, shift.id);
                    const color = shiftColors[si % shiftColors.length];

                    return (
                      <tr key={shift.id} className="transition-colors hover:bg-white/5">
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            <div className="w-3 h-3 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}80` }} />
                            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{shift.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <span className="text-sm font-medium opacity-80" style={{ color: 'var(--text-secondary)' }}>
                            {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                          </span>
                        </td>
                        <td className="px-6 py-5 w-full">
                          {sched && sched.assignments && sched.assignments.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {sched.assignments.map(a => (
                                <span
                                  key={a.id}
                                  className="px-3 py-1.5 rounded-lg text-sm font-medium"
                                  style={{ 
                                    background: `${color}15`, 
                                    color: color,
                                    border: `1px solid ${color}30`
                                  }}
                                >
                                  {a.employee?.name}
                                </span>
                              ))}
                            </div>
                          ) : sched ? (
                            <span className="text-sm px-4 py-1.5 rounded-full" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                              ไม่มีพนักงานลงกะนี้
                            </span>
                          ) : (
                            <span className="text-sm opacity-50" style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center py-8" style={{ borderTop: '1px solid var(--border-color)' }}>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Powered by ShiftFlow — ระบบจัดตารางงานอัตโนมัติ
        </p>
      </footer>
    </div>
  );
}
