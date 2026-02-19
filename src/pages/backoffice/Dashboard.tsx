import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, Users, Ship, FileText, Eye, TrendingUp, Clock, Globe } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { sv } from 'date-fns/locale';

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

  // Fetch aggregated page view stats via RPC (no 1000-row limit)
  const { data: analytics } = useQuery({
    queryKey: ['page-view-stats-rpc'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_page_view_stats');
      if (error) throw error;
      const stats = data as any;
      return {
        totalViews: stats?.total_views || 0,
        todayViews: stats?.today_views || 0,
        weekViews: stats?.week_views || 0,
        todaySessions: stats?.today_sessions || 0,
        weekSessions: stats?.week_sessions || 0,
        todayUsers: stats?.today_users || 0,
        weekUsers: stats?.week_users || 0,
        topPages: (stats?.top_pages || []).map((p: any) => [p.path, p.count] as [string, number]),
        dailyData: (stats?.daily || []).map((d: any) => ({
          date: format(new Date(d.day), 'EEE', { locale: sv }),
          views: d.views,
          sessions: d.sessions,
        })),
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Back Office</h1>
        <p className="text-muted-foreground">Välkommen till SeaLogg administration</p>
      </div>

      {/* Analytics Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Eye className="h-5 w-5" />
          Besöksstatistik
        </h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Idag</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.todayViews || 0}</div>
              <p className="text-xs text-muted-foreground">
                {analytics?.todaySessions || 0} unika sessioner
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Senaste 7 dagar</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.weekViews || 0}</div>
              <p className="text-xs text-muted-foreground">
                {analytics?.weekSessions || 0} unika sessioner
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inloggade idag</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.todayUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                {analytics?.weekUsers || 0} senaste veckan
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Totalt (30 dagar)</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics?.totalViews || 0}</div>
              <p className="text-xs text-muted-foreground">sidvisningar</p>
            </CardContent>
          </Card>
        </div>

        {/* Daily breakdown */}
        {analytics?.dailyData && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Sidvisningar per dag (senaste 7 dagar)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-32">
                {analytics.dailyData.map((day, i) => {
                  const maxViews = Math.max(...analytics.dailyData.map(d => d.views), 1);
                  const height = (day.views / maxViews) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs font-medium">{day.views}</span>
                      <div
                        className="w-full bg-primary/80 rounded-t transition-all"
                        style={{ height: `${Math.max(height, 4)}%` }}
                      />
                      <span className="text-xs text-muted-foreground">{day.date}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top pages */}
        {analytics?.topPages && analytics.topPages.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Mest besökta sidor (7 dagar)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {analytics.topPages.map(([path, count]) => (
                  <div key={path} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-muted-foreground truncate max-w-[300px]">{path}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
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
