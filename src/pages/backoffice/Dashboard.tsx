import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Ship, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function BackofficeDashboard() {
  const { data: stats } = useQuery({
    queryKey: ['backoffice-stats'],
    queryFn: async () => {
      const [orgs, members, vessels, logbooks] = await Promise.all([
        supabase.from('organizations').select('id', { count: 'exact' }),
        supabase.from('organization_members').select('id', { count: 'exact' }),
        supabase.from('vessels').select('id', { count: 'exact' }),
        supabase.from('logbooks').select('id', { count: 'exact' }),
      ]);

      return {
        organizations: orgs.count || 0,
        members: members.count || 0,
        vessels: vessels.count || 0,
        logbooks: logbooks.count || 0,
      };
    },
  });

  const { data: recentOrgs } = useQuery({
    queryKey: ['recent-organizations'],
    queryFn: async () => {
      const { data } = await supabase
        .from('organizations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Back Office</h1>
        <p className="text-muted-foreground">Välkommen till SeaLogg administration</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organisationer</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.organizations || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Användare</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.members || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Fartyg</CardTitle>
            <Ship className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.vessels || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Loggböcker</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.logbooks || 0}</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Organizations */}
      <Card>
        <CardHeader>
          <CardTitle>Senaste organisationer</CardTitle>
          <CardDescription>De senast skapade organisationerna</CardDescription>
        </CardHeader>
        <CardContent>
          {recentOrgs && recentOrgs.length > 0 ? (
            <div className="space-y-4">
              {recentOrgs.map((org) => (
                <div key={org.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{org.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {org.org_number || 'Inget org.nr'} • {org.contact_email || 'Ingen e-post'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/backoffice/organizations/${org.id}`}>Visa</Link>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-8">
              Inga organisationer än. <Link to="/backoffice/organizations" className="text-primary hover:underline">Skapa den första!</Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
