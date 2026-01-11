import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { AlertTriangle, Wrench, Award, Ship, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { format, addDays, differenceInDays } from 'date-fns';
import { sv } from 'date-fns/locale';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgVessels } from '@/hooks/useOrgVessels';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';

const FAULT_PRIORITY_LABELS: Record<string, string> = {
  lag: 'Låg',
  normal: 'Normal',
  hog: 'Hög',
  kritisk: 'Kritisk',
};

const FAULT_STATUS_LABELS: Record<string, string> = {
  ny: 'Ny',
  varvsatgard: 'Varvsåtgärd',
  arbete_pagar: 'Arbete pågår',
  atgardad: 'Åtgärdad',
  avslutad: 'Avslutad',
};

const CONTROL_STATUS_LABELS: Record<string, string> = {
  ok: 'OK',
  kommande: 'Kommande',
  forfallen: 'Förfallen',
};

export default function AdminStatus() {
  const { selectedOrgId } = useOrganization();
  const { data: vessels } = useOrgVessels(selectedOrgId);
  const { data: profiles } = useOrgProfiles(selectedOrgId);

  const vesselIds = vessels?.map(v => v.id) || [];
  const profileIds = profiles?.map(p => p.id) || [];

  const cutoffDate = addDays(new Date(), 60);
  const today = new Date();

  // Fetch open fault cases - scoped to org vessels
  const { data: faultCases } = useQuery({
    queryKey: ['status-fault-cases', vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('fault_cases')
        .select(`*, vessel:vessels(name)`)
        .in('vessel_id', vesselIds)
        .in('status', ['ny', 'varvsatgard', 'arbete_pagar'])
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: vesselIds.length > 0,
  });

  // Fetch control point states - scoped to org vessels
  const { data: controlStates } = useQuery({
    queryKey: ['status-control-states', vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('vessel_control_point_state')
        .select(`*, control_point:control_points(name, type), vessel:vessels(name)`)
        .in('vessel_id', vesselIds)
        .in('status', ['kommande', 'forfallen'])
        .order('next_due_date', { ascending: true });
      if (error) throw error;
      return data?.filter(s => {
        if (!s.next_due_date) return true;
        return new Date(s.next_due_date) <= cutoffDate;
      });
    },
    enabled: vesselIds.length > 0,
  });

  // Fetch vessel certificates - scoped to org vessels
  const { data: vesselCertificates } = useQuery({
    queryKey: ['status-vessel-certificates', vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('vessel_certificates')
        .select(`*, vessel:vessels(name)`)
        .in('vessel_id', vesselIds)
        .lte('expiry_date', cutoffDate.toISOString().split('T')[0])
        .gte('expiry_date', today.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: vesselIds.length > 0,
  });

  // Fetch user certificates - scoped to org profiles
  const { data: userCertificates } = useQuery({
    queryKey: ['status-user-certificates', profileIds],
    queryFn: async () => {
      if (profileIds.length === 0) return [];
      const { data, error } = await supabase
        .from('user_certificates')
        .select(`*, profile:profiles(full_name), certificate_type:certificate_types(name)`)
        .in('profile_id', profileIds)
        .lte('expiry_date', cutoffDate.toISOString().split('T')[0])
        .gte('expiry_date', today.toISOString().split('T')[0])
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: profileIds.length > 0,
  });

  // Fetch open deviations - scoped to org vessels
  const { data: deviations } = useQuery({
    queryKey: ['status-deviations', vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('deviations')
        .select(`*, vessel:vessels(name)`)
        .in('vessel_id', vesselIds)
        .in('status', ['oppen', 'under_utredning'])
        .order('severity', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: vesselIds.length > 0,
  });

  const getDaysUntil = (dateStr: string) => {
    const days = differenceInDays(new Date(dateStr), today);
    if (days < 0) return 'Förfallen';
    if (days === 0) return 'Idag';
    if (days === 1) return 'Imorgon';
    return `${days} dagar`;
  };

  const getUrgencyBadge = (dateStr: string) => {
    const days = differenceInDays(new Date(dateStr), today);
    if (days < 0) return 'destructive';
    if (days <= 7) return 'destructive';
    if (days <= 30) return 'default';
    return 'secondary';
  };

  const totalIssues = 
    (faultCases?.length || 0) + 
    (controlStates?.length || 0) + 
    (vesselCertificates?.length || 0) + 
    (userCertificates?.length || 0) + 
    (deviations?.length || 0);

  return (
    <MainLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-display font-bold">Statusöversikt</h1>
          <p className="text-muted-foreground mt-1">
            Kommande ärenden inom 60 dagar • {totalIssues} ärenden kräver uppmärksamhet
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/10 rounded-lg">
                  <Wrench className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{faultCases?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Felärenden</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/10 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{controlStates?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Egenkontroll</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Ship className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{vesselCertificates?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Fartygscertifikat</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Award className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{userCertificates?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Personliga certifikat</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-500/10 rounded-lg">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{deviations?.length || 0}</p>
                  <p className="text-xs text-muted-foreground">Avvikelser</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Fault Cases */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="h-5 w-5" />
                Öppna felärenden
              </CardTitle>
            </CardHeader>
            <CardContent>
              {faultCases?.length === 0 ? (
                <p className="text-muted-foreground text-sm">Inga öppna felärenden</p>
              ) : (
                <div className="space-y-3">
                  {faultCases?.slice(0, 10).map((fc) => (
                    <Link
                      key={fc.id}
                      to={`/portal/fault-cases/${fc.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{fc.title}</p>
                        <p className="text-sm text-muted-foreground">{(fc as any).vessel?.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={fc.priority === 'kritisk' || fc.priority === 'hog' ? 'destructive' : 'secondary'}>
                          {FAULT_PRIORITY_LABELS[fc.priority]}
                        </Badge>
                        <Badge variant="outline">
                          {FAULT_STATUS_LABELS[fc.status]}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                  {(faultCases?.length || 0) > 10 && (
                    <Link to="/portal/fault-cases" className="block text-sm text-primary hover:underline text-center pt-2">
                      Visa alla {faultCases?.length} felärenden →
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Control Points */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5" />
                Kommande egenkontroller
              </CardTitle>
            </CardHeader>
            <CardContent>
              {controlStates?.length === 0 ? (
                <p className="text-muted-foreground text-sm">Inga kommande egenkontroller</p>
              ) : (
                <div className="space-y-3">
                  {controlStates?.slice(0, 10).map((cs) => (
                    <Link
                      key={cs.id}
                      to="/portal/self-control"
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{(cs as any).control_point?.name}</p>
                        <p className="text-sm text-muted-foreground">{(cs as any).vessel?.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={cs.status === 'forfallen' ? 'destructive' : 'default'}>
                          {CONTROL_STATUS_LABELS[cs.status]}
                        </Badge>
                        {cs.next_due_date && (
                          <Badge variant={getUrgencyBadge(cs.next_due_date)}>
                            {getDaysUntil(cs.next_due_date)}
                          </Badge>
                        )}
                      </div>
                    </Link>
                  ))}
                  {(controlStates?.length || 0) > 10 && (
                    <Link to="/portal/self-control" className="block text-sm text-primary hover:underline text-center pt-2">
                      Visa alla {controlStates?.length} kontroller →
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Vessel Certificates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-5 w-5" />
                Fartygscertifikat som löper ut
              </CardTitle>
            </CardHeader>
            <CardContent>
              {vesselCertificates?.length === 0 ? (
                <p className="text-muted-foreground text-sm">Inga certifikat löper ut inom 60 dagar</p>
              ) : (
                <div className="space-y-3">
                  {vesselCertificates?.map((vc) => (
                    <div
                      key={vc.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{vc.name}</p>
                        <p className="text-sm text-muted-foreground">{(vc as any).vessel?.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={getUrgencyBadge(vc.expiry_date)}>
                          {getDaysUntil(vc.expiry_date)}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* User Certificates */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Award className="h-5 w-5" />
                Personliga certifikat som löper ut
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userCertificates?.length === 0 ? (
                <p className="text-muted-foreground text-sm">Inga certifikat löper ut inom 60 dagar</p>
              ) : (
                <div className="space-y-3">
                  {userCertificates?.map((uc) => (
                    <Link
                      key={uc.id}
                      to="/portal/qualifications"
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{(uc as any).certificate_type?.name}</p>
                        <p className="text-sm text-muted-foreground">{(uc as any).profile?.full_name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <Badge variant={getUrgencyBadge(uc.expiry_date)}>
                          {getDaysUntil(uc.expiry_date)}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Deviations */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                Öppna avvikelser
              </CardTitle>
            </CardHeader>
            <CardContent>
              {deviations?.length === 0 ? (
                <p className="text-muted-foreground text-sm">Inga öppna avvikelser</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {deviations?.slice(0, 10).map((d) => (
                    <Link
                      key={d.id}
                      to={`/portal/deviations/${d.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{d.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {(d as any).vessel?.name} • {format(new Date(d.date), 'PP', { locale: sv })}
                        </p>
                      </div>
                      <Badge variant={d.severity === 'hog' ? 'destructive' : d.severity === 'medel' ? 'default' : 'secondary'}>
                        {d.severity === 'hog' ? 'Hög' : d.severity === 'medel' ? 'Medel' : 'Låg'}
                      </Badge>
                    </Link>
                  ))}
                  {(deviations?.length || 0) > 10 && (
                    <Link to="/portal/deviations" className="block text-sm text-primary hover:underline text-center pt-2 md:col-span-2">
                      Visa alla {deviations?.length} avvikelser →
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
}
