'use client';

import { useEffect, useState } from 'react';
import { Users, Clock, CalendarDays, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

interface Stats {
  employees: number;
  shifts: number;
  schedulesToday: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({ employees: 0, shifts: 0, schedulesToday: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [empRes, shiftRes, schedRes] = await Promise.all([
          supabase.from('employees').select('id', { count: 'exact', head: true }),
          supabase.from('shifts').select('id', { count: 'exact', head: true }),
          supabase.from('schedules').select('id', { count: 'exact', head: true })
            .eq('work_date', new Date().toISOString().split('T')[0]),
        ]);
        setStats({
          employees: empRes.count ?? 0,
          shifts: shiftRes.count ?? 0,
          schedulesToday: schedRes.count ?? 0,
        });
      } catch {
        // silently fail — stats are non-critical
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);

  const cards = [
    { label: 'พนักงานทั้งหมด', value: stats.employees, icon: Users, color: '#6366f1', href: '/admin/employees' },
    { label: 'กะการทำงาน', value: stats.shifts, icon: Clock, color: '#8b5cf6', href: '/admin/shifts' },
    { label: 'ตารางงานวันนี้', value: stats.schedulesToday, icon: CalendarDays, color: '#10b981', href: '/admin/schedules' },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
          แดชบอร์ด
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          ภาพรวมระบบจัดตารางงาน ShiftFlow
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        {cards.map((card, i) => (
          <Link
            key={card.label}
            href={card.href}
            className={`group relative rounded-xl p-6 transition-all duration-300 animate-fade-in stagger-${i + 1}`}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{ background: `linear-gradient(135deg, ${card.color}10, transparent)` }}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>{card.label}</p>
                <p className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {loading ? '—' : card.value}
                </p>
              </div>
              <div
                className="p-3 rounded-xl transition-transform duration-300 group-hover:scale-110"
                style={{ background: `${card.color}15` }}
              >
                <card.icon size={24} style={{ color: card.color }} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
          <TrendingUp size={20} className="inline mr-2" style={{ color: 'var(--accent-primary)' }} />
          เข้าใช้งานด่วน
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/admin/schedules"
            className="flex items-center gap-4 p-5 rounded-xl transition-all duration-300 group"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div className="p-3 rounded-xl" style={{ background: 'var(--gradient-primary)' }}>
              <CalendarDays size={24} className="text-white" />
            </div>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>สร้างตารางงานใหม่</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>สุ่มจัดตารางอัตโนมัติด้วยระบบ</p>
            </div>
          </Link>
          <Link
            href="/admin/employees"
            className="flex items-center gap-4 p-5 rounded-xl transition-all duration-300 group"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div className="p-3 rounded-xl" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
              <Users size={24} className="text-white" />
            </div>
            <div>
              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>จัดการพนักงาน</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>เพิ่ม/แก้ไข ข้อมูลพนักงานพาร์ทไทม์</p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
