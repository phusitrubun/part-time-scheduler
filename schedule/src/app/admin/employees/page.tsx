'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Employee, EmployeeUnavailability, ShiftPreference, DailyShiftPreference, EmploymentType } from '@/lib/types';
import { showToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import {
  Plus, Pencil, Trash2, UserPlus, Search,
  CalendarOff, ChevronLeft, ChevronRight
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isToday, getDay, addMonths, subMonths, isSameDay
} from 'date-fns';
import { th } from 'date-fns/locale';

const PREF_LABELS: Record<ShiftPreference, string> = {
  morning: 'กะเช้า',
  evening: 'กะเย็น',
  both: 'ทั้งสองกะ',
};

const PREF_COLORS: Record<ShiftPreference, string> = {
  morning: '#f59e0b',
  evening: '#6366f1',
  both: '#10b981',
};

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editEmployee, setEditEmployee] = useState<Employee | null>(null);
  const [formName, setFormName] = useState('');
  const [formPref, setFormPref] = useState<ShiftPreference>('both');
  const [formEmploymentType, setFormEmploymentType] = useState<EmploymentType>('part_time');
  
  const defaultWeeklyPref: Record<string, DailyShiftPreference> = {
    '0': 'both', '1': 'both', '2': 'both', '3': 'both', '4': 'both', '5': 'both', '6': 'both'
  };
  const [formWeeklyPref, setFormWeeklyPref] = useState<Record<string, DailyShiftPreference>>(defaultWeeklyPref);
  const [saving, setSaving] = useState(false);
  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);

  // Unavailability
  const [showUnavail, setShowUnavail] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [unavailDates, setUnavailDates] = useState<EmployeeUnavailability[]>([]);
  const [calMonth, setCalMonth] = useState(new Date());

  const loadEmployees = useCallback(async () => {
    const { data, error } = await supabase
      .from('employees')
      .select('*, unavailabilities:employee_unavailability(unavailable_date)')
      .order('created_at', { ascending: true });
    if (error) {
      showToast('error', 'ไม่สามารถโหลดข้อมูลพนักงานได้');
    } else {
      setEmployees(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  const openAdd = () => {
    setEditEmployee(null);
    setFormName('');
    setFormPref('both');
    setFormEmploymentType('part_time');
    setFormWeeklyPref(defaultWeeklyPref);
    setShowForm(true);
  };

  const openEdit = (emp: Employee) => {
    setEditEmployee(emp);
    setFormName(emp.name);
    setFormPref(emp.shift_preference);
    setFormEmploymentType(emp.employment_type || 'part_time');
    if (emp.weekly_shift_preference) {
      setFormWeeklyPref(emp.weekly_shift_preference);
    } else {
      const fallback: Record<string, DailyShiftPreference> = {};
      for (let i = 0; i < 7; i++) fallback[i.toString()] = emp.shift_preference;
      setFormWeeklyPref(fallback);
    }
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      showToast('warning', 'กรุณากรอกชื่อพนักงาน');
      return;
    }
    setSaving(true);
    if (editEmployee) {
      const { error } = await supabase
        .from('employees')
        .update({ name: formName.trim(), shift_preference: formPref, weekly_shift_preference: formWeeklyPref, employment_type: formEmploymentType })
        .eq('id', editEmployee.id);
      if (error) showToast('error', 'แก้ไขไม่สำเร็จ');
      else showToast('success', 'แก้ไขพนักงานสำเร็จ');
    } else {
      const { error } = await supabase
        .from('employees')
        .insert({ name: formName.trim(), shift_preference: formPref, weekly_shift_preference: formWeeklyPref, employment_type: formEmploymentType });
      if (error) showToast('error', 'เพิ่มพนักงานไม่สำเร็จ');
      else showToast('success', 'เพิ่มพนักงานสำเร็จ');
    }
    setSaving(false);
    setShowForm(false);
    loadEmployees();
  };

  const confirmDelete = (emp: Employee) => {
    setEmpToDelete(emp);
  };

  const executeDelete = async () => {
    if (!empToDelete) return;
    const { error } = await supabase.from('employees').delete().eq('id', empToDelete.id);
    if (error) showToast('error', 'ลบไม่สำเร็จ');
    else {
      showToast('success', 'ลบพนักงานสำเร็จ');
      loadEmployees();
      setEmpToDelete(null);
    }
  };

  // Unavailability
  const openUnavail = async (emp: Employee) => {
    setSelectedEmployee(emp);
    setCalMonth(new Date());
    setShowUnavail(true);
    const { data } = await supabase
      .from('employee_unavailability')
      .select('*')
      .eq('employee_id', emp.id);
    setUnavailDates(data ?? []);
  };

  const toggleDate = async (date: Date) => {
    if (!selectedEmployee) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const existing = unavailDates.find((u) => u.unavailable_date === dateStr);
    if (existing) {
      await supabase.from('employee_unavailability').delete().eq('id', existing.id);
      setUnavailDates((prev) => prev.filter((u) => u.id !== existing.id));
      setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, unavailabilities: e.unavailabilities?.filter(u => u.unavailable_date !== dateStr) } : e));
      showToast('info', `เปิดวันที่ ${format(date, 'd MMM', { locale: th })} แล้ว`);
    } else {
      const { data, error } = await supabase
        .from('employee_unavailability')
        .insert({ employee_id: selectedEmployee.id, unavailable_date: dateStr })
        .select()
        .single();
      if (!error && data) {
        setUnavailDates((prev) => [...prev, data]);
        setEmployees(prev => prev.map(e => e.id === selectedEmployee.id ? { ...e, unavailabilities: [...(e.unavailabilities || []), data] } : e));
        showToast('warning', `ปิดวันที่ ${format(date, 'd MMM', { locale: th })} แล้ว`);
      }
    }
  };

  const filtered = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase())
  );

  // Calendar helpers
  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart); // 0 = Sunday

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            จัดการพนักงาน
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            เพิ่ม แก้ไข ลบ และกำหนดวันหยุดพนักงานพาร์ทไทม์
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 cursor-pointer hover:opacity-90"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <UserPlus size={18} />
          เพิ่มพนักงาน
        </button>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          placeholder="ค้นหาชื่อพนักงาน..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-11 pr-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
          <thead>
            <tr style={{ background: 'var(--bg-surface)' }}>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>ชื่อพนักงาน</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>กะและวันที่สะดวก (ว่าง/หยุด)</th>
              <th className="text-left px-6 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>วันหยุดพิเศษ (ปฏิทิน)</th>
              <th className="text-right px-6 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>จัดการ</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={3} className="px-6 py-12 text-center" style={{ color: 'var(--text-muted)' }}>กำลังโหลด...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={3} className="px-6 py-12 text-center" style={{ color: 'var(--text-muted)' }}>
                {search ? 'ไม่พบพนักงาน' : 'ยังไม่มีพนักงาน — เพิ่มคนแรกของคุณ!'}
              </td></tr>
            ) : (
              filtered.map((emp, i) => (
                <tr
                  key={emp.id}
                  className={`border-t transition-colors duration-150 animate-fade-in stagger-${Math.min(i + 1, 5)}`}
                  style={{ borderColor: 'var(--border-color)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-card-hover)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{emp.name}</span>
                      <span 
                        className="px-2 py-0.5 rounded-md text-[10px] font-bold w-max"
                        style={{
                          background: emp.employment_type === 'full_time' ? 'var(--accent-primary)' : 'var(--accent-warning)',
                          color: emp.employment_type === 'full_time' ? 'white' : '#fff'
                        }}
                      >
                        {emp.employment_type === 'full_time' ? 'พนักงานประจำ' : 'พาร์ทไทม์'}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      if (!emp.weekly_shift_preference) {
                        return (
                          <span
                            className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                            style={{ background: `${PREF_COLORS[emp.shift_preference]}20`, color: PREF_COLORS[emp.shift_preference] }}
                          >
                            {PREF_LABELS[emp.shift_preference]}
                          </span>
                        );
                      }
                      const dayNames = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
                      const avail = [];
                      const unavail = [];
                      for(let i=1; i<=7; i++) {
                         const idx = (i%7).toString();
                         if (emp.weekly_shift_preference[idx] === 'none') unavail.push(dayNames[parseInt(idx)]);
                         else avail.push(dayNames[parseInt(idx)]);
                      }
                      return (
                        <div className="flex flex-col gap-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: '#10b981' }}></span>
                            <span style={{ color: 'var(--text-primary)' }}><strong>ว่าง:</strong> {avail.join(', ') || '-'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }}></span>
                            <span style={{ color: 'var(--text-secondary)' }}><strong>ปิดรับกะ:</strong> {unavail.join(', ') || '-'}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const today = new Date();
                      today.setHours(0, 0, 0, 0);
                      const futureUnavail = (emp.unavailabilities || [])
                        .filter(u => new Date(u.unavailable_date) >= today)
                        .sort((a,b) => new Date(a.unavailable_date).getTime() - new Date(b.unavailable_date).getTime());
                      
                      if (futureUnavail.length === 0) {
                        return <span className="text-xs" style={{ color: 'var(--text-muted)' }}>-</span>;
                      }
                      
                      return (
                        <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                          {futureUnavail.map((u, idx) => {
                            const d = new Date(u.unavailable_date);
                            return (
                              <span 
                                key={idx} 
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                                style={{
                                  background: 'var(--accent-danger)',
                                  color: 'white',
                                  opacity: 0.9
                                }}
                              >
                                {d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })}
                              </span>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openUnavail(emp)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-warning)'; e.currentTarget.style.color = 'var(--accent-warning)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        <CalendarOff size={14} />
                        วันไม่ว่าง
                      </button>
                      <button
                        onClick={() => openEdit(emp)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-info)'; e.currentTarget.style.color = 'var(--accent-info)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        <Pencil size={14} />
                        แก้ไข
                      </button>
                      <button
                        onClick={() => confirmDelete(emp)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-200 cursor-pointer"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent-danger)'; e.currentTarget.style.color = 'var(--accent-danger)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
                      >
                        <Trash2 size={14} />
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        </div>
      </div>

      {/* Add/Edit Employee Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editEmployee ? 'แก้ไขพนักงาน' : 'เพิ่มพนักงานใหม่'}
      >
        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              ชื่อ-นามสกุล
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="เช่น สมชาย ใจดี"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200 mb-5"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
              autoFocus
            />
          </div>

          <div className="mb-2">
            <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
              ประเภทพนักงาน (ประจำ / พาร์ทไทม์)
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <label 
                className={`flex-1 flex flex-col items-center justify-center p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  formEmploymentType === 'full_time' ? 'border-indigo-500 bg-indigo-500/10' : 'border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5'
                }`}
              >
                <input 
                  type="radio" 
                  className="hidden" 
                  checked={formEmploymentType === 'full_time'} 
                  onChange={() => {
                    setFormEmploymentType('full_time');
                    const newPref = { ...formWeeklyPref };
                    for (let i = 0; i < 7; i++) {
                      if (newPref[i.toString()] === 'none') newPref[i.toString()] = 'both';
                    }
                    setFormWeeklyPref(newPref);
                  }}
                />
                <span className={`font-bold text-sm ${formEmploymentType === 'full_time' ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>พนักงานประจำ (Full-Time)</span>
                <span className="text-[10px] mt-1 text-center" style={{ color: 'var(--text-muted)' }}>ต้องทำงานทุกวัน (เลือกกะได้)</span>
              </label>

              <label 
                className={`flex-1 flex flex-col items-center justify-center p-3.5 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                  formEmploymentType === 'part_time' ? 'border-amber-500 bg-amber-500/10' : 'border-black/5 dark:border-white/5 bg-black/5 dark:bg-white/5'
                }`}
              >
                <input 
                  type="radio" 
                  className="hidden" 
                  checked={formEmploymentType === 'part_time'} 
                  onChange={() => setFormEmploymentType('part_time')} 
                />
                <span className={`font-bold text-sm ${formEmploymentType === 'part_time' ? 'text-amber-600 dark:text-amber-500' : 'text-gray-500 dark:text-gray-400'}`}>พาร์ทไทม์ (Part-Time)</span>
                <span className="text-[10px] mt-1 text-center" style={{ color: 'var(--text-muted)' }}>เลือกวันทำงานและวันหยุดได้อย่างอิสระ</span>
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              ความสะดวกรองรับกะ (แยกตามวัน)
            </label>
            <div className="flex flex-col gap-2">
              {['1','2','3','4','5','6','0'].map((dayIdx) => {
                const dayNames: Record<string, string> = { '0':'อาทิตย์', '1':'จันทร์', '2':'อังคาร', '3':'พุธ', '4':'พฤหัสบดี', '5':'ศุกร์', '6':'เสาร์'};
                const pref = formWeeklyPref[dayIdx];
                return (
                  <div key={dayIdx} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl gap-3 sm:gap-0" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-primary)', minWidth: '80px' }}>
                      {dayNames[dayIdx]}
                    </span>
                    <div className="flex bg-black/5 dark:bg-white/5 rounded-lg p-1 overflow-x-auto w-full sm:w-auto">
                      {(['morning', 'evening', 'both', 'none'] as DailyShiftPreference[]).map((p) => {
                        const labels = { morning: 'เช้า', evening: 'เย็น', both: 'ทั้งคู่', none: 'ไม่ว่าง' };
                        const colors = { morning: '#f59e0b', evening: '#6366f1', both: '#10b981', none: '#ef4444' };
                        const isActive = pref === p;
                        const isDisabled = formEmploymentType === 'full_time' && p === 'none';
                        return (
                          <button
                            key={p}
                            disabled={isDisabled}
                            onClick={() => setFormWeeklyPref(prev => ({ ...prev, [dayIdx]: p }))}
                            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                              isDisabled ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                            } ${isActive && !isDisabled ? 'shadow-sm' : ''}`}
                            style={{
                              background: isActive ? 'var(--bg-surface)' : 'transparent',
                              color: isActive ? colors[p] : 'var(--text-secondary)',
                              border: isActive ? `1px solid ${colors[p]}40` : '1px solid transparent'
                            }}
                          >
                            {labels[p]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
              *หมายเหตุ: วันที่เลือก "ไม่ว่าง" ในตารางนี้ ระบบจะไม่นำพนักงานมาลงกะในวันนั้นๆ ทุกสัปดาห์ (ประยุกต์ใช้แทนฟังก์ชันวันหยุดประจำสัปดาห์)
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors duration-200 cursor-pointer"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
              }}
            >
              ยกเลิก
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 cursor-pointer hover:opacity-90 disabled:opacity-50"
              style={{ background: 'var(--gradient-primary)' }}
            >
              {saving ? 'กำลังบันทึก...' : editEmployee ? 'บันทึก' : 'เพิ่ม'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Unavailability Calendar Modal */}
      <Modal
        isOpen={showUnavail}
        onClose={() => setShowUnavail(false)}
        title={`📅 วันหยุดของ ${selectedEmployee?.name ?? ''}`}
        maxWidth="420px"
      >
        <div>
          {/* Month Nav */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setCalMonth(subMonths(calMonth, 1))}
              className="p-2 rounded-lg cursor-pointer transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {format(calMonth, 'MMMM yyyy', { locale: th })}
            </span>
            <button
              onClick={() => setCalMonth(addMonths(calMonth, 1))}
              className="p-2 rounded-lg cursor-pointer transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'].map((d) => (
              <div key={d} className="text-center text-xs py-1" style={{ color: 'var(--text-muted)' }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}
            {days.map((day) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isUnavail = unavailDates.some((u) => u.unavailable_date === dateStr);
              const isCurrentDay = isToday(day);
              return (
                <button
                  key={dateStr}
                  onClick={() => toggleDate(day)}
                  className="relative w-full aspect-square flex items-center justify-center rounded-lg text-sm transition-all duration-200 cursor-pointer"
                  style={{
                    background: isUnavail ? 'var(--accent-danger)' : isCurrentDay ? 'var(--bg-surface)' : 'transparent',
                    color: isUnavail ? 'white' : isSameMonth(day, calMonth) ? 'var(--text-primary)' : 'var(--text-muted)',
                    border: isCurrentDay && !isUnavail ? '1px solid var(--accent-primary)' : '1px solid transparent',
                  }}
                >
                  {format(day, 'd')}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ background: 'var(--accent-danger)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>วันที่ไม่สะดวก</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded" style={{ border: '1px solid var(--accent-primary)', background: 'var(--bg-surface)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>วันนี้</span>
            </div>
          </div>

          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            💡 คลิกวันที่เพื่อเปิด/ปิดวันหยุด — วันที่สีแดงจะไม่ถูกสุ่มลงกะ
          </p>
        </div>
      </Modal>

      {/* Delete Employee Confirm Modal */}
      <Modal
        isOpen={!!empToDelete}
        onClose={() => setEmpToDelete(null)}
        title="🗑️ ยืนยันการลบพนักงาน"
        maxWidth="400px"
      >
        <div>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            คุณแน่ใจหรือไม่ว่าต้องการลบ <span className="font-bold text-white">"{empToDelete?.name}"</span> ? ข้อมูลการจัดตารางงานทั้งหมดของพนักงานคนนี้จะถูกลบไปด้วย และไม่สามารถกู้คืนได้
          </p>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setEmpToDelete(null)}
              className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer hover:opacity-80"
              style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}
            >
              ยกเลิก
            </button>
            <button
              onClick={executeDelete}
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
