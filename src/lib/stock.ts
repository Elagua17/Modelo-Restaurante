import { supabase } from './supabase';
import type { Product } from '@/types';

export async function incrementPageView() {
  const { data } = await supabase.from('store_page_views').select('*').eq('id', 1).maybeSingle();
  const current = data?.count ?? 0;
  await supabase.from('store_page_views').upsert({ id: 1, count: current + 1 });
}

export async function trackProductView(productId: string) {
  await supabase.from('store_product_views').insert({ product_id: productId });
}

export async function decrementStock(product: Product, amount: number) {
  if (product.stock === null) return;
  const newStock = Math.max(0, product.stock - amount);
  await supabase.from('store_products').update({ stock: newStock }).eq('id', product.id);
}

export async function restoreStock(productId: string, amount: number) {
  const { data } = await supabase.from('store_products').select('*').eq('id', productId).maybeSingle();
  if (data && data.stock !== null) {
    await supabase.from('store_products').update({ stock: data.stock + amount }).eq('id', productId);
  }
}
