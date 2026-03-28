import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';
import { useToast } from '@/hooks/use-toast';
import { useLogbookPrint } from '@/hooks/useLogbookPrint';
import { useValidation } from '@/hooks/useValidation';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LogbookStops, LogbookStopsDisplay, StopEntry } from '@/components/LogbookStops';
import { useLogbookSignatures, useSignLogbook } from '@/hooks/useLogbookSignature';
import { LOGBOOK_STATUS_LABELS, CREW_ROLE_LABELS, CrewRole } from '@/lib/types';
import { EngineHourEntry, CrewMember, QuickEntry } from '@/lib/logbook-types';
import { LogbookBasicInfo } from '@/components/logbook/LogbookBasicInfo';
import { LogbookEngineHours } from '@/components/logbook/LogbookEngineHours';
import { LogbookExercises } from '@/components/logbook/LogbookExercises';
import { LogbookCrew } from '@/components/logbook/LogbookCrew';
import { LogbookSidebar } from '@/components/logbook/LogbookSidebar';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Ship, MapPin, ArrowLeft, Save, Trash2, Plus, ShieldCheck, History, Fuel, Loader2, CheckCircle2, CloudOff } from 'lucide-react';

export default function LogbookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canEdit, isAdmin } = useAuth();
  const { toast } = useToast();
  const { printLogbook } = useLogbookPrint();
  const queryClient = useQueryClient();

  const [weather, setWeather] = useState('');
  const [wind, setWind] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [bunkerLiters, setBunkerLiters] = useState('');
  const [stops, setStops] = useState<StopEntry[]>([]);
  const [stopsInitialized, setStopsInitialized] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [overrideValidation, setOverrideValidation] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCrewDialog, setShowCrewDialog] = useState(false);
  const [editableCrew, setEditableCrew] = useState<CrewMember[]>([]);
  const [fetchingWind, setFetchingWind] = useState(false);
  const [editableEngineHours, setEditableEngineHours] = useState<EngineHourEntry[]>([]);
  const [engineHoursInitialized, setEngineHoursInitialized] = useState(false);
  const [editableExercises, setEditableExercises] = useState<{tempId: string; exerciseType: string; notes: string}[]>([]);
  const [exercisesInitialized, setExercisesInitialized] = useState(false);
  const [exerciseDialogOpen, setExerciseDialogOpen] = useState(false);
  const [newExerciseType, setNewExerciseType] = useState('');
  const [newExerciseNotes, setNewExerciseNotes] = useState('');
  const [showSignDialog, setShowSignDialog] = useState(false);
  const [showHistoryDialog, setShowHistoryDialog] = useState(false);
  const [showDeletePassengerSessionDialog, setShowDeletePassengerSessionDialog] = useState(false);
  const [showBunkerDialog, setShowBunkerDialog] = useState(false);
  const [bunkerDialogLiters, setBunkerDialogLiters] = useState('');
  const [bunkerDialogEngineHours, setBunkerDialogEngineHours] = useState('');
  const [quickEntries, setQuickEntries] = useState<QuickEntry[]>([]);
  const [quickEntriesInitialized, setQuickEntriesInitialized] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitializedRef = useRef(false);

  // Passenger session
  const { data: passengerSession } = useQuery({
    queryKey: ['passenger-session-for-logbook', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_sessions')
        .select('id, is_active, started_at, ended_at')
        .eq('logbook_id', id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Passenger entries summary
  const { data: passengerSummary } = useQuery({
    queryKey: ['passenger-summary', passengerSession?.id],
    queryFn: async () => {
      if (!passengerSession?.id) return null;
      const { data: entries, error } = await supabase
        .from('passenger_entries')
        .select('departure_time, pax_on, pax_off, dock_name')
        .eq('session_id', passengerSession.id)
        .order('entry_order', { ascending: true });
      if (error) throw error;
      if (!entries || entries.length === 0) return null;
      const sortedByTime = [...entries].sort((a, b) => (a.departure_time || '').localeCompare(b.departure_time || ''));
      return {
        firstDeparture: sortedByTime[0]?.departure_time?.slice(0, 5) || '-',
        lastDeparture: sortedByTime[sortedByTime.length - 1]?.departure_time?.slice(0, 5) || '-',
        totalPaxOn: entries.reduce((sum, e) => sum + (e.pax_on || 0), 0),
        totalPaxOff: entries.reduce((sum, e) => sum + (e.pax_off || 0), 0),
        stopCount: entries.length,
        stops: entries.map((e, i) => ({
          order: i + 1,
          time: e.departure_time?.slice(0, 5) || '-',
          dock: e.dock_name || '-',
          paxOn: e.pax_on || 0,
          paxOff: e.pax_off || 0,
        })),
      };
    },
    enabled: !!passengerSession?.id,
  });

  const activatePassengerRegistration = useMutation({
    mutationFn: async () => {
      if (!logbook) throw new Error('No logbook');
      const { data, error } = await supabase
        .from('passenger_sessions')
        .insert({ logbook_id: id, vessel_id: logbook.vessel_id, started_by: user?.id })
        .select('id')
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-session-for-logbook', id] });
      toast({ title: 'Passagerarregistrering aktiverad', description: 'Besättningen kan nu registrera passagerare.' });
    },
    onError: () => {
      toast({ title: 'Fel', description: 'Kunde inte aktivera passagerarregistrering', variant: 'destructive' });
    },
  });

  const lockPassengerSession = useMutation({
    mutationFn: async () => {
      if (!passengerSession?.id) throw new Error('Ingen passagerarsession');
      const { error } = await supabase
        .from('passenger_sessions')
        .update({ is_active: false, ended_at: new Date().toISOString() })
        .eq('id', passengerSession.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-session-for-logbook', id] });
      queryClient.invalidateQueries({ queryKey: ['passenger-sessions'] });
      toast({ title: 'Låst', description: 'Passagerarregistreringen är nu låst.' });
    },
    onError: () => {
      toast({ title: 'Fel', description: 'Kunde inte låsa passagerarregistrering', variant: 'destructive' });
    },
  });

  const unlockPassengerSession = useMutation({
    mutationFn: async () => {
      if (!passengerSession?.id) throw new Error('Ingen passagerarsession');
      const { error } = await supabase
        .from('passenger_sessions')
        .update({ is_active: true, ended_at: null })
        .eq('id', passengerSession.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-session-for-logbook', id] });
      queryClient.invalidateQueries({ queryKey: ['passenger-sessions'] });
      toast({ title: 'Upplåst', description: 'Passagerarregistreringen är nu aktiv igen.' });
    },
    onError: () => {
      toast({ title: 'Fel', description: 'Kunde inte låsa upp passagerarregistrering', variant: 'destructive' });
    },
  });

  const deletePassengerSession = useMutation({
    mutationFn: async () => {
      if (!passengerSession?.id) throw new Error('Ingen passagerarsession');
      const { error: entriesError } = await supabase.from('passenger_entries').delete().eq('session_id', passengerSession.id);
      if (entriesError) throw entriesError;
      const { error } = await supabase.from('passenger_sessions').delete().eq('id', passengerSession.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['passenger-session-for-logbook', id] }),
        queryClient.invalidateQueries({ queryKey: ['passenger-sessions'], refetchType: 'all' }),
        queryClient.invalidateQueries({ queryKey: ['passenger-summary'], refetchType: 'all' }),
      ]);
      toast({ title: 'Borttagen', description: 'Passagerarregistreringen har tagits bort.' });
    },
    onError: () => {
      toast({ title: 'Fel', description: 'Kunde inte ta bort passagerarregistrering', variant: 'destructive' });
    },
  });

  const { data: signatures } = useLogbookSignatures(id);
  const signLogbook = useSignLogbook();

  const { data: linkedDeviations } = useQuery({
    queryKey: ['logbook-deviations', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deviations')
        .select('id, title, type, severity, status, deviation_number')
        .eq('logbook_id', id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: auditHistory } = useQuery({
    queryKey: ['logbook-audit-history', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('table_name', 'logbooks')
        .eq('record_id', id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const userIds = [...new Set(data?.map(log => log.user_id).filter(Boolean) as string[])];
      const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds);
      return data?.map(log => ({
        ...log,
        user_profile: profiles?.find(p => p.user_id === log.user_id),
      })) || [];
    },
    enabled: !!id,
  });

  const { data: logbook, isLoading } = useQuery({
    queryKey: ['logbook', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logbooks')
        .select(`*, vessel:vessels(*)`)
        .eq('id', id)
        .single();
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('*').eq('user_id', data.created_by).maybeSingle();
      let creatorName = profile?.full_name;
      if (!creatorName && data.created_by) {
        const { data: nameData } = await supabase.rpc('get_profile_name_by_user_id', { _user_id: data.created_by });
        creatorName = nameData;
      }
      return { ...data, created_by_profile: profile || { full_name: creatorName || 'Okänd' } };
    },
    enabled: !!id,
  });

  // Initialize form fields when logbook data is loaded
  useEffect(() => {
    if (logbook && !initialized) {
      setWeather(logbook.weather || '');
      setWind(logbook.wind || '');
      setGeneralNotes(logbook.general_notes || '');
      setBunkerLiters(logbook.bunker_liters?.toString() || '');
      
      const entries: QuickEntry[] = [];
      if ((logbook as any)?.bunkered) {
        supabase
          .from('bunker_events')
          .select('liters, engine_hours, engine_name')
          .eq('logbook_id', id!)
          .order('created_at', { ascending: false })
          .limit(1)
          .then(({ data: bunkerEvents }) => {
            const be = bunkerEvents?.[0];
            let bunkerText = 'Bunkrat';
            if (be) {
              bunkerText = `Bunkrat ${be.liters} liter`;
              if (be.engine_hours) {
                bunkerText += ` vid ${be.engine_hours} h (${be.engine_name || 'HM'})`;
              }
            } else if (logbook.bunker_liters) {
              bunkerText = `Bunkrat ${logbook.bunker_liters}L`;
            }
            setQuickEntries(prev => {
              const withoutBunkring = prev.filter(e => e.type !== 'bunkring');
              return [{ id: crypto.randomUUID(), type: 'bunkring' as const, text: bunkerText, timestamp: '' }, ...withoutBunkring];
            });
          });
        entries.push({ id: crypto.randomUUID(), type: 'bunkring', text: 'Bunkrat', timestamp: '' });
      }
      if ((logbook as any)?.water_filled) {
        entries.push({ id: crypto.randomUUID(), type: 'farskvatten', text: 'Fyllt färskvatten', timestamp: '' });
      }
      if ((logbook as any)?.septic_emptied) {
        entries.push({ id: crypto.randomUUID(), type: 'septik', text: 'Tömt septik', timestamp: '' });
      }
      if (entries.length > 0) {
        setQuickEntries(entries);
      }
      setInitialized(true);
    }
  }, [logbook, initialized]);

  const { data: logbookStops } = useQuery({
    queryKey: ['logbook-stops', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('logbook_stops').select('*').eq('logbook_id', id).order('stop_order');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (logbookStops && !stopsInitialized) {
      setStops(logbookStops.map(s => ({
        tempId: s.id,
        stopOrder: s.stop_order,
        departureTime: s.departure_time || '',
        departureLocation: s.departure_location || '',
        arrivalTime: s.arrival_time || '',
        arrivalLocation: s.arrival_location || '',
        passengerCount: s.passenger_count?.toString() || '',
        paxOn: (s as any).pax_on?.toString() || '',
        paxOff: (s as any).pax_off?.toString() || '',
        vehiclesOn: (s as any).vehicles_on?.toString() || '',
        vehiclesOff: (s as any).vehicles_off?.toString() || '',
        cargoOnKg: (s as any).cargo_on_kg?.toString() || '',
        cargoOffKg: (s as any).cargo_off_kg?.toString() || '',
        notes: s.notes || '',
      })));
      setStopsInitialized(true);
    }
  }, [logbookStops, stopsInitialized]);

  const { data: crewMembers } = useQuery({
    queryKey: ['logbook-crew', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logbook_crew')
        .select(`*, profile:profiles!logbook_crew_profile_id_fkey(*)`)
        .eq('logbook_id', id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { selectedOrgId } = useOrganization();
  const { data: profiles } = useOrgProfiles(selectedOrgId);

  const { data: engineHours } = useQuery({
    queryKey: ['logbook-engine-hours', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logbook_engine_hours')
        .select('*')
        .eq('logbook_id', id)
        .order('engine_type')
        .order('engine_number');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: exercises } = useQuery({
    queryKey: ['logbook-exercises', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('logbook_exercises').select('*').eq('logbook_id', id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (exercises && !exercisesInitialized) {
      setEditableExercises(exercises.map(e => ({ tempId: e.id, exerciseType: e.exercise_type, notes: e.notes || '' })));
      setExercisesInitialized(true);
    }
  }, [exercises, exercisesInitialized]);

  const { data: exerciseCategories } = useQuery({
    queryKey: ['exercise-categories', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('exercise_categories')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const { data: vesselEngineHours } = useQuery({
    queryKey: ['vessel-engine-hours', logbook?.vessel_id],
    queryFn: async () => {
      if (!logbook?.vessel_id) return [];
      const { data, error } = await supabase
        .from('vessel_engine_hours')
        .select('*')
        .eq('vessel_id', logbook.vessel_id)
        .order('engine_type')
        .order('engine_number');
      if (error) throw error;
      return data;
    },
    enabled: !!logbook?.vessel_id,
  });

  useEffect(() => {
    if (engineHours && !engineHoursInitialized) {
      setEditableEngineHours(engineHours.map(e => ({
        id: e.id,
        tempId: e.id,
        engineType: (e.engine_type as 'main' | 'auxiliary') || 'main',
        engineNumber: e.engine_number || 1,
        engineLabel: e.engine_name || `${e.engine_type === 'auxiliary' ? 'Hjälpmaskin' : 'Huvudmaskin'} ${e.engine_number || 1}`,
        startHours: e.start_hours || 0,
        stopHours: e.stop_hours,
        notes: e.notes || '',
      })));
      setEngineHoursInitialized(true);
    }
  }, [engineHours, engineHoursInitialized]);

  const initializeEngineHoursFromVessel = () => {
    if (!vesselEngineHours || !logbook?.vessel) return;
    const vessel = logbook.vessel as any;
    const entries: EngineHourEntry[] = [];
    for (let i = 1; i <= (vessel.main_engine_count || 0); i++) {
      const existing = vesselEngineHours.find(h => h.engine_type === 'main' && h.engine_number === i);
      entries.push({ tempId: crypto.randomUUID(), engineType: 'main', engineNumber: i, engineLabel: existing?.name || `Huvudmaskin ${i}`, startHours: existing?.current_hours || 0, stopHours: null, notes: '' });
    }
    for (let i = 1; i <= (vessel.auxiliary_engine_count || 0); i++) {
      const existing = vesselEngineHours.find(h => h.engine_type === 'auxiliary' && h.engine_number === i);
      entries.push({ tempId: crypto.randomUUID(), engineType: 'auxiliary', engineNumber: i, engineLabel: existing?.name || `Hjälpmaskin ${i}`, startHours: existing?.current_hours || 0, stopHours: null, notes: '' });
    }
    setEditableEngineHours(entries);
  };

  const updateEngineHour = (tempId: string, field: keyof EngineHourEntry, value: string | number | null) => {
    setEditableEngineHours(editableEngineHours.map(e => e.tempId === tempId ? { ...e, [field]: value } : e));
  };

  const crewForValidation = crewMembers?.map(c => ({
    userId: c.profile_id,
    role: c.role as CrewRole,
    fullName: (c as any).profile?.full_name || 'Okänd',
  })) || [];
  const validation = useValidation({ vesselId: logbook?.vessel_id || null, crew: crewForValidation });

  // Save stops + engine hours + exercises helper
  const saveRelatedData = async () => {
    // Stops
    await supabase.from('logbook_stops').delete().eq('logbook_id', id);
    if (stops.length > 0) {
      const { error: stopsError } = await supabase.from('logbook_stops').insert(
        stops.map(s => ({
          logbook_id: id,
          stop_order: s.stopOrder,
          departure_time: s.departureTime || null,
          departure_location: s.departureLocation || null,
          arrival_time: s.arrivalTime || null,
          arrival_location: s.arrivalLocation || null,
          passenger_count: s.passengerCount ? parseInt(s.passengerCount) : null,
          pax_on: s.paxOn ? parseInt(s.paxOn) : 0,
          pax_off: s.paxOff ? parseInt(s.paxOff) : 0,
          vehicles_on: s.vehiclesOn ? parseInt(s.vehiclesOn) : 0,
          vehicles_off: s.vehiclesOff ? parseInt(s.vehiclesOff) : 0,
          cargo_on_kg: s.cargoOnKg ? parseFloat(s.cargoOnKg) : 0,
          cargo_off_kg: s.cargoOffKg ? parseFloat(s.cargoOffKg) : 0,
          notes: s.notes || null,
        }))
      );
      if (stopsError) throw stopsError;
    }

    // Engine hours
    await supabase.from('logbook_engine_hours').delete().eq('logbook_id', id);
    if (editableEngineHours.length > 0) {
      const { error: engineError } = await supabase.from('logbook_engine_hours').insert(
        editableEngineHours.map(e => ({
          logbook_id: id,
          engine_type: e.engineType,
          engine_number: e.engineNumber,
          engine_name: e.engineLabel,
          start_hours: e.startHours,
          stop_hours: e.stopHours,
          notes: e.notes || null,
        }))
      );
      if (engineError) throw engineError;
    }

    // Engine refills
    await supabase.from('engine_refills').delete().eq('logbook_id', id);
    const allRefills = editableEngineHours.flatMap(e =>
      e.refills.map(r => ({
        logbook_id: id,
        engine_type: e.engineType,
        engine_number: e.engineNumber,
        engine_name: e.engineLabel,
        refill_type: r.refillType,
        liters: r.liters,
      }))
    );
    if (allRefills.length > 0) {
      const { error: refillError } = await supabase.from('engine_refills').insert(allRefills);
      if (refillError) throw refillError;
    }

    // Exercises
    await supabase.from('logbook_exercises').delete().eq('logbook_id', id);
    if (editableExercises.length > 0) {
      const { error: exercisesError } = await supabase.from('logbook_exercises').insert(
        editableExercises.map(exercise => ({
          logbook_id: id,
          exercise_type: exercise.exerciseType,
          notes: exercise.notes || null,
        }))
      );
      if (exercisesError) throw exercisesError;
    }
  };

  const getLogbookUpdateFields = () => ({
    weather: weather || null,
    wind: wind || null,
    general_notes: generalNotes || null,
    bunker_liters: bunkerLiters ? parseInt(bunkerLiters) : null,
    bunkered: quickEntries.some(e => e.type === 'bunkring'),
    water_filled: quickEntries.some(e => e.type === 'farskvatten'),
    septic_emptied: quickEntries.some(e => e.type === 'septik'),
  });

  // Auto-save function
  const performAutoSave = useCallback(async () => {
    if (!id || !isInitializedRef.current) return;
    setAutoSaveStatus('saving');
    try {
      const { error } = await supabase.from('logbooks').update(getLogbookUpdateFields()).eq('id', id);
      if (error) throw error;
      await saveRelatedData();
      queryClient.invalidateQueries({ queryKey: ['logbook', id] });
      queryClient.invalidateQueries({ queryKey: ['logbooks'] });
      queryClient.invalidateQueries({ queryKey: ['logbook-engine-hours', id] });
      queryClient.invalidateQueries({ queryKey: ['logbook-exercises', id] });
      queryClient.invalidateQueries({ queryKey: ['logbook-stops', id] });
      setAutoSaveStatus('saved');
      setTimeout(() => setAutoSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Auto-save error:', err);
      setAutoSaveStatus('error');
    }
  }, [id, weather, wind, generalNotes, bunkerLiters, quickEntries, stops, editableEngineHours, editableExercises]);

  // Debounced auto-save effect - triggers on any editable field change
  useEffect(() => {
    if (!isInitializedRef.current) return;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      performAutoSave();
    }, 1500);
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [weather, wind, generalNotes, bunkerLiters, quickEntries, stops, editableEngineHours, editableExercises, performAutoSave]);

  // Mark initialized after all data has been loaded into state
  useEffect(() => {
    if (initialized && stopsInitialized && engineHoursInitialized && exercisesInitialized) {
      // Small delay to avoid triggering auto-save from initialization
      const t = setTimeout(() => { isInitializedRef.current = true; }, 500);
      return () => clearTimeout(t);
    }
  }, [initialized, stopsInitialized, engineHoursInitialized, exercisesInitialized]);

  const updateLogbook = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('logbooks').update(getLogbookUpdateFields()).eq('id', id);
      if (error) throw error;
      await saveRelatedData();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logbook', id] });
      queryClient.invalidateQueries({ queryKey: ['logbooks'] });
      queryClient.invalidateQueries({ queryKey: ['logbook-engine-hours', id] });
      queryClient.invalidateQueries({ queryKey: ['logbook-exercises', id] });
      toast({ title: 'Sparat', description: 'Loggboken har uppdaterats.' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const closeLogbook = useMutation({
    mutationFn: async () => {
      const missingFields: string[] = [];
      if (!weather?.trim()) missingFields.push('Väder');
      if (!wind?.trim()) missingFields.push('Vind');
      if (!bunkerLiters?.trim()) missingFields.push('Bunker');
      if (!overrideValidation && (!crewMembers || crewMembers.length === 0)) missingFields.push('Besättning');
      const hasEngineHours = editableEngineHours.length > 0 && editableEngineHours.some(e => e.stopHours !== null && e.stopHours !== undefined);
      if (!hasEngineHours) missingFields.push('Maskintimmar (sluttimmar)');
      if (missingFields.length > 0) throw new Error(`Följande fält måste fyllas i: ${missingFields.join(', ')}`);
      if (!validation.isValid && !overrideValidation) throw new Error('Valideringsfel måste åtgärdas innan loggboken kan stängas.');

      await saveRelatedData();

      // Auto-lock passenger session if active
      if (passengerSession?.is_active) {
        await supabase.from('passenger_sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', passengerSession.id);
      }

      const { error } = await supabase
        .from('logbooks')
        .update({
          ...getLogbookUpdateFields(),
          status: 'stangd',
          closed_at: new Date().toISOString(),
          closed_by: user?.id,
        })
        .eq('id', id);
      if (error) throw error;

      // Passenger data for signature
      let passengerDataForSignature = null;
      if (passengerSession?.id) {
        const { data: paxEntries } = await supabase
          .from('passenger_entries')
          .select('departure_time, pax_on, pax_off, dock_name, entry_order')
          .eq('session_id', passengerSession.id)
          .order('entry_order', { ascending: true });
        if (paxEntries && paxEntries.length > 0) {
          passengerDataForSignature = {
            totalPaxOn: paxEntries.reduce((sum, e) => sum + (e.pax_on || 0), 0),
            totalPaxOff: paxEntries.reduce((sum, e) => sum + (e.pax_off || 0), 0),
            stopCount: paxEntries.length,
            stops: paxEntries.map(e => ({ time: e.departure_time, dock: e.dock_name, paxOn: e.pax_on, paxOff: e.pax_off })),
          };
        }
      }

      await signLogbook.mutateAsync({
        logbookId: id!,
        logbookData: {
          id, date: logbook?.date, vessel_id: logbook?.vessel_id, weather, wind,
          bunker_liters: bunkerLiters ? parseInt(bunkerLiters) : null,
          general_notes: generalNotes,
          stops: stops.map(s => ({ stopOrder: s.stopOrder, departureTime: s.departureTime, departureLocation: s.departureLocation, arrivalTime: s.arrivalTime, arrivalLocation: s.arrivalLocation, passengerCount: s.passengerCount })),
          engine_hours: editableEngineHours.map(e => ({ engineType: e.engineType, engineNumber: e.engineNumber, startHours: e.startHours, stopHours: e.stopHours })),
          crew: crewMembers?.map(c => ({ profileId: c.profile_id, role: c.role })) || [],
          exercises: editableExercises.map(e => ({ type: e.exerciseType, notes: e.notes })),
          passengers: passengerDataForSignature,
        },
        signatureType: 'close',
      });

      // Update vessel engine hours
      if (editableEngineHours.length > 0 && logbook?.vessel_id) {
        for (const entry of editableEngineHours) {
          if (entry.stopHours !== null) {
            await supabase.from('vessel_engine_hours').upsert({
              vessel_id: logbook.vessel_id,
              engine_type: entry.engineType || 'main',
              engine_number: entry.engineNumber || 1,
              current_hours: entry.stopHours,
              updated_at: new Date().toISOString()
            }, { onConflict: 'vessel_id,engine_type,engine_number' });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logbook', id] });
      queryClient.invalidateQueries({ queryKey: ['logbooks'] });
      queryClient.invalidateQueries({ queryKey: ['vessel-engine-hours'] });
      queryClient.invalidateQueries({ queryKey: ['logbook-engine-hours', id] });
      queryClient.invalidateQueries({ queryKey: ['logbook-signatures', id] });
      queryClient.invalidateQueries({ queryKey: ['passenger-session-for-logbook', id] });
      queryClient.invalidateQueries({ queryKey: ['passenger-summary', passengerSession?.id] });
      setShowSignDialog(false);
      toast({ title: 'Signerad & Stängd', description: 'Loggboken har signerats digitalt och stängts. Maskintimmar har uppdaterats.' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteLogbook = useMutation({
    mutationFn: async () => {
      await supabase.from('logbook_crew').delete().eq('logbook_id', id);
      await supabase.from('logbook_engine_hours').delete().eq('logbook_id', id);
      if (passengerSession?.id) {
        await supabase.from('passenger_entries').delete().eq('session_id', passengerSession.id);
        await supabase.from('passenger_sessions').delete().eq('id', passengerSession.id);
      }
      const { error } = await supabase.from('logbooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logbooks'] });
      toast({ title: 'Raderad', description: 'Loggboken har raderats.' });
      navigate('/portal');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const updateCrew = useMutation({
    mutationFn: async () => {
      await supabase.from('logbook_crew').delete().eq('logbook_id', id);
      const validCrew = editableCrew.filter(c => c.profileId);
      if (validCrew.length > 0) {
        const { error } = await supabase.from('logbook_crew').insert(
          validCrew.map(c => ({ logbook_id: id, profile_id: c.profileId, role: c.role }))
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logbook-crew', id] });
      toast({ title: 'Sparat', description: 'Besättningen har uppdaterats.' });
      setShowCrewDialog(false);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const openCrewDialog = () => {
    setEditableCrew(crewMembers?.map(c => ({ tempId: c.id, id: c.id, profileId: c.profile_id, role: c.role as CrewRole })) || []);
    setShowCrewDialog(true);
  };

  const fetchWindData = async () => {
    setFetchingWind(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-wind-data', { body: { stationId: '99280' } });
      if (error) throw error;
      if (data?.success && data?.data) {
        const windInfo = data.data;
        let windString = `${windInfo.direction} ${windInfo.averageSpeed}`;
        if (windInfo.gustSpeed && windInfo.gustSpeed !== 'Ej tillgänglig') windString += ` (by ${windInfo.gustSpeed})`;
        setWind(windString);
        toast({ title: 'Vinddata hämtad', description: `Från ${windInfo.stationName} kl ${windInfo.timestamp}` });
      } else {
        throw new Error(data?.error || 'Kunde inte hämta vinddata');
      }
    } catch (error) {
      toast({ title: 'Fel', description: 'Kunde inte hämta vinddata från SMHI', variant: 'destructive' });
    } finally {
      setFetchingWind(false);
    }
  };

  const handleRemoveQuickEntry = async (entry: QuickEntry) => {
    if (entry.type === 'bunkring') {
      await supabase.from('bunker_events').delete().eq('logbook_id', id);
      setBunkerLiters('');
      queryClient.invalidateQueries({ queryKey: ['bunker-events'] });
      queryClient.invalidateQueries({ queryKey: ['bunker-stats'] });
    }
    setQuickEntries(prev => prev.filter(e => e.id !== entry.id));
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-64 bg-muted rounded" />
        </div>
      </MainLayout>
    );
  }

  if (!logbook) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Loggboken hittades inte.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/portal')}>
            Tillbaka till översikten
          </Button>
        </div>
      </MainLayout>
    );
  }

  const isOpen = logbook.status === 'oppen';
  const canEditThis = canEdit && isOpen;

  return (
    <MainLayout>
      <div className="max-w-6xl mx-auto space-y-3 sm:space-y-4 px-0 md:px-0">
        <div className="flex items-center gap-2 sm:gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/portal/logbooks')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-3xl font-display font-bold truncate">{(logbook as any).vessel?.name}</h1>
              <Badge variant={isOpen ? 'default' : 'secondary'}>
                {LOGBOOK_STATUS_LABELS[logbook.status as keyof typeof LOGBOOK_STATUS_LABELS]}
              </Badge>
            </div>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {format(new Date(logbook.date), 'PPPP', { locale: sv })}
            </p>
          </div>
        </div>

        <div id="logbook-print-content" className="grid gap-3 md:grid-cols-[1fr_200px] lg:grid-cols-[1fr_260px]">
          <div className="space-y-3 sm:space-y-4">
            <LogbookBasicInfo
              weather={weather}
              wind={wind}
              generalNotes={generalNotes}
              bunkerLiters={bunkerLiters}
              quickEntries={quickEntries}
              canEditThis={canEditThis}
              creatorName={(logbook as any).created_by_profile?.full_name || 'Okänd'}
              fetchingWind={fetchingWind}
              onWeatherChange={setWeather}
              onWindChange={setWind}
              onGeneralNotesChange={setGeneralNotes}
              onBunkerLitersChange={setBunkerLiters}
              onFetchWind={fetchWindData}
              onOpenBunkerDialog={() => {
                setBunkerDialogLiters('');
                setBunkerDialogEngineHours('');
                setShowBunkerDialog(true);
              }}
              onAddFarskvatten={() => {
                const timestamp = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                setQuickEntries(prev => [...prev, { id: crypto.randomUUID(), type: 'farskvatten', text: 'Fyllt färskvatten', timestamp }]);
              }}
              onAddSeptik={() => {
                const timestamp = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                setQuickEntries(prev => [...prev, { id: crypto.randomUUID(), type: 'septik', text: 'Tömt septik', timestamp }]);
              }}
              onRemoveQuickEntry={handleRemoveQuickEntry}
            />

            {/* Travel info card */}
            <div className="rounded-lg border bg-card">
              <div className="px-3 sm:px-4 pt-3 sm:pt-4 pb-1">
                <h3 className="flex items-center gap-2 text-base sm:text-lg font-semibold leading-none tracking-tight font-display">
                  <MapPin className="h-4 w-4 sm:h-5 sm:w-5" />
                  Reseinformation
                </h3>
              </div>
              <div className="px-2 sm:px-3 pb-3 sm:pb-4 pt-1">
                {isOpen ? (
                  <LogbookStops
                    stops={stops}
                    onStopsChange={setStops}
                    disabled={!canEditThis}
                    maxPassengers={(logbook as any)?.vessel?.max_passengers}
                    vesselType={(logbook as any)?.vessel?.vessel_type || 'passagerarfartyg'}
                    passengerSession={passengerSession}
                    passengerSummary={passengerSummary}
                    onActivatePassengerRegistration={() => activatePassengerRegistration.mutate()}
                    isActivatingPassenger={activatePassengerRegistration.isPending}
                    onOpenPassengerSession={() => navigate(`/portal/passagerare/${passengerSession?.id}`)}
                    onLockPassengerSession={() => lockPassengerSession.mutate()}
                    onUnlockPassengerSession={() => unlockPassengerSession.mutate()}
                    onDeletePassengerSession={() => setShowDeletePassengerSessionDialog(true)}
                    isLockingSession={lockPassengerSession.isPending || unlockPassengerSession.isPending}
                    isDeletingSession={deletePassengerSession.isPending}
                    canLockSession={canEditThis}
                  />
                ) : (
                  <LogbookStopsDisplay stops={logbookStops || []} vesselType={(logbook as any)?.vessel?.vessel_type || 'passagerarfartyg'} />
                )}
              </div>
            </div>

            <LogbookCrew
              crewMembers={crewMembers}
              canEditThis={canEditThis}
              onOpenCrewDialog={openCrewDialog}
            />

            <LogbookEngineHours
              editableEngineHours={editableEngineHours}
              engineHours={engineHours}
              vesselEngineHours={vesselEngineHours}
              isOpen={isOpen}
              canEditThis={canEditThis}
              onUpdateEngineHour={updateEngineHour}
              onInitializeFromVessel={initializeEngineHoursFromVessel}
            />

            <LogbookExercises
              editableExercises={editableExercises}
              exercises={exercises}
              exerciseCategories={exerciseCategories}
              isOpen={isOpen}
              canEditThis={canEditThis}
              exerciseDialogOpen={exerciseDialogOpen}
              newExerciseType={newExerciseType}
              newExerciseNotes={newExerciseNotes}
              onExerciseDialogOpenChange={setExerciseDialogOpen}
              onNewExerciseTypeChange={setNewExerciseType}
              onNewExerciseNotesChange={setNewExerciseNotes}
              onAddExercise={() => {
                if (newExerciseType) {
                  setEditableExercises([...editableExercises, { tempId: crypto.randomUUID(), exerciseType: newExerciseType, notes: newExerciseNotes }]);
                  setNewExerciseType('');
                  setNewExerciseNotes('');
                  setExerciseDialogOpen(false);
                }
              }}
              onRemoveExercise={(tempId) => setEditableExercises(editableExercises.filter(e => e.tempId !== tempId))}
            />
          </div>

          <LogbookSidebar
            validation={validation}
            canEditThis={canEditThis}
            isOpen={isOpen}
            overrideValidation={overrideValidation}
            onOverrideChange={setOverrideValidation}
            onSave={() => updateLogbook.mutate()}
            onSignAndClose={() => setShowSignDialog(true)}
            onDelete={() => setShowDeleteDialog(true)}
            onExport={() => printLogbook({
              logbook: {
                id: logbook.id, date: logbook.date, status: logbook.status,
                weather: logbook.weather || undefined, wind: logbook.wind || undefined,
                general_notes: logbook.general_notes || undefined,
                bunker_liters: logbook.bunker_liters || undefined,
                vessel: (logbook as any).vessel,
                created_by_profile: (logbook as any).created_by_profile,
              },
              stops: logbookStops || [],
              crewMembers: crewMembers?.map(c => ({ profile: (c as any).profile, role: c.role })) || [],
              engineHours: engineHours || [],
              exercises: exercises || [],
              passengerSummary: passengerSummary,
              signatures: signatures,
              deviations: linkedDeviations,
            })}
            onShowHistory={() => setShowHistoryDialog(true)}
            isSaving={updateLogbook.isPending}
            isClosing={closeLogbook.isPending}
            isDeleting={deleteLogbook.isPending}
            signatures={signatures}
            closedAt={logbook.closed_at}
            deviations={linkedDeviations}
            autoSaveStatus={autoSaveStatus}
          />
        </div>
      </div>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Radera loggbok"
        description="Är du säker på att du vill radera denna loggbok? All data inklusive besättning och maskintimmar kommer att tas bort permanent."
        confirmLabel="Radera"
        onConfirm={() => deleteLogbook.mutate()}
      />

      {/* Crew Edit Dialog */}
      <Dialog open={showCrewDialog} onOpenChange={setShowCrewDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Redigera besättning</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {editableCrew.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">Ingen besättning tillagd.</p>
            ) : (
              <div className="space-y-3">
                {editableCrew.map(member => {
                  const selectedProfileIds = editableCrew.filter(c => c.tempId !== member.tempId && c.profileId).map(c => c.profileId);
                  return (
                    <div key={member.tempId} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Person</Label>
                        <Select value={member.profileId} onValueChange={v => setEditableCrew(editableCrew.map(c => c.tempId === member.tempId ? { ...c, profileId: v } : c))}>
                          <SelectTrigger><SelectValue placeholder="Välj person" /></SelectTrigger>
                          <SelectContent>
                            {profiles?.map(p => (
                              <SelectItem key={p.id} value={p.id} disabled={selectedProfileIds.includes(p.id)}>
                                {p.full_name}{p.is_external ? ' (extern)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Roll</Label>
                        <Select value={member.role} onValueChange={v => setEditableCrew(editableCrew.map(c => c.tempId === member.tempId ? { ...c, role: v as CrewRole } : c))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(CREW_ROLE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => setEditableCrew(editableCrew.filter(c => c.tempId !== member.tempId))}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            <Button variant="outline" onClick={() => setEditableCrew([...editableCrew, { tempId: crypto.randomUUID(), profileId: '', role: 'matros' }])} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Lägg till besättningsmedlem
            </Button>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCrewDialog(false)}>Avbryt</Button>
              <Button onClick={() => updateCrew.mutate()} disabled={updateCrew.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateCrew.isPending ? 'Sparar...' : 'Spara'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sign Dialog */}
      <Dialog open={showSignDialog} onOpenChange={setShowSignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Signera & Stäng loggbok
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-muted/50 space-y-2">
              <p className="text-sm">Genom att signera bekräftar du att:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>All information i loggboken är korrekt</li>
                <li>Du har behörighet att stänga denna loggbok</li>
                <li>Loggboken kommer att låsas permanent</li>
              </ul>
            </div>
            <div className="p-3 rounded border bg-background">
              <p className="text-xs text-muted-foreground mb-1">Signeras av</p>
              <p className="font-medium">{user?.email}</p>
              <p className="text-xs text-muted-foreground mt-2">En kryptografisk hash (SHA-256) av loggboksinnehållet kommer att sparas som bevis.</p>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowSignDialog(false)}>Avbryt</Button>
              <Button onClick={() => closeLogbook.mutate()} disabled={closeLogbook.isPending || signLogbook.isPending}>
                <ShieldCheck className="h-4 w-4 mr-2" />
                {closeLogbook.isPending || signLogbook.isPending ? 'Signerar...' : 'Signera & Stäng'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Ändringshistorik
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3 pr-4">
              {signatures && signatures.length > 0 && (
                <div className="p-3 rounded-lg border border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
                  <div className="flex items-center gap-2 mb-2">
                    <ShieldCheck className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-700 dark:text-green-400">Signerad & stängd</span>
                  </div>
                  {signatures.map((sig: any) => (
                    <div key={sig.id} className="text-sm">
                      <p className="font-medium">{sig.signer_profile?.full_name || 'Okänd'}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(sig.signed_at), 'yyyy-MM-dd HH:mm:ss', { locale: sv })}</p>
                    </div>
                  ))}
                </div>
              )}
              {auditHistory && auditHistory.length > 0 ? (
                auditHistory.map((log: any) => {
                  const actionLabel = log.action === 'INSERT' ? 'Skapad' : log.action === 'UPDATE' ? 'Sparad' : 'Borttagen';
                  const actionColor = log.action === 'INSERT' ? 'text-green-600' : log.action === 'DELETE' ? 'text-red-600' : 'text-blue-600';
                  return (
                    <div key={log.id} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between mb-1">
                        <span className={`font-medium text-sm ${actionColor}`}>{actionLabel}</span>
                        <span className="text-xs text-muted-foreground">{format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: sv })}</span>
                      </div>
                      <p className="text-sm">{log.user_profile?.full_name || log.user_profile?.email || 'System'}</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-muted-foreground text-center py-4">Ingen historik tillgänglig.</p>
              )}
              {(!auditHistory || auditHistory.length === 0) && logbook && (
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-green-600">Skapad</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(logbook.created_at), 'yyyy-MM-dd HH:mm:ss', { locale: sv })}</span>
                  </div>
                  <p className="text-sm">{(logbook as any).created_by_profile?.full_name || 'Okänd'}</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={showDeletePassengerSessionDialog}
        onOpenChange={setShowDeletePassengerSessionDialog}
        title="Ta bort passagerarregistrering"
        description={
          passengerSummary && passengerSummary.totalPaxOn > 0
            ? `Varning: Det finns ${passengerSummary.totalPaxOn} registrerade passagerare. Är du säker på att du vill ta bort passagerarregistreringen? All data kommer att raderas.`
            : 'Är du säker på att du vill ta bort passagerarregistreringen?'
        }
        confirmLabel="Ta bort"
        onConfirm={() => {
          deletePassengerSession.mutate();
          setShowDeletePassengerSessionDialog(false);
        }}
        variant="destructive"
      />

      {/* Bunkring Dialog */}
      <Dialog open={showBunkerDialog} onOpenChange={setShowBunkerDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Fuel className="h-5 w-5" />
              Registrera bunkring
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="bunker-liters">Antal liter</Label>
              <Input id="bunker-liters" type="number" value={bunkerDialogLiters} onChange={(e) => setBunkerDialogLiters(e.target.value)} placeholder="T.ex. 500" min="0" />
            </div>
            <div className="space-y-2">
              {(() => {
                const vessel = logbook?.vessel as any;
                const primaryEngineId = vessel?.primary_engine_id;
                const primaryEngine = vesselEngineHours?.find(e => e.id === primaryEngineId);
                const primaryEngineEntry = editableEngineHours.find(e => {
                  if (primaryEngine) return e.engineType === primaryEngine.engine_type && e.engineNumber === primaryEngine.engine_number;
                  return e.engineType === 'main' && e.engineNumber === 1;
                });
                const engineName = primaryEngine?.name || primaryEngineEntry?.engineLabel || 'Huvudmaskin';
                const currentHours = primaryEngineEntry?.stopHours ?? primaryEngineEntry?.startHours ?? primaryEngine?.current_hours;
                return (
                  <>
                    <Label htmlFor="bunker-hours">Timställning {engineName}</Label>
                    <Input id="bunker-hours" type="number" value={bunkerDialogEngineHours} onChange={(e) => setBunkerDialogEngineHours(e.target.value)} placeholder="T.ex. 1234" min="0" />
                    {currentHours !== undefined && currentHours !== null && (
                      <p className="text-xs text-muted-foreground">Nuvarande: {currentHours} h</p>
                    )}
                  </>
                );
              })()}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowBunkerDialog(false)}>Avbryt</Button>
              <Button
                onClick={async () => {
                  const vessel = logbook?.vessel as any;
                  const primaryEngineId = vessel?.primary_engine_id;
                  const primaryEngine = vesselEngineHours?.find(e => e.id === primaryEngineId);
                  const engineName = primaryEngine?.name || 'Huvudmaskin';
                  const timestamp = new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
                  let bunkerText = `Bunkrat ${bunkerDialogLiters || '?'} liter`;
                  if (bunkerDialogEngineHours) bunkerText += ` vid ${bunkerDialogEngineHours} h (${engineName})`;
                  const { error } = await supabase.from('bunker_events').insert({
                    logbook_id: id, vessel_id: logbook?.vessel_id,
                    liters: parseInt(bunkerDialogLiters),
                    engine_hours: bunkerDialogEngineHours ? parseFloat(bunkerDialogEngineHours) : null,
                    engine_name: bunkerDialogEngineHours ? engineName : null,
                    recorded_by: user?.id,
                  });
                  if (error) { toast({ title: 'Fel', description: 'Kunde inte spara bunkring', variant: 'destructive' }); return; }
                  setQuickEntries(prev => [...prev, { id: crypto.randomUUID(), type: 'bunkring', text: bunkerText, timestamp }]);
                  setBunkerDialogLiters('');
                  setBunkerDialogEngineHours('');
                  setShowBunkerDialog(false);
                  toast({ title: 'Bunkring registrerad', description: `${bunkerDialogLiters} liter sparades` });
                }}
                disabled={!bunkerDialogLiters}
              >
                <Fuel className="h-4 w-4 mr-2" />
                Registrera
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
