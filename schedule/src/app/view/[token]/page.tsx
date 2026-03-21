'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ScheduleWithDetails, Shift, ROLES } from '@/lib/types';
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
            <div className="p-4 sm:p-6 flex flex-col gap-6">
              {ROLES.map((roleObj) => {
                const roleShifts = shifts.filter(s => (s.role || 'server') === roleObj.id);
                if (roleShifts.length === 0) return null;

                return (
                  <div key={roleObj.id} className="flex flex-col gap-3">
                    <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                      <span className="w-1.5 h-4 rounded-full" style={{ background: 'var(--accent-primary)' }}></span>
                      {roleObj.label}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {roleShifts.map((shift, si) => {
                        const sched = getScheduleForCell(viewDateStr, shift.id);
                        const color = shiftColors[si % shiftColors.length];
                        const assignmentCount = sched?.assignments?.length ?? 0;

                        return (
                          <div key={shift.id} className="rounded-xl flex flex-col p-4 transition-all duration-200 shadow-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)' }}>
                            <div className="flex items-center justify-between mb-3 pb-3 border-b border-dashed" style={{ borderColor: 'var(--border-color)' }}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-2.5 h-2.5 rounded-full relative" style={{ flexShrink: 0 }}>
                                  <div className="absolute inset-0 rounded-full animate-ping opacity-20" style={{ background: color }}></div>
                                  <div className="relative w-full h-full rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}80` }} />
                                </div>
                                <span className="font-semibold text-sm line-clamp-1" style={{ color: 'var(--text-primary)' }}>{shift.name}</span>
                              </div>
                              <span className="text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0" style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}>
                                {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                              </span>
                            </div>
                            
                            <div className="flex flex-col gap-2 flex-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                                พนักงานปฏิบัติงาน ({assignmentCount}/{shift.required_staff})
                              </p>
                              {sched && sched.assignments && sched.assignments.length > 0 ? (
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {sched.assignments.map(a => (
                                    <span
                                      key={a.id}
                                      className="px-2.5 py-1 rounded-lg text-xs font-bold shadow-sm"
                                      style={{ 
                                        background: `var(--bg-card)`, 
                                        color: color,
                                        border: `1px solid ${color}30`
                                      }}
                                    >
                                      {a.employee?.name}
                                    </span>
                                  ))}
                                </div>
                              ) : sched ? (
                                <div className="flex-1 flex flex-col justify-center items-center py-4 rounded-lg border border-dashed mt-1" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
                                  <span className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>ไม่มีพนักงานลงกะนี้</span>
                                </div>
                              ) : (
                                <div className="flex-1 flex flex-col justify-center items-center py-4 rounded-lg border border-dashed mt-1" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-card)' }}>
                                  <span className="text-[11px] font-medium opacity-50" style={{ color: 'var(--text-muted)' }}>ยังไม่เปิดกะนี้</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
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
