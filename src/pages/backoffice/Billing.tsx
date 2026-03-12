import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays, parseISO, addMonths, addYears, addQuarters } from 'date-fns';
import { sv } from 'date-fns/locale';
import { CreditCard, AlertTriangle, CheckCircle2, Clock, XCircle, Plus } from 'lucide-react';

type BillingFrequency = 'monthly' | 'yearly' | 'quarterly';
type BillingStatus = 'active' | 'overdue' | 'cancelled' | 'trial';

interface BillingRecord {
  id: string;
  organization_id: string;
  billing_frequency: BillingFrequency;
  status: BillingStatus;
  price_sek: number;
  last_paid_at: string | null;
  next_invoice_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  organizations?: { id: string; name: string } | null;
}

const FREQUENCY_LABELS: Record<BillingFrequency, string> = {
  monthly: 'Månadsvis',
  quarterly: 'Kvartalsvis',
  yearly: 'Årsvis',
};

const STATUS_LABELS: Record<BillingStatus, string> = {
  active: 'Aktiv',
  overdue: 'Förfallen',
  cancelled: 'Avslutad',
  trial: 'Provperiod',
};

const STATUS_VARIANTS: Record<BillingStatus, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  active: 'default',
  overdue: 'destructive',
  cancelled: 'secondary',
  trial: 'outline',
};

const STATUS_ICONS: Record<BillingStatus, typeof CheckCircle2> = {
  active: CheckCircle2,
  overdue: AlertTriangle,
  cancelled: XCircle,
  trial: Clock,
};

