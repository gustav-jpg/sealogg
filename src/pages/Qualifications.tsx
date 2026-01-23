import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Ship, Users, Award, AlertTriangle, FileText, ExternalLink, Filter, Search, ChevronRight } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgVessels } from '@/hooks/useOrgVessels';
import { useOrgProfiles } from '@/hooks/useOrgProfiles';
import { useToast } from '@/hooks/use-toast';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function Qualifications() {
  const { toast } = useToast();
  const { selectedOrgId } = useOrganization();
  const [selectedVesselId, setSelectedVesselId] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [activeTab, setActiveTab] = useState<'vessel' | 'crew'>('vessel');
  const [selectedProfile, setSelectedProfile] = useState<any>(null);

  const { data: vessels } = useOrgVessels(selectedOrgId);
  const { data: profiles } = useOrgProfiles(selectedOrgId);

  // Filter vessel ids for scoped queries
  const vesselIds = vessels?.map(v => v.id) || [];
  const profileIds = profiles?.map(p => p.id) || [];

  const { data: vesselCertificates } = useQuery({
    queryKey: ['vessel-certificates', selectedVesselId, vesselIds],
    queryFn: async () => {
      if (vesselIds.length === 0) return [];
      let query = supabase
        .from('vessel_certificates')
        .select('*, vessel:vessels(name)')
        .order('expiry_date', { ascending: true });
      
      if (selectedVesselId !== 'all') {
        query = query.eq('vessel_id', selectedVesselId);
      } else {
        query = query.in('vessel_id', vesselIds);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: vesselIds.length > 0,
  });

  const { data: userCertificates } = useQuery({
    queryKey: ['user-certificates-org', profileIds],
    queryFn: async () => {
      if (profileIds.length === 0) return [];
      const { data, error } = await supabase
        .from('user_certificates')
        .select('*, certificate_type:certificate_types(*), profile:profiles(*)')
        .in('profile_id', profileIds)
        .order('expiry_date', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: profileIds.length > 0,
  });

  const { data: inductions } = useQuery({
    queryKey: ['user-inductions-org', profileIds, vesselIds],
    queryFn: async () => {
      if (profileIds.length === 0 || vesselIds.length === 0) return [];
      const { data, error } = await supabase
        .from('user_vessel_inductions')
        .select('*, vessel:vessels(*), profile:profiles(*)')
        .in('profile_id', profileIds)
        .in('vessel_id', vesselIds);
      if (error) throw error;
      return data;
    },
    enabled: profileIds.length > 0 && vesselIds.length > 0,
  });

  const today = new Date().toISOString().split('T')[0];
  const warningDate = new Date();
  warningDate.setMonth(warningDate.getMonth() + 2);
  const warningDateStr = warningDate.toISOString().split('T')[0];

  const getCertificateStatus = (expiryDate: string | null, isIndefinite?: boolean) => {
    if (isIndefinite || !expiryDate) return 'valid';
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

  const handleViewFile = async (fileUrl: string | null | undefined, bucket: string) => {
    if (!fileUrl || fileUrl.trim() === '') {
      toast({ title: 'Fel', description: 'Inget dokument finns uppladdat', variant: 'destructive' });
      return;
    }

    try {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(fileUrl, 300);

      if (error || !data?.signedUrl) {
        throw new Error('Kunde inte skapa länk till dokumentet');
      }

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const fullUrl = data.signedUrl.startsWith('http')
        ? data.signedUrl
        : `${supabaseUrl}/storage/v1${data.signedUrl}`;

      window.open(fullUrl, '_blank');
    } catch (error: any) {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    }
  };

  // Filter profiles by search text
  const searchFilteredProfiles = profiles?.filter(p => 
    p.full_name.toLowerCase().includes(searchText.toLowerCase())
  );

  // Get profile status summary
  const getProfileStatus = (profileId: string) => {
    const profileCerts = userCertificates?.filter(c => c.profile_id === profileId) || [];
    const hasExpired = profileCerts.some(c => getCertificateStatus(c.expiry_date) === 'expired');
    const hasExpiring = profileCerts.some(c => getCertificateStatus(c.expiry_date) === 'expiring');
    
    if (hasExpired) return 'expired';
    if (hasExpiring) return 'expiring';
    if (profileCerts.length === 0) return 'none';
    return 'valid';
  };

  const getProfileStatusBadge = (status: string) => {
    switch (status) {
      case 'expired':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Utgånget</Badge>;
      case 'expiring':
        return <Badge variant="secondary" className="gap-1 bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"><AlertTriangle className="h-3 w-3" />Går ut snart</Badge>;
      case 'none':
        return <Badge variant="outline" className="text-muted-foreground">Inga certifikat</Badge>;
      default:
        return <Badge variant="outline" className="text-green-600">OK</Badge>;
    }
  };

  // Get selected profile data
  const selectedProfileCerts = selectedProfile 
    ? userCertificates?.filter(c => c.profile_id === selectedProfile.id) || []
    : [];
  const selectedProfileInductions = selectedProfile
    ? inductions?.filter(i => i.profile_id === selectedProfile.id) || []
    : [];

  return (
    <MainLayout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-xl md:text-3xl font-display font-bold">Certifikat</h1>
          <p className="text-muted-foreground text-sm mt-1">Översikt över fartygs- och besättningscertifikat</p>
        </div>

        {/* Filter */}
        <Card>
          <CardHeader className="py-3 md:py-4">
            <CardTitle className="text-sm md:text-base flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid gap-2 md:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {activeTab === 'vessel' && (
                <Select value={selectedVesselId} onValueChange={setSelectedVesselId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Alla fartyg" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alla fartyg</SelectItem>
                    {vessels?.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {activeTab === 'crew' && (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Sök på namn..."
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'vessel' | 'crew')} className="space-y-4">
          <TabsList className="w-full sm:w-auto grid grid-cols-2 sm:flex">
            <TabsTrigger value="vessel" className="gap-2 text-xs sm:text-sm">
              <Ship className="h-4 w-4" />
              <span className="hidden sm:inline">Fartygscertifikat</span>
              <span className="sm:hidden">Fartyg</span>
            </TabsTrigger>
            <TabsTrigger value="crew" className="gap-2 text-xs sm:text-sm">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Besättningscertifikat</span>
              <span className="sm:hidden">Besättning</span>
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
              <>
                {/* Mobile card view */}
                <div className="space-y-2 md:hidden">
                  {vesselCertificates?.map(cert => {
                    const isIndefinite = cert.is_indefinite === true;
                    const status = getCertificateStatus(cert.expiry_date, isIndefinite);
                    
                    return (
                      <Card 
                        key={cert.id}
                        className={status === 'expired' ? 'border-destructive/50 bg-destructive/5' : status === 'expiring' ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20' : ''}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm">{cert.name}</p>
                              <p className="text-xs text-muted-foreground">{(cert.vessel as any)?.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {isIndefinite ? (
                                  <span className="text-green-600 text-xs">Tillsvidare</span>
                                ) : cert.expiry_date ? (
                                  <span className="text-xs text-muted-foreground">{format(new Date(cert.expiry_date), 'yyyy-MM-dd')}</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {getStatusBadge(status)}
                              {cert.file_url && (
                                <Button 
                                  variant="ghost" 
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleViewFile(cert.file_url!, 'vessel-certificates')}
                                >
                                  <FileText className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Desktop table view */}
                <Card className="hidden md:block">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Certifikat</TableHead>
                          <TableHead>Fartyg</TableHead>
                          <TableHead>Utgår</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {vesselCertificates?.map(cert => {
                          const isIndefinite = cert.is_indefinite === true;
                          const status = getCertificateStatus(cert.expiry_date, isIndefinite);
                          const daysUntilExpiry = cert.expiry_date ? differenceInDays(new Date(cert.expiry_date), new Date()) : null;
                          
                          return (
                            <TableRow 
                              key={cert.id} 
                              className={status === 'expired' ? 'bg-destructive/5' : status === 'expiring' ? 'bg-amber-50 dark:bg-amber-950/20' : ''}
                            >
                              <TableCell>
                                <div>
                                  <p className="font-medium">{cert.name}</p>
                                  {cert.description && (
                                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{cert.description}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {(cert.vessel as any)?.name}
                              </TableCell>
                              <TableCell>
                                {isIndefinite ? (
                                  <span className="text-green-600 dark:text-green-400 text-sm">Tillsvidare</span>
                                ) : cert.expiry_date ? (
                                  <div className="text-sm">
                                    <span>{format(new Date(cert.expiry_date), 'yyyy-MM-dd')}</span>
                                    {status !== 'expired' && daysUntilExpiry !== null && (
                                      <span className="text-muted-foreground text-xs ml-1">({daysUntilExpiry}d)</span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-sm">–</span>
                                )}
                              </TableCell>
                              <TableCell>{getStatusBadge(status)}</TableCell>
                              <TableCell>
                                {cert.file_url && (
                                  <Button 
                                    variant="ghost" 
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleViewFile(cert.file_url!, 'vessel-certificates')}
                                  >
                                    <FileText className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="crew" className="space-y-4">
            {searchFilteredProfiles?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>{searchText ? 'Inga resultat matchade sökningen' : 'Ingen besättning registrerad'}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="space-y-2 md:hidden">
                  {searchFilteredProfiles?.map(profile => {
                    const status = getProfileStatus(profile.id);
                    return (
                      <Card 
                        key={profile.id}
                        className={`cursor-pointer active:bg-accent/50 transition-colors ${status === 'expired' ? 'border-destructive/50 bg-destructive/5' : status === 'expiring' ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20' : ''}`}
                        onClick={() => setSelectedProfile(profile)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {status === 'expired' && <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />}
                              {status === 'expiring' && <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                              <span className="font-medium text-sm truncate">{profile.full_name}</span>
                              {profile.is_external && <Badge variant="outline" className="text-xs">Extern</Badge>}
                            </div>
                            <div className="flex items-center gap-2">
                              {getProfileStatusBadge(status)}
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Desktop table view */}
                <Card className="hidden md:block">
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Namn</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-12"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {searchFilteredProfiles?.map(profile => {
                          const status = getProfileStatus(profile.id);
                          return (
                            <TableRow 
                              key={profile.id} 
                              className={`cursor-pointer hover:bg-muted/50 ${status === 'expired' ? 'bg-destructive/5' : status === 'expiring' ? 'bg-amber-50 dark:bg-amber-950/20' : ''}`}
                              onClick={() => setSelectedProfile(profile)}
                            >
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  {status === 'expired' && <AlertTriangle className="h-4 w-4 text-destructive" />}
                                  {status === 'expiring' && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                                  <span>{profile.full_name}</span>
                                  {profile.is_external && <Badge variant="outline" className="text-xs">Extern</Badge>}
                                </div>
                              </TableCell>
                              <TableCell>{getProfileStatusBadge(status)}</TableCell>
                              <TableCell>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Profile Detail Dialog */}
      <Dialog open={!!selectedProfile} onOpenChange={(open) => !open && setSelectedProfile(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedProfile?.full_name}
              {selectedProfile?.is_external && <Badge variant="outline" className="text-xs">Extern</Badge>}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Certificates */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Award className="h-4 w-4" />
                Certifikat
              </h4>
              {selectedProfileCerts.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga certifikat registrerade</p>
              ) : (
                <div className="space-y-2">
                  {selectedProfileCerts.map(cert => {
                    const status = getCertificateStatus(cert.expiry_date);
                    return (
                      <div 
                        key={cert.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border ${status === 'expired' ? 'border-destructive/50 bg-destructive/5' : status === 'expiring' ? 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/20' : 'bg-muted/30'}`}
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">{(cert.certificate_type as any)?.name}</p>
                          <p className="text-xs text-muted-foreground">
                            Utgår: {format(new Date(cert.expiry_date), 'yyyy-MM-dd')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {getStatusBadge(status)}
                          {cert.file_url && (
                            <Button 
                              variant="ghost" 
                              size="icon"
                              className="h-8 w-8"
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

            {/* Inductions */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Ship className="h-4 w-4" />
                Inskolningar
              </h4>
              {selectedProfileInductions.length === 0 ? (
                <p className="text-sm text-muted-foreground">Inga inskolningar registrerade</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {selectedProfileInductions.map(ind => (
                    <Badge key={ind.id} variant="secondary" className="gap-1">
                      {(ind.vessel as any)?.name}
                      <span className="text-muted-foreground text-xs">
                        ({format(new Date(ind.inducted_at), 'yyyy-MM-dd')})
                      </span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
