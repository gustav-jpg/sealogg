import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Ship, Users, ArrowRight } from "lucide-react";
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
  const { user } = useAuth();

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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Passagerarregistrering</h1>
          <p className="text-muted-foreground">
            Aktiva registreringssessioner för din organisation
          </p>
        </div>

        {activeSessions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">Inga aktiva sessioner</h3>
              <p className="text-muted-foreground mb-4">
                Aktivera passagerarregistrering från en öppen loggbok för att börja registrera passagerare.
              </p>
              <Button variant="outline" onClick={() => navigate('/portal/logbooks')}>
                Gå till loggböcker
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeSessions.map((session) => (
              <Card 
                key={session.id} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => navigate(`/portal/passagerare/${session.id}`)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2">
                    <Ship className="h-5 w-5" />
                    {session.vessel?.name || 'Okänt fartyg'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    <div>Datum: {session.logbook?.date ? format(new Date(session.logbook.date), 'd MMMM yyyy', { locale: sv }) : '-'}</div>
                    <div>Rutt: {session.route?.name || 'Ingen rutt vald'}</div>
                    <div>Registreringar: {session._count?.entries || 0}</div>
                  </div>
                  <Button className="w-full" size="sm">
                    Öppna <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
