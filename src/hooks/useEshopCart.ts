import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/contexts/OrganizationContext';
import { toast } from 'sonner';

export function useEshopCart() {
  const { selectedOrgId } = useOrganization();
  const qc = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const cartQuery = useQuery({
    queryKey: ['es_cart', selectedOrgId, userId],
    enabled: !!selectedOrgId && !!userId,
    queryFn: async () => {
      // get or create cart
      const { data: existing } = await supabase
        .from('es_carts')
        .select('*')
        .eq('organization_id', selectedOrgId!)
        .eq('user_id', userId!)
        .maybeSingle();
      let cart = existing;
      if (!cart) {
        const { data: created, error } = await supabase
          .from('es_carts')
          .insert({ organization_id: selectedOrgId!, user_id: userId! })
          .select()
          .single();
        if (error) throw error;
        cart = created;
      }
      const { data: items, error: e2 } = await supabase
        .from('es_cart_items')
        .select('*, es_products(id,name,sku,price_excl_vat,vat_rate)')
        .eq('cart_id', cart.id);
      if (e2) throw e2;
      return { cart, items: items ?? [] };
    },
  });

  const addItem = useMutation({
    mutationFn: async ({ productId, qty = 1 }: { productId: string; qty?: number }) => {
      const cartId = cartQuery.data?.cart.id;
      if (!cartId) throw new Error('Ingen varukorg');
      const existing = cartQuery.data?.items.find((i: any) => i.product_id === productId && !i.variant_id);
      if (existing) {
        const { error } = await supabase
          .from('es_cart_items')
          .update({ qty: existing.qty + qty })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('es_cart_items')
          .insert({ cart_id: cartId, product_id: productId, qty });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['es_cart'] });
      toast.success('Lagt i varukorg');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateQty = useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => {
      if (qty <= 0) {
        const { error } = await supabase.from('es_cart_items').delete().eq('id', id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('es_cart_items').update({ qty }).eq('id', id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['es_cart'] }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('es_cart_items').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['es_cart'] }),
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      const cartId = cartQuery.data?.cart.id;
      if (!cartId) return;
      const { error } = await supabase.from('es_cart_items').delete().eq('cart_id', cartId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['es_cart'] }),
  });

  const items = cartQuery.data?.items ?? [];
  const totals = items.reduce(
    (acc: any, it: any) => {
      const price = Number(it.es_products?.price_excl_vat ?? 0);
      const vat = Number(it.es_products?.vat_rate ?? 25);
      const line = price * it.qty;
      acc.sub += line;
      acc.vat += line * (vat / 100);
      acc.count += it.qty;
      return acc;
    },
    { sub: 0, vat: 0, count: 0 }
  );

  return {
    userId,
    cart: cartQuery.data?.cart,
    items,
    isLoading: cartQuery.isLoading,
    totals: { ...totals, grand: totals.sub + totals.vat },
    addItem,
    updateQty,
    removeItem,
    clearCart,
    refetch: cartQuery.refetch,
  };
}