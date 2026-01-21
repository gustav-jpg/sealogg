import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Ship, Users, Plus, ArrowLeft, Check, Trash2, Lock, Clock, UserPlus, UserMinus } from "lucide-react";
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
  const [useManualDock, setUseManualDock] = useState(false);
  
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
          vessel:vessels(id, name),
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

  // Get next dock from route
  const nextRouteDock = useMemo(() => {
    if (!session?.route_id || routeStops.length === 0) return null;
    const nextIndex = entries.length;
    if (nextIndex >= routeStops.length) return null;
    return routeStops[nextIndex];
  }, [session?.route_id, routeStops, entries.length]);

  // Set dock when route dock is available
  useEffect(() => {
    if (nextRouteDock && !useManualDock) {
      setSelectedDockId(nextRouteDock.dock_id);
    }
  }, [nextRouteDock, useManualDock]);

  // Add entry mutation
  const addEntry = useMutation({
    mutationFn: async () => {
      const dockId = useManualDock ? (selectedDockId || null) : (nextRouteDock?.dock_id || selectedDockId || null);
      const dockName = useManualDock 
        ? (manualDockName || allDocks.find(d => d.id === selectedDockId)?.name || 'Okänd brygga')
        : (nextRouteDock?.dock?.name || allDocks.find(d => d.id === selectedDockId)?.name || 'Okänd brygga');

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
      toast.error('Kunde inte spara registrering');
      console.error(error);
    },
  });

  // Delete entry mutation
  const deleteEntry = useMutation({
    mutationFn: async (entryId: string) => {
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
  });

  // Update route mutation
  const updateRoute = useMutation({
    mutationFn: async (routeId: string | null) => {
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
  });

  // Handle form submit with Enter key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !addEntry.isPending) {
      e.preventDefault();
      addEntry.mutate();
    }
  };

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
    <MainLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/portal/passagerare')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Ship className="h-5 w-5" />
                {(session as any).vessel?.name}
              </h1>
              <p className="text-sm text-muted-foreground">
                {(session as any).logbook?.date ? format(new Date((session as any).logbook.date), 'd MMMM yyyy', { locale: sv }) : ''}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{currentOnboard}</div>
              <div className="text-sm text-muted-foreground">ombord</div>
            </div>
            {!session.is_active && (
              <Badge variant="secondary" className="gap-1">
                <Lock className="h-3 w-3" />
                Låst
              </Badge>
            )}
          </div>
        </div>

        {/* Route Selection */}
        <Card>
          <CardContent className="py-3">
            <div className="flex items-center gap-4">
              <Label className="whitespace-nowrap">Rutt:</Label>
              <Select
                value={session.route_id || 'none'}
                onValueChange={(value) => updateRoute.mutate(value === 'none' ? null : value)}
              >
                <SelectTrigger className="w-[200px]">
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
              {nextRouteDock && (
                <span className="text-sm text-muted-foreground">
                  Nästa: <span className="font-medium">{nextRouteDock.dock?.name}</span>
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Entry Form */}
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Ny registrering</CardTitle>
          </CardHeader>
          <CardContent className="py-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3" onKeyDown={handleKeyDown}>
              <div>
                <Label className="text-xs">Avgång</Label>
                <Input
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="h-10"
                />
              </div>
              
              <div>
                <Label className="text-xs">Brygga</Label>
                {session.route_id && nextRouteDock ? (
                  <Input
                    value={nextRouteDock.dock?.name || ''}
                    disabled
                    className="h-10 bg-muted"
                  />
                ) : (
                  <Select value={selectedDockId} onValueChange={setSelectedDockId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Välj brygga" />
                    </SelectTrigger>
                    <SelectContent>
                      {allDocks.map((dock) => (
                        <SelectItem key={dock.id} value={dock.id}>
                          {dock.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div>
                <Label className="text-xs">På</Label>
                <Input
                  ref={paxOnRef}
                  type="number"
                  min="0"
                  value={paxOn}
                  onChange={(e) => setPaxOn(e.target.value)}
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
                  placeholder="0"
                  className="h-10 text-lg font-semibold text-center"
                />
              </div>

              <div className="flex items-end">
                <Button 
                  onClick={() => addEntry.mutate()} 
                  disabled={addEntry.isPending}
                  className="w-full h-10"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Registrera
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Entries Table */}
        <Card>
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
                          <TableCell className="text-center font-bold">{runningTotal}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {entry.registered_by_profile?.full_name || '-'}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteEntry.mutate(entry.id)}
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
  );
}
