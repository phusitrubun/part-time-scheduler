'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Employee, EmployeeUnavailability, Shift, ScheduleWithDetails, ScheduleWarning } from '@/lib/types';
import { showToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import {
  CalendarDays, Wand2, AlertTriangle, Check, ChevronLeft,
  ChevronRight, Eye, EyeOff, Link2, Copy, Trash2, UserPlus, X, Users
} from 'lucide-react';
import {
  format, eachDayOfInterval, parseISO, addMonths, subMonths,
  startOfMonth, endOfMonth, getDay, isSameMonth, isToday, addDays
} from 'date-fns';
import { th } from 'date-fns/locale';
import DatePicker from '@/components/DatePicker';

export default function SchedulesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [unavailability, setUnavailability] = useState<EmployeeUnavailability[]>([]);
  const [schedules, setSchedules] = useState<ScheduleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [warnings, setWarnings] = useState<ScheduleWarning[]>([]);
  const [showWarnings, setShowWarnings] = useState(false);
  
  // Store Holidays
  const [storeHolidays, setStoreHolidays] = useState<Set<number>>(new Set());

  useEffect(() => {
    try {
      const saved = localStorage.getItem('store_holidays');
      if (saved) setStoreHolidays(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  const toggleStoreHoliday = (dayIdx: number) => {
    setStoreHolidays(prev => {
      const next = new Set(prev);
      if (next.has(dayIdx)) next.delete(dayIdx);
      else next.add(dayIdx);
      
      const arr = Array.from(next);
      localStorage.setItem('store_holidays', JSON.stringify(arr));
      
      // Save globally for public view
      supabase.from('store_settings').upsert({
        setting_key: 'store_holidays',
        setting_value: arr
      }, { onConflict: 'setting_key' }).then();
      
      return next;
    });
  };

  // Date range for generation
  const [startDate, setStartDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return format(d, 'yyyy-MM-dd');
  });

  // Table view: daily navigation
  const [viewDate, setViewDate] = useState(() => new Date());

  // Side panel for editing a specific schedule cell
  const [selectedCell, setSelectedCell] = useState<{ dateStr: string; shiftId: string } | null>(null);
  const [panelVisible, setPanelVisible] = useState(false);

  // Share link and Publish Modals
  const [showShareLink, setShowShareLink] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [deleteScheduleId, setDeleteScheduleId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [empRes, shiftRes, unavRes, schedRes] = await Promise.all([
      supabase.from('employees').select('*').order('name'),
      supabase.from('shifts').select('*').order('start_time'),
      supabase.from('employee_unavailability').select('*'),
      supabase.from('schedules').select(`
        *,
        shift:shifts(*),
        assignments:schedule_assignments(*, employee:employees(*))
      `).order('work_date'),
    ]);

    setEmployees(empRes.data ?? []);
    setShifts(shiftRes.data ?? []);
    setUnavailability(unavRes.data ?? []);
    setSchedules((schedRes.data as ScheduleWithDetails[]) ?? []);
    setLoading(false);
    
    // Load store holidays safely without breaking the page if table doesn't exist yet
    supabase.from('store_settings').select('setting_value').eq('setting_key', 'store_holidays').single().then(({ data }) => {
      if (data?.setting_value) setStoreHolidays(new Set(data.setting_value));
    });
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ============ SCHEDULE GENERATION ALGORITHM ============
  const generateSchedule = async () => {
    if (shifts.length === 0) {
      showToast('warning', 'กรุณาเพิ่มกะก่อนสร้างตาราง');
      return;
    }
    if (employees.length === 0) {
      showToast('warning', 'กรุณาเพิ่มพนักงานก่อนสร้างตาราง');
      return;
    }

    setGenerating(true);
    const newWarnings: ScheduleWarning[] = [];
    const dates = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    });

    const workloadCount: Record<string, number> = {};
    employees.forEach((emp) => (workloadCount[emp.id] = 0));

    const unavailSet = new Set(
      unavailability.map((u) => `${u.employee_id}_${u.unavailable_date}`)
    );

    const matchesPreference = (emp: Employee, shift: Shift, date: Date): boolean => {
      const dayIdx = date.getDay().toString();
      const pref = emp.weekly_shift_preference ? emp.weekly_shift_preference[dayIdx] : emp.shift_preference;
      
      if (pref === 'none') return false;
      if (pref === 'both') return true;
      
      const startHour = parseInt(shift.start_time.split(':')[0], 10);
      if (pref === 'morning') return startHour < 14;
      if (pref === 'evening') return startHour >= 14;
      
      return true;
    };

    try {
      for (const date of dates) {
        if (storeHolidays.has(date.getDay())) continue; // ข้ามวันหยุดร้าน完全 ไม่สร้างตารางใดๆ
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // เก็บรายชื่อคนที่ถูกสุ่มลงกะไปแล้วในวันนี้ เพื่อไม่ให้ลงซ้ำ 2 กะ
        const assignedToday = new Set<string>();

        // สลับลำดับกะแบบสุ่ม เพื่อไม่ให้พนักงานประจำถูกดึงไปกะแรก (กะเช้า) ตลอดทุกวัน
        const shuffledShifts = [...shifts].sort(() => Math.random() - 0.5);

        for (const shift of shuffledShifts) {
          let scheduleId = '';
          const existing = schedules.find(
            (s) => s.work_date === dateStr && s.shift_id === shift.id
          );

          if (existing) {
            scheduleId = existing.id;
            // ลบของเดิมทิ้งเพื่อจัดใหม่ทับลงไป
            await supabase.from('schedule_assignments').delete().eq('schedule_id', scheduleId);
          } else {
            const { data: scheduleData, error: schedError } = await supabase
              .from('schedules')
              .insert({ work_date: dateStr, shift_id: shift.id })
              .select()
              .single();

            if (schedError || !scheduleData) continue;
            scheduleId = scheduleData.id;
          }

          const eligible = employees.filter((emp) => {
            if (unavailSet.has(`${emp.id}_${dateStr}`)) return false;
            if (assignedToday.has(emp.id)) return false; // ข้ามคนที่จัดลงกะอื่นในวันนี้ไปแล้ว
            if (!matchesPreference(emp, shift, date)) return false;
            return true;
          });

          eligible.sort((a, b) => {
            // 1. ความสำคัญ: พนักงานประจำ (Full-Time) ต้องถูกสุ่มลงกะก่อนเสมอ
            if (a.employment_type === 'full_time' && b.employment_type !== 'full_time') return -1;
            if (a.employment_type !== 'full_time' && b.employment_type === 'full_time') return 1;
            // 2. ถ้าประเภทเหมือนกัน ให้เกลี่ยจำนวนกะ (workload) ให้สมดุล
            const workloadDiff = (workloadCount[a.id] ?? 0) - (workloadCount[b.id] ?? 0);
            if (workloadDiff !== 0) return workloadDiff;
            // 3. ถ้าจำนวนกะเท่ากัน ให้สุ่มแฟร์ๆ (Random Tiebreaker)
            return Math.random() - 0.5;
          });

          const selected = eligible.slice(0, shift.required_staff);

          if (selected.length < shift.required_staff) {
            newWarnings.push({
              date: dateStr,
              shift_name: shift.name,
              required: shift.required_staff,
              available: selected.length,
              message: `วันที่ ${format(date, 'd MMM', { locale: th })} กะ${shift.name}: ต้องการ ${shift.required_staff} คน แต่มีผู้ว่าง ${selected.length} คน`,
            });
          }

          if (selected.length > 0) {
            const assignments = selected.map((emp) => ({
              schedule_id: scheduleId,
              employee_id: emp.id,
            }));

            await supabase.from('schedule_assignments').insert(assignments);

            selected.forEach((emp) => {
              workloadCount[emp.id] = (workloadCount[emp.id] ?? 0) + 1;
              assignedToday.add(emp.id); // บันทึกว่าคนนี้ทำงานแล้วในวันนี้
            });
          }
        }
      }

      setWarnings(newWarnings);
      if (newWarnings.length > 0) {
        setShowWarnings(true);
        showToast('warning', `สร้างตารางสำเร็จ แต่มี ${newWarnings.length} รายการที่คนไม่พอ`);
      } else {
        showToast('success', 'สร้างตารางงานสำเร็จ! 🎉');
      }

      await loadAll();
    } catch {
      showToast('error', 'เกิดข้อผิดพลาดในการสร้างตาราง');
    }
    setGenerating(false);
  };

  // ============ MANUAL OPERATIONS ============
  const createEmptySchedule = async (dateStr: string, shiftId: string) => {
    const { error } = await supabase
      .from('schedules')
      .insert({ work_date: dateStr, shift_id: shiftId });
    if (error) {
      if (error.code === '23505') showToast('info', 'กะนี้ถูกสร้างไว้แล้ว');
      else showToast('error', 'สร้างกะไม่สำเร็จ');
    } else {
      showToast('success', 'เปิดกะสำเร็จ สามารถจัดพนักงานได้เลย');
      loadAll();
    }
  };

  const togglePublish = async (scheduleId: string, current: boolean) => {
    const { error } = await supabase
      .from('schedules')
      .update({ is_published: !current })
      .eq('id', scheduleId);
    if (error) showToast('error', 'อัปเดตไม่สำเร็จ');
    else {
      showToast('success', !current ? 'เผยแพร่ตารางแล้ว' : 'ยกเลิกการเผยแพร่แล้ว');
      loadAll();
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    const { error } = await supabase.from('schedule_assignments').delete().eq('id', assignmentId);
    if (error) showToast('error', 'ลบไม่สำเร็จ');
    else {
      showToast('success', 'ลบพนักงานออกจากกะแล้ว');
      loadAll();
    }
  };

  const addEmployeeToSchedule = async (employeeId: string, scheduleId: string) => {
    const { error } = await supabase
      .from('schedule_assignments')
      .insert({ schedule_id: scheduleId, employee_id: employeeId });
    if (error) {
      if (error.code === '23505') showToast('warning', 'พนักงานนี้อยู่ในกะนี้แล้ว');
      else showToast('error', 'เพิ่มไม่สำเร็จ');
    } else {
      showToast('success', 'เพิ่มพนักงานเข้ากะแล้ว');
      loadAll();
    }
  };

  const deleteSchedule = (scheduleId: string) => {
    setDeleteScheduleId(scheduleId);
  };

  const executeDeleteSchedule = async () => {
    if (!deleteScheduleId) return;
    const { error } = await supabase.from('schedules').delete().eq('id', deleteScheduleId);
    if (error) showToast('error', 'ลบไม่สำเร็จ');
    else {
      showToast('success', 'ลบตารางแล้ว');
      loadAll();
      setDeleteScheduleId(null);
    }
  };

  const copyShareLink = () => {
    const link = `${window.location.origin}/view/public`;
    navigator.clipboard.writeText(link);
    showToast('success', 'คัดลอกลิงก์แล้ว!');
  };

  const openPublishModal = () => {
    const unpublishedCount = schedules.filter(s => !s.is_published).length;
    if (unpublishedCount === 0) {
      showToast('info', 'ไม่มีตารางใหม่ให้เผยแพร่ (ถูกเผยแพร่หมดแล้ว หรือยังไม่ถูกสร้าง)');
      return;
    }
    setShowPublishModal(true);
  };

  const confirmPublishAll = async () => {
    const unpublishedIds = schedules.filter(s => !s.is_published).map(s => s.id);
    if (unpublishedIds.length === 0) return;

    const { error } = await supabase
      .from('schedules')
      .update({ is_published: true })
      .in('id', unpublishedIds);

    if (error) {
      showToast('error', 'เกิดข้อผิดพลาดในการเผยแพร่');
    } else {
      showToast('success', `เผยแพร่สำเร็จ ${unpublishedIds.length} รายการ ผู้พนักงานจะมองเห็นตารางเหล่านี้แล้ว`);
      loadAll();
      setShowPublishModal(false);
    }
  };

  // ============ TABLE VIEW HELPERS ============
  const viewDateStr = format(viewDate, 'yyyy-MM-dd');

  const getScheduleForCell = (dateStr: string, shiftId: string) =>
    schedules.find((s) => s.work_date === dateStr && s.shift_id === shiftId);

  const openCellPanel = (dateStr: string, shiftId: string) => {
    setSelectedCell({ dateStr, shiftId });
    setPanelVisible(true);
  };

  const closeCellPanel = () => {
    setPanelVisible(false);
    setTimeout(() => setSelectedCell(null), 300);
  };

  const navigateDate = (direction: number) => {
    setViewDate((prev) => addDays(prev, direction));
  };

  const shiftColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  // Selected cell data
  const selectedSchedule = selectedCell
    ? getScheduleForCell(selectedCell.dateStr, selectedCell.shiftId)
    : null;
  const selectedShift = selectedCell
    ? shifts.find((s) => s.id === selectedCell.shiftId)
    : null;

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            จัดตารางงาน
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            สุ่มจัดตารางอัตโนมัติ และปรับแก้ไขด้วยตนเอง
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openPublishModal}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer text-white hover:opacity-90 disabled:opacity-50"
            style={{
              background: 'var(--accent-success)',
              boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)',
            }}
          >
            <Eye size={16} />
            เผยแพร่ทั้งหมด
          </button>
          <button
            onClick={() => setShowShareLink(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-secondary)',
            }}
          >
            <Link2 size={16} />
            แชร์ลิงก์
          </button>
        </div>
      </div>

      {/* Generate Section */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
        }}
      >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Wand2 size={20} style={{ color: 'var(--accent-primary)' }} />
          สร้างตารางอัตโนมัติ
        </h2>

        <div className="mb-6 pb-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            วันหยุดประจำสัปดาห์ของร้าน (ระบบจะไม่สุ่มพนักงานมาลงกะในวันนี้)
          </label>
          <div className="flex gap-2 flex-wrap">
            {['1', '2', '3', '4', '5', '6', '0'].map((idxStr) => {
              const idx = parseInt(idxStr);
              const dayNames: Record<number, string> = { 0: 'อาทิตย์', 1: 'จันทร์', 2: 'อังคาร', 3: 'พุธ', 4: 'พฤหัสบดี', 5: 'ศุกร์', 6: 'เสาร์' };
              const isSelected = storeHolidays.has(idx);
              return (
                <button
                  key={idx}
                  onClick={() => toggleStoreHoliday(idx)}
                  className={`px-4 py-2 rounded-xl text-xs font-medium transition-all duration-200 cursor-pointer ${isSelected ? 'shadow-sm' : ''}`}
                  style={{
                    background: isSelected ? 'var(--accent-danger)' : 'var(--bg-surface)',
                    color: isSelected ? 'white' : 'var(--text-secondary)',
                    border: `1px solid ${isSelected ? 'transparent' : 'var(--border-color)'}`
                  }}
                  title={isSelected ? 'คลิกเพื่อเปลี่ยนให้เป็นวันปกติ' : 'คลิกเพื่อตั้งเป็นวันหยุดร้าน'}
                >
                  {dayNames[idx]} {isSelected && ''}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>วันที่เริ่มต้น</label>
            <DatePicker 
              value={parseISO(startDate)} 
              onChange={(d) => setStartDate(format(d, 'yyyy-MM-dd'))} 
            />
          </div>
          <div className="flex-1 w-full sm:w-auto">
            <label className="block text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>วันที่สิ้นสุด</label>
            <DatePicker 
              value={parseISO(endDate)} 
              onChange={(d) => setEndDate(format(d, 'yyyy-MM-dd'))} 
            />
          </div>
          <button
            onClick={generateSchedule}
            disabled={generating}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 cursor-pointer hover:opacity-90 disabled:opacity-50 whitespace-nowrap"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Wand2 size={18} className={generating ? 'animate-spin' : ''} />
            {generating ? 'กำลังสร้าง...' : 'สุ่มจัดตาราง'}
          </button>
        </div>

        <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
          💡 ระบบจะสุ่มพนักงานตามกะที่สะดวก, วันที่ว่าง และกระจายงานอย่างสม่ำเสมอ
        </p>
      </div>

      {/* Date Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate(-1)}
            className="p-2 rounded-lg cursor-pointer transition-colors"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => navigateDate(1)}
            className="p-2 rounded-lg cursor-pointer transition-colors"
            style={{ color: 'var(--text-muted)', background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <ChevronRight size={18} />
          </button>
          <h3 className="text-lg font-bold ml-2" style={{ color: 'var(--text-primary)' }}>
            {format(viewDate, 'EEEE ที่ d MMMM yyyy', { locale: th })}
          </h3>
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
            className="px-4 py-2.5 rounded-xl text-sm font-medium cursor-pointer transition-colors"
            style={{ color: 'var(--accent-primary)', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}
          >
            ไปที่วันนี้
          </button>
        </div>
      </div>

      {/* Main Content: Table + Side Panel */}
      <div className="flex gap-4 relative">
        {/* Schedule Table */}
        <div className={`flex-1 min-w-0 transition-all duration-300 ${panelVisible ? 'mr-0' : ''}`}>
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            {loading ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>กำลังโหลด...</div>
            ) : shifts.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                กรุณาเพิ่มกะก่อนเพื่อแสดงตาราง
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr style={{ background: 'var(--bg-surface)' }}>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>กะการทำงาน</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>เวลา</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>โควตา (คน)</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>พนักงานที่จัดลงกะ</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>สถานะ</th>
                      <th className="px-5 py-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-color)' }}>จัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border-color)' }}>
                    {shifts.map((shift, si) => {
                      const sched = getScheduleForCell(viewDateStr, shift.id);
                      const assignmentCount = sched?.assignments?.length ?? 0;
                      const isFull = assignmentCount >= shift.required_staff;
                      const color = shiftColors[si % shiftColors.length];
                      const isActive = selectedCell?.dateStr === viewDateStr && selectedCell?.shiftId === shift.id;
                      
                      return (
                        <tr 
                          key={shift.id} 
                          className="transition-colors hover:bg-white/5"
                          style={{ background: isActive ? 'var(--bg-surface)' : 'transparent' }}
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}80` }} />
                              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{shift.name}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="text-sm font-medium opacity-80" style={{ color: 'var(--text-secondary)' }}>
                              {shift.start_time.substring(0, 5)} - {shift.end_time.substring(0, 5)}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-bold" style={{ color: isFull ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                                {assignmentCount} / {shift.required_staff}
                              </span>
                              <div className="h-1.5 w-16 bg-white/10 rounded-full overflow-hidden hidden sm:block">
                                <div 
                                  className="h-full transition-all duration-500 rounded-full" 
                                  style={{ 
                                    width: `${Math.min(100, (assignmentCount / shift.required_staff) * 100)}%`,
                                    background: isFull ? 'var(--accent-success)' : 'var(--accent-warning)'
                                  }} 
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 w-full">
                            {sched && sched.assignments && sched.assignments.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {sched.assignments.map(a => (
                                  <span
                                    key={a.id}
                                    className="px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1.5"
                                    style={{ 
                                      background: `${color}10`, 
                                      color: color,
                                      borderColor: `${color}30`,
                                      width: 'max-content'
                                    }}
                                  >
                                    {a.employee?.name}
                                    {a.employee?.employment_type && (
                                      <span 
                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold" 
                                        style={{ 
                                          background: a.employee.employment_type === 'full_time' ? 'var(--accent-primary)' : 'var(--accent-warning)', 
                                          color: 'white' 
                                        }}
                                      >
                                        {a.employee.employment_type === 'full_time' ? 'ประจำ' : 'พาร์ทไทม์'}
                                      </span>
                                    )}
                                  </span>
                                ))}
                              </div>
                            ) : sched ? (
                              <span className="text-xs px-3 py-1 rounded-full" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>ยังไม่มีคนลงกะ</span>
                            ) : (
                              <span className="text-xs opacity-50" style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {sched ? (
                              sched.is_published ? (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-success)' }}>
                                  <Check size={12} strokeWidth={3} /> เผยแพร่แล้ว
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--accent-warning)' }}>
                                  <AlertTriangle size={12} strokeWidth={2.5} /> รอเผยแพร่
                                </span>
                              )
                            ) : (
                              <span className="text-xs opacity-50" style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            <button
                              onClick={() => openCellPanel(viewDateStr, shift.id)}
                              className="w-full sm:w-auto px-4 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer shadow-sm hover:shadow-md"
                              style={{ 
                                background: isActive ? 'var(--gradient-primary)' : 'var(--bg-surface)', 
                                color: isActive ? 'white' : 'var(--text-primary)', 
                                border: isActive ? '1px solid transparent' : '1px solid var(--border-color)' 
                              }}
                            >
                              {sched ? 'จัดการกะ' : 'สร้างกะนี้'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Side Panel (non-blocking overlay) */}
        <div
          style={{
            transform: panelVisible ? 'translateX(0)' : 'translateX(100%)',
            background: 'var(--bg-card)',
            borderLeft: '1px solid var(--border-color)',
            boxShadow: panelVisible ? '-4px 0 24px rgba(0,0,0,0.2)' : 'none',
          }}
        >
          {selectedCell && (
            <div
              className="w-[360px] rounded-xl h-fit sticky top-4"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-color)',
                boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
              }}
            >
              {/* Panel Header */}
              <div
                className="flex items-center justify-between px-5 py-4"
                style={{
                  borderBottom: '1px solid var(--border-color)',
                  background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.06), rgba(139, 92, 246, 0.03))',
                }}
              >
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {selectedShift?.name ?? 'กะ'}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    📅 {format(parseISO(selectedCell.dateStr), 'EEE d MMM yyyy', { locale: th })}
                  </p>
                </div>
                <button
                  onClick={closeCellPanel}
                  className="p-1.5 rounded-lg cursor-pointer transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; e.currentTarget.style.color = 'var(--accent-danger)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Panel Body */}
              <div className="px-5 py-4">
                {selectedSchedule ? (
                  <>
                    {/* Actions Row */}
                    <div className="flex items-center gap-1.5 mb-4">
                      <button
                        onClick={() => togglePublish(selectedSchedule.id, selectedSchedule.is_published)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                        style={{
                          background: selectedSchedule.is_published ? 'rgba(16, 185, 129, 0.1)' : 'var(--bg-surface)',
                          color: selectedSchedule.is_published ? 'var(--accent-success)' : 'var(--text-secondary)',
                          border: `1px solid ${selectedSchedule.is_published ? 'rgba(16, 185, 129, 0.2)' : 'var(--border-color)'}`,
                        }}
                      >
                        {selectedSchedule.is_published ? <EyeOff size={12} /> : <Eye size={12} />}
                        {selectedSchedule.is_published ? 'ยกเลิกเผยแพร่' : 'เผยแพร่'}
                      </button>
                      <button
                        onClick={() => deleteSchedule(selectedSchedule.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                        style={{
                          background: 'rgba(239,68,68,0.08)',
                          color: 'var(--accent-danger)',
                          border: '1px solid rgba(239,68,68,0.15)',
                        }}
                      >
                        <Trash2 size={12} />
                        ลบ
                      </button>
                    </div>

                    {/* Assigned employees */}
                    <div className="mb-4">
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        พนักงานในกะ ({selectedSchedule.assignments?.length ?? 0}/{selectedShift?.required_staff ?? 0})
                      </p>
                      {selectedSchedule.assignments?.length === 0 ? (
                        <p className="text-xs py-3 text-center rounded-lg" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}>
                          ยังไม่มีพนักงานในกะนี้
                        </p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {selectedSchedule.assignments?.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center justify-between px-3 py-2 rounded-lg group"
                              style={{ background: 'var(--bg-surface)' }}
                            >
                              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                {a.employee?.name ?? 'Unknown'}
                              </span>
                              <button
                                onClick={() => removeAssignment(a.id)}
                                className="opacity-0 group-hover:opacity-100 p-1 rounded cursor-pointer transition-all duration-200"
                                style={{ color: 'var(--accent-danger)' }}
                                title="ลบออกจากกะ"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Add employee buttons */}
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
                        เพิ่มพนักงาน
                      </p>
                      <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
                        {employees.map((emp) => {
                          const alreadyAssigned = selectedSchedule.assignments?.some((a) => a.employee_id === emp.id);
                          return (
                            <button
                              key={emp.id}
                              onClick={() => !alreadyAssigned && addEmployeeToSchedule(emp.id, selectedSchedule.id)}
                              disabled={alreadyAssigned}
                              className="flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                              }}
                              onMouseEnter={(e) => { if (!alreadyAssigned) e.currentTarget.style.background = 'var(--bg-surface)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                            >
                              <span>{emp.name}</span>
                              {alreadyAssigned ? (
                                <Check size={14} style={{ color: 'var(--accent-success)' }} />
                              ) : (
                                <UserPlus size={14} style={{ color: 'var(--accent-primary)' }} />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-8">
                    <CalendarDays size={32} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-3" />
                    <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                      ยังไม่มีตารางงานนี้
                    </p>
                    <p className="text-xs mb-5 leading-relaxed px-4" style={{ color: 'var(--text-secondary)' }}>
                      คุณสามารถสุ่มจัดตารางอัตโนมัติ 
                      <br/>หรือกดปุ่มด้านล่างเพื่อ <b>"จัดคนลงกะด้วยตัวเอง"</b>
                    </p>
                    <button
                      onClick={() => createEmptySchedule(selectedCell.dateStr, selectedCell.shiftId)}
                      className="px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 cursor-pointer hover:shadow-lg active:scale-95"
                      style={{ 
                        background: 'var(--gradient-primary)',
                        boxShadow: '0 4px 14px rgba(99, 102, 241, 0.2)'
                      }}
                    >
                      สร้างกะเอง (เปลี่ยนผู้รับผิดชอบ)
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Warnings Modal */}
      <Modal
        isOpen={showWarnings}
        onClose={() => setShowWarnings(false)}
        title="⚠️ คำเตือนจากระบบ"
        maxWidth="520px"
      >
        <div className="flex flex-col gap-3">
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            พบว่าบางกะมีพนักงานไม่เพียงพอ กรุณาจัดการเพิ่มเติมด้วยตนเอง:
          </p>
          {warnings.map((w, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3 rounded-lg"
              style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
            >
              <AlertTriangle size={16} style={{ color: 'var(--accent-warning)', marginTop: '2px', flexShrink: 0 }} />
              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{w.message}</span>
            </div>
          ))}
        </div>
      </Modal>

      {/* Share Link Modal */}
      <Modal
        isOpen={showShareLink}
        onClose={() => setShowShareLink(false)}
        title="🔗 แชร์ตารางงาน"
        maxWidth="460px"
      >
        <div>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            ส่งลิงก์นี้ให้พนักงานเพื่อดูตารางที่เผยแพร่แล้ว (Read-only):
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={typeof window !== 'undefined' ? `${window.location.origin}/view/public` : '/view/public'}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
            <button
              onClick={copyShareLink}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white cursor-pointer hover:opacity-90"
              style={{ background: 'var(--gradient-primary)' }}
            >
              <Copy size={16} />
              คัดลอก
            </button>
          </div>
        </div>
      </Modal>

      {/* Publish Confirm Modal */}
      <Modal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        title="✨ ยืนยันการเผยแพร่"
        maxWidth="460px"
      >
        <div>
          <p className="text-sm mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            มีตารางจัดงานที่ยังไม่เผยแพร่จำนวน <span className="font-bold text-white px-1.5 py-0.5 rounded-md mx-1" style={{ background: 'var(--accent-success)' }}>{schedules.filter(s => !s.is_published).length}</span> รายการ
            <br /><br />
            คุณต้องการเผยแพร่ตารางทั้งหมดนี้หรือไม่? (หลังจากยืนยัน พนักงานทุกคนจะสามารถมองเห็นตารางงานเหล่านี้ผ่านหน้าต่างสาธารณะ)
          </p>
          <div className="flex justify-end gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setShowPublishModal(false)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer hover:opacity-80"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            >
              ยกเลิก
            </button>
            <button
              onClick={confirmPublishAll}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 cursor-pointer hover:opacity-90"
              style={{ background: 'var(--accent-success)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.2)' }}
            >
              <Eye size={16} />
              ยืนยันการเผยแพร่
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Schedule Confirm Modal */}
      <Modal
        isOpen={!!deleteScheduleId}
        onClose={() => setDeleteScheduleId(null)}
        title="🗑️ ยืนยันการลบตารางงาน"
        maxWidth="400px"
      >
        <div>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            คุณแน่ใจหรือไม่ว่าต้องการลบตารางงานนี้? ข้อมูลพนักงานที่จัดกะไว้ในตารางนี้จะหายไปทั้งหมด และการลบจะไม่สามารถกู้คืนได้
          </p>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setDeleteScheduleId(null)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer hover:opacity-80"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            >
              ยกเลิก
            </button>
            <button
              onClick={executeDeleteSchedule}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 cursor-pointer hover:opacity-90"
              style={{ background: 'var(--accent-danger)' }}
            >
              ยืนยันการลบ
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
