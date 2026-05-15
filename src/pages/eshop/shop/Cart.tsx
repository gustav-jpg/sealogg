import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { MainLayout } from '@/components/layout/MainLayout';
import { useOrganization } from '@/contexts/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useEshopCart } from '@/hooks/useEshopCart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Trash2, Plus, Minus, ShoppingCart, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

function fmt(n: number) {
  return n.toLocaleString('sv-SE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function EshopCart() {
  const { selectedOrgId } = useOrganization();
  const cart = useEshopCart();
  const navigate = useNavigate();

  const [vesselId, setVesselId] = useState<string>('none');
  const [note, setNote] = useState('');
  const [delivery, setDelivery] = useState({
    name: '',
    street: '',
    postal_code: '',
    city: '',
    country: 'SE',
  });
  const [submitting, setSubmitting] = useState(false);

  const { data: vessels = [] } = useQuery({
    queryKey: ['cart_vessels', selectedOrgId],
    enabled: !!selectedOrgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vessels')
        .select('id,name')
        .eq('organization_id', selectedOrgId!)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const handleCheckout = async () => {
    if (!selectedOrgId || !cart.userId) return;
    if (cart.items.length === 0) {
      toast.error('Varukorgen är tom');
      return;
    }
    if (!delivery.street || !delivery.city) {
      toast.error('Fyll i leveransadress');
      return;
    }
    setSubmitting(true);
    try {
      const { sub, vat, grand } = cart.totals;

      const { data: order, error: oErr } = await supabase
        .from('es_orders')
        .insert({
          organization_id: selectedOrgId,
          ordered_by: cart.userId,
          vessel_id: vesselId !== 'none' ? vesselId : null,
          status: 'pending',
          sub_total: sub,
          vat_total: vat,
          grand_total: grand,
          customer_note: note || null,
          delivery_address: delivery as any,
          billing_address: delivery as any,
          order_number: '',
        } as any)
        .select()
        .single();
      if (oErr) throw oErr;

      const itemsPayload = cart.items.map((it: any) => {
        const price = Number(it.es_products?.price_excl_vat ?? 0);
        return {
          order_id: order.id,
          product_id: it.product_id,
          variant_id: it.variant_id,
          product_name_snapshot: it.es_products?.name ?? '',
          sku_snapshot: it.es_products?.sku ?? '',
          qty: it.qty,
          unit_price_excl_vat: price,
          line_total_excl_vat: price * it.qty,
          vat_rate: Number(it.es_products?.vat_rate ?? 25),
        };
      });
      const { error: iErr } = await supabase.from('es_order_items').insert(itemsPayload);
      if (iErr) throw iErr;

      const { error: invErr } = await supabase.from('es_invoices').insert({
        organization_id: selectedOrgId,
        order_id: order.id,
        status: 'draft',
        total_excl_vat: sub,
        vat_total: vat,
        grand_total: grand,
        invoice_number: '',
      } as any);
      if (invErr) throw invErr;

      await cart.clearCart.mutateAsync();
      toast.success(`Order ${order.order_number} skapad`);
      navigate(`/portal/eshop/order/${order.id}`);
    } catch (e: any) {
      toast.error(e.message ?? 'Misslyckades skapa order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <Button variant="ghost" size="sm" asChild className="mb-4">
          <Link to="/portal/eshop/shop">
            <ArrowLeft className="h-4 w-4 mr-1" /> Tillbaka till butik
          </Link>
        </Button>

        <div className="flex items-center gap-3 mb-6">
          <ShoppingCart className="h-7 w-7 text-primary" />
          <h1 className="text-2xl font-bold">Varukorg</h1>
        </div>

        <div className="grid gap-6 md:grid-cols-[1.5fr,1fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Artiklar ({cart.totals.count})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cart.items.length === 0 && (
                <p className="text-sm text-muted-foreground">Varukorgen är tom.</p>
              )}
              {cart.items.map((it: any) => {
                const p = it.es_products;
                const price = Number(p?.price_excl_vat ?? 0);
                return (
                  <div key={it.id} className="flex items-center gap-3 border-b pb-3 last:border-0">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p?.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p?.sku} • {fmt(price)} kr / st
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          cart.updateQty.mutate({ id: it.id, qty: it.qty - 1 })
                        }
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-8 text-center text-sm">{it.qty}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() =>
                          cart.updateQty.mutate({ id: it.id, qty: it.qty + 1 })
                        }
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="w-24 text-right text-sm font-medium">
                      {fmt(price * it.qty)} kr
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => cart.removeItem.mutate(it.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Leveransuppgifter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label className="text-xs">Fartyg (valfritt)</Label>
                  <Select value={vesselId} onValueChange={setVesselId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Inget fartyg" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Inget fartyg</SelectItem>
                      {vessels.map((v: any) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Mottagarnamn</Label>
                  <Input
                    value={delivery.name}
                    onChange={(e) => setDelivery({ ...delivery, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label className="text-xs">Adress *</Label>
                  <Input
                    value={delivery.street}
                    onChange={(e) => setDelivery({ ...delivery, street: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Postnr</Label>
                    <Input
                      value={delivery.postal_code}
                      onChange={(e) =>
                        setDelivery({ ...delivery, postal_code: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Ort *</Label>
                    <Input
                      value={delivery.city}
                      onChange={(e) => setDelivery({ ...delivery, city: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Meddelande</Label>
                  <Textarea
                    rows={2}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Frivillig kommentar…"
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Delsumma</span>
                  <span>{fmt(cart.totals.sub)} kr</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Moms</span>
                  <span>{fmt(cart.totals.vat)} kr</span>
                </div>
                <div className="flex justify-between font-bold text-base border-t pt-2">
                  <span>Totalt</span>
                  <span>{fmt(cart.totals.grand)} kr</span>
                </div>
                <Button
                  className="w-full mt-3"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={submitting || cart.items.length === 0}
                >
                  {submitting ? 'Skapar order…' : 'Slutför beställning (faktura)'}
                </Button>
                <p className="text-[10px] text-muted-foreground text-center">
                  Beställningen skickas och faktureras enligt avtal.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}