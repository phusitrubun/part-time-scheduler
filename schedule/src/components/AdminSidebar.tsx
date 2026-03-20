'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Users, Clock, CalendarDays, LayoutDashboard, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const navItems = [
  { href: '/admin', icon: LayoutDashboard, label: 'แดชบอร์ด' },
  { href: '/admin/employees', icon: Users, label: 'พนักงาน' },
  { href: '/admin/shifts', icon: Clock, label: 'กะการทำงาน' },
  { href: '/admin/schedules', icon: CalendarDays, label: 'จัดตารางงาน' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className="hidden md:flex flex-col h-full transition-all duration-300 ease-in-out z-40 relative"
        style={{
          width: collapsed ? '72px' : '260px',
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
        }}
      >
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 h-16 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg text-white font-bold text-sm"
          style={{ background: 'var(--gradient-primary)' }}
        >
          SF
        </div>
        {!collapsed && (
          <span className="text-lg font-bold tracking-tight animate-fade-in" style={{ color: 'var(--text-primary)' }}>
            ShiftFlow
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative"
              style={{
                background: isActive ? 'var(--gradient-card)' : 'transparent',
                color: isActive ? 'var(--accent-primary-hover)' : 'var(--text-secondary)',
                borderLeft: isActive ? '3px solid var(--accent-primary)' : '3px solid transparent',
              }}
              title={collapsed ? item.label : undefined}
            >
              <item.icon
                size={20}
                className="transition-transform duration-200 group-hover:scale-110 flex-shrink-0"
              />
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
              {isActive && !collapsed && (
                <div
                  className="absolute right-3 w-1.5 h-1.5 rounded-full animate-pulse-glow"
                  style={{ background: 'var(--accent-primary)' }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center h-12 border-t transition-colors duration-200 cursor-pointer"
        style={{
          borderColor: 'var(--border-color)',
          color: 'var(--text-muted)',
        }}
      >
        {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
      </button>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around px-2 py-3"
        style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border-color)',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        }}
      >
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${isActive ? 'scale-105' : 'hover:scale-105'}`}
              style={{
                color: isActive ? 'var(--accent-primary)' : 'var(--text-muted)',
              }}
            >
              <item.icon size={24} className={isActive ? 'opacity-100' : 'opacity-70'} />
              <span className="text-[10px] font-medium" style={{ opacity: isActive ? 1 : 0.8 }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
