import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/contexts/OrganizationContext';
import { useOrgCertificateTypes } from '@/hooks/useOrgCertificateTypes';
import { Plus, Trash2, Award } from 'lucide-react';

export default function RoleRules() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedOrgId } = useOrganization();

  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [typeName, setTypeName] = useState('');
  const [typeDescription, setTypeDescription] = useState('');

  const { data: certificateTypes } = useOrgCertificateTypes(selectedOrgId);

  const createCertType = useMutation({
    mutationFn: async () => {
      if (!selectedOrgId) throw new Error('No organization found');
      const { error } = await supabase.from('certificate_types').insert({
        name: typeName,
        description: typeDescription || null,
        organization_id: selectedOrgId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-certificate-types', selectedOrgId] });
      toast({ title: 'Certifikattyp skapad' });
      setTypeDialogOpen(false);
      setTypeName('');
      setTypeDescription('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCertType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('certificate_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-certificate-types', selectedOrgId] });
      toast({ title: 'Certifikattyp borttagen' });
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold">Certifikatstyper</h1>
            <p className="text-muted-foreground mt-1">
              Hantera certifikattyper som kan tilldelas besättningsmedlemmar
            </p>
          </div>
          <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Ny certifikattyp
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Skapa certifikattyp</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Namn *</Label>
                  <Input
                    id="name"
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                    placeholder="T.ex. Befäls Behörighet klass 6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Beskrivning</Label>
                  <Textarea
                    id="desc"
                    value={typeDescription}
                    onChange={(e) => setTypeDescription(e.target.value)}
                  />
                </div>
                <Button
                  onClick={() => createCertType.mutate()}
                  disabled={!typeName || createCertType.isPending}
                  className="w-full"
                >
                  {createCertType.isPending ? 'Skapar...' : 'Skapa'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {certificateTypes?.map((ct) => (
            <Card key={ct.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    {ct.name}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => deleteCertType.mutate(ct.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </CardTitle>
              </CardHeader>
              {ct.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{ct.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
          {(!certificateTypes || certificateTypes.length === 0) && (
            <p className="text-muted-foreground col-span-full text-center py-8">
              Inga certifikattyper skapade ännu
            </p>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
