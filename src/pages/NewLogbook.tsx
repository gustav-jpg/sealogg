import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { ValidationPanel } from '@/components/ValidationPanel';
import { useValidation } from '@/hooks/useValidation';
import { LogbookStops, StopEntry } from '@/components/LogbookStops';
import { CrewRole, CREW_ROLE_LABELS } from '@/lib/types';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';
import { Plus, Trash2, Ship, Users, Save, MapPin, Gauge, GraduationCap } from 'lucide-react';
import { format } from 'date-fns';

const EXERCISE_TYPES = [
  { value: 'sjukdomsfall', label: 'Sjukdomsfall' },
  { value: 'overgivande_fartyg', label: 'Övergivande av fartyg' },
  { value: 'brand', label: 'Brand' },
  { value: 'grundstotning', label: 'Grundstötning' },
  { value: 'kollision', label: 'Kollision' },
  { value: 'vattenfororening', label: 'Vattenförorening' },
] as const;


interface CrewMember {
  tempId: string;
  userId: string;
  role: CrewRole;
}

interface EngineHourEntry {
  tempId: string;
  engineType: 'main' | 'auxiliary';
  engineNumber: number;
  engineLabel: string;
  startHours: number;
  stopHours: number;
  notes: string;
}

export default function NewLogbook() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [vesselId, setVesselId] = useState('');
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [weather, setWeather] = useState('');
  const [wind, setWind] = useState('');
  const [generalNotes, setGeneralNotes] = useState('');
  const [bunkerLiters, setBunkerLiters] = useState('');
  const [stops, setStops] = useState<StopEntry[]>([]);
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [engineHours, setEngineHours] = useState<EngineHourEntry[]>([]);
  const [overrideValidation, setOverrideValidation] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState<string[]>([]);
  const [exercisesNotes, setExercisesNotes] = useState('');

  const { data: vessels } = useQuery({
    queryKey: ['vessels', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      const { data, error } = await supabase
        .from('vessels')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  const { data: profiles } = useOrgProfiles(selectedOrgId);


  const { data: vesselEngineHours } = useQuery({
    queryKey: ['vessel-engine-hours', vesselId],
    queryFn: async () => {
      if (!vesselId) return [];
      const { data, error } = await supabase
        .from('vessel_engine_hours')
        .select('*')
        .eq('vessel_id', vesselId)
        .order('engine_type')
        .order('engine_number');
      if (error) throw error;
      return data;
    },
    enabled: !!vesselId,
  });

  // Automatiskt skapa engine hour entries när fartyg väljs
  const selectedVessel = vessels?.find(v => v.id === vesselId);
  
  const initializeEngineHours = () => {
    if (!selectedVessel || !vesselEngineHours) return;
    
    const entries: EngineHourEntry[] = [];
    
    for (let i = 1; i <= selectedVessel.main_engine_count; i++) {
      const existing = vesselEngineHours.find(h => h.engine_type === 'main' && h.engine_number === i);
      entries.push({
        tempId: crypto.randomUUID(),
        engineType: 'main',
        engineNumber: i,
        engineLabel: existing?.name || `Huvudmaskin ${i}`,
        startHours: existing?.current_hours || 0,
        stopHours: existing?.current_hours || 0,
        notes: ''
      });
    }
    
    for (let i = 1; i <= selectedVessel.auxiliary_engine_count; i++) {
      const existing = vesselEngineHours.find(h => h.engine_type === 'auxiliary' && h.engine_number === i);
      entries.push({
        tempId: crypto.randomUUID(),
        engineType: 'auxiliary',
        engineNumber: i,
        engineLabel: existing?.name || `Hjälpmaskin ${i}`,
        startHours: existing?.current_hours || 0,
        stopHours: existing?.current_hours || 0,
        notes: ''
      });
    }
    
    setEngineHours(entries);
  };

  // Återställ engine hours när fartyg ändras
  const handleVesselChange = (newVesselId: string) => {
    setVesselId(newVesselId);
    setEngineHours([]);
  };

  const crewForValidation = crew
    .filter(c => c.userId)
    .map(c => {
      const profile = profiles?.find(p => p.id === c.userId);
      return { userId: c.userId, role: c.role, fullName: profile?.full_name || 'Okänd' };
    });

  const validation = useValidation({ vesselId, crew: crewForValidation });

  const createLogbook = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('Ej inloggad');
      if (!vesselId) throw new Error('Välj ett fartyg');
      if (!validation.isValid && !overrideValidation) throw new Error('Valideringsfel måste åtgärdas');

      const { data: logbook, error: logbookError } = await supabase
        .from('logbooks')
        .insert({
          vessel_id: vesselId,
          date,
          weather: weather || null,
          wind: wind || null,
          general_notes: generalNotes || null,
          bunker_liters: bunkerLiters ? parseInt(bunkerLiters) : null,
          created_by: user.id,
          status: 'oppen',
        })
        .select()
        .single();

      if (logbookError) throw logbookError;

      // Insert stops
      if (stops.length > 0) {
        const { error: stopsError } = await supabase.from('logbook_stops').insert(
          stops.map(s => ({
            logbook_id: logbook.id,
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

      if (crew.length > 0) {
        const { error: crewError } = await supabase.from('logbook_crew').insert(
          crew.map(c => ({
            logbook_id: logbook.id,
            profile_id: c.userId,
            role: c.role,
          }))
        );
        if (crewError) throw crewError;
      }

      if (engineHours.length > 0) {
        const { error: engineError } = await supabase.from('logbook_engine_hours').insert(
          engineHours.map(e => ({
            logbook_id: logbook.id,
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

      // Insert exercises
      if (selectedExercises.length > 0) {
        const { error: exercisesError } = await supabase.from('logbook_exercises').insert(
          selectedExercises.map((exerciseType, index) => ({
            logbook_id: logbook.id,
            exercise_type: exerciseType,
            notes: index === 0 ? (exercisesNotes || null) : null,
          }))
        );
        if (exercisesError) throw exercisesError;
      }

      return logbook;
    },
    onSuccess: (logbook) => {
      queryClient.invalidateQueries({ queryKey: ['logbooks'] });
      toast({ title: 'Loggbok skapad', description: 'Loggboken har skapats.' });
      navigate(`/portal/logbook/${logbook.id}`);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const addCrewMember = () => {
    setCrew([...crew, { tempId: crypto.randomUUID(), userId: '', role: 'matros' }]);
  };

  const updateCrewMember = (tempId: string, field: 'userId' | 'role', value: string) => {
    setCrew(crew.map(c => (c.tempId === tempId ? { ...c, [field]: value } : c)));
  };

  const removeCrewMember = (tempId: string) => {
    setCrew(crew.filter(c => c.tempId !== tempId));
  };

  const updateEngineHour = (tempId: string, field: keyof EngineHourEntry, value: string | number) => {
    setEngineHours(engineHours.map(e => (e.tempId === tempId ? { ...e, [field]: value } : e)));
  };

  return (
    <MainLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Ny loggbok</h1>
          <p className="text-muted-foreground mt-1">Skapa en ny fartygsloggbok</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Ship className="h-5 w-5" />
                  Välj fartyg
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="vessel">Fartyg *</Label>
                  <Select value={vesselId} onValueChange={handleVesselChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Välj fartyg" />
                    </SelectTrigger>
                    <SelectContent>
                      {vessels?.map(v => (
                        <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!vesselId && (
                  <p className="text-muted-foreground text-sm">Välj ett fartyg för att fortsätta.</p>
                )}
              </CardContent>
            </Card>

            {vesselId && (
              <>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Ship className="h-5 w-5" />
                      Grunduppgifter
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Datum *</Label>
                      <Input id="date" type="date" value={date} onChange={e => setDate(e.target.value)} />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="weather">Väder</Label>
                        <Input id="weather" value={weather} onChange={e => setWeather(e.target.value)} placeholder="T.ex. Soligt, 18°C" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="wind">Vind</Label>
                        <Input id="wind" value={wind} onChange={e => setWind(e.target.value)} placeholder="T.ex. SV 5 m/s" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="bunker">Bunker (liter)</Label>
                      <Input id="bunker" type="number" value={bunkerLiters} onChange={e => setBunkerLiters(e.target.value)} placeholder="T.ex. 500" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Allmänna anteckningar</Label>
                      <Textarea id="notes" value={generalNotes} onChange={e => setGeneralNotes(e.target.value)} rows={3} />
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
                <LogbookStops stops={stops} onStopsChange={setStops} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Gauge className="h-5 w-5" />
                    Maskintimmar
                  </span>
                  {vesselId && engineHours.length === 0 && (
                    <Button variant="outline" size="sm" onClick={initializeEngineHours}>
                      <Plus className="h-4 w-4 mr-1" />
                      Ladda maskiner
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!vesselId ? (
                  <p className="text-muted-foreground text-center py-4">Välj ett fartyg först.</p>
                ) : engineHours.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Klicka på "Ladda maskiner" för att hämta aktuella maskintimmar.</p>
                ) : (
                  <div className="space-y-3">
                    {engineHours.map(entry => (
                      <div key={entry.tempId} className="space-y-2">
                        <Label className="text-sm font-medium">{entry.engineLabel}</Label>
                        <div className="flex gap-2 items-end">
                          <div className="w-24 space-y-1">
                            <Label className="text-xs">Start</Label>
                            <Input type="number" value={entry.startHours} onChange={e => updateEngineHour(entry.tempId, 'startHours', parseInt(e.target.value) || 0)} />
                          </div>
                          <div className="w-24 space-y-1">
                            <Label className="text-xs">Stopp</Label>
                            <Input type="number" value={entry.stopHours} onChange={e => updateEngineHour(entry.tempId, 'stopHours', parseInt(e.target.value) || 0)} />
                          </div>
                          <div className="w-20 space-y-1">
                            <Label className="text-xs">Diff</Label>
                            <div className="h-10 flex items-center px-3 bg-muted rounded-md text-sm font-mono">
                              {entry.stopHours - entry.startHours}h
                            </div>
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Anteckning</Label>
                            <Input value={entry.notes} onChange={e => updateEngineHour(entry.tempId, 'notes', e.target.value)} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Övningar */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Övningar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {EXERCISE_TYPES.map(exercise => (
                      <label
                        key={exercise.value}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                          selectedExercises.includes(exercise.value)
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'bg-muted/50 border-border hover:bg-muted'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedExercises.includes(exercise.value)}
                          onChange={e => {
                            if (e.target.checked) {
                              setSelectedExercises([...selectedExercises, exercise.value]);
                            } else {
                              setSelectedExercises(selectedExercises.filter(v => v !== exercise.value));
                            }
                          }}
                          className="h-4 w-4 rounded border-input"
                        />
                        <span className="text-sm">{exercise.label}</span>
                      </label>
                    ))}
                  </div>
                  {selectedExercises.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-xs">Anteckningar (valfritt)</Label>
                      <Textarea
                        value={exercisesNotes}
                        onChange={e => setExercisesNotes(e.target.value)}
                        placeholder="T.ex. hur övningen gick, deltagare..."
                        rows={2}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Besättning
                  </span>
                  <Button variant="outline" size="sm" onClick={addCrewMember}>
                    <Plus className="h-4 w-4 mr-1" />
                    Lägg till
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {crew.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Ingen besättning tillagd ännu.</p>
                ) : (
                  <div className="space-y-3">
                    {crew.map(member => {
                      // Get user IDs already selected by other crew members
                      const selectedUserIds = crew
                        .filter(c => c.tempId !== member.tempId && c.userId)
                        .map(c => c.userId);
                      
                      return (
                        <div key={member.tempId} className="flex gap-2 items-end">
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Person</Label>
                            <Select value={member.userId} onValueChange={v => updateCrewMember(member.tempId, 'userId', v)}>
                              <SelectTrigger>
                                <SelectValue placeholder="Välj person" />
                              </SelectTrigger>
                              <SelectContent>
                                {profiles?.map(p => (
                                  <SelectItem 
                                    key={p.id} 
                                    value={p.id}
                                    disabled={selectedUserIds.includes(p.id)}
                                  >
                                    {p.full_name}{p.is_external ? ' (extern)' : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex-1 space-y-1">
                            <Label className="text-xs">Roll</Label>
                            <Select value={member.role} onValueChange={v => updateCrewMember(member.tempId, 'role', v as CrewRole)}>
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
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
              </>
            )}
          </div>

          <div className="space-y-6">
            {vesselId && (
              <>
                <ValidationPanel validation={validation} />

                {!validation.isValid && validation.errors.length > 0 && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="override"
                      checked={overrideValidation}
                      onChange={e => setOverrideValidation(e.target.checked)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <Label htmlFor="override" className="text-sm text-muted-foreground cursor-pointer">
                      Bekräfta ändå (skapa trots valideringsfel)
                    </Label>
                  </div>
                )}
              </>
            )}

            <Button
              className="w-full"
              size="lg"
              onClick={() => createLogbook.mutate()}
              disabled={createLogbook.isPending || !vesselId || (!validation.isValid && !overrideValidation)}
            >
              <Save className="h-4 w-4 mr-2" />
              {createLogbook.isPending ? 'Skapar...' : 'Skapa loggbok'}
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
