import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Ship, Users } from "lucide-react";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface ActiveSession {
  id: string;
  logbook_id: string;
  vessel_id: string;
  is_active: boolean;
  started_at: string;
  vessel: {
    id: string;
    name: string;
  };
  logbook: {
    id: string;
    date: string;
  };
  route?: {
    id: string;
    name: string;
  } | null;
  _count?: {
    entries: number;
  };
}

export default function PassengerRegistration() {
  const navigate = useNavigate();
  const { selectedOrgId } = useOrganization();

  const { data: activeSessions = [], isLoading } = useQuery({
    queryKey: ['passenger-sessions', selectedOrgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('passenger_sessions')
        .select(`
          id,
          logbook_id,
          vessel_id,
          is_active,
          started_at,
          route_id,
          vessel:vessels(id, name),
          logbook:logbooks(id, date)
        `)
        .eq('is_active', true)
        .order('started_at', { ascending: false });

      if (error) throw error;

      // Fetch route info separately if needed
      const sessionsWithRoutes = await Promise.all(
        (data || []).map(async (session: any) => {
          if (session.route_id) {
            const { data: routeData } = await supabase
              .from('passenger_routes')
              .select('id, name')
              .eq('id', session.route_id)
              .single();
            return { ...session, route: routeData };
          }
          return { ...session, route: null };
        })
      );

      // Get entry counts
      const sessionsWithCounts = await Promise.all(
        sessionsWithRoutes.map(async (session: any) => {
          const { count } = await supabase
            .from('passenger_entries')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', session.id);
          return { ...session, _count: { entries: count || 0 } };
        })
      );

      return sessionsWithCounts as ActiveSession[];
    },
    enabled: !!selectedOrgId,
  });

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Passagerarregistrering</h1>
            <p className="text-muted-foreground text-sm">Aktiva registreringssessioner</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 bg-muted animate-pulse rounded" />
            ))}
          </div>
        ) : activeSessions.length === 0 ? (
          <Card className="text-center py-8">
            <CardContent>
              <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="text-base font-medium mb-1">Inga aktiva sessioner</h3>
              <p className="text-muted-foreground text-sm mb-3">
                Aktivera passagerarregistrering från en öppen loggbok för att börja.
              </p>
              <Button size="sm" variant="outline" onClick={() => navigate('/portal/logbooks')}>
                Gå till loggböcker
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="h-9">Datum</TableHead>
                  <TableHead className="h-9">Fartyg</TableHead>
                  <TableHead className="h-9">Rutt</TableHead>
                  <TableHead className="h-9 text-center">Registreringar</TableHead>
                  <TableHead className="h-9">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeSessions.map((session) => (
                  <TableRow 
                    key={session.id} 
                    className="cursor-pointer"
                    onClick={() => navigate(`/portal/passagerare/${session.id}`)}
                  >
                    <TableCell className="py-2 text-muted-foreground text-sm">
                      {session.logbook?.date 
                        ? format(new Date(session.logbook.date), 'd MMM yyyy', { locale: sv }) 
                        : '-'}
                    </TableCell>
                    <TableCell className="py-2 font-medium">
                      <div className="flex items-center gap-2">
                        <Ship className="h-4 w-4 text-muted-foreground" />
                        {session.vessel?.name || 'Okänt fartyg'}
                      </div>
                    </TableCell>
                    <TableCell className="py-2 text-sm">
                      {session.route?.name || <span className="text-muted-foreground">Ingen rutt</span>}
                    </TableCell>
                    <TableCell className="py-2 text-center">
                      <Badge variant="outline" className="font-mono">
                        {session._count?.entries || 0}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="default" className="text-xs">
                        Aktiv
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
