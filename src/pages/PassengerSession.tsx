import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Badge imported for lock status display
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Ship, Users, Plus, ArrowLeft, Check, Trash2, Lock, Clock, UserPlus, UserMinus, Pencil, AlertTriangle, Hash } from "lucide-react";
import { CounterMode } from "@/components/passenger/CounterMode";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { toast } from "sonner";

interface PassengerEntry {
  id: string;
  dock_id: string | null;
  dock_name: string;
  departure_time: string;
  pax_on: number;
  pax_off: number;
  entry_order: number;
  created_at: string;
  registered_by: string;
  registered_by_profile?: {
    full_name: string;
  } | null;
}

interface RouteStop {
  id: string;
  dock_id: string;
  stop_order: number;
  dock: {
    id: string;
    name: string;
  };
}

interface Dock {
  id: string;
  name: string;
}

export default function PassengerSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrganization();
  const { user } = useAuth();
  
  const [departureTime, setDepartureTime] = useState(format(new Date(), 'HH:mm'));
  const [selectedDockId, setSelectedDockId] = useState<string>('');
  const [manualDockName, setManualDockName] = useState('');
  const [paxOn, setPaxOn] = useState<string>('');
  const [paxOff, setPaxOff] = useState<string>('');
  const [lastEntriesCount, setLastEntriesCount] = useState(0);
  const [counterMode, setCounterMode] = useState(false);
  
  const paxOnRef = useRef<HTMLInputElement>(null);

  // Check if current user is crew on the logbook
  const { data: isCrewMember, isLoading: crewCheckLoading } = useQuery({
    queryKey: ['is-crew-member', sessionId, user?.id],
    queryFn: async () => {
      // First get the session to find the logbook_id
      const { data: sessionData, error: sessionError } = await supabase
        .from('passenger_sessions')
        .select('logbook_id')
        .eq('id', sessionId)
        .single();
      
      if (sessionError || !sessionData) return false;

      // Get user's profile id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', user?.id)
        .single();
      
      if (!profile) return false;

      // Check if user is in logbook crew
      const { data: crewData } = await supabase
        .from('logbook_crew')
        .select('id')
        .eq('logbook_id', sessionData.logbook_id)
        .eq('profile_id', profile.id)
        .maybeSingle();
      
      return !!crewData;
    },
    enabled: !!sessionId && !!user?.id,
  });

  // Fetch session data
  const { data: session, isLoading: sessionLoading, error: sessionError } = useQuery({
    queryKey: ['passenger-session', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_sessions')
        .select(`
          id,
          logbook_id,
          vessel_id,
          route_id,
          current_stop_index,
          is_active,
          started_at,
          vessel:vessels(id, name, max_passengers),
          logbook:logbooks(id, date)
        `)
        .eq('id', sessionId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!sessionId,
  });

  // Fetch route with stops
  const { data: routeStops = [] } = useQuery({
    queryKey: ['route-stops', session?.route_id],
    queryFn: async () => {
      if (!session?.route_id) return [];
      
      const { data, error } = await supabase
        .from('passenger_route_stops')
        .select(`
          id,
          dock_id,
          stop_order,
          dock:passenger_docks(id, name)
        `)
        .eq('route_id', session.route_id)
        .order('stop_order', { ascending: true });

      if (error) throw error;
      return (data || []) as RouteStop[];
    },
    enabled: !!session?.route_id,
  });

  // Fetch all docks for manual selection
  const { data: allDocks = [] } = useQuery({
    queryKey: ['passenger-docks', selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_docks')
        .select('id, name')
        .eq('organization_id', selectedOrgId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data as Dock[];
    },
    enabled: !!selectedOrgId,
  });

  // Fetch all routes
  const { data: routes = [] } = useQuery({
    queryKey: ['passenger-routes', selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_routes')
        .select('id, name')
        .eq('organization_id', selectedOrgId)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      return data;
    },
    enabled: !!selectedOrgId,
  });

  // Fetch entries with registered_by profile
  const { data: entries = [] } = useQuery({
    queryKey: ['passenger-entries', sessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_entries')
        .select('*')
        .eq('session_id', sessionId)
        .order('entry_order', { ascending: true });

      if (error) throw error;
      
      // Fetch profiles for all registered_by users
      const userIds = [...new Set((data || []).map(e => e.registered_by).filter(Boolean))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.user_id, { full_name: p.full_name }]) || []);
      
      return (data || []).map(entry => ({
        ...entry,
        registered_by_profile: profileMap.get(entry.registered_by) || null,
      })) as PassengerEntry[];
    },
    enabled: !!sessionId,
  });

  // Calculate current onboard
  const currentOnboard = useMemo(() => {
    return entries.reduce((sum, entry) => sum + entry.pax_on - entry.pax_off, 0);
  }, [entries]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    if (entries.length === 0) return null;
    
    const sortedByTime = [...entries].sort((a, b) => 
      a.departure_time.localeCompare(b.departure_time)
    );
    
    return {
      firstDeparture: sortedByTime[0]?.departure_time?.slice(0, 5) || '-',
      lastDeparture: sortedByTime[sortedByTime.length - 1]?.departure_time?.slice(0, 5) || '-',
      totalPaxOn: entries.reduce((sum, e) => sum + e.pax_on, 0),
      totalPaxOff: entries.reduce((sum, e) => sum + e.pax_off, 0),
      stopCount: entries.length,
    };
  }, [entries]);

  // Track previous route to detect route changes
  const prevRouteIdRef = useRef<string | null | undefined>(undefined);

  // ALWAYS set first dock when route changes or when routeStops load for current route
  useEffect(() => {
    const routeChanged = prevRouteIdRef.current !== undefined && prevRouteIdRef.current !== session?.route_id;
    const initialLoad = prevRouteIdRef.current === undefined;
    
    // Always set first dock when route changes (even if routeStops not yet loaded)
    if (routeChanged) {
      if (routeStops.length > 0) {
        setSelectedDockId(routeStops[0].dock_id);
      } else {
        // Clear selection until routeStops loads
        setSelectedDockId('');
      }
    } else if (initialLoad && routeStops.length > 0 && !selectedDockId) {
      // Initial load: set first dock if none selected
      setSelectedDockId(routeStops[0].dock_id);
    } else if (!routeChanged && routeStops.length > 0 && !selectedDockId) {
      // routeStops just loaded for current route, set first dock
      setSelectedDockId(routeStops[0].dock_id);
    }
    
    prevRouteIdRef.current = session?.route_id;
  }, [session?.route_id, routeStops]);

  // Advance to next dock in list after saving (cycles)
  useEffect(() => {
    if (routeStops.length === 0) return;
    if (entries.length === 0) return; // Let user pick start freely
    if (entries.length <= lastEntriesCount) {
      setLastEntriesCount(entries.length);
      return;
    }
    
    // Find last saved dock and move to next in list
    const lastEntry = entries[entries.length - 1];
    const lastIndex = routeStops.findIndex(s => s.dock_id === lastEntry.dock_id);
    const nextIndex = (lastIndex + 1) % routeStops.length;
    setSelectedDockId(routeStops[nextIndex].dock_id);
    setLastEntriesCount(entries.length);
  }, [entries.length, routeStops]);

  // Add entry mutation
  const addEntry = useMutation({
    mutationFn: async () => {
      if (!session?.is_active) {
        throw new Error('Sessionen är låst');
      }
      const dockId = selectedDockId || null;
      const dockName = allDocks.find(d => d.id === selectedDockId)?.name || manualDockName || 'Okänd brygga';

      const { error } = await supabase
        .from('passenger_entries')
        .insert({
          session_id: sessionId,
          dock_id: dockId,
          dock_name: dockName,
          departure_time: departureTime,
          pax_on: parseInt(paxOn) || 0,
          pax_off: parseInt(paxOff) || 0,
          entry_order: entries.length + 1,
          registered_by: user?.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-entries', sessionId] });
      // Reset form but keep time updated
      setDepartureTime(format(new Date(), 'HH:mm'));
      setPaxOn('');
      setPaxOff('');
      setManualDockName('');
      // Focus on pax_on for quick next entry
      setTimeout(() => paxOnRef.current?.focus(), 100);
      toast.success('Registrering sparad');
    },
    onError: (error) => {
      if ((error as any)?.message?.includes('låst')) {
        toast.error('Sessionen är låst och kan inte ändras');
        return;
      }
      toast.error('Kunde inte spara registrering');
      console.error(error);
    },
  });

  // Delete entry mutation
  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
      if (!session?.is_active) {
        throw new Error('Sessionen är låst');
      }
      const { error } = await supabase
        .from('passenger_entries')
        .delete()
        .eq('id', entryId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-entries', sessionId] });
      toast.success('Registrering borttagen');
    },
    onError: (error) => {
      if ((error as any)?.message?.includes('låst')) {
        toast.error('Sessionen är låst och kan inte ändras');
        return;
      }
      toast.error('Kunde inte ta bort registrering');
      console.error(error);
    },
  });

  // Update route mutation
  const updateRoute = useMutation({
    mutationFn: async (routeId: string | null) => {
      if (!session?.is_active) {
        throw new Error('Sessionen är låst');
      }
      const { error } = await supabase
        .from('passenger_sessions')
        .update({ route_id: routeId })
        .eq('id', sessionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['passenger-session', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['route-stops'] });
      toast.success('Rutt uppdaterad');
    },
    onError: (error) => {
      if ((error as any)?.message?.includes('låst')) {
        toast.error('Sessionen är låst och kan inte ändras');
        return;
      }
      toast.error('Kunde inte uppdatera rutt');
      console.error(error);
    },
  });

  // Handle form submit with Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!session?.is_active) return;
    if (e.key === 'Enter' && !addEntry.isPending) {
      e.preventDefault();
      addEntry.mutate();
    }
  };

  // Counter mode save handler
  const handleCounterSave = useCallback(async (paxOnVal: number, paxOffVal: number) => {
    if (!session?.is_active) throw new Error('Sessionen är låst');
    const dockId = selectedDockId || null;
    const dockName = allDocks.find(d => d.id === selectedDockId)?.name || 'Okänd brygga';

    const { error } = await supabase
      .from('passenger_entries')
      .insert({
        session_id: sessionId,
        dock_id: dockId,
        dock_name: dockName,
        departure_time: format(new Date(), 'HH:mm'),
        pax_on: paxOnVal,
        pax_off: paxOffVal,
        entry_order: entries.length + 1,
        registered_by: user?.id,
      });

    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['passenger-entries', sessionId] });
    toast.success('Registrering sparad');
  }, [session?.is_active, selectedDockId, allDocks, sessionId, entries.length, user?.id, queryClient]);

  // Get current dock name for counter mode
  const currentDockName = useMemo(() => {
    if (selectedDockId) {
      const dock = allDocks.find(d => d.id === selectedDockId);
      if (dock) return dock.name;
      const stop = routeStops.find(s => s.dock_id === selectedDockId);
      if (stop) return stop.dock?.name || '';
    }
    return '';
  }, [selectedDockId, allDocks, routeStops]);

  if (sessionLoading || crewCheckLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!session || sessionError) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Session hittades inte eller du har inte tillgång</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/portal/passagerare')}>
            Tillbaka
          </Button>
        </div>
      </MainLayout>
    );
  }

  if (!isCrewMember) {
    return (
      <MainLayout>
        <div className="text-center py-12">
          <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold mb-2">Ingen åtkomst</h2>
          <p className="text-muted-foreground mb-4">
            Du måste vara registrerad i loggbokens besättning för att kunna registrera passagerare.
          </p>
          <Button variant="outline" onClick={() => navigate('/portal/passagerare')}>
            Tillbaka
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <>
      {counterMode && (
        <CounterMode
          dockName={currentDockName}
          currentOnboard={currentOnboard}
          maxPassengers={(session as any).vessel?.max_passengers}
          isActive={session.is_active}
          onSave={handleCounterSave}
          onClose={() => setCounterMode(false)}
        />
      )}
    <MainLayout>
      <div className="space-y-3 md:space-y-4">
        {/* Header - Mobile optimized */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 md:gap-4 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 md:h-10 md:w-10 flex-shrink-0 mt-0.5" onClick={() => navigate('/portal/passagerare')}>
              <ArrowLeft className="h-4 w-4 md:h-5 md:w-5" />
            </Button>
            <div className="min-w-0">
              <h1 className="text-base md:text-xl font-bold flex items-center gap-2 truncate">
                <Ship className="h-4 w-4 md:h-5 md:w-5 flex-shrink-0" />
                <span className="truncate">{(session as any).vessel?.name}</span>
              </h1>
              <p className="text-xs md:text-sm text-muted-foreground">
                {(session as any).logbook?.date ? format(new Date((session as any).logbook.date), 'd MMM yyyy', { locale: sv }) : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
            <div className="text-right">
              <div className={`text-2xl md:text-3xl font-bold ${(session as any).vessel?.max_passengers && currentOnboard > (session as any).vessel.max_passengers ? 'text-destructive' : 'text-primary'}`}>{currentOnboard}</div>
              <div className="text-xs md:text-sm text-muted-foreground">ombord</div>
              {(session as any).vessel?.max_passengers && currentOnboard > (session as any).vessel.max_passengers && (
                <div className="flex items-center gap-1 text-destructive text-xs mt-0.5 justify-end">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Max {(session as any).vessel.max_passengers}!</span>
                </div>
              )}
            </div>
            {!session.is_active && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Lock className="h-3 w-3" />
                <span className="hidden sm:inline">Låst</span>
              </Badge>
            )}
          </div>
        </div>

        {/* Route Selection - Mobile optimized */}
        <Card>
          <CardContent className="py-2 md:py-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
              <Label className="whitespace-nowrap text-xs md:text-sm">Rutt:</Label>
              <Select
                disabled={!session.is_active}
                value={session.route_id || 'none'}
                onValueChange={(value) => updateRoute.mutate(value === 'none' ? null : value)}
              >
                <SelectTrigger className="w-full sm:w-[200px] h-9">
                  <SelectValue placeholder="Välj rutt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ingen rutt (manuell)</SelectItem>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={route.id}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Quick Entry Form - Mobile optimized */}
        <Card>
          <CardHeader className="py-2 md:py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm md:text-base">Ny registrering</CardTitle>
            {session.is_active && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
                onClick={() => setCounterMode(true)}
              >
                <Hash className="h-3.5 w-3.5" />
                Räknare
              </Button>
            )}
          </CardHeader>
          <CardContent className="py-2 md:py-3">
            <div className="space-y-3 md:space-y-0" onKeyDown={handleKeyDown}>
              {/* Mobile: stacked layout */}
              <div className="grid grid-cols-2 gap-2 md:hidden">
                <div>
                  <Label className="text-xs">Avgång</Label>
                  <Input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    disabled={!session.is_active}
                    className="h-12 text-base"
                  />
                </div>
                <div>
                  <Label className="text-xs">Brygga</Label>
                  <Select value={selectedDockId} onValueChange={setSelectedDockId} disabled={!session.is_active}>
                    <SelectTrigger className="h-12 text-base">
                      <SelectValue placeholder="Välj" />
                    </SelectTrigger>
                    <SelectContent>
                      {session.route_id && routeStops.length > 0
                        ? routeStops.map((stop) => (
                            <SelectItem key={stop.dock_id} value={stop.dock_id}>
                              {stop.dock?.name}
                            </SelectItem>
                          ))
                        : allDocks.map((dock) => (
                            <SelectItem key={dock.id} value={dock.id}>
                              {dock.name}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 md:hidden">
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <UserPlus className="h-3 w-3 text-primary" /> På
                  </Label>
                  <Input
                    ref={paxOnRef}
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={paxOn}
                    onChange={(e) => setPaxOn(e.target.value)}
                    disabled={!session.is_active}
                    placeholder="0"
                    className="h-14 text-2xl font-bold text-center"
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1">
                    <UserMinus className="h-3 w-3 text-destructive" /> Av
                  </Label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    max={currentOnboard}
                    value={paxOff}
                    onChange={(e) => setPaxOff(e.target.value)}
                    disabled={!session.is_active}
                    placeholder="0"
                    className="h-14 text-2xl font-bold text-center"
                  />
                </div>
              </div>

              <Button 
                onClick={() => addEntry.mutate()} 
                disabled={!session.is_active || addEntry.isPending}
                className="w-full h-12 text-base md:hidden"
              >
                <Plus className="h-5 w-5 mr-2" />
                Registrera
              </Button>

              {/* Desktop: grid layout */}
              <div className="hidden md:grid md:grid-cols-5 gap-3">
                <div>
                  <Label className="text-xs">Avgång</Label>
                  <Input
                    type="time"
                    value={departureTime}
                    onChange={(e) => setDepartureTime(e.target.value)}
                    disabled={!session.is_active}
                    className="h-10"
                  />
                </div>
                
                <div>
                  <Label className="text-xs">Brygga</Label>
                  <Select value={selectedDockId} onValueChange={setSelectedDockId} disabled={!session.is_active}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Välj brygga" />
                    </SelectTrigger>
                    <SelectContent>
                      {session.route_id && routeStops.length > 0
                        ? routeStops.map((stop) => (
                            <SelectItem key={stop.dock_id} value={stop.dock_id}>
                              {stop.dock?.name}
                            </SelectItem>
                          ))
                        : allDocks.map((dock) => (
                            <SelectItem key={dock.id} value={dock.id}>
                              {dock.name}
                            </SelectItem>
                          ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs">På</Label>
                  <Input
                    type="number"
                    min="0"
                    value={paxOn}
                    onChange={(e) => setPaxOn(e.target.value)}
                    disabled={!session.is_active}
                    placeholder="0"
                    className="h-10 text-lg font-semibold text-center"
                  />
                </div>

                <div>
                  <Label className="text-xs">Av</Label>
                  <Input
                    type="number"
                    min="0"
                    max={currentOnboard}
                    value={paxOff}
                    onChange={(e) => setPaxOff(e.target.value)}
                    disabled={!session.is_active}
                    placeholder="0"
                    className="h-10 text-lg font-semibold text-center"
                  />
                </div>

                <div className="flex items-end">
                  <Button 
                    onClick={() => addEntry.mutate()} 
                    disabled={!session.is_active || addEntry.isPending}
                    className="w-full h-10"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Registrera
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entries - Mobile card view */}
        <div className="space-y-2 md:hidden">
          {entries.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground text-sm">
                Inga registreringar ännu. Börja registrera passagerare ovan.
              </CardContent>
            </Card>
          ) : (
            entries.map((entry, index) => {
              const runningTotal = entries
                .slice(0, index + 1)
                .reduce((sum, e) => sum + e.pax_on - e.pax_off, 0);
              
              return (
                <Card key={entry.id}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="text-xs text-muted-foreground w-5">{entry.entry_order}</div>
                        <div>
                          <div className="font-medium text-sm">{entry.dock_name}</div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {entry.departure_time?.slice(0, 5)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 text-sm">
                          {entry.pax_on > 0 && (
                            <span className="text-primary font-semibold">+{entry.pax_on}</span>
                          )}
                          {entry.pax_off > 0 && (
                            <span className="text-destructive font-semibold">-{entry.pax_off}</span>
                          )}
                        </div>
                        <div className={`px-2 py-1 rounded text-sm font-bold min-w-[40px] text-center ${(session as any).vessel?.max_passengers && runningTotal > (session as any).vessel.max_passengers ? 'bg-destructive/10 text-destructive' : 'bg-muted'}`}>
                          {runningTotal}
                        </div>
                        {session.is_active && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteEntry.mutate(entry.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Entries - Desktop table view */}
        <Card className="hidden md:block">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Tid</TableHead>
                  <TableHead>Brygga</TableHead>
                  <TableHead className="text-center w-20">På</TableHead>
                  <TableHead className="text-center w-20">Av</TableHead>
                  <TableHead className="text-center w-24">Ombord</TableHead>
                  <TableHead>Rapporterad av</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Inga registreringar ännu. Börja registrera passagerare ovan.
                    </TableCell>
                  </TableRow>
                ) : (
                  entries.map((entry, index) => {
                    const runningTotal = entries
                      .slice(0, index + 1)
                      .reduce((sum, e) => sum + e.pax_on - e.pax_off, 0);
                    
                      return (
                        <TableRow key={entry.id}>
                          <TableCell className="text-muted-foreground">{entry.entry_order}</TableCell>
                          <TableCell className="font-mono">{entry.departure_time?.slice(0, 5)}</TableCell>
                          <TableCell>{entry.dock_name}</TableCell>
                          <TableCell className="text-center font-semibold text-primary">
                            {entry.pax_on > 0 ? `+${entry.pax_on}` : '-'}
                          </TableCell>
                          <TableCell className="text-center font-semibold text-destructive">
                            {entry.pax_off > 0 ? `-${entry.pax_off}` : '-'}
                          </TableCell>
                          <TableCell className={`text-center font-bold ${(session as any).vessel?.max_passengers && runningTotal > (session as any).vessel.max_passengers ? 'text-destructive' : ''}`}>{runningTotal}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.registered_by_profile?.full_name || '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteEntry.mutate(entry.id)}
                              disabled={!session.is_active}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

      </div>
    </MainLayout>
    </>
  );
}
