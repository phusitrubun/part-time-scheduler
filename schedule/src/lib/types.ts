// ==========================================
// Database Types matching Supabase Schema
// ==========================================

export type ShiftPreference = 'morning' | 'evening' | 'both';
export type DailyShiftPreference = ShiftPreference | 'none';

export type EmploymentType = 'full_time' | 'part_time';

export interface Employee {
  id: string;
  name: string;
  employment_type?: EmploymentType; // Added for full-time / part-time
  shift_preference: ShiftPreference; // Legacy column, kept for backward compatibility
  weekly_shift_preference?: Record<string, DailyShiftPreference>; // '0'-'6' mapping
  unavailabilities?: { unavailable_date: string }[];
  created_at: string;
  role?: string;
}

export interface EmployeeUnavailability {
  id: string;
  employee_id: string;
  unavailable_date: string; // YYYY-MM-DD
  created_at: string;
}

export interface Shift {
  id: string;
  name: string;
  start_time: string; // HH:MM:SS
  end_time: string;   // HH:MM:SS
  required_staff: number;
  created_at: string;
  role?: string;
}

export interface Schedule {
  id: string;
  work_date: string; // YYYY-MM-DD
  shift_id: string;
  is_published: boolean;
  created_at: string;
  // Joined data
  shift?: Shift;
}

export interface ScheduleAssignment {
  id: string;
  schedule_id: string;
  employee_id: string;
  created_at: string;
  // Joined data
  employee?: Employee;
}

export const ROLES = [
  { id: 'server', label: 'พนักงานเสิร์ฟ' },
  { id: 'bar', label: 'พนักงานบาร์คาเฟ่' },
  { id: 'chef', label: 'เชฟ' },
  { id: 'assistant_chef', label: 'ผู้ช่วยเชฟ' },
];

export interface ScheduleWithDetails extends Schedule {
  shift: Shift;
  assignments: (ScheduleAssignment & { employee: Employee })[];
}

// Form types
export interface EmployeeFormData {
  name: string;
  shift_preference: ShiftPreference;
  role?: string;
}

export interface ShiftFormData {
  name: string;
  start_time: string;
  end_time: string;
  required_staff: number;
  role?: string;
}

export interface GenerateScheduleParams {
  start_date: string;
  end_date: string;
  shift_ids: string[];
}

// Warning type for schedule generation
export interface ScheduleWarning {
  date: string;
  shift_name: string;
  required: number;
  available: number;
  message: string;
}
