import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Ship, Calendar, User, Printer } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { LOGBOOK_STATUS_LABELS } from '@/lib/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';
import { usePrint } from '@/hooks/usePrint';

export default function Dashboard() {
  const { canEdit } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { printContent } = usePrint();

  const { data: logbooks, isLoading } = useQuery({
    queryKey: ['logbooks', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      
      // First get vessels for this org
      const { data: orgVessels, error: vesselError } = await supabase
        .from('vessels')
        .select('id')
        .eq('organization_id', selectedOrgId);
      if (vesselError) throw vesselError;
      
      const vesselIds = orgVessels?.map(v => v.id) || [];
      if (vesselIds.length === 0) return [];
      
      const { data, error } = await supabase
        .from('logbooks')
        .select(`
          *,
          vessel:vessels(*)
        `)
        .in('vessel_id', vesselIds)
        .order('date', { ascending: false })
        .limit(50);
      if (error) throw error;
      
      // Fetch creator profiles separately since created_by references auth.users
      if (data && data.length > 0) {
        const creatorIds = [...new Set(data.map(l => l.created_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', creatorIds);
        
        const profileMap = new Map(profiles?.map(p => [p.user_id, p.full_name]) || []);
        
        return data.map(logbook => ({
          ...logbook,
          creator_name: profileMap.get(logbook.created_by) || 'Okänd'
        }));
      }
      
      return data;
    },
    enabled: !!selectedOrgId,
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Loggböcker</h1>
            <p className="text-muted-foreground mt-1">Hantera och visa fartygsloggböcker</p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => printContent('logbooks-list', { 
                title: 'Loggböcker', 
                subtitle: 'Alla loggböcker'
              })}
            >
              <Printer className="h-4 w-4 mr-2" />
              Skriv ut
            </Button>
            {canEdit && (
              <Button asChild>
                <Link to="/portal/logbook/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Ny loggbok
                </Link>
              </Button>
            )}
          </div>
        </div>

        <div id="logbooks-list">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="h-20 bg-muted" />
                  <CardContent className="h-24" />
                </Card>
              ))}
            </div>
          ) : logbooks?.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Ship className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Inga loggböcker ännu</h3>
                <p className="text-muted-foreground mb-4">Skapa din första loggbok för att komma igång.</p>
                {canEdit && (
                  <Button asChild>
                    <Link to="/portal/logbook/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Skapa loggbok
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left p-2 border-b">Fartyg</th>
                  <th className="text-left p-2 border-b">Datum</th>
                  <th className="text-left p-2 border-b">Rutt</th>
                  <th className="text-left p-2 border-b">Skapad av</th>
                  <th className="text-left p-2 border-b">Status</th>
                </tr>
              </thead>
              <tbody>
                {logbooks?.map((logbook) => (
                  <tr key={logbook.id} className="hover:bg-muted/50 cursor-pointer" onClick={() => window.location.href = `/portal/logbook/${logbook.id}`}>
                    <td className="p-2 border-b font-medium">{(logbook as any).vessel?.name || 'Okänt fartyg'}</td>
                    <td className="p-2 border-b text-muted-foreground text-sm">
                      {format(new Date(logbook.date), 'PPP', { locale: sv })}
                    </td>
                    <td className="p-2 border-b text-sm text-muted-foreground">
                      Se detaljer
                    </td>
                    <td className="p-2 border-b text-sm">{(logbook as any).creator_name || 'Okänd'}</td>
                    <td className="p-2 border-b">
                      <Badge variant={logbook.status === 'oppen' ? 'default' : 'secondary'}>
                        {LOGBOOK_STATUS_LABELS[logbook.status as keyof typeof LOGBOOK_STATUS_LABELS]}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
