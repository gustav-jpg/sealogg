import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import BackofficeLayout from '@/components/layout/BackofficeLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Boxes, Search, Plus, Minus, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type LevelRow = {
  product_id: string;
  sku: string;
  name: string;
  brand: string | null;
  on_hand: number;
  reserved: number;
  reorder_level: number;
  warning_level: number;
};

const REASONS = [
  { value: 'inleverans', label: 'Inleverans' },
  { value: 'utleverans', label: 'Utleverans' },
  { value: 'inventering', label: 'Inventering / korrigering' },
  { value: 'svinn', label: 'Svinn / kassering' },
  { value: 'retur', label: 'Retur' },
  { value: 'ompackning', label: 'Ompackning / flytt' },
];

export default function EshopInventory() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustForm, setAdjustForm] = useState<any>({ product_id: '', name: '', qty: '', direction: 'in', reason: 'inleverans', note: '' });

  const { data: warehouses = [] } = useQuery({
    queryKey: ['es_warehouses_inv'],
    queryFn: async () => {
      const { data, error } = await supabase.from('es_warehouses').select('id,name').eq('is_active', true).order('name');
      if (error) throw error;
      if (data && data.length > 0 && !warehouseId) setWarehouseId(data[0].id);
      return data as any[];
    },
  });

  const { data: products = [] } = useQuery({
    queryKey: ['es_products_inv'],
    queryFn: async () => {
      const { data, error } = await supabase.from('es_products').select('id,sku,name,brand').eq('is_active', true).order('name');
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: levels = [] } = useQuery({
    queryKey: ['es_inventory_levels', warehouseId],
    enabled: !!warehouseId,
    queryFn: async () => {
      const { data, error } = await supabase.from('es_inventory_levels').select('product_id,on_hand,reserved,reorder_level,warning_level').eq('warehouse_id', warehouseId);
      if (error) throw error;
      return data as any[];
    },
  });

  const rows: LevelRow[] = useMemo(() => {
    const byProduct = new Map(levels.map((l: any) => [l.product_id, l]));
    return products.map((p: any) => {
      const lvl = byProduct.get(p.id) || { on_hand: 0, reserved: 0, reorder_level: 0, warning_level: 0 };
      return {
        product_id: p.id, sku: p.sku, name: p.name, brand: p.brand,
        on_hand: lvl.on_hand ?? 0, reserved: lvl.reserved ?? 0,
        reorder_level: lvl.reorder_level ?? 0, warning_level: lvl.warning_level ?? 0,
      };
    });
  }, [levels, products]);

  const filteredRows = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || (r.brand || '').toLowerCase().includes(q);
  });

  const move = useMutation({
    mutationFn: async (p: any) => {
      if (!warehouseId) throw new Error('Välj lager');
      const qtyAbs = Math.abs(Number(p.qty));
      if (!qtyAbs) throw new Error('Antal saknas');
      const signedQty = p.direction === 'out' ? -qtyAbs : qtyAbs;
      const { error } = await supabase.from('es_inventory_moves').insert({
        warehouse_id: warehouseId,
        product_id: p.product_id,
        qty: signedQty,
        reason: p.reason + (p.note ? ` – ${p.note}` : ''),
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['es_inventory_levels', warehouseId] });
      qc.invalidateQueries({ queryKey: ['es_inventory_moves', warehouseId] });
      setAdjustOpen(false);
      toast.success('Lagerrörelse registrerad');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateThresholds = useMutation({
    mutationFn: async (p: { product_id: string; reorder_level: number; warning_level: number }) => {
      if (!warehouseId) throw new Error('Välj lager');
      // upsert: ensure row exists (insert with 0 qty move would be misleading; do direct upsert)
      const { error } = await supabase
        .from('es_inventory_levels')
        .upsert({
          warehouse_id: warehouseId,
          product_id: p.product_id,
          variant_id: null,
          reorder_level: p.reorder_level,
          warning_level: p.warning_level,
        } as any, { onConflict: 'warehouse_id,product_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['es_inventory_levels', warehouseId] });
      toast.success('Sparat');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: moves = [] } = useQuery({
    queryKey: ['es_inventory_moves', warehouseId],
    enabled: !!warehouseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('es_inventory_moves')
        .select('id, qty, reason, created_at, created_by, product_id, es_products(name,sku)')
        .eq('warehouse_id', warehouseId)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as any[];
    },
  });

  const openAdjust = (row: LevelRow, direction: 'in' | 'out') => {
    setAdjustForm({
      product_id: row.product_id,
      name: `${row.name} (${row.sku})`,
      qty: '',
      direction,
      reason: direction === 'in' ? 'inleverans' : 'utleverans',
      note: '',
    });
    setAdjustOpen(true);
  };

  const lowCount = rows.filter(r => r.warning_level > 0 && r.on_hand <= r.warning_level).length;

  return (
    <BackofficeLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-6xl space-y-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Boxes className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Lagerhantering</h1>
          </div>
          <div className="flex items-center gap-3">
            <Label className="text-sm">Lager:</Label>
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Välj lager" /></SelectTrigger>
              <SelectContent>
                {warehouses.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {warehouses.length === 0 ? (
          <Card><CardContent className="py-8 text-sm text-muted-foreground">Inga lager finns. Lägg till ett under <strong>Lager</strong> först.</CardContent></Card>
        ) : (
          <Tabs defaultValue="levels">
            <TabsList>
              <TabsTrigger value="levels">Saldon</TabsTrigger>
              <TabsTrigger value="moves">Rörelser</TabsTrigger>
            </TabsList>

            <TabsContent value="levels" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="flex items-center gap-2">
                      Saldon ({filteredRows.length})
                      {lowCount > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> {lowCount} under varningsnivå
                        </span>
                      )}
                    </CardTitle>
                    <div className="relative w-64">
                      <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                      <Input placeholder="Sök produkt..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {filteredRows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Inga produkter.</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>SKU</TableHead><TableHead>Produkt</TableHead>
                        <TableHead className="text-right">Saldo</TableHead>
                        <TableHead className="text-right">Reserverat</TableHead>
                        <TableHead className="text-right w-28">Varning</TableHead>
                        <TableHead className="text-right w-28">Påfyll</TableHead>
                        <TableHead className="text-right w-32"></TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {filteredRows.map(r => {
                          const low = r.warning_level > 0 && r.on_hand <= r.warning_level;
                          return (
                            <TableRow key={r.product_id}>
                              <TableCell className="font-mono text-xs">{r.sku}</TableCell>
                              <TableCell className="font-medium">{r.name}{r.brand ? <span className="text-muted-foreground text-xs"> · {r.brand}</span> : null}</TableCell>
                              <TableCell className={cn("text-right font-semibold", low && "text-amber-600 dark:text-amber-400")}>{r.on_hand}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{r.reserved}</TableCell>
                              <TableCell className="text-right">
                                <ThresholdInput
                                  value={r.warning_level}
                                  onCommit={(v) => updateThresholds.mutate({ product_id: r.product_id, reorder_level: r.reorder_level, warning_level: v })}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <ThresholdInput
                                  value={r.reorder_level}
                                  onCommit={(v) => updateThresholds.mutate({ product_id: r.product_id, reorder_level: v, warning_level: r.warning_level })}
                                />
                              </TableCell>
                              <TableCell className="text-right">
                                <Button size="icon" variant="ghost" title="In" onClick={() => openAdjust(r, 'in')}><Plus className="h-4 w-4 text-emerald-600" /></Button>
                                <Button size="icon" variant="ghost" title="Ut" onClick={() => openAdjust(r, 'out')}><Minus className="h-4 w-4 text-rose-600" /></Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="moves" className="space-y-4">
              <Card>
                <CardHeader><CardTitle>Senaste rörelser ({moves.length})</CardTitle></CardHeader>
                <CardContent>
                  {moves.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Inga rörelser ännu.</p>
                  ) : (
                    <Table>
                      <TableHeader><TableRow>
                        <TableHead>Datum</TableHead><TableHead>Produkt</TableHead>
                        <TableHead className="text-right">Antal</TableHead><TableHead>Anledning</TableHead>
                      </TableRow></TableHeader>
                      <TableBody>
                        {moves.map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString('sv-SE')}</TableCell>
                            <TableCell>
                              <span className="font-medium">{m.es_products?.name || '–'}</span>
                              <span className="text-xs text-muted-foreground"> · {m.es_products?.sku}</span>
                            </TableCell>
                            <TableCell className={cn("text-right font-semibold", m.qty > 0 ? "text-emerald-600" : "text-rose-600")}>
                              {m.qty > 0 ? '+' : ''}{m.qty}
                            </TableCell>
                            <TableCell className="text-sm">{m.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{adjustForm.direction === 'in' ? 'Lägg till lager' : 'Ta från lager'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">{adjustForm.name}</div>
              <div className="space-y-1">
                <Label>Antal *</Label>
                <Input type="number" min={1} value={adjustForm.qty} onChange={e => setAdjustForm({ ...adjustForm, qty: e.target.value })} autoFocus />
              </div>
              <div className="space-y-1">
                <Label>Anledning</Label>
                <Select value={adjustForm.reason} onValueChange={(v) => setAdjustForm({ ...adjustForm, reason: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {REASONS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Anteckning (valfritt)</Label>
                <Textarea rows={2} value={adjustForm.note} onChange={e => setAdjustForm({ ...adjustForm, note: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAdjustOpen(false)}>Avbryt</Button>
              <Button onClick={() => move.mutate(adjustForm)} disabled={!adjustForm.qty || move.isPending}>
                {adjustForm.direction === 'in' ? 'Lägg till' : 'Ta bort'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </BackofficeLayout>
  );
}

function ThresholdInput({ value, onCommit }: { value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value ?? 0));
  return (
    <Input
      type="number"
      className="h-8 text-right"
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = Number(v) || 0; if (n !== value) onCommit(n); }}
    />
  );
}