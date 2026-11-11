import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  attempt,
  Badge,
  Button,
  Card,
  Chip,
  ChipScroller,
  EmptyState,
  ErrorBanner,
  Loading,
  notify,
  Row,
  Screen,
  SectionHeader,
  Txt,
} from '@/components/ui';
import { money, prettyDateTime } from '@/lib/format';
import { startCheckout } from '@/lib/payments';
import { supabase, unwrap } from '@/lib/supabase';
import { ORDER_STATUS_TONE, type Order, type Product } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useAuth } from '@/providers/auth';
import { useCurrentClub } from '@/providers/club';
import { radius, space, useColors } from '@/theme';

export default function Shop() {
  const c = useColors();
  const { session } = useAuth();
  const { club } = useCurrentClub();
  const [category, setCategory] = useState<string | null>(null);
  const [basket, setBasket] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<'wallet' | 'card' | null>(null);

  const data = useData(async () => {
    const [products, orders] = await Promise.all([
      supabase.from('products').select('*').eq('club_id', club.id).eq('active', true).order('category').order('name'),
      supabase
        .from('orders')
        .select('*, order_items(name, quantity, unit_price_cents)')
        .eq('club_id', club.id)
        .eq('user_id', session!.user.id)
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10),
    ]);
    return { products: unwrap(products) as Product[], orders: unwrap(orders) as Order[] };
  }, [club.id]);

  const products = useMemo(() => data.data?.products ?? [], [data.data]);
  const categories = [...new Set(products.map((p) => p.category))];
  const lines = Object.entries(basket)
    .map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty }))
    .filter((l) => l.product && l.qty > 0);
  const total = lines.reduce((s, l) => s + l.product.price_cents * l.qty, 0);
  const items = lines.map((l) => ({ product_id: l.product.id, quantity: l.qty }));

  const change = (p: Product, delta: number) =>
    setBasket((b) => {
      const next = Math.max(0, (b[p.id] ?? 0) + delta);
      if (p.stock != null && next > p.stock) return b;
      return { ...b, [p.id]: next };
    });

  const payWallet = () =>
    attempt(async () => {
      setBusy('wallet');
      try {
        unwrap(await supabase.rpc('place_wallet_order', { p_club: club.id, p_items: items }));
        setBasket({});
        await data.reload();
        notify('Order placed', 'Paid from your bar card. Collect from the pro shop.');
      } finally {
        setBusy(null);
      }
    });

  const payCard = () =>
    attempt(async () => {
      setBusy('card');
      try {
        await startCheckout({ kind: 'order', club_id: club.id, items });
        setBasket({});
        await data.reload();
      } finally {
        setBusy(null);
      }
    });

  if (data.loading && !data.data) return <Loading />;

  return (
    <Screen refreshing={data.loading} onRefresh={data.reload}>
      <ErrorBanner message={data.error} />
      {categories.length > 1 && (
        <ChipScroller>
          <Chip label="All" selected={!category} onPress={() => setCategory(null)} />
          {categories.map((cat) => (
            <Chip key={cat} label={cat} selected={category === cat} onPress={() => setCategory(cat)} />
          ))}
        </ChipScroller>
      )}
      {products.length === 0 && <EmptyState icon="pricetag-outline" title="The shop is empty" message="Check back soon." />}
      {products
        .filter((p) => !category || p.category === category)
        .map((p) => {
          const qty = basket[p.id] ?? 0;
          const soldOut = p.stock === 0;
          return (
            <Card key={p.id}>
              <Row gap={space.md} style={{ alignItems: 'flex-start' }}>
                {p.image_url ? (
                  <Image source={p.image_url} style={{ width: 72, height: 72, borderRadius: radius.sm }} contentFit="cover" />
                ) : (
                  <View style={{ width: 72, height: 72, borderRadius: radius.sm, backgroundColor: c.surfaceAlt, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="pricetag-outline" size={26} color={c.textMuted} />
                  </View>
                )}
                <View style={{ flex: 1, gap: 2 }}>
                  <Txt variant="heading">{p.name}</Txt>
                  {p.description && <Txt variant="muted" numberOfLines={2}>{p.description}</Txt>}
                  <Row style={{ justifyContent: 'space-between', marginTop: 4 }}>
                    <Txt style={{ fontWeight: '700' }}>{money(p.price_cents, club.currency)}</Txt>
                    {soldOut ? (
                      <Badge label="Sold out" tone="danger" />
                    ) : qty === 0 ? (
                      <Button small title="Add" icon="add" onPress={() => change(p, 1)} />
                    ) : (
                      <Row>
                        <Pressable onPress={() => change(p, -1)} accessibilityLabel="Remove one">
                          <Ionicons name="remove-circle-outline" size={26} color={c.primary} />
                        </Pressable>
                        <Txt style={{ fontWeight: '700', minWidth: 20, textAlign: 'center' }}>{qty}</Txt>
                        <Pressable onPress={() => change(p, 1)} accessibilityLabel="Add one">
                          <Ionicons name="add-circle-outline" size={26} color={c.primary} />
                        </Pressable>
                      </Row>
                    )}
                  </Row>
                </View>
              </Row>
            </Card>
          );
        })}

      {lines.length > 0 && (
        <Card style={{ borderColor: c.primary }}>
          <Txt variant="heading">Basket</Txt>
          {lines.map((l) => (
            <Row key={l.product.id} style={{ justifyContent: 'space-between' }}>
              <Txt>
                {l.qty} × {l.product.name}
              </Txt>
              <Txt>{money(l.product.price_cents * l.qty, club.currency)}</Txt>
            </Row>
          ))}
          <Row style={{ justifyContent: 'space-between' }}>
            <Txt variant="heading">Total</Txt>
            <Txt variant="heading">{money(total, club.currency)}</Txt>
          </Row>
          <Button title="Pay with bar card" icon="card-outline" onPress={payWallet} loading={busy === 'wallet'} />
          {club.card_payments_enabled && (
            <Button title="Pay by card" variant="secondary" onPress={payCard} loading={busy === 'card'} />
          )}
          <Txt variant="small">Click & collect from the pro shop.</Txt>
        </Card>
      )}

      {!!data.data?.orders.length && (
        <>
          <SectionHeader title="My orders" />
          {data.data.orders.map((o) => (
            <Card key={o.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="small">{prettyDateTime(o.created_at)}</Txt>
                <Badge label={o.status} tone={ORDER_STATUS_TONE[o.status]} />
              </Row>
              <Txt>{o.order_items.map((i) => `${i.quantity} × ${i.name}`).join(', ')}</Txt>
              <Txt style={{ fontWeight: '700' }}>{money(o.total_cents, club.currency)}</Txt>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
