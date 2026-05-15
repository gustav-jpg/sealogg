import { useQuery } from '@tanstack/react-query';
import BackofficeLayout from '@/components/layout/BackofficeLayout';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Receipt } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_LABEL: Record<string,string> = { draft: 'Utkast', sent: 'Skickad', paid: 'Betald', overdue: 'Förfallen', cancelled: 'Avbruten' };
const STATUS_COLOR: Record<string,string> = { draft: 'bg-muted text-muted-foreground', sent: 'bg-blue-500/15 text-blue-600 dark:text-blue-400', paid: 'bg-green-500/15 text-green-600 dark:text-green-400', overdue: 'bg-red-500/15 text-red-600 dark:text-red-400', cancelled: 'bg-muted text-muted-foreground line-through' };

export default function EshopInvoices() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['es_invoices_all'],
    queryFn: async () => {
      const { data, error } = await supabase.from('es_invoices').select('*, organizations(name)').order('issued_at', { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  return (
    <BackofficeLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center gap-3">
          <Receipt className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Fakturor – alla organisationer</h1>
        </div>
        <Card>
          <CardHeader><CardTitle>Alla fakturor</CardTitle></CardHeader>
          <CardContent>
            {isLoading ? <p className="text-sm text-muted-foreground">Laddar...</p> : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga fakturor ännu.</p>
            ) : (
              <Table>
                <TableHeader><TableRow><TableHead>Nr</TableHead><TableHead>Datum</TableHead><TableHead>Kund</TableHead><TableHead>Förfaller</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Summa</TableHead></TableRow></TableHeader>
                <TableBody>
                  {rows.map((r: any) => (
                    <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50">
                      <TableCell className="font-mono">
                        <Link to={`/backoffice/eshop/invoices/${r.id}`} className="text-primary hover:underline">{r.invoice_number}</Link>
                      </TableCell>
                      <TableCell>{r.issued_at}</TableCell>
                      <TableCell>{r.organizations?.name || '–'}</TableCell>
                      <TableCell>{r.due_at || '–'}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[r.status] || 'bg-muted'}`}>
                          {STATUS_LABEL[r.status] || r.status}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{Number(r.grand_total).toFixed(2)} kr</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </BackofficeLayout>
  );
}