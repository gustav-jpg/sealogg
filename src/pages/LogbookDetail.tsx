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
import { Ship, User, MapPin, Users, Lock, ArrowLeft, Save, Trash2, Printer, Pencil, Plus, FileDown, Wind, Loader2 } from 'lucide-react';


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
        .order('start_hours');
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logbook', id] });
      queryClient.invalidateQueries({ queryKey: ['logbooks'] });
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
      
      // Check engine hours - at least one engine must have stop_hours filled
      const hasEngineHours = engineHours && engineHours.length > 0 && 
        engineHours.some(e => e.stop_hours !== null && e.stop_hours !== undefined);
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
      if (engineHours && engineHours.length > 0 && logbook?.vessel_id) {
        for (const entry of engineHours) {
          if (entry.stop_hours !== null) {
            const { error: engineError } = await supabase
              .from('vessel_engine_hours')
              .upsert({
                vessel_id: logbook.vessel_id,
                engine_type: entry.engine_type || 'main',
                engine_number: entry.engine_number || 1,
                current_hours: entry.stop_hours,
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

            {engineHours && engineHours.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Maskintimmar</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {engineHours.map(entry => (
                      <div key={entry.id} className="flex items-center gap-4 p-2 rounded bg-muted/50">
                        <span className="text-sm font-medium min-w-28">
                          {entry.engine_name || (entry.engine_type === 'auxiliary' 
                            ? `Hjälpmaskin ${entry.engine_number}` 
                            : `Huvudmaskin ${entry.engine_number || 1}`)}
                        </span>
                        <span className="font-mono">{entry.start_hours} → {entry.stop_hours}</span>
                        <Badge variant="outline">{(entry.stop_hours ?? 0) - (entry.start_hours ?? 0)}h</Badge>
                        {entry.notes && <span className="text-muted-foreground text-sm">{entry.notes}</span>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
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
