import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit, Route, Anchor, ChevronUp, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Dock {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface RouteData {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface RouteStop {
  id: string;
  dock_id: string;
  stop_order: number;
  dock: Dock;
}

export default function PassengerAdmin() {
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrganization();
  
  const [dockDialog, setDockDialog] = useState(false);
  const [editingDock, setEditingDock] = useState<Dock | null>(null);
  const [dockName, setDockName] = useState('');
  const [dockDescription, setDockDescription] = useState('');

  const [routeDialog, setRouteDialog] = useState(false);
  const [editingRoute, setEditingRoute] = useState<RouteData | null>(null);
  const [routeName, setRouteName] = useState('');
  const [routeDescription, setRouteDescription] = useState('');

  const [stopsDialog, setStopsDialog] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<RouteData | null>(null);
  const [selectedDockForStop, setSelectedDockForStop] = useState('');

  // Fetch docks
  const { data: docks = [] } = useQuery({
    queryKey: ['admin-passenger-docks', selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_docks')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');

      if (error) throw error;
      return data as Dock[];
    },
    enabled: !!selectedOrgId,
  });

  // Fetch routes
  const { data: routes = [] } = useQuery({
    queryKey: ['admin-passenger-routes', selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_routes')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');

      if (error) throw error;
      return data as RouteData[];
    },
    enabled: !!selectedOrgId,
  });

  // Fetch route stops for selected route
  const { data: routeStops = [] } = useQuery({
    queryKey: ['admin-route-stops', selectedRoute?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_route_stops')
        .select(`
          id,
          dock_id,
          stop_order,
          dock:passenger_docks(id, name, description, is_active)
        `)
        .eq('route_id', selectedRoute!.id)
        .order('stop_order');

      if (error) throw error;
      return data as RouteStop[];
    },
    enabled: !!selectedRoute?.id,
  });

  // Dock mutations
  const saveDock = useMutation({
    mutationFn: async () => {
      if (editingDock) {
        const { error } = await supabase
          .from('passenger_docks')
          .update({ name: dockName, description: dockDescription || null })
          .eq('id', editingDock.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('passenger_docks')
          .insert({
            organization_id: selectedOrgId,
            name: dockName,
            description: dockDescription || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-passenger-docks'] });
      setDockDialog(false);
      setEditingDock(null);
      setDockName('');
      setDockDescription('');
      toast.success(editingDock ? 'Brygga uppdaterad' : 'Brygga skapad');
    },
    onError: () => toast.error('Kunde inte spara brygga'),
  });

  const deleteDock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('passenger_docks')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-passenger-docks'] });
      toast.success('Brygga borttagen');
    },
    onError: () => toast.error('Kunde inte ta bort brygga'),
  });

  // Route mutations
  const saveRoute = useMutation({
    mutationFn: async () => {
      if (editingRoute) {
        const { error } = await supabase
          .from('passenger_routes')
          .update({ name: routeName, description: routeDescription || null })
          .eq('id', editingRoute.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('passenger_routes')
          .insert({
            organization_id: selectedOrgId,
            name: routeName,
            description: routeDescription || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-passenger-routes'] });
      setRouteDialog(false);
      setEditingRoute(null);
      setRouteName('');
      setRouteDescription('');
      toast.success(editingRoute ? 'Rutt uppdaterad' : 'Rutt skapad');
    },
    onError: () => toast.error('Kunde inte spara rutt'),
  });

  const deleteRoute = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('passenger_routes')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-passenger-routes'] });
      toast.success('Rutt borttagen');
    },
    onError: () => toast.error('Kunde inte ta bort rutt'),
  });

  // Route stop mutations
  const addRouteStop = useMutation({
    mutationFn: async () => {
      const { data: lastStop, error: fetchLastError } = await supabase
        .from('passenger_route_stops')
        .select('stop_order')
        .eq('route_id', selectedRoute!.id)
        .order('stop_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (fetchLastError) throw fetchLastError;

      const { error } = await supabase
        .from('passenger_route_stops')
        .insert({
          route_id: selectedRoute!.id,
          dock_id: selectedDockForStop,
          stop_order: (lastStop?.stop_order ?? 0) + 1,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-route-stops', selectedRoute?.id] });
      setSelectedDockForStop('');
      toast.success('Stopp tillagt');
    },
    onError: () => toast.error('Kunde inte lägga till stopp'),
  });

  const deleteRouteStop = useMutation({
    mutationFn: async (stopId: string) => {
      const { error } = await supabase
        .from('passenger_route_stops')
        .delete()
        .eq('id', stopId);
      if (error) throw error;

      // Reorder remaining stops to remove gaps
      const remaining = routeStops
        .filter(s => s.id !== stopId)
        .sort((a, b) => a.stop_order - b.stop_order);
      
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].stop_order !== i + 1) {
          const { error: reorderError } = await supabase
            .from('passenger_route_stops')
            .update({ stop_order: i + 1 })
            .eq('id', remaining[i].id);
          if (reorderError) throw reorderError;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-route-stops'] });
      toast.success('Stopp borttaget');
    },
  });

  const moveRouteStop = useMutation({
    mutationFn: async ({ stopId, direction }: { stopId: string; direction: 'up' | 'down' }) => {
      const currentIndex = routeStops.findIndex(s => s.id === stopId);
      if (currentIndex === -1) return;
      
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= routeStops.length) return;

      const currentStop = routeStops[currentIndex];
      const targetStop = routeStops[targetIndex];

      // Swap stop_order values
      const { error: error1 } = await supabase
        .from('passenger_route_stops')
        .update({ stop_order: targetStop.stop_order })
        .eq('id', currentStop.id);
      if (error1) throw error1;

      const { error: error2 } = await supabase
        .from('passenger_route_stops')
        .update({ stop_order: currentStop.stop_order })
        .eq('id', targetStop.id);
      if (error2) throw error2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-route-stops'] });
    },
    onError: () => toast.error('Kunde inte flytta stopp'),
  });

  const openDockDialog = (dock?: Dock) => {
    if (dock) {
      setEditingDock(dock);
      setDockName(dock.name);
      setDockDescription(dock.description || '');
    } else {
      setEditingDock(null);
      setDockName('');
      setDockDescription('');
    }
    setDockDialog(true);
  };

  const openRouteDialog = (route?: RouteData) => {
    if (route) {
      setEditingRoute(route);
      setRouteName(route.name);
      setRouteDescription(route.description || '');
    } else {
      setEditingRoute(null);
      setRouteName('');
      setRouteDescription('');
    }
    setRouteDialog(true);
  };

  const openStopsDialog = (route: RouteData) => {
    setSelectedRoute(route);
    setStopsDialog(true);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Passagerarinställningar</h1>
          <p className="text-muted-foreground">
            Hantera bryggor och rutter för passagerarregistrering
          </p>
        </div>

        <Tabs defaultValue="docks">
          <TabsList>
            <TabsTrigger value="docks" className="gap-2">
              <Anchor className="h-4 w-4" /> Bryggor
            </TabsTrigger>
            <TabsTrigger value="routes" className="gap-2">
              <Route className="h-4 w-4" /> Rutter
            </TabsTrigger>
          </TabsList>

          <TabsContent value="docks" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-lg">Bryggor</CardTitle>
                <Button size="sm" onClick={() => openDockDialog()}>
                  <Plus className="h-4 w-4 mr-1" /> Lägg till
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Namn</TableHead>
                      <TableHead>Beskrivning</TableHead>
                      <TableHead className="w-24"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {docks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          Inga bryggor har lagts till ännu
                        </TableCell>
                      </TableRow>
                    ) : (
                      docks.map((dock) => (
                        <TableRow key={dock.id}>
                          <TableCell className="font-medium">{dock.name}</TableCell>
                          <TableCell className="text-muted-foreground">{dock.description || '-'}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openDockDialog(dock)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive"
                                onClick={() => deleteDock.mutate(dock.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="routes" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <CardTitle className="text-lg">Rutter</CardTitle>
                <Button size="sm" onClick={() => openRouteDialog()}>
                  <Plus className="h-4 w-4 mr-1" /> Lägg till
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Namn</TableHead>
                      <TableHead>Beskrivning</TableHead>
                      <TableHead>Stopp</TableHead>
                      <TableHead className="w-32"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {routes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Inga rutter har lagts till ännu
                        </TableCell>
                      </TableRow>
                    ) : (
                      routes.map((route) => (
                        <TableRow key={route.id}>
                          <TableCell className="font-medium">{route.name}</TableCell>
                          <TableCell className="text-muted-foreground">{route.description || '-'}</TableCell>
                          <TableCell>
                            <Button variant="link" size="sm" className="p-0 h-auto" onClick={() => openStopsDialog(route)}>
                              Hantera stopp
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openRouteDialog(route)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive"
                                onClick={() => deleteRoute.mutate(route.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dock Dialog */}
      <Dialog open={dockDialog} onOpenChange={setDockDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDock ? 'Redigera brygga' : 'Ny brygga'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Namn</Label>
              <Input
                value={dockName}
                onChange={(e) => setDockName(e.target.value)}
                placeholder="T.ex. Strandvägskajen"
              />
            </div>
            <div>
              <Label>Beskrivning (valfritt)</Label>
              <Input
                value={dockDescription}
                onChange={(e) => setDockDescription(e.target.value)}
                placeholder="T.ex. Norra sidan"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDockDialog(false)}>Avbryt</Button>
            <Button onClick={() => saveDock.mutate()} disabled={!dockName || saveDock.isPending}>
              {editingDock ? 'Spara' : 'Skapa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route Dialog */}
      <Dialog open={routeDialog} onOpenChange={setRouteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRoute ? 'Redigera rutt' : 'Ny rutt'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Namn</Label>
              <Input
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="T.ex. Skärgårdstur 1"
              />
            </div>
            <div>
              <Label>Beskrivning (valfritt)</Label>
              <Input
                value={routeDescription}
                onChange={(e) => setRouteDescription(e.target.value)}
                placeholder="T.ex. Via Vaxholm och Grinda"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRouteDialog(false)}>Avbryt</Button>
            <Button onClick={() => saveRoute.mutate()} disabled={!routeName || saveRoute.isPending}>
              {editingRoute ? 'Spara' : 'Skapa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Route Stops Dialog */}
      <Dialog open={stopsDialog} onOpenChange={setStopsDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Stopp för {selectedRoute?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Select value={selectedDockForStop} onValueChange={setSelectedDockForStop}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Välj brygga att lägga till" />
                </SelectTrigger>
                <SelectContent>
                  {docks.map((dock) => (
                    <SelectItem key={dock.id} value={dock.id}>
                      {dock.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={() => addRouteStop.mutate()} disabled={!selectedDockForStop}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <div className="border rounded-lg">
              {routeStops.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  Inga stopp i denna rutt
                </div>
              ) : (
                <div className="divide-y">
                  {routeStops.map((stop, index) => (
                    <div key={stop.id} className="flex items-center gap-2 px-4 py-2">
                      <div className="flex flex-col">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === 0 || moveRouteStop.isPending}
                          onClick={() => moveRouteStop.mutate({ stopId: stop.id, direction: 'up' })}
                        >
                          <ChevronUp className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          disabled={index === routeStops.length - 1 || moveRouteStop.isPending}
                          onClick={() => moveRouteStop.mutate({ stopId: stop.id, direction: 'down' })}
                        >
                          <ChevronDown className="h-4 w-4" />
                        </Button>
                      </div>
                      <span className="text-muted-foreground w-6">{index + 1}.</span>
                      <span className="flex-1 font-medium">{stop.dock?.name}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => deleteRouteStop.mutate(stop.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setStopsDialog(false)}>Klar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
