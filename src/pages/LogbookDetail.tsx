import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { ValidationPanel } from '@/components/ValidationPanel';
import { useValidation } from '@/hooks/useValidation';
import { LOGBOOK_STATUS_LABELS, CREW_ROLE_LABELS, CrewRole } from '@/lib/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { Ship, Calendar, User, MapPin, Users, Lock, ArrowLeft, Save } from 'lucide-react';

export default function LogbookDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, canEdit, isAdmin } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fromLocation, setFromLocation] = useState('');
  const [toLocation, setToLocation] = useState('');
  const [passengerCount, setPassengerCount] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');

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
      if (error) throw error;
      
      setFromLocation(data.from_location || '');
      setToLocation(data.to_location || '');
      setPassengerCount(data.passenger_count?.toString() || '');
      setDepartureTime(data.departure_time || '');
      setArrivalTime(data.arrival_time || '');
      
      return data;
    },
    enabled: !!id,
  });

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
      const { error } = await supabase
        .from('logbooks')
        .update({
          from_location: fromLocation || null,
          to_location: toLocation || null,
          passenger_count: passengerCount ? parseInt(passengerCount) : null,
          departure_time: departureTime || null,
          arrival_time: arrivalTime || null,
        })
        .eq('id', id);
      if (error) throw error;
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
      if (!validation.isValid) throw new Error('Valideringsfel måste åtgärdas innan loggboken kan stängas.');
      
      const { error } = await supabase
        .from('logbooks')
        .update({
          status: 'stangd',
          closed_at: new Date().toISOString(),
          closed_by: user?.id,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logbook', id] });
      queryClient.invalidateQueries({ queryKey: ['logbooks'] });
      toast({ title: 'Stängd', description: 'Loggboken har stängts och är nu låst.' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

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
          <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
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
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
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

        <div className="grid gap-6 lg:grid-cols-3">
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
                  <div>
                    <Label className="text-muted-foreground text-xs">Väder</Label>
                    <p>{logbook.weather || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Vind</Label>
                    <p>{logbook.wind || '-'}</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs">Allmänna anteckningar</Label>
                  <p>{logbook.general_notes || '-'}</p>
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
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="from">Från hamn/plats</Label>
                    <Input
                      id="from"
                      value={fromLocation}
                      onChange={e => setFromLocation(e.target.value)}
                      disabled={!canEditThis}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to">Till hamn/plats</Label>
                    <Input
                      id="to"
                      value={toLocation}
                      onChange={e => setToLocation(e.target.value)}
                      disabled={!canEditThis}
                    />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="passengers">Antal passagerare</Label>
                    <Input
                      id="passengers"
                      type="number"
                      value={passengerCount}
                      onChange={e => setPassengerCount(e.target.value)}
                      disabled={!canEditThis}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="departure">Avgångstid</Label>
                    <Input
                      id="departure"
                      type="time"
                      value={departureTime}
                      onChange={e => setDepartureTime(e.target.value)}
                      disabled={!canEditThis}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="arrival">Ankomsttid</Label>
                    <Input
                      id="arrival"
                      type="time"
                      value={arrivalTime}
                      onChange={e => setArrivalTime(e.target.value)}
                      disabled={!canEditThis}
                    />
                  </div>
                </div>
                {canEditThis && (
                  <Button onClick={() => updateLogbook.mutate()} disabled={updateLogbook.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateLogbook.isPending ? 'Sparar...' : 'Spara ändringar'}
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Besättning
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!crewMembers || crewMembers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">Ingen besättning registrerad.</p>
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
                        <span className="font-mono">{entry.start_hours} → {entry.stop_hours}</span>
                        <Badge variant="outline">{(entry.stop_hours ?? 0) - (entry.start_hours ?? 0)}h</Badge>
                        <span className="text-muted-foreground">{entry.notes || '-'}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <ValidationPanel validation={validation} />

            {canEditThis && (
              <Button
                className="w-full"
                variant="secondary"
                size="lg"
                onClick={() => closeLogbook.mutate()}
                disabled={closeLogbook.isPending || !validation.isValid}
              >
                <Lock className="h-4 w-4 mr-2" />
                {closeLogbook.isPending ? 'Stänger...' : 'Stäng loggbok'}
              </Button>
            )}

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
    </MainLayout>
  );
}
