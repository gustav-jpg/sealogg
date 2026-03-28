import { CrewRole } from '@/lib/types';

export interface EngineRefill {
  tempId: string;
  id?: string;
  refillType: 'olja' | 'glykol';
  liters: number;
}

export interface EngineHourEntry {
  id?: string;
  tempId: string;
  engineType: 'main' | 'auxiliary';
  engineNumber: number;
  engineLabel: string;
  startHours: number;
  stopHours: number | null;
  notes: string;
  refills: EngineRefill[];
}

export interface CrewMember {
  tempId: string;
  id?: string;
  profileId: string;
  role: CrewRole;
}

export interface QuickEntry {
  id: string;
  type: 'bunkring' | 'farskvatten' | 'septik';
  text: string;
  timestamp: string;
}

export interface LogbookWithRelations {
  id: string;
  date: string;
  status: string;
  weather: string | null;
  wind: string | null;
  general_notes: string | null;
  bunker_liters: number | null;
  bunkered: boolean;
  water_filled: boolean;
  septic_emptied: boolean;
  vessel_id: string;
  created_by: string;
  created_at: string;
  closed_at: string | null;
  closed_by: string | null;
  departure_time: string | null;
  arrival_time: string | null;
  from_location: string | null;
  to_location: string | null;
  passenger_count: number | null;
  updated_at: string;
  vessel: {
    id: string;
    name: string;
    organization_id: string;
    max_passengers?: number;
    main_engine_count?: number;
    auxiliary_engine_count?: number;
    primary_engine_id?: string;
    [key: string]: any;
  } | null;
  created_by_profile: {
    full_name: string;
    [key: string]: any;
  };
}

export interface PassengerSummary {
  firstDeparture: string;
  lastDeparture: string;
  totalPaxOn: number;
  totalPaxOff: number;
  stopCount: number;
  stops: {
    order: number;
    time: string;
    dock: string;
    paxOn: number;
    paxOff: number;
  }[];
}
