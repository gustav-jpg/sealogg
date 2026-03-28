import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Check, X, Eye, Loader2, UserPlus, Clock, FileText, Pencil } from 'lucide-react';
import { format } from 'date-fns';

interface Props {
  selectedOrgId: string | null;
}

interface CertType {
  id: string;
  name: string;
}

export function PendingRegistrations({ selectedOrgId }: Props) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedRegistration, setSelectedRegistration] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<string>('deckhand');
  const [certTypes, setCertTypes] = useState<CertType[]>([]);
  // Track admin edits: certId -> { typeId, expiry }
  const [certEdits, setCertEdits] = useState<Record<string, { typeId: string | null; expiry: string | null }>>({});

  // Load cert types when org changes
  useEffect(() => {
    if (!selectedOrgId) return;
    supabase
      .from('certificate_types')
      .select('id, name')
      .eq('organization_id', selectedOrgId)
      .order('name')
      .then(({ data }) => {
        if (data) setCertTypes(data);
      });
  }, [selectedOrgId]);

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

  // Initialize edits from certificate data when certificates load
  useEffect(() => {
    if (!certificates) return;
    const edits: Record<string, { typeId: string | null; expiry: string | null }> = {};
    for (const cert of certificates) {
      edits[cert.id] = {
        typeId: (cert as any).confirmed_type_id || null,
        expiry: (cert as any).confirmed_expiry || (cert as any).ai_suggested_expiry || null,
      };
    }
    setCertEdits(edits);
  }, [certificates]);

  const updateCertEdit = (certId: string, field: 'typeId' | 'expiry', value: string | null) => {
    setCertEdits((prev) => ({
      ...prev,
      [certId]: { ...prev[certId], [field]: value },
    }));
  };

  const approveMutation = useMutation({
    mutationFn: async ({ registrationId, role }: { registrationId: string; role: string }) => {
      const reg = pendingRegs?.find((r: any) => r.id === registrationId);
      if (!reg) throw new Error('Registration not found');

      // 1. Save admin edits to pending_certificates
      if (certificates) {
        for (const cert of certificates) {
          const edit = certEdits[cert.id];
          if (edit) {
            await supabase
              .from('pending_certificates')
              .update({
                confirmed_type_id: edit.typeId,
                confirmed_expiry: edit.expiry,
              } as any)
              .eq('id', cert.id);
          }
        }
      }

      // 2. Update pending_registration status
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

      // 3. Add as organization member
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          user_id: reg.user_id,
          organization_id: selectedOrgId!,
          role: role as any,
        });
      if (memberError) throw memberError;

      // 4. Create user_certificates from edits
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', reg.user_id)
        .single();

      if (profile && certificates && certificates.length > 0) {
        const certInserts = certificates
          .map((c: any) => {
            const edit = certEdits[c.id];
            return {
              profile_id: profile.id,
              certificate_type_id: edit?.typeId || c.confirmed_type_id,
              expiry_date: edit?.expiry || c.confirmed_expiry || c.ai_suggested_expiry,
            };
          })
          .filter((c: any) => c.certificate_type_id);

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
      setCertEdits({});
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
      <Dialog open={!!selectedRegistration} onOpenChange={(open) => { if (!open) { setSelectedRegistration(null); setCertEdits({}); } }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Granska registrering</DialogTitle>
          </DialogHeader>

          {selectedRegistration && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Namn:</span>
                  <p className="font-medium">{selectedRegistration?.profile?.full_name}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">E-post:</span>
                  <p className="font-medium">{selectedRegistration?.profile?.email}</p>
                </div>
              </div>

              {/* Certificates */}
              <div>
                <h4 className="font-medium mb-2">Uppladdade certifikat</h4>
                {certificates && certificates.length > 0 ? (
                  <div className="space-y-3">
                    {certificates.map((cert: any) => (
                      <CertificateReviewCard
                        key={cert.id}
                        cert={cert}
                        certTypes={certTypes}
                        edit={certEdits[cert.id]}
                        onEditChange={(field, value) => updateCertEdit(cert.id, field, value)}
                        onDelete={async () => {
                          // Delete file from storage
                          await supabase.storage.from('registration-certificates').remove([cert.file_url]);
                          // Delete DB record
                          await supabase.from('pending_certificates').delete().eq('id', cert.id);
                          // Remove from local edits
                          setCertEdits((prev) => { const next = { ...prev }; delete next[cert.id]; return next; });
                          queryClient.invalidateQueries({ queryKey: ['pending-certificates', selectedRegistration?.id] });
                          toast({ title: 'Borttaget', description: 'Certifikatet har tagits bort.' });
                        }}
                      />
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

function CertificateReviewCard({ cert, certTypes, edit, onEditChange }: {
  cert: any;
  certTypes: CertType[];
  edit?: { typeId: string | null; expiry: string | null };
  onEditChange: (field: 'typeId' | 'expiry', value: string | null) => void;
}) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [showImage, setShowImage] = useState(false);
  const [loading, setLoading] = useState(false);

  const isPdf = cert.file_name?.toLowerCase().endsWith('.pdf');

  const loadImage = async () => {
    if (imageUrl) {
      setShowImage(!showImage);
      return;
    }
    setLoading(true);
    const { data } = await supabase.storage
      .from('registration-certificates')
      .createSignedUrl(cert.file_url, 300);
    setLoading(false);
    if (data?.signedUrl) {
      setImageUrl(data.signedUrl);
      setShowImage(true);
    }
  };

  const matchedTypeName = certTypes.find((t) => t.id === edit?.typeId)?.name;

  return (
    <div className="border rounded-lg p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{cert.ai_suggested_type || 'Okänt certifikat'}</p>
          {cert.ai_confidence != null && (
            <Badge variant="outline" className="text-xs mt-0.5">
              AI: {Math.round(cert.ai_confidence * 100)}% säkerhet
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" onClick={loadImage} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isPdf ? <FileText className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
          {isPdf ? 'Öppna PDF' : 'Visa'}
        </Button>
      </div>

      {showImage && imageUrl && (
        isPdf ? (
          <div className="text-center">
            <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline">
              Öppna PDF i nytt fönster
            </a>
          </div>
        ) : (
          <img src={imageUrl} alt="Certifikat" className="w-full rounded border" />
        )
      )}

      {/* Editable fields */}
      <div className="space-y-2 pt-2 border-t">
        <div>
          <label className="text-xs text-muted-foreground">Certifikatstyp</label>
          <Select
            value={edit?.typeId || '__none'}
            onValueChange={(val) => onEditChange('typeId', val === '__none' ? null : val)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Välj certifikatstyp" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— Välj typ —</SelectItem>
              {certTypes.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Utgångsdatum</label>
          <Input
            type="date"
            className="h-9 text-sm"
            value={edit?.expiry || ''}
            onChange={(e) => onEditChange('expiry', e.target.value || null)}
          />
        </div>
      </div>
    </div>
  );
}
