import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ship, Users, Award, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

export default function Qualifications() {
  const [selectedVesselId, setSelectedVesselId] = useState<string>('all');

  const { data: vessels } = useQuery({
    queryKey: ['vessels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('vessels').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: vesselCertificates } = useQuery({
    queryKey: ['vessel-certificates', selectedVesselId],
    queryFn: async () => {
      let query = supabase
        .from('vessel_certificates')
        .select('*, vessel:vessels(name)')
        .order('expiry_date', { ascending: true });
      
      if (selectedVesselId !== 'all') {
        query = query.eq('vessel_id', selectedVesselId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').order('full_name');
      if (error) throw error;
      return data;
    },
  });

  const { data: userCertificates } = useQuery({
    queryKey: ['user-certificates-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_certificates')
        .select('*, certificate_type:certificate_types(*), profile:profiles(*)')
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: inductions } = useQuery({
    queryKey: ['user-inductions-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_vessel_inductions')
        .select('*, vessel:vessels(*), profile:profiles(*)');
      if (error) throw error;
      return data;
    },
  });

  const today = new Date().toISOString().split('T')[0];
  const warningDate = new Date();
  warningDate.setMonth(warningDate.getMonth() + 2);
  const warningDateStr = warningDate.toISOString().split('T')[0];

  const getCertificateStatus = (expiryDate: string) => {
    if (expiryDate < today) return 'expired';
    if (expiryDate <= warningDateStr) return 'expiring';
    return 'valid';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'expired':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Utgånget</Badge>;
      case 'expiring':
        return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"><AlertTriangle className="h-3 w-3" />Går ut snart</Badge>;
      default:
        return <Badge variant="outline" className="text-green-600">Giltigt</Badge>;
    }
  };

  const handleViewFile = async (fileUrl: string, bucket: string) => {
    const { data } = await supabase.storage.from(bucket).createSignedUrl(fileUrl, 3600);
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank');
    }
  };

  // Filter user certificates by vessel inductions if a vessel is selected
  const filteredUserCertificates = selectedVesselId === 'all' 
    ? userCertificates 
    : userCertificates?.filter(cert => {
        const profileInductions = inductions?.filter(i => i.profile_id === cert.profile_id);
        return profileInductions?.some(i => i.vessel_id === selectedVesselId);
      });

  // Get profiles that have inductions for selected vessel
  const relevantProfiles = selectedVesselId === 'all'
    ? profiles
    : profiles?.filter(p => inductions?.some(i => i.profile_id === p.id && i.vessel_id === selectedVesselId));

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-display font-bold">Behörigheter & Certifikat</h1>
            <p className="text-muted-foreground mt-1">Översikt över fartygs- och besättningscertifikat</p>
          </div>
          
          <div className="w-full sm:w-64">
            <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrera på fartyg" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alla fartyg</SelectItem>
                {vessels?.map(v => (
                  <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs defaultValue="vessel" className="space-y-4">
          <TabsList>
            <TabsTrigger value="vessel" className="gap-2">
              <Ship className="h-4 w-4" />
              Fartygscertifikat
            </TabsTrigger>
            <TabsTrigger value="crew" className="gap-2">
              <Users className="h-4 w-4" />
              Besättningscertifikat
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vessel" className="space-y-4">
            {vesselCertificates?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Ship className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Inga fartygscertifikat registrerade</p>
                  <p className="text-sm mt-1">Admin kan lägga till certifikat under Fartyg</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {vesselCertificates?.map(cert => {
                  const status = getCertificateStatus(cert.expiry_date);
                  const daysUntilExpiry = differenceInDays(new Date(cert.expiry_date), new Date());
                  
                  return (
                    <Card key={cert.id} className={status === 'expired' ? 'border-destructive/50' : status === 'expiring' ? 'border-amber-500/50' : ''}>
                      <CardContent className="py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h3 className="font-semibold">{cert.name}</h3>
                              {getStatusBadge(status)}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {(cert.vessel as any)?.name} • Utgår: {format(new Date(cert.expiry_date), 'yyyy-MM-dd')}
                              {status !== 'expired' && (
                                <span className="ml-2">({daysUntilExpiry} dagar kvar)</span>
                              )}
                            </p>
                            {cert.description && (
                              <p className="text-sm text-muted-foreground mt-1">{cert.description}</p>
                            )}
                          </div>
                          {cert.file_url && (
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => handleViewFile(cert.file_url!, 'vessel-certificates')}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Visa dokument
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="crew" className="space-y-4">
            {relevantProfiles?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Ingen besättning registrerad</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {relevantProfiles?.map(profile => {
                  const profileCerts = filteredUserCertificates?.filter(c => c.profile_id === profile.id) || [];
                  const profileInductions = inductions?.filter(i => i.profile_id === profile.id) || [];
                  
                  const hasExpired = profileCerts.some(c => getCertificateStatus(c.expiry_date) === 'expired');
                  const hasExpiring = profileCerts.some(c => getCertificateStatus(c.expiry_date) === 'expiring');
                  
                  return (
                    <Card key={profile.id} className={hasExpired ? 'border-destructive/50' : hasExpiring ? 'border-amber-500/50' : ''}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                          {profile.full_name}
                          {profile.is_external && <Badge variant="outline" className="text-xs">Extern</Badge>}
                          {hasExpired && <Badge variant="destructive" className="text-xs gap-1"><AlertTriangle className="h-3 w-3" />Utgånget certifikat</Badge>}
                          {!hasExpired && hasExpiring && <Badge variant="secondary" className="text-xs gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"><AlertTriangle className="h-3 w-3" />Certifikat går ut snart</Badge>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* Certifikat */}
                        <div>
                          <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                            <Award className="h-4 w-4" />
                            Certifikat ({profileCerts.length})
                          </h4>
                          {profileCerts.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Inga certifikat registrerade</p>
                          ) : (
                            <div className="space-y-2">
                              {profileCerts.map(cert => {
                                const status = getCertificateStatus(cert.expiry_date);
                                return (
                                  <div key={cert.id} className="flex items-center justify-between p-2 rounded bg-muted/50 gap-2 flex-wrap">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="font-medium">{(cert.certificate_type as any)?.name}</span>
                                      {getStatusBadge(status)}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm text-muted-foreground">
                                        {format(new Date(cert.expiry_date), 'yyyy-MM-dd')}
                                      </span>
                                      {cert.file_url && (
                                        <Button 
                                          variant="ghost" 
                                          size="sm"
                                          onClick={() => handleViewFile(cert.file_url!, 'certificates')}
                                        >
                                          <FileText className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                        
                        {/* Inskolningar */}
                        <div>
                          <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                            <Ship className="h-4 w-4" />
                            Inskolningar ({profileInductions.length})
                          </h4>
                          {profileInductions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Inga inskolningar registrerade</p>
                          ) : (
                            <div className="flex flex-wrap gap-2">
                              {profileInductions.map(ind => (
                                <Badge key={ind.id} variant="secondary">
                                  {(ind.vessel as any)?.name}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
