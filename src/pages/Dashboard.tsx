import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Plus, Ship, Calendar, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LOGBOOK_STATUS_LABELS } from '@/lib/types';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

export default function Dashboard() {
  const { canEdit } = useAuth();

  const { data: logbooks, isLoading } = useQuery({
    queryKey: ['logbooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('logbooks')
        .select(`
          *,
          vessel:vessels(*)
        `)
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
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Loggböcker</h1>
            <p className="text-muted-foreground mt-1">Hantera och visa fartygsloggböcker</p>
          </div>
          {canEdit && (
            <Button asChild>
              <Link to="/logbook/new">
                <Plus className="h-4 w-4 mr-2" />
                Ny loggbok
              </Link>
            </Button>
          )}
        </div>

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
                  <Link to="/logbook/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Skapa loggbok
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {logbooks?.map((logbook) => (
              <Link key={logbook.id} to={`/logbook/${logbook.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-display">
                        {(logbook as any).vessel?.name || 'Okänt fartyg'}
                      </CardTitle>
                      <Badge variant={logbook.status === 'oppen' ? 'default' : 'secondary'}>
                        {LOGBOOK_STATUS_LABELS[logbook.status as keyof typeof LOGBOOK_STATUS_LABELS]}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(logbook.date), 'PPP', { locale: sv })}
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {(logbook as any).creator_name || 'Okänd'}
                    </div>
                    {logbook.from_location && logbook.to_location && (
                      <p className="truncate">
                        {logbook.from_location} → {logbook.to_location}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
}
