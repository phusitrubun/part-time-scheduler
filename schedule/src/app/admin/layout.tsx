'use client';

import AdminSidebar from '@/components/AdminSidebar';
import ToastContainer from '@/components/Toast';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row h-screen" style={{ background: 'var(--bg-primary)' }}>
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto pb-20 md:pb-0 relative pt-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 w-full">
          {children}
        </div>
      </main>
      <ToastContainer />
    </div>
  );
}
