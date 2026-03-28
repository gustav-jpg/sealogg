import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Check, X, Eye, Loader2, UserPlus, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  selectedOrgId: string | null;
}

export function PendingRegistrations({ selectedOrgId }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<string>('deckhand');

  const { data: pendingRegs, isLoading } = useQuery({
    queryKey: ['pending-registrations', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data: regs, error } = await supabase
        .from('pending_registrations')
        .select('*')
        .eq('organization_id', selectedOrgId!)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch profile info for each registration
      if (!regs || regs.length === 0) return [];
      const userIds = regs.map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return regs.map((r: any) => ({ ...r, profile: profileMap.get(r.user_id) || null }));
    },
  });

  const { data: certificates } = useQuery({
    queryKey: ['pending-certificates', selectedRegistration?.id],
    enabled: !!selectedRegistration?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_certificates')
        .select('*')
        .eq('registration_id', selectedRegistration.id)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ registrationId, role }: { registrationId: string; role: string }) => {
      const reg = pendingRegs?.find((r: any) => r.id === registrationId);
      if (!reg) throw new Error('Registration not found');

      // 1. Update pending_registration status
      const { error: updateError } = await supabase
        .from('pending_registrations')
        .update({
          status: 'approved' as any,
          approved_by: user?.id,
          approved_at: new Date().toISOString(),
          assigned_role: role as any,
        })
        .eq('id', registrationId);
      if (updateError) throw updateError;

      // 2. Add as organization member
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          user_id: reg.user_id,
          organization_id: selectedOrgId!,
          role: role as any,
        });
      if (memberError) throw memberError;

      // 3. Create user_certificates from confirmed pending_certificates
      // Get profile_id for the user
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', reg.user_id)
        .single();

      if (profile && certificates && certificates.length > 0) {
        const certInserts = certificates
          .filter((c: any) => c.confirmed_type_id || c.ai_suggested_type)
          .map((c: any) => ({
            profile_id: profile.id,
            certificate_type_id: c.confirmed_type_id,
            expiry_date: c.confirmed_expiry || c.ai_suggested_expiry,
          }))
          .filter((c: any) => c.certificate_type_id && c.expiry_date);

        if (certInserts.length > 0) {
          await supabase.from('user_certificates').insert(certInserts);
        }
      }
    },
    onSuccess: () => {
      toast({ title: 'Godkänd', description: 'Användaren har godkänts och lagts till i organisationen.' });
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      queryClient.invalidateQueries({ queryKey: ['org-profiles'] });
      setSelectedRegistration(null);
    },
    onError: (e) => {
      toast({ variant: 'destructive', title: 'Fel', description: e.message });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from('pending_registrations')
        .update({ status: 'rejected' as any, approved_by: user?.id, approved_at: new Date().toISOString() })
        .eq('id', registrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'Avvisad', description: 'Registreringen har avvisats.' });
      queryClient.invalidateQueries({ queryKey: ['pending-registrations'] });
      setSelectedRegistration(null);
    },
    onError: (e) => {
      toast({ variant: 'destructive', title: 'Fel', description: e.message });
    },
  });

  if (!selectedOrgId) return null;

  const pendingCount = pendingRegs?.length || 0;

  return (
    <div className="space-y-4">
      {pendingCount === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <UserPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Inga väntande registreringar</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Väntande registreringar
              <Badge variant="secondary">{pendingCount}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Namn</TableHead>
                  <TableHead>E-post</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead className="text-right">Åtgärd</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRegs?.map((reg: any) => (
                  <TableRow key={reg.id}>
                    <TableCell className="font-medium">{reg.profile?.full_name || 'Okänd'}</TableCell>
                    <TableCell>{reg.profile?.email || '—'}</TableCell>
                    <TableCell>{format(new Date(reg.created_at), 'yyyy-MM-dd')}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setSelectedRegistration(reg)}>
                        <Eye className="h-4 w-4 mr-1" />
                        Granska
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Review dialog */}
      <Dialog open={!!selectedRegistration} onOpenChange={(open) => !open && setSelectedRegistration(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Granska registrering</DialogTitle>
          </DialogHeader>

          {selectedRegistration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Namn:</span>
                  <p className="font-medium">{(selectedRegistration as any).profiles?.full_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">E-post:</span>
                  <p className="font-medium">{(selectedRegistration as any).profiles?.email}</p>
                </div>
              </div>

              {/* Certificates */}
              <div>
                <h4 className="font-medium mb-2">Uppladdade certifikat</h4>
                {certificates && certificates.length > 0 ? (
                  <div className="space-y-3">
                    {certificates.map((cert: any) => (
                      <CertificateReviewCard key={cert.id} cert={cert} />
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Inga certifikat uppladdade.</p>
                )}
              </div>

              {/* Role selection */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Tilldela roll</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org_admin">Administratör</SelectItem>
                    <SelectItem value="org_user">Skeppare</SelectItem>
                    <SelectItem value="deckhand">Däcksman</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => approveMutation.mutate({ registrationId: selectedRegistration.id, role: selectedRole })}
                  disabled={approveMutation.isPending}
                >
                  {approveMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Godkänn
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => rejectMutation.mutate(selectedRegistration.id)}
                  disabled={rejectMutation.isPending}
                >
                  {rejectMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <X className="mr-2 h-4 w-4" />}
                  Avvisa
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CertificateReviewCard({ cert }: { cert: any }) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);

  const loadImage = async () => {
    if (imageUrl) {
      setShowImage(true);
      return;
    }
    const { data } = await supabase.storage
      .from('registration-certificates')
      .createSignedUrl(cert.file_url, 300);
    if (data?.signedUrl) {
      setImageUrl(data.signedUrl);
      setShowImage(true);
    }
  };

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{cert.ai_suggested_type || 'Okänt certifikat'}</p>
          {cert.ai_suggested_expiry && (
            <p className="text-xs text-muted-foreground">Utgår: {cert.ai_suggested_expiry}</p>
          )}
          {cert.ai_confidence != null && (
            <Badge variant="outline" className="text-xs mt-1">
              AI: {Math.round(cert.ai_confidence * 100)}% säkerhet
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={loadImage}>
          <Eye className="h-4 w-4 mr-1" />
          Visa
        </Button>
      </div>
      {showImage && imageUrl && (
        <img src={imageUrl} alt="Certifikat" className="w-full rounded border" />
      )}
    </div>
  );
}
