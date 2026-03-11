import { useState, useEffect, useCallback } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganization } from '@/contexts/OrganizationContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Plus, Pencil, Trash2, GripVertical, HelpCircle } from 'lucide-react';

interface FaqItem {
  id: string;
  category: string;
  question: string;
  answer: string;
  sort_order: number;
  is_published: boolean;
}

export default function FaqAdmin() {
  const { user } = useAuth();
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const [faqs, setFaqs] = useState<FaqItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<FaqItem | null>(null);
  const [form, setForm] = useState({ category: 'Allmänt', question: '', answer: '', is_published: true });

  const orgId = selectedOrgId;

  const fetchFaqs = useCallback(async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('faq_items')
      .select('*')
      .eq('organization_id', orgId)
      .order('sort_order', { ascending: true });
    setFaqs((data as FaqItem[]) || []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { fetchFaqs(); }, [fetchFaqs]);

  const openNew = () => {
    setEditing(null);
    setForm({ category: 'Allmänt', question: '', answer: '', is_published: true });
    setDialogOpen(true);
  };

  const openEdit = (faq: FaqItem) => {
    setEditing(faq);
    setForm({ category: faq.category, question: faq.question, answer: faq.answer, is_published: faq.is_published });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.question.trim() || !form.answer.trim()) {
      toast({ title: 'Fyll i fråga och svar', variant: 'destructive' });
      return;
    }
    if (editing) {
      const { error } = await supabase
        .from('faq_items')
        .update({ category: form.category, question: form.question, answer: form.answer, is_published: form.is_published })
        .eq('id', editing.id);
      if (error) { toast({ title: 'Kunde inte uppdatera', variant: 'destructive' }); return; }
      toast({ title: 'FAQ uppdaterad' });
    } else {
      const maxOrder = faqs.length > 0 ? Math.max(...faqs.map((f) => f.sort_order)) + 1 : 0;
      const { error } = await supabase
        .from('faq_items')
        .insert({ organization_id: orgId, category: form.category, question: form.question, answer: form.answer, is_published: form.is_published, sort_order: maxOrder });
      if (error) { toast({ title: 'Kunde inte skapa', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'FAQ skapad' });
    }
    setDialogOpen(false);
    fetchFaqs();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Vill du ta bort denna fråga?')) return;
    await supabase.from('faq_items').delete().eq('id', id);
    toast({ title: 'FAQ borttagen' });
    fetchFaqs();
  };

  const togglePublished = async (faq: FaqItem) => {
    await supabase.from('faq_items').update({ is_published: !faq.is_published }).eq('id', faq.id);
    fetchFaqs();
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <HelpCircle className="h-6 w-6" />
              Vanliga frågor (FAQ)
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Hantera frågor och svar som visas på supportsidan.
            </p>
          </div>
          <Button onClick={openNew} className="gap-1">
            <Plus className="h-4 w-4" /> Ny fråga
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : faqs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Inga frågor tillagda ännu. Klicka "Ny fråga" för att komma igång.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {faqs.map((faq) => (
              <Card key={faq.id} className={!faq.is_published ? 'opacity-50' : ''}>
                <CardContent className="flex items-start gap-3 py-3 px-4">
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{faq.category}</span>
                      {!faq.is_published && <span className="text-xs text-muted-foreground">(dold)</span>}
                    </div>
                    <p className="font-medium text-sm">{faq.question}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{faq.answer}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Switch checked={faq.is_published} onCheckedChange={() => togglePublished(faq)} />
                    <Button variant="ghost" size="icon" onClick={() => openEdit(faq)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(faq.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Redigera fråga' : 'Ny fråga'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Kategori</Label>
              <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="t.ex. Loggbok, Avvikelser" />
            </div>
            <div>
              <Label>Fråga</Label>
              <Input value={form.question} onChange={(e) => setForm({ ...form, question: e.target.value })} placeholder="Hur gör jag för att..." />
            </div>
            <div>
              <Label>Svar</Label>
              <Textarea value={form.answer} onChange={(e) => setForm({ ...form, answer: e.target.value })} placeholder="Svaret på frågan..." rows={5} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
              <Label>Publicerad</Label>
            </div>
            <Button onClick={handleSave} className="w-full">
              {editing ? 'Spara ändringar' : 'Skapa fråga'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
