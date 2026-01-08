// Enums matching database
export type AppRole = 'admin' | 'skeppare' | 'readonly';
export type CrewRole = 'befalhavare' | 'styrman' | 'matros' | 'jungman' | 'restaurangpersonal';
export type LogbookStatus = 'oppen' | 'stangd';

// Helper labels in Swedish
export const CREW_ROLE_LABELS: Record<CrewRole, string> = {
  befalhavare: 'Befälhavare',
  styrman: 'Styrman',
  matros: 'Matros',
  jungman: 'Jungman',
  restaurangpersonal: 'Restaurangpersonal',
};

export const APP_ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Administratör',
  skeppare: 'Skeppare',
  readonly: 'Läsbehörighet',
};

export const LOGBOOK_STATUS_LABELS: Record<LogbookStatus, string> = {
  oppen: 'Öppen',
  stangd: 'Stängd',
};

// Interfaces
export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Vessel {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface VesselCrewRequirement {
  id: string;
  vessel_id: string;
  role: CrewRole;
  minimum_count: number;
  created_at: string;
}

export interface CertificateType {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface UserCertificate {
  id: string;
  user_id: string;
  certificate_type_id: string;
  issue_date: string | null;
  expiry_date: string;
  created_at: string;
  updated_at: string;
  certificate_type?: CertificateType;
}

export interface UserVesselInduction {
  id: string;
  user_id: string;
  vessel_id: string;
  inducted_at: string;
  created_at: string;
  vessel?: Vessel;
}

export interface RoleCertificateRule {
  id: string;
  role: CrewRole;
  certificate_type_id: string;
  is_required: boolean;
  group_logic: string | null;
  group_name: string | null;
  requires_induction: boolean;
  created_at: string;
  certificate_type?: CertificateType;
}

export interface Logbook {
  id: string;
  vessel_id: string;
  date: string;
  status: LogbookStatus;
  weather: string | null;
  wind: string | null;
  general_notes: string | null;
  from_location: string | null;
  to_location: string | null;
  passenger_count: number | null;
  departure_time: string | null;
  arrival_time: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  closed_by: string | null;
  vessel?: Vessel;
  created_by_profile?: Profile;
}

export interface LogbookEngineHour {
  id: string;
  logbook_id: string;
  start_hours: number | null;
  stop_hours: number | null;
  notes: string | null;
  operational_status: string | null;
  created_at: string;
}

export interface LogbookCrew {
  id: string;
  logbook_id: string;
  user_id: string;
  role: CrewRole;
  created_at: string;
  profile?: Profile;
}

export interface AuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  user_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
}

// Validation types
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  noVesselSelected?: boolean;
}

export interface ValidationError {
  type: 'crew_requirement' | 'certificate' | 'induction';
  message: string;
  details?: string;
}

export interface ValidationWarning {
  type: 'certificate_expiring' | 'other';
  message: string;
  details?: string;
}
