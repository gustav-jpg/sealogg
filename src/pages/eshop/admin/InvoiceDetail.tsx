import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BackofficeLayout from '@/components/layout/BackofficeLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Receipt, Download, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const STATUSES = ['draft','sent','paid','overdue','cancelled'];
const STATUS_LABEL: Record<string,string> = { draft: 'Utkast', sent: 'Skickad', paid: 'Betald', overdue: 'Förfallen', cancelled: 'Avbruten' };

export default function EshopInvoiceDetail() {
  const { id } = useParams();
  const qc = useQueryClient();

  const { data: invoice, isLoading } = useQuery({
    queryKey: ['es_invoice', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('es_invoices')
        .select('*, organizations(name), es_orders(*, vessels(name))')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: items = [] } = useQuery({
    queryKey: ['es_invoice_items', invoice?.order_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('es_order_items')
        .select('*')
        .eq('order_id', invoice!.order_id)
        .order('created_at');
      if (error) throw error;
      return data as any[];
    },
    enabled: !!invoice?.order_id,
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from('es_invoices').update({ status }).eq('id', id!);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['es_invoice', id] }); qc.invalidateQueries({ queryKey: ['es_invoices_all'] }); toast.success('Status uppdaterad'); },
    onError: (e: any) => toast.error(e.message),
  });

  function downloadPdf() {
    if (!invoice) return;
    const order = invoice.es_orders;
    const addr = order?.delivery_address || {};
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();

    // Seller
    doc.setFontSize(18); doc.setFont('helvetica','bold');
    doc.text('SeaLogg Skeppshandel', 14, 20);
    doc.setFontSize(9); doc.setFont('helvetica','normal');
    doc.text('AhrensGroup AB', 14, 26);
    doc.text('support@sealogg.se', 14, 31);

    // Title
    doc.setFontSize(22); doc.setFont('helvetica','bold');
    doc.text('FAKTURA', pageW - 14, 20, { align: 'right' });
    doc.setFontSize(10); doc.setFont('helvetica','normal');
    doc.text(`Nr: ${invoice.invoice_number}`, pageW - 14, 27, { align: 'right' });
    doc.text(`Datum: ${invoice.issued_at}`, pageW - 14, 32, { align: 'right' });
    if (invoice.due_at) doc.text(`Förfaller: ${invoice.due_at}`, pageW - 14, 37, { align: 'right' });
    doc.text(`Status: ${STATUS_LABEL[invoice.status] || invoice.status}`, pageW - 14, 42, { align: 'right' });

    // Customer
    doc.setFontSize(10); doc.setFont('helvetica','bold');
    doc.text('Faktureras till:', 14, 50);
    doc.setFont('helvetica','normal');
    let y = 56;
    doc.text(invoice.organizations?.name || '–', 14, y); y += 5;
    if (addr.name) { doc.text(addr.name, 14, y); y += 5; }
    if (addr.street) { doc.text(addr.street, 14, y); y += 5; }
    if (addr.postal_code || addr.city) { doc.text(`${addr.postal_code || ''} ${addr.city || ''}`.trim(), 14, y); y += 5; }
    if (addr.country) { doc.text(addr.country, 14, y); y += 5; }
    if (order?.vessels?.name) { doc.text(`Fartyg: ${order.vessels.name}`, 14, y); y += 5; }

    // Items table
    autoTable(doc, {
      startY: Math.max(y + 5, 90),
      head: [['SKU','Produkt','Antal','À-pris','Moms','Summa']],
      body: items.map((it: any) => [
        it.sku_snapshot,
        it.product_name_snapshot,
        String(it.qty),
        Number(it.unit_price_excl_vat).toFixed(2),
        `${Number(it.vat_rate).toFixed(0)}%`,
        Number(it.line_total_excl_vat).toFixed(2),
      ]),
      headStyles: { fillColor: [10, 22, 40] },
      styles: { fontSize: 9 },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 8;
    const labelX = pageW - 60; const valX = pageW - 14;
    doc.setFontSize(10);
    doc.text('Delsumma', labelX, finalY); doc.text(`${Number(invoice.total_excl_vat).toFixed(2)} kr`, valX, finalY, { align: 'right' });
    doc.text('Moms', labelX, finalY + 6); doc.text(`${Number(invoice.vat_total).toFixed(2)} kr`, valX, finalY + 6, { align: 'right' });
    doc.setFont('helvetica','bold');
    doc.text('Totalt', labelX, finalY + 14); doc.text(`${Number(invoice.grand_total).toFixed(2)} kr`, valX, finalY + 14, { align: 'right' });

    doc.setFont('helvetica','normal'); doc.setFontSize(8);
    doc.text('Betalningsvillkor: enligt avtal. Vid frågor: support@sealogg.se', 14, doc.internal.pageSize.getHeight() - 12);

    doc.save(`${invoice.invoice_number}.pdf`);
  }

  return (
    <BackofficeLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl space-y-6">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="sm"><Link to="/backoffice/eshop/invoices"><ArrowLeft className="h-4 w-4 mr-1" /> Tillbaka</Link></Button>
        </div>
        {isLoading || !invoice ? (
          <p className="text-sm text-muted-foreground">Laddar...</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <Receipt className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold font-mono">{invoice.invoice_number}</h1>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={invoice.status} onValueChange={(v) => updateStatus.mutate(v)}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
                {invoice.status !== 'paid' && (
                  <Button variant="default" onClick={() => updateStatus.mutate('paid')}>
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Markera som betald
                  </Button>
                )}
                <Button variant="outline" onClick={downloadPdf}>
                  <Download className="h-4 w-4 mr-1" /> Ladda ner PDF
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader><CardTitle className="text-base">Kund</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div>{invoice.organizations?.name || '–'}</div>
                  {invoice.es_orders?.vessels?.name && <div className="text-muted-foreground">Fartyg: {invoice.es_orders.vessels.name}</div>}
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Datum</CardTitle></CardHeader>
                <CardContent className="text-sm space-y-1">
                  <div><span className="text-muted-foreground">Utfärdad: </span>{invoice.issued_at}</div>
                  <div><span className="text-muted-foreground">Förfaller: </span>{invoice.due_at || '–'}</div>
                  <div><span className="text-muted-foreground">Order: </span><Link to={`/backoffice/eshop/orders/${invoice.order_id}`} className="text-primary hover:underline">Visa order</Link></div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle className="text-base">Leveransadress</CardTitle></CardHeader>
                <CardContent className="text-sm">
                  {invoice.es_orders?.delivery_address ? (
                    <div className="space-y-0.5">
                      {invoice.es_orders.delivery_address.name && <div>{invoice.es_orders.delivery_address.name}</div>}
                      {invoice.es_orders.delivery_address.street && <div>{invoice.es_orders.delivery_address.street}</div>}
                      {(invoice.es_orders.delivery_address.postal_code || invoice.es_orders.delivery_address.city) && <div>{invoice.es_orders.delivery_address.postal_code} {invoice.es_orders.delivery_address.city}</div>}
                      {invoice.es_orders.delivery_address.country && <div>{invoice.es_orders.delivery_address.country}</div>}
                    </div>
                  ) : <span className="text-muted-foreground">–</span>}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader><CardTitle className="text-base">Fakturarader</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>Produkt</TableHead><TableHead className="text-right">Antal</TableHead><TableHead className="text-right">À-pris</TableHead><TableHead className="text-right">Moms</TableHead><TableHead className="text-right">Summa</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {items.map((it: any) => (
                      <TableRow key={it.id}>
                        <TableCell className="font-mono text-xs">{it.sku_snapshot}</TableCell>
                        <TableCell>{it.product_name_snapshot}</TableCell>
                        <TableCell className="text-right">{it.qty}</TableCell>
                        <TableCell className="text-right">{Number(it.unit_price_excl_vat).toFixed(2)}</TableCell>
                        <TableCell className="text-right">{Number(it.vat_rate).toFixed(0)}%</TableCell>
                        <TableCell className="text-right">{Number(it.line_total_excl_vat).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Delsumma</span><span>{Number(invoice.total_excl_vat).toFixed(2)} kr</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Moms</span><span>{Number(invoice.vat_total).toFixed(2)} kr</span></div>
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Totalt</span><span>{Number(invoice.grand_total).toFixed(2)} kr</span></div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </BackofficeLayout>
  );
}
