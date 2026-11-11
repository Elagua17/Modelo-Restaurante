import type { Order, OrderItem, Product } from '@/types';
import { money } from '@/lib/utils';
import { TrendingUp, Eye, Package, BarChart3, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface StatsDashboardProps {
  orders: Order[];
  products: Product[];
}

export default function StatsDashboard({ orders, products }: StatsDashboardProps) {
  const [pageViews, setPageViews] = useState(0);
  const [productViews, setProductViews] = useState<Record<string, number>>({});
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    void supabase.from('store_page_views').select('*').eq('id', 1).maybeSingle().then(({ data }) => setPageViews(data?.count ?? 0));
    void supabase.from('store_product_views').select('product_id').then(({ data }) => {
      const counts: Record<string, number> = {};
      (data ?? []).forEach((v: { product_id: string }) => { counts[v.product_id] = (counts[v.product_id] ?? 0) + 1; });
      setProductViews(counts);
    });
    void supabase.from('store_order_items').select('*').then(({ data }) => setOrderItems(data ?? []));
  }, [orders]);

  const validOrders = orders.filter((o) => o.status === 'delivered');
  const totalSales = validOrders.reduce((s, o) => s + o.total, 0);

  const productSales: Record<string, { name: string; qty: number; revenue: number }> = {};
  const validOrderIds = new Set(validOrders.map((o) => o.id));
  
  orderItems.filter(item => validOrderIds.has(item.order_id)).forEach((item) => {
    if (!productSales[item.product_name]) productSales[item.product_name] = { name: item.product_name, qty: 0, revenue: 0 };
    productSales[item.product_name].qty += item.quantity;
    productSales[item.product_name].revenue += item.line_total;
  });
  const topProducts = Object.values(productSales).sort((a, b) => b.qty - a.qty).slice(0, 5);
  const maxQty = topProducts[0]?.qty ?? 1;

  const totalProductViews = Object.values(productViews).reduce((s, v) => s + v, 0);

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="panel">
          <TrendingUp className="text-green-600" size={22} />
          <span className="mt-3">Ventas totales</span>
          <strong>{money(totalSales)}</strong>
          <small>{validOrders.length} pedidos válidos</small>
        </div>
        <div className="panel">
          <Eye className="text-blue-600" size={22} />
          <span className="mt-3">Vistas de la página</span>
          <strong>{pageViews.toLocaleString('es-AR')}</strong>
          <small>Visitas totales</small>
        </div>
        <div className="panel">
          <BarChart3 className="text-orange-600" size={22} />
          <span className="mt-3">Vistas de productos</span>
          <strong>{totalProductViews.toLocaleString('es-AR')}</strong>
          <small>Visualizaciones individuales</small>
        </div>
        <div className="panel">
          <Package className="text-stone-600" size={22} />
          <span className="mt-3">Productos activos</span>
          <strong>{products.filter((p) => p.available).length}</strong>
          <small>{products.length} en total</small>
        </div>
      </div>

      {/* Top products chart */}
      <div className="panel">
        <div className="flex items-center gap-2">
          <Star className="text-orange-600" size={20} />
          <h2 className="section-title">Productos más demandados</h2>
        </div>
        {topProducts.length ? (
          <div className="mt-5 space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-700">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between text-sm">
                    <b className="truncate text-stone-700">{p.name}</b>
                    <span className="ml-2 flex-shrink-0 font-bold text-orange-700">{p.qty} vendidos</span>
                  </div>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-stone-100">
                    <div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-orange-600" style={{ width: `${(p.qty / maxQty) * 100}%` }} />
                  </div>
                </div>
                <span className="hidden flex-shrink-0 text-sm font-semibold text-stone-500 sm:block">{money(p.revenue)}</span>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-stone-500">Todavía no hay ventas registradas.</p>}
      </div>

    </div>
  );
}
