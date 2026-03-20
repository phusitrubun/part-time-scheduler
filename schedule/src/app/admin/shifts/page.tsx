'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { Shift } from '@/lib/types';
import { showToast } from '@/components/Toast';
import Modal from '@/components/Modal';
import { Plus, Pencil, Trash2, Clock, Users } from 'lucide-react';
import TimePicker from '@/components/TimePicker';

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editShift, setEditShift] = useState<Shift | null>(null);
  const [formName, setFormName] = useState('');
  const [formStart, setFormStart] = useState('08:00');
  const [formEnd, setFormEnd] = useState('15:00');
  const [formStaff, setFormStaff] = useState(1);
  const [saving, setSaving] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<Shift | null>(null);

  const loadShifts = useCallback(async () => {
    const { data, error } = await supabase
      .from('shifts')
      .select('*')
      .order('start_time', { ascending: true });
    if (error) showToast('error', 'ไม่สามารถโหลดข้อมูลกะได้');
    else setShifts(data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { loadShifts(); }, [loadShifts]);

  const openAdd = () => {
    setEditShift(null);
    setFormName('');
    setFormStart('08:00');
    setFormEnd('15:00');
    setFormStaff(1);
    setShowForm(true);
  };

  const openEdit = (shift: Shift) => {
    setEditShift(shift);
    setFormName(shift.name);
    setFormStart(shift.start_time.substring(0, 5));
    setFormEnd(shift.end_time.substring(0, 5));
    setFormStaff(shift.required_staff);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      showToast('warning', 'กรุณากรอกชื่อกะ');
      return;
    }
    setSaving(true);
    const payload = {
      name: formName.trim(),
      start_time: formStart,
      end_time: formEnd,
      required_staff: formStaff,
    };
    if (editShift) {
      const { error } = await supabase.from('shifts').update(payload).eq('id', editShift.id);
      if (error) showToast('error', 'แก้ไขไม่สำเร็จ');
      else showToast('success', 'แก้ไขกะสำเร็จ');
    } else {
      const { error } = await supabase.from('shifts').insert(payload);
      if (error) showToast('error', 'เพิ่มกะไม่สำเร็จ');
      else showToast('success', 'เพิ่มกะสำเร็จ');
    }
    setSaving(false);
    setShowForm(false);
    loadShifts();
  };

  const confirmDelete = (shift: Shift) => {
    setShiftToDelete(shift);
  };

  const executeDelete = async () => {
    if (!shiftToDelete) return;
    const { error } = await supabase.from('shifts').delete().eq('id', shiftToDelete.id);
    if (error) showToast('error', 'ลบไม่สำเร็จ');
    else {
      showToast('success', 'ลบกะสำเร็จ');
      loadShifts();
      setShiftToDelete(null);
    }
  };

  const formatTime = (time: string) => time.substring(0, 5);

  const shiftColors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            ⏰ จัดการกะการทำงาน
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            กำหนดช่วงเวลาและจำนวนพนักงานที่ต้องการในแต่ละกะ
          </p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all duration-200 cursor-pointer hover:opacity-90"
          style={{ background: 'var(--gradient-primary)' }}
        >
          <Plus size={18} />
          เพิ่มกะ
        </button>
      </div>

      {/* Shift Cards */}
      {loading ? (
        <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>กำลังโหลด...</div>
      ) : shifts.length === 0 ? (
        <div
          className="text-center py-16 rounded-xl"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
        >
          ยังไม่มีกะ — เพิ่มกะแรกของคุณ!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {shifts.map((shift, i) => {
            const color = shiftColors[i % shiftColors.length];
            return (
              <div
                key={shift.id}
                className={`group relative rounded-xl p-6 transition-all duration-300 animate-fade-in stagger-${Math.min(i + 1, 5)}`}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                }}
              >
                {/* Color accent line */}
                <div
                  className="absolute top-0 left-6 right-6 h-0.5 rounded-b"
                  style={{ background: color }}
                />

                <div className="flex items-start justify-between mb-4">
                  <div
                    className="p-2.5 rounded-xl"
                    style={{ background: `${color}15` }}
                  >
                    <Clock size={20} style={{ color }} />
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => openEdit(shift)}
                      className="p-1.5 rounded-lg cursor-pointer transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-info)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      onClick={() => confirmDelete(shift)}
                      className="p-1.5 rounded-lg cursor-pointer transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-danger)')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {shift.name}
                </h3>

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {formatTime(shift.start_time)} — {formatTime(shift.end_time)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 mt-2">
                  <Users size={14} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    ต้องการ {shift.required_staff} คน
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add/Edit Shift Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editShift ? 'แก้ไขกะ' : 'เพิ่มกะใหม่'}
      >
        <div className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              ชื่อกะ
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="เช่น กะเช้า, กะเย็น"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
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

          <div className="grid grid-cols-2 gap-4">
            <TimePicker
              value={formStart}
              onChangeAction={setFormStart}
              label="เวลาเริ่ม"
            />
            <TimePicker
              value={formEnd}
              onChangeAction={setFormEnd}
              label="เวลาสิ้นสุด"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              จำนวนพนักงานที่ต้องการ
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={formStaff}
              onChange={(e) => setFormStaff(parseInt(e.target.value) || 1)}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all duration-200"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
              }}
            />
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
              {saving ? 'กำลังบันทึก...' : editShift ? 'บันทึก' : 'เพิ่ม'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Shift Confirm Modal */}
      <Modal
        isOpen={!!shiftToDelete}
        onClose={() => setShiftToDelete(null)}
        title="🗑️ ยืนยันการลบกะ"
        maxWidth="400px"
      >
        <div>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
            คุณแน่ใจหรือไม่ว่าต้องการลบกะ <span className="font-bold text-white">"{shiftToDelete?.name}"</span> ? ข้อมูลการจัดตารางงานที่เคยใช้กะนี้อาจเกิดข้อผิดพลาดได้ การลบจะไม่สามารถกู้คืนได้
          </p>
          <div className="flex justify-end gap-3 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
            <button
              onClick={() => setShiftToDelete(null)}
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
