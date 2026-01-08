import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Award, Trash2 } from 'lucide-react';

export default function AdminCertificates() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const { data: certificateTypes } = useQuery({
    queryKey: ['certificate-types'],
    queryFn: async () => {
      const { data, error } = await supabase.from('certificate_types').select('*').order('name');
      if (error) throw error;
      return data;
    },
  });

  const createCertificateType = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('certificate_types').insert({ name, description: description || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificate-types'] });
      toast({ title: 'Skapat', description: 'Certifikattypen har skapats.' });
      setDialogOpen(false);
      setName('');
      setDescription('');
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCertificateType = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('certificate_types').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['certificate-types'] });
      toast({ title: 'Borttaget' });
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
            <h1 className="text-3xl font-display font-bold">Certifikattyper</h1>
            <p className="text-muted-foreground mt-1">Hantera certifikattyper som kan tilldelas användare</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="T.ex. Befäls Behörighet klass 6"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Beskrivning</Label>
                  <Textarea id="desc" value={description} onChange={e => setDescription(e.target.value)} />
                </div>
                <Button
                  onClick={() => createCertificateType.mutate()}
                  disabled={!name || createCertificateType.isPending}
                  className="w-full"
                >
                  {createCertificateType.isPending ? 'Skapar...' : 'Skapa'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {certificateTypes?.map(ct => (
            <Card key={ct.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-lg">
                  <span className="flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    {ct.name}
                  </span>
                  <Button variant="ghost" size="icon" onClick={() => deleteCertificateType.mutate(ct.id)}>
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
        </div>
      </div>
    </MainLayout>
  );
}
