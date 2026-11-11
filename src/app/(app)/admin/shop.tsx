import { useState } from 'react';
import { View } from 'react-native';

import {
  attempt,
  Badge,
  Button,
  Card,
  Chip,
  confirm,
  EmptyState,
  ErrorBanner,
  Field,
  Loading,
  Row,
  Screen,
  Stack,
  Toggle,
  Txt,
} from '@/components/ui';
import { money, parseMoney, prettyDateTime } from '@/lib/format';
import { supabase, unwrap } from '@/lib/supabase';
import { ORDER_STATUS_TONE, type Order, type OrderStatus, type Product } from '@/lib/types';
import { useData } from '@/lib/use-data';
import { useCurrentClub } from '@/providers/club';

const EMPTY = { name: '', description: '', category: 'General', price: '', stock: '', image_url: '', active: true };

export default function AdminShop() {
  const { club, canManage } = useCurrentClub();
  const [tab, setTab] = useState<'orders' | 'products'>('orders');
  const [editing, setEditing] = useState<Product | 'new' | null>(null);

  const data = useData(async () => {
    const [products, orders] = await Promise.all([
      supabase.from('products').select('*').eq('club_id', club.id).order('category').order('name'),
      supabase
        .from('orders')
        .select('*, order_items(name, quantity, unit_price_cents), profiles(full_name)')
        .eq('club_id', club.id)
        .in('status', ['paid', 'ready'])
        .order('created_at'),
    ]);
    return { products: unwrap(products) as Product[], orders: unwrap(orders) as Order[] };
  }, [club.id]);

  if (!canManage('pro_shop')) return <Screen><Txt>You don't have access to the pro shop.</Txt></Screen>;
  if (data.loading && !data.data) return <Loading />;

  const setStatus = (o: Order, status: OrderStatus) =>
    attempt(async () => {
      unwrap(await supabase.from('orders').update({ status }).eq('id', o.id));
      await data.reload();
    });

  return (
    <Screen refreshing={data.loading} onRefresh={data.reload}>
      <ErrorBanner message={data.error} />
      <Row>
        <Chip label={`Orders to fulfil (${data.data?.orders.length ?? 0})`} selected={tab === 'orders'} onPress={() => setTab('orders')} />
        <Chip label="Products" selected={tab === 'products'} onPress={() => setTab('products')} />
      </Row>

      {tab === 'orders' && (
        <>
          {data.data?.orders.length === 0 && <EmptyState icon="bag-check-outline" title="No open orders" />}
          {data.data?.orders.map((o) => (
            <Card key={o.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Txt variant="heading">{o.profiles?.full_name}</Txt>
                <Badge label={o.status} tone={ORDER_STATUS_TONE[o.status]} />
              </Row>
              <Txt variant="small">
                {prettyDateTime(o.created_at)} · {o.payment_method === 'wallet' ? 'Bar card' : 'Card'} · {money(o.total_cents, club.currency)}
              </Txt>
              {o.order_items.map((i, idx) => (
                <Txt key={idx}>
                  {i.quantity} × {i.name}
                </Txt>
              ))}
              <Row>
                {o.status === 'paid' && <Button small title="Mark ready" onPress={() => setStatus(o, 'ready')} />}
                <Button small variant="secondary" title="Collected" onPress={() => setStatus(o, 'collected')} />
              </Row>
            </Card>
          ))}
        </>
      )}

      {tab === 'products' && (
        <>
          {editing ? (
            <ProductForm
              key={editing === 'new' ? 'new' : editing.id}
              clubId={club.id}
              product={editing === 'new' ? null : editing}
              onDone={async () => {
                setEditing(null);
                await data.reload();
              }}
            />
          ) : (
            <Button title="Add product" icon="add" onPress={() => setEditing('new')} />
          )}
          {data.data?.products.map((p) => (
            <Card key={p.id} onPress={() => setEditing(p)}>
              <Row style={{ justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Txt variant="heading">{p.name}</Txt>
                  <Txt variant="small">
                    {p.category} · {money(p.price_cents, club.currency)} · {p.stock == null ? 'Stock not tracked' : `${p.stock} in stock`}
                  </Txt>
                </View>
                {!p.active && <Badge label="Hidden" />}
              </Row>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

function ProductForm({ clubId, product, onDone }: { clubId: string; product: Product | null; onDone: () => Promise<void> }) {
  const [f, setF] = useState(
    product
      ? {
          name: product.name,
          description: product.description ?? '',
          category: product.category,
          price: (product.price_cents / 100).toFixed(2),
          stock: product.stock?.toString() ?? '',
          image_url: product.image_url ?? '',
          active: product.active,
        }
      : EMPTY,
  );
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const [busy, setBusy] = useState(false);

  const save = () =>
    attempt(async () => {
      const price = parseMoney(f.price);
      if (!f.name.trim()) throw new Error('Enter a product name');
      if (price == null) throw new Error('Enter a valid price');
      const payload = {
        club_id: clubId,
        name: f.name.trim(),
        description: f.description.trim() || null,
        category: f.category.trim() || 'General',
        price_cents: price,
        stock: f.stock.trim() === '' ? null : Number(f.stock),
        image_url: f.image_url.trim() || null,
        active: f.active,
      };
      setBusy(true);
      try {
        if (product) unwrap(await supabase.from('products').update(payload).eq('id', product.id));
        else unwrap(await supabase.from('products').insert(payload));
        await onDone();
      } finally {
        setBusy(false);
      }
    });

  const remove = async () => {
    if (!product || !(await confirm('Delete product?', product.name, 'Delete'))) return;
    await attempt(async () => {
      unwrap(await supabase.from('products').delete().eq('id', product.id));
      await onDone();
    });
  };

  return (
    <Card>
      <Stack>
        <Txt variant="heading">{product ? 'Edit product' : 'New product'}</Txt>
        <Field label="Name" value={f.name} onChangeText={(name) => set({ name })} />
        <Field label="Description" value={f.description} onChangeText={(description) => set({ description })} multiline />
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field label="Category" value={f.category} onChangeText={(category) => set({ category })} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Price" value={f.price} onChangeText={(price) => set({ price })} keyboardType="decimal-pad" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Stock" value={f.stock} onChangeText={(stock) => set({ stock })} keyboardType="number-pad" placeholder="Untracked" />
          </View>
        </Row>
        <Field label="Image URL" value={f.image_url} onChangeText={(image_url) => set({ image_url })} autoCapitalize="none" placeholder="https://…" />
        <Toggle label="Visible to members" value={f.active} onValueChange={(active) => set({ active })} />
        <Row>
          <Button style={{ flex: 1 }} title="Save" onPress={save} loading={busy} />
          <Button style={{ flex: 1 }} title="Cancel" variant="secondary" onPress={() => void onDone()} />
        </Row>
        {product && <Button title="Delete product" variant="danger" onPress={remove} />}
      </Stack>
    </Card>
  );
}
