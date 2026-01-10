// Booking system types and labels

export type BookingStatus = 'forfragen' | 'preliminar' | 'bekraftad' | 'avbokad' | 'genomford' | 'blockerad';
export type EventType = 'middag' | 'foretagsevent' | 'brollop' | 'transport' | 'privat' | 'konferens' | 'ovrigt';
export type EventLayout = 'sittning' | 'mingel' | 'konferens' | 'blandat';
export type PmType = 'besattning' | 'servering' | 'kok' | 'bar';
export type BookingCrewRole = 'kapten' | 'matros' | 'serveringsansvarig' | 'kock' | 'bartender';
export type BlockingReason = 'service' | 'privat' | 'vaderreserv' | 'personalbrist' | 'ovrigt';

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  forfragen: 'Förfrågan',
  preliminar: 'Preliminär',
  bekraftad: 'Bekräftad',
  avbokad: 'Avbokad',
  genomford: 'Genomförd',
  blockerad: 'Blockerad',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  forfragen: 'bg-yellow-100 text-yellow-800 border-yellow-300',
  preliminar: 'bg-blue-100 text-blue-800 border-blue-300',
  bekraftad: 'bg-green-100 text-green-800 border-green-300',
  avbokad: 'bg-red-100 text-red-800 border-red-300',
  genomford: 'bg-gray-100 text-gray-800 border-gray-300',
  blockerad: 'bg-purple-100 text-purple-800 border-purple-300',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  middag: 'Middag',
  foretagsevent: 'Företagsevent',
  brollop: 'Bröllop',
  transport: 'Transport',
  privat: 'Privat',
  konferens: 'Konferens',
  ovrigt: 'Övrigt',
};

export const EVENT_LAYOUT_LABELS: Record<EventLayout, string> = {
  sittning: 'Sittning',
  mingel: 'Mingel',
  konferens: 'Konferens',
  blandat: 'Blandat',
};

export const PM_TYPE_LABELS: Record<PmType, string> = {
  besattning: 'Besättning/Drift',
  servering: 'Servering/Restaurang',
  kok: 'Kök',
  bar: 'Bar/Inköp',
};

export const BOOKING_CREW_ROLE_LABELS: Record<BookingCrewRole, string> = {
  kapten: 'Kapten',
  matros: 'Matros',
  serveringsansvarig: 'Serveringsansvarig',
  kock: 'Kock',
  bartender: 'Bartender',
};

export const BLOCKING_REASON_LABELS: Record<BlockingReason, string> = {
  service: 'Service/Underhåll',
  privat: 'Privat',
  vaderreserv: 'Väderreserv',
  personalbrist: 'Personalbrist',
  ovrigt: 'Övrigt',
};

export const DIETARY_TAGS = [
  'glutenfri',
  'laktosfri',
  'vegetarisk',
  'vegan',
  'nötfri',
  'skaldjursfri',
  'äggfri',
  'fiskfri',
] as const;

export interface Booking {
  id: string;
  vessel_id: string;
  booking_date: string;
  start_time: string;
  end_time: string;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  status: BookingStatus;
  blocking_reason?: BlockingReason;
  event_type?: EventType;
  event_layout?: EventLayout;
  guest_count?: number;
  max_guest_warning?: boolean;
  contact_name?: string;
  contact_phone?: string;
  contact_company?: string;
  internal_notes?: string;
  departure_harbor?: string;
  arrival_harbor?: string;
  route_notes?: string;
  tech_equipment?: string[];
  safety_notes?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  vessels?: {
    id: string;
    name: string;
  };
}

export interface Menu {
  id: string;
  name: string;
  season?: string;
  description?: string;
  courses: any[];
  allergen_info?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DrinkPackage {
  id: string;
  name: string;
  description?: string;
  contents: any[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface BookingFood {
  id: string;
  booking_id: string;
  menu_id?: string;
  menu_name_snapshot?: string;
  portions?: number;
  dietary_tags: string[];
  dietary_notes?: string;
  menu_deadline?: string;
  serving_times?: any;
  kitchen_notes?: string;
  menus?: Menu;
}

export interface BookingDrinks {
  id: string;
  booking_id: string;
  drink_package_id?: string;
  package_name_snapshot?: string;
  is_a_la_carte: boolean;
  extras: string[];
  notes?: string;
  drink_packages?: DrinkPackage;
}

export interface BookingCrew {
  id: string;
  booking_id: string;
  profile_id: string;
  role_type: BookingCrewRole;
  notes?: string;
  profiles?: {
    id: string;
    full_name: string;
  };
}

export interface BookingPm {
  id: string;
  booking_id: string;
  pm_type: PmType;
  version: number;
  content: any;
  is_latest: boolean;
  created_by: string;
  created_at: string;
}
