import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';
import { useToast } from '@/hooks/use-toast';
import { usePrint } from '@/hooks/usePrint';
import { ValidationPanel } from '@/components/ValidationPanel';
import { useValidation } from '@/hooks/useValidation';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { LogbookStops, LogbookStopsDisplay, StopEntry } from '@/components/LogbookStops';
import { LOGBOOK_STATUS_LABELS, CREW_ROLE_LABELS, CrewRole } from '@/lib/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Ship, User, MapPin, Users, Lock, ArrowLeft, Save, Trash2, Printer, Pencil, Plus, FileDown, Wind, Loader2, Gauge, GraduationCap } from 'lucide-react';

interface EngineHourEntry {
  id?: string;
  tempId: string;
  engineType: 'main' | 'auxiliary';
  engineNumber: number;
  engineLabel: string;
  startHours: number;
  stopHours: number | null;
  notes: string;
}


interface CrewMember {
  tempId: string;
  id?: string;
  profileId: string;
  role: CrewRole;
}

export default function LogbookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canEdit, isAdmin } = useAuth();
  const { toast } = useToast();
  const { printContent } = usePrint();
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


  const { data: logbook, isLoading } = useQuery({
    queryKey: ['logbook', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logbooks')
        .select(`*, vessel:vessels(*)`)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      
      // Fetch profile separately since created_by references auth.users, not profiles
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', data.created_by)
        .maybeSingle();
      
      return { ...data, created_by_profile: profile };
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
      setInitialized(true);
    }
  }, [logbook, initialized]);

  // Fetch logbook stops
  const { data: logbookStops } = useQuery({
    queryKey: ['logbook-stops', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logbook_stops')
        .select('*')
        .eq('logbook_id', id)
        .order('stop_order');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Initialize stops from database
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

  // Fetch exercises for this logbook
  const { data: exercises } = useQuery({
    queryKey: ['logbook-exercises', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logbook_exercises')
        .select('*')
        .eq('logbook_id', id);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Initialize exercises from database
  useEffect(() => {
    if (exercises && !exercisesInitialized) {
      setEditableExercises(exercises.map(e => ({
        tempId: e.id,
        exerciseType: e.exercise_type,
        notes: e.notes || ''
      })));
      setExercisesInitialized(true);
    }
  }, [exercises, exercisesInitialized]);

  // Fetch exercise categories
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

  // Fetch vessel engine hours to initialize if logbook doesn't have any
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

  // Initialize editable engine hours from database or vessel config
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
    
    // Create entries for main engines
    for (let i = 1; i <= (vessel.main_engine_count || 0); i++) {
      const existing = vesselEngineHours.find(h => h.engine_type === 'main' && h.engine_number === i);
      entries.push({
        tempId: crypto.randomUUID(),
        engineType: 'main',
        engineNumber: i,
        engineLabel: existing?.name || `Huvudmaskin ${i}`,
        startHours: existing?.current_hours || 0,
        stopHours: null,
        notes: ''
      });
    }
    
    // Create entries for auxiliary engines
    for (let i = 1; i <= (vessel.auxiliary_engine_count || 0); i++) {
      const existing = vesselEngineHours.find(h => h.engine_type === 'auxiliary' && h.engine_number === i);
      entries.push({
        tempId: crypto.randomUUID(),
        engineType: 'auxiliary',
        engineNumber: i,
        engineLabel: existing?.name || `Hjälpmaskin ${i}`,
        startHours: existing?.current_hours || 0,
        stopHours: null,
        notes: ''
      });
    }
    
    setEditableEngineHours(entries);
  };

  const updateEngineHour = (tempId: string, field: keyof EngineHourEntry, value: string | number | null) => {
    setEditableEngineHours(editableEngineHours.map(e => 
      e.tempId === tempId ? { ...e, [field]: value } : e
    ));
  };

  const crewForValidation = crewMembers?.map(c => ({
    userId: c.profile_id,
    role: c.role as CrewRole,
    fullName: (c as any).profile?.full_name || 'Okänd',
  })) || [];
  const validation = useValidation({ vesselId: logbook?.vessel_id || null, crew: crewForValidation });

  const updateLogbook = useMutation({
    mutationFn: async () => {
      // Update main logbook data
      const { error } = await supabase
        .from('logbooks')
        .update({
          weather: weather || null,
          wind: wind || null,
          general_notes: generalNotes || null,
          bunker_liters: bunkerLiters ? parseInt(bunkerLiters) : null,
        })
        .eq('id', id);
      if (error) throw error;

      // Delete existing stops and re-insert
      const { error: deleteError } = await supabase
        .from('logbook_stops')
        .delete()
        .eq('logbook_id', id);
      if (deleteError) throw deleteError;

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
            notes: s.notes || null,
          }))
        );
        if (stopsError) throw stopsError;
      }

      // Save engine hours
      const { error: deleteEngineError } = await supabase
        .from('logbook_engine_hours')
        .delete()
        .eq('logbook_id', id);
      if (deleteEngineError) throw deleteEngineError;

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

      // Save exercises
      const { error: deleteExercisesError } = await supabase
        .from('logbook_exercises')
        .delete()
        .eq('logbook_id', id);
      if (deleteExercisesError) throw deleteExercisesError;

      if (editableExercises.length > 0) {
        const { error: exercisesError } = await supabase.from('logbook_exercises').insert(
          editableExercises.map((exercise) => ({
            logbook_id: id,
            exercise_type: exercise.exerciseType,
            notes: exercise.notes || null,
          }))
        );
        if (exercisesError) throw exercisesError;
      }
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
      // Validate required fields before closing
      const missingFields: string[] = [];
      
      if (!weather?.trim()) missingFields.push('Väder');
      if (!wind?.trim()) missingFields.push('Vind');
      if (!bunkerLiters?.trim()) missingFields.push('Bunker');
      if (!crewMembers || crewMembers.length === 0) missingFields.push('Besättning');
      
      // Check engine hours - at least one engine must have stop_hours filled (use editable state)
      const hasEngineHours = editableEngineHours.length > 0 && 
        editableEngineHours.some(e => e.stopHours !== null && e.stopHours !== undefined);
      if (!hasEngineHours) missingFields.push('Maskintimmar (sluttimmar)');
      
      if (missingFields.length > 0) {
        throw new Error(`Följande fält måste fyllas i: ${missingFields.join(', ')}`);
      }
      
      if (!validation.isValid && !overrideValidation) throw new Error('Valideringsfel måste åtgärdas innan loggboken kan stängas.');
      
      // Save stops before closing
      const { error: deleteStopsError } = await supabase
        .from('logbook_stops')
        .delete()
        .eq('logbook_id', id);
      if (deleteStopsError) throw deleteStopsError;

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
            notes: s.notes || null,
          }))
        );
        if (stopsError) throw stopsError;
      }

      // Save engine hours before closing
      const { error: deleteEngineError } = await supabase
        .from('logbook_engine_hours')
        .delete()
        .eq('logbook_id', id);
      if (deleteEngineError) throw deleteEngineError;

      if (editableEngineHours.length > 0) {
        const { error: engineInsertError } = await supabase.from('logbook_engine_hours').insert(
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
        if (engineInsertError) throw engineInsertError;
      }

      // Save all data before closing
      const { error } = await supabase
        .from('logbooks')
        .update({
          weather: weather || null,
          wind: wind || null,
          general_notes: generalNotes || null,
          bunker_liters: bunkerLiters ? parseInt(bunkerLiters) : null,
          status: 'stangd',
          closed_at: new Date().toISOString(),
          closed_by: user?.id,
        })
        .eq('id', id);
      if (error) throw error;
      
      // Uppdatera vessel_engine_hours med stop_hours från denna loggbok
      if (editableEngineHours.length > 0 && logbook?.vessel_id) {
        for (const entry of editableEngineHours) {
          if (entry.stopHours !== null) {
            const { error: engineError } = await supabase
              .from('vessel_engine_hours')
              .upsert({
                vessel_id: logbook.vessel_id,
                engine_type: entry.engineType || 'main',
                engine_number: entry.engineNumber || 1,
                current_hours: entry.stopHours,
                updated_at: new Date().toISOString()
              }, { onConflict: 'vessel_id,engine_type,engine_number' });
            if (engineError) console.error('Failed to update engine hours:', engineError);
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logbook', id] });
      queryClient.invalidateQueries({ queryKey: ['logbooks'] });
      queryClient.invalidateQueries({ queryKey: ['vessel-engine-hours'] });
      queryClient.invalidateQueries({ queryKey: ['logbook-engine-hours', id] });
      toast({ title: 'Stängd', description: 'Loggboken har sparats och stängts. Maskintimmar har uppdaterats.' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteLogbook = useMutation({
    mutationFn: async () => {
      // First delete related records
      const { error: crewError } = await supabase
        .from('logbook_crew')
        .delete()
        .eq('logbook_id', id);
      if (crewError) throw crewError;

      const { error: engineError } = await supabase
        .from('logbook_engine_hours')
        .delete()
        .eq('logbook_id', id);
      if (engineError) throw engineError;

      // Then delete the logbook
      const { error } = await supabase
        .from('logbooks')
        .delete()
        .eq('id', id);
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
      // Delete existing crew
      const { error: deleteError } = await supabase
        .from('logbook_crew')
        .delete()
        .eq('logbook_id', id);
      if (deleteError) throw deleteError;

      // Insert updated crew
      if (editableCrew.length > 0) {
        const validCrew = editableCrew.filter(c => c.profileId);
        if (validCrew.length > 0) {
          const { error: insertError } = await supabase.from('logbook_crew').insert(
            validCrew.map(c => ({
              logbook_id: id,
              profile_id: c.profileId,
              role: c.role,
            }))
          );
          if (insertError) throw insertError;
        }
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
    setEditableCrew(
      crewMembers?.map(c => ({
        tempId: c.id,
        id: c.id,
        profileId: c.profile_id,
        role: c.role as CrewRole,
      })) || []
    );
    setShowCrewDialog(true);
  };

  const addCrewMember = () => {
    setEditableCrew([...editableCrew, { tempId: crypto.randomUUID(), profileId: '', role: 'matros' }]);
  };

  const updateCrewMember = (tempId: string, field: 'profileId' | 'role', value: string) => {
    setEditableCrew(editableCrew.map(c => (c.tempId === tempId ? { ...c, [field]: value } : c)));
  };

  const removeCrewMember = (tempId: string) => {
    setEditableCrew(editableCrew.filter(c => c.tempId !== tempId));
  };

  const fetchWindData = async () => {
    setFetchingWind(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-wind-data', {
        body: { stationId: '99280' }, // Svenska Högarna (SMHI)
      });
      
      if (error) throw error;
      
      if (data?.success && data?.data) {
        const windInfo = data.data;
        // Format: "NO 40° medel 4.0 m/s" or with gust if available
        let windString = `${windInfo.direction} ${windInfo.averageSpeed}`;
        if (windInfo.gustSpeed && windInfo.gustSpeed !== 'Ej tillgänglig') {
          windString += ` (by ${windInfo.gustSpeed})`;
        }
        setWind(windString);
        toast({ 
          title: 'Vinddata hämtad', 
          description: `Från ${windInfo.stationName} kl ${windInfo.timestamp}` 
        });
      } else {
        throw new Error(data?.error || 'Kunde inte hämta vinddata');
      }
    } catch (error) {
      console.error('Error fetching wind:', error);
      toast({ 
        title: 'Fel', 
        description: 'Kunde inte hämta vinddata från SMHI', 
        variant: 'destructive' 
      });
    } finally {
      setFetchingWind(false);
    }
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
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/portal')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-display font-bold">{(logbook as any).vessel?.name}</h1>
              <Badge variant={isOpen ? 'default' : 'secondary'}>
                {LOGBOOK_STATUS_LABELS[logbook.status as keyof typeof LOGBOOK_STATUS_LABELS]}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">
              {format(new Date(logbook.date), 'PPPP', { locale: sv })}
            </p>
          </div>
        </div>

        <div id="logbook-print-content" className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ship className="h-5 w-5" />
                  Grunduppgifter
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="weather">Väder</Label>
                    <Input
                      id="weather"
                      value={weather}
                      onChange={e => setWeather(e.target.value)}
                      disabled={!canEditThis}
                      placeholder="T.ex. Soligt, 18°C"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wind">Vind</Label>
                    <div className="flex gap-2">
                      <Input
                        id="wind"
                        value={wind}
                        onChange={e => setWind(e.target.value)}
                        disabled={!canEditThis}
                        placeholder="T.ex. SV 5 m/s"
                        className="flex-1"
                      />
                      {canEditThis && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={fetchWindData}
                          disabled={fetchingWind}
                          title="Hämta vinddata från Blockhusudden (Sjöfartsverket)"
                        >
                          {fetchingWind ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Wind className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bunker">Bunker (liter)</Label>
                  <Input
                    id="bunker"
                    type="number"
                    value={bunkerLiters}
                    onChange={e => setBunkerLiters(e.target.value)}
                    disabled={!canEditThis}
                    placeholder="T.ex. 500"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Allmänna anteckningar</Label>
                  <Textarea
                    id="notes"
                    value={generalNotes}
                    onChange={e => setGeneralNotes(e.target.value)}
                    disabled={!canEditThis}
                    rows={3}
                  />
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  Skapad av {(logbook as any).created_by_profile?.full_name}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Reseinformation
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isOpen ? (
                  <LogbookStops stops={stops} onStopsChange={setStops} disabled={!canEditThis} />
                ) : (
                  <LogbookStopsDisplay stops={logbookStops || []} />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Besättning
                  </span>
                  {canEditThis && (
                    <Button variant="outline" size="sm" onClick={openCrewDialog}>
                      <Pencil className="h-4 w-4 mr-1" />
                      Redigera
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!crewMembers || crewMembers.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-muted-foreground">Ingen besättning registrerad.</p>
                    {canEditThis && (
                      <Button variant="outline" size="sm" className="mt-2" onClick={openCrewDialog}>
                        <Plus className="h-4 w-4 mr-1" />
                        Lägg till besättning
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {crewMembers.map(member => (
                      <div key={member.id} className="flex items-center justify-between p-2 rounded bg-muted/50">
                        <span>{(member as any).profile?.full_name || 'Okänd'}</span>
                        <Badge variant="outline">{CREW_ROLE_LABELS[member.role as CrewRole]}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Gauge className="h-5 w-5" />
                    Maskintimmar
                  </span>
                  {canEditThis && editableEngineHours.length === 0 && vesselEngineHours && vesselEngineHours.length > 0 && (
                    <Button variant="outline" size="sm" onClick={initializeEngineHoursFromVessel}>
                      <Plus className="h-4 w-4 mr-1" />
                      Ladda maskiner
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isOpen && canEditThis ? (
                  // Editable mode for open logbooks
                  editableEngineHours.length === 0 ? (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">Inga maskintimmar registrerade.</p>
                      {vesselEngineHours && vesselEngineHours.length > 0 && (
                        <Button variant="outline" size="sm" className="mt-2" onClick={initializeEngineHoursFromVessel}>
                          <Plus className="h-4 w-4 mr-1" />
                          Ladda maskiner från fartyg
                        </Button>
                      )}
                      {(!vesselEngineHours || vesselEngineHours.length === 0) && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Fartyget har inga motorer konfigurerade.
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {editableEngineHours.map(entry => (
                        <div key={entry.tempId} className="space-y-2">
                          <Label className="text-sm font-medium">{entry.engineLabel}</Label>
                          <div className="flex gap-2 items-end">
                            <div className="w-24 space-y-1">
                              <Label className="text-xs">Start</Label>
                              <Input 
                                type="number" 
                                value={entry.startHours} 
                                onChange={e => updateEngineHour(entry.tempId, 'startHours', parseInt(e.target.value) || 0)} 
                              />
                            </div>
                            <div className="w-24 space-y-1">
                              <Label className="text-xs">Stopp</Label>
                              <Input 
                                type="number" 
                                value={entry.stopHours ?? ''} 
                                onChange={e => updateEngineHour(entry.tempId, 'stopHours', e.target.value ? parseInt(e.target.value) : null)} 
                                placeholder="—"
                              />
                            </div>
                            <div className="w-20 space-y-1">
                              <Label className="text-xs">Diff</Label>
                              <div className="h-10 flex items-center px-3 bg-muted rounded-md text-sm font-mono">
                                {entry.stopHours !== null ? `${(entry.stopHours || 0) - entry.startHours}h` : '—'}
                              </div>
                            </div>
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs">Anteckning</Label>
                              <Input 
                                value={entry.notes} 
                                onChange={e => updateEngineHour(entry.tempId, 'notes', e.target.value)} 
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  // Read-only mode for closed logbooks
                  engineHours && engineHours.length > 0 ? (
                    <div className="space-y-2">
                      {engineHours.map(entry => (
                        <div key={entry.id} className="flex items-center gap-4 p-2 rounded bg-muted/50">
                          <span className="text-sm font-medium min-w-28">
                            {entry.engine_name || (entry.engine_type === 'auxiliary' 
                              ? `Hjälpmaskin ${entry.engine_number}` 
                              : `Huvudmaskin ${entry.engine_number || 1}`)}
                          </span>
                          <span className="font-mono">{entry.start_hours} → {entry.stop_hours ?? '—'}</span>
                          <Badge variant="outline">{(entry.stop_hours ?? 0) - (entry.start_hours ?? 0)}h</Badge>
                          {entry.notes && <span className="text-muted-foreground text-sm">{entry.notes}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Inga maskintimmar registrerade.</p>
                  )
                )}
              </CardContent>
            </Card>

            {/* Övningar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5" />
                    Övningar
                  </span>
                  {isOpen && canEditThis && (
                    <Dialog open={exerciseDialogOpen} onOpenChange={setExerciseDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="h-4 w-4 mr-1" />
                          Lägg till
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Lägg till övning</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Välj övningstyp *</Label>
                            <Select value={newExerciseType} onValueChange={setNewExerciseType}>
                              <SelectTrigger>
                                <SelectValue placeholder="Välj övning" />
                              </SelectTrigger>
                              <SelectContent>
                                {exerciseCategories?.map((cat) => (
                                  <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            className="w-full"
                            onClick={() => {
                              if (newExerciseType) {
                                setEditableExercises([...editableExercises, {
                                  tempId: crypto.randomUUID(),
                                  exerciseType: newExerciseType,
                                  notes: ''
                                }]);
                                setNewExerciseType('');
                                setExerciseDialogOpen(false);
                              }
                            }}
                            disabled={!newExerciseType}
                          >
                            Lägg till
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isOpen && canEditThis ? (
                  editableExercises.length === 0 ? (
                    <p className="text-muted-foreground text-center py-4">Inga övningar tillagda ännu.</p>
                  ) : (
                    <div className="space-y-3">
                      {editableExercises.map(exercise => (
                        <div key={exercise.tempId} className="p-3 rounded-lg border bg-muted/50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{exercise.exerciseType}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditableExercises(editableExercises.filter(e => e.tempId !== exercise.tempId))}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Kommentar</Label>
                            <Textarea
                              value={exercise.notes}
                              onChange={e => setEditableExercises(editableExercises.map(ex => 
                                ex.tempId === exercise.tempId ? { ...ex, notes: e.target.value } : ex
                              ))}
                              placeholder="Beskriv vad ni övade..."
                              rows={2}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  exercises && exercises.length > 0 ? (
                    <div className="space-y-3">
                      {exercises.map(ex => (
                        <div key={ex.id} className="p-3 rounded-lg bg-muted/50">
                          <p className="font-medium">{ex.exercise_type}</p>
                          {ex.notes && <p className="text-sm text-muted-foreground mt-1">{ex.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Inga övningar registrerade.</p>
                  )
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <ValidationPanel validation={validation} />

            {canEditThis && !validation.isValid && validation.errors.length > 0 && (
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="override"
                  checked={overrideValidation}
                  onChange={e => setOverrideValidation(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                <Label htmlFor="override" className="text-sm text-muted-foreground cursor-pointer">
                  Bekräfta ändå (stäng trots valideringsfel)
                </Label>
              </div>
            )}

            {canEditThis && (
              <div className="space-y-3">
                <Button
                  className="w-full"
                  onClick={() => updateLogbook.mutate()}
                  disabled={updateLogbook.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateLogbook.isPending ? 'Sparar...' : 'Spara ändringar'}
                </Button>

                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => closeLogbook.mutate()}
                  disabled={closeLogbook.isPending || (!validation.isValid && !overrideValidation)}
                >
                  <Lock className="h-4 w-4 mr-2" />
                  {closeLogbook.isPending ? 'Stänger...' : 'Stäng loggbok'}
                </Button>
                
                <Button
                  className="w-full"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={deleteLogbook.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {deleteLogbook.isPending ? 'Raderar...' : 'Radera loggbok'}
                </Button>
              </div>
            )}

            <Button
              className="w-full"
              variant="outline"
              onClick={() => printContent('logbook-print-content', {
                title: `Loggbok - ${(logbook as any).vessel?.name}`,
                subtitle: format(new Date(logbook.date), 'PPPP', { locale: sv }),
              })}
            >
              <FileDown className="h-4 w-4 mr-2" />
              Exportera / Skriv ut
            </Button>

            {!isOpen && (
              <Card className="border-muted">
                <CardContent className="pt-6 text-center text-muted-foreground">
                  <Lock className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">Denna loggbok är stängd och kan inte redigeras.</p>
                  {logbook.closed_at && (
                    <p className="text-xs mt-1">
                      Stängd {format(new Date(logbook.closed_at), 'PPP', { locale: sv })}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
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
                  const selectedProfileIds = editableCrew
                    .filter(c => c.tempId !== member.tempId && c.profileId)
                    .map(c => c.profileId);
                  
                  return (
                    <div key={member.tempId} className="flex gap-2 items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Person</Label>
                        <Select value={member.profileId} onValueChange={v => updateCrewMember(member.tempId, 'profileId', v)}>
                          <SelectTrigger>
                            <SelectValue placeholder="Välj person" />
                          </SelectTrigger>
                          <SelectContent>
                            {profiles?.map(p => (
                              <SelectItem 
                                key={p.id} 
                                value={p.id}
                                disabled={selectedProfileIds.includes(p.id)}
                              >
                                {p.full_name}{p.is_external ? ' (extern)' : ''}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Roll</Label>
                        <Select value={member.role} onValueChange={v => updateCrewMember(member.tempId, 'role', v)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(CREW_ROLE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeCrewMember(member.tempId)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
            
            <Button variant="outline" onClick={addCrewMember} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Lägg till besättningsmedlem
            </Button>

            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCrewDialog(false)}>
                Avbryt
              </Button>
              <Button onClick={() => updateCrew.mutate()} disabled={updateCrew.isPending}>
                <Save className="h-4 w-4 mr-2" />
                {updateCrew.isPending ? 'Sparar...' : 'Spara'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