export default function Billing() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingRecord, setEditingRecord] = useState<BillingRecord | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formData, setFormData] = useState({
    organization_id: '',
    billing_frequency: 'monthly' as BillingFrequency,
    status: 'active' as BillingStatus,
    price_sek: 0,
    last_paid_at: '',
    next_invoice_date: '',
    notes: '',
  });

  // Fetch billing records with org names
  const { data: billingRecords = [], isLoading } = useQuery({
    queryKey: ['backoffice-billing'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_billing')
        .select('*, organizations(id, name)')
        .order('next_invoice_date', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data as unknown as BillingRecord[];
    },
  });

  // Fetch all organizations for the add dialog
  const { data: allOrgs = [] } = useQuery({
    queryKey: ['backoffice-all-orgs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organizations')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Orgs without billing record
  const orgsWithoutBilling = allOrgs.filter(
    (org) => !billingRecords.some((b) => b.organization_id === org.id)
  );

  const upsertMutation = useMutation({
    mutationFn: async (data: {
      id?: string;
      organization_id: string;
      billing_frequency: BillingFrequency;
      status: BillingStatus;
      price_sek: number;
      last_paid_at: string | null;
      next_invoice_date: string | null;
      notes: string | null;
    }) => {
      const payload = {
        organization_id: data.organization_id,
        billing_frequency: data.billing_frequency,
        status: data.status,
        price_sek: data.price_sek,
        last_paid_at: data.last_paid_at || null,
        next_invoice_date: data.next_invoice_date || null,
        notes: data.notes || null,
        updated_at: new Date().toISOString(),
      };

      if (data.id) {
        const { error } = await supabase
          .from('organization_billing')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('organization_billing')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backoffice-billing'] });
      toast({ title: 'Sparat', description: 'Faktureringsinformation uppdaterad.' });
      setEditingRecord(null);
      setShowAddDialog(false);
    },
    onError: (error) => {
      toast({ title: 'Fel', description: error.message, variant: 'destructive' });
    },
  });

  const markAsPaidMutation = useMutation({
    mutationFn: async (record: BillingRecord) => {
      const today = new Date();
      let nextDate: Date;
      if (record.billing_frequency === 'monthly') {
        nextDate = addMonths(today, 1);
      } else if (record.billing_frequency === 'quarterly') {
        nextDate = addQuarters(today, 1);
      } else {
        nextDate = addYears(today, 1);
      }

      const { error } = await supabase
        .from('organization_billing')
        .update({
          last_paid_at: format(today, 'yyyy-MM-dd'),
          next_invoice_date: format(nextDate, 'yyyy-MM-dd'),
          status: 'active' as BillingStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', record.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backoffice-billing'] });
      toast({ title: 'Registrerat', description: 'Betalning registrerad och nästa fakturadatum satt.' });
    },
  });

  const openEdit = (record: BillingRecord) => {
    setFormData({
      organization_id: record.organization_id,
      billing_frequency: record.billing_frequency,
      status: record.status,
      price_sek: record.price_sek,
      last_paid_at: record.last_paid_at || '',
      next_invoice_date: record.next_invoice_date || '',
      notes: record.notes || '',
    });
    setEditingRecord(record);
  };

  const openAdd = () => {
    setFormData({
      organization_id: orgsWithoutBilling[0]?.id || '',
      billing_frequency: 'monthly',
      status: 'active',
      price_sek: 0,
      last_paid_at: '',
      next_invoice_date: format(new Date(), 'yyyy-MM-dd'),
      notes: '',
    });
    setShowAddDialog(true);
  };

  const handleSave = () => {
    upsertMutation.mutate({
      id: editingRecord?.id,
      organization_id: formData.organization_id,
      billing_frequency: formData.billing_frequency,
      status: formData.status,
      price_sek: formData.price_sek,
      last_paid_at: formData.last_paid_at || null,
      next_invoice_date: formData.next_invoice_date || null,
      notes: formData.notes || null,
    });
  };

  const getDaysUntilInvoice = (dateStr: string | null) => {
    if (!dateStr) return null;
    return differenceInDays(parseISO(dateStr), new Date());
  };

  const getInvoiceUrgencyClass = (days: number | null) => {
    if (days === null) return '';
    if (days < 0) return 'text-destructive font-semibold';
    if (days <= 7) return 'text-orange-600 font-medium';
    if (days <= 30) return 'text-yellow-600';
    return 'text-muted-foreground';
  };

  // Stats
  const activeCount = billingRecords.filter((b) => b.status === 'active').length;
  const overdueCount = billingRecords.filter((b) => b.status === 'overdue').length;
  const upcomingCount = billingRecords.filter((b) => {
    const days = getDaysUntilInvoice(b.next_invoice_date);
    return days !== null && days >= 0 && days <= 14;
  }).length;
  const totalMRR = billingRecords
    .filter((b) => b.status === 'active' || b.status === 'trial')
    .reduce((sum, b) => {
      if (b.billing_frequency === 'yearly') return sum + b.price_sek / 12;
      if (b.billing_frequency === 'quarterly') return sum + b.price_sek / 3;
      return sum + b.price_sek;
    }, 0);

  const BillingForm = () => (
    <div className="space-y-4">
      {!editingRecord && (
        <div>
          <Label>Organisation</Label>
          <Select value={formData.organization_id} onValueChange={(v) => setFormData((f) => ({ ...f, organization_id: v }))}>
            <SelectTrigger><SelectValue placeholder="Välj organisation" /></SelectTrigger>
            <SelectContent>
              {orgsWithoutBilling.map((org) => (
                <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Faktureringsfrekvens</Label>
          <Select value={formData.billing_frequency} onValueChange={(v) => setFormData((f) => ({ ...f, billing_frequency: v as BillingFrequency }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Månadsvis</SelectItem>
              <SelectItem value="quarterly">Kvartalsvis</SelectItem>
              <SelectItem value="yearly">Årsvis</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(v) => setFormData((f) => ({ ...f, status: v as BillingStatus }))}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="overdue">Förfallen</SelectItem>
              <SelectItem value="cancelled">Avslutad</SelectItem>
              <SelectItem value="trial">Provperiod</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>Pris (SEK)</Label>
        <Input
          type="number"
          value={formData.price_sek}
          onChange={(e) => setFormData((f) => ({ ...f, price_sek: parseInt(e.target.value) || 0 }))}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Senast betald</Label>
          <Input
            type="date"
            value={formData.last_paid_at}
            onChange={(e) => setFormData((f) => ({ ...f, last_paid_at: e.target.value }))}
          />
        </div>
        <div>
          <Label>Nästa fakturadatum</Label>
          <Input
            type="date"
            value={formData.next_invoice_date}
            onChange={(e) => setFormData((f) => ({ ...f, next_invoice_date: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <Label>Anteckningar</Label>
        <Textarea
          value={formData.notes}
          onChange={(e) => setFormData((f) => ({ ...f, notes: e.target.value }))}
          placeholder="T.ex. kontaktperson, faktureringsadress..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={() => { setEditingRecord(null); setShowAddDialog(false); }}>
          Avbryt
        </Button>
        <Button onClick={handleSave} disabled={upsertMutation.isPending}>
          Spara
        </Button>
      </div>
    </div>
  );

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Fakturering
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Hantera betalningsstatus och faktureringsschema</p>
        </div>
        <Button onClick={openAdd} disabled={orgsWithoutBilling.length === 0}>
          <Plus className="h-4 w-4 mr-2" />
          Lägg till
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Aktiva kunder</p>
          <p className="text-2xl font-bold">{activeCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Förfallna</p>
          <p className="text-2xl font-bold text-destructive">{overdueCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Kommande 14 dagar</p>
          <p className="text-2xl font-bold text-orange-600">{upcomingCount}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">MRR (SEK)</p>
          <p className="text-2xl font-bold">{Math.round(totalMRR).toLocaleString('sv-SE')}</p>
        </div>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Organisation</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Frekvens</TableHead>
            <TableHead className="text-right">Pris (SEK)</TableHead>
            <TableHead>Senast betald</TableHead>
            <TableHead>Nästa faktura</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {billingRecords.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                Inga faktureringsposter ännu. Lägg till en organisation ovan.
              </TableCell>
            </TableRow>
          )}
          {billingRecords.map((record) => {
            const daysUntil = getDaysUntilInvoice(record.next_invoice_date);
            const StatusIcon = STATUS_ICONS[record.status];
            return (
              <TableRow key={record.id}>
                <TableCell className="font-medium">
                  {record.organizations?.name || 'Okänd'}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANTS[record.status]} className="gap-1">
                    <StatusIcon className="h-3 w-3" />
                    {STATUS_LABELS[record.status]}
                  </Badge>
                </TableCell>
                <TableCell>{FREQUENCY_LABELS[record.billing_frequency]}</TableCell>
                <TableCell className="text-right font-mono">
                  {record.price_sek.toLocaleString('sv-SE')} kr
                </TableCell>
                <TableCell>
                  {record.last_paid_at
                    ? format(parseISO(record.last_paid_at), 'd MMM yyyy', { locale: sv })
                    : <span className="text-muted-foreground">–</span>}
                </TableCell>
                <TableCell>
                  {record.next_invoice_date ? (
                    <span className={getInvoiceUrgencyClass(daysUntil)}>
                      {format(parseISO(record.next_invoice_date), 'd MMM yyyy', { locale: sv })}
                      {daysUntil !== null && (
                        <span className="ml-1 text-xs">
                          ({daysUntil < 0 ? `${Math.abs(daysUntil)}d sedan` : `om ${daysUntil}d`})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(record)}>
                    Redigera
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => markAsPaidMutation.mutate(record)}
                    disabled={markAsPaidMutation.isPending}
                  >
                    Betald ✓
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Edit dialog */}
      <Dialog open={!!editingRecord} onOpenChange={(open) => { if (!open) setEditingRecord(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera fakturering – {editingRecord?.organizations?.name}</DialogTitle>
          </DialogHeader>
          <BillingForm />
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lägg till fakturering</DialogTitle>
          </DialogHeader>
          <BillingForm />
        </DialogContent>
      </Dialog>
    </div>
  );
}
