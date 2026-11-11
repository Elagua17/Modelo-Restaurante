import { useEffect, useState } from 'react';
import type { Order, OrderItem, OrderStatus } from '@/types';
import { ORDER_STATUS_META, ORDER_COLUMNS } from '@/lib/constants';
import { money, fmtDate } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import { restoreStock } from '@/lib/stock';
import { Trash2, MapPin } from 'lucide-react';

interface KanbanBoardProps {
  orders: Order[];
  onUpdate: (id: string, patch: Partial<Order>) => void;
  onDelete: (id: string) => void;
}

export default function KanbanBoard({ orders, onUpdate, onDelete }: KanbanBoardProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [dragId, setDragId] = useState<string | null>(null);
  const [activeMobileCol, setActiveMobileCol] = useState<string>('pending');

  useEffect(() => {
    if (!expanded) return;
    let isCurrent = true;
    void supabase.from('store_order_items').select('*').eq('order_id', expanded).then(({ data }) => {
      if (data && isCurrent) setOrderItems((prev) => ({ ...prev, [expanded]: data }));
    });
    return () => {
      isCurrent = false;
    };
  }, [expanded]);

  const handleStatusChange = async (orderId: string, status: OrderStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.status === status) return;

    if (status === 'cancelled' || status === 'delivered') {
      if (!window.confirm('¿Estás seguro de cambiar el estado de este pedido?')) return;
    }

    if (status === 'cancelled' && order.status !== 'cancelled') {
      const { data: items } = await supabase.from('store_order_items').select('*').eq('order_id', order.id);
      if (items) {
        for (const item of items) {
          const cleanName = item.product_name.replace(/\s*\(Canje\)$/i, '').trim();
          const { data: prod } = await supabase.from('store_products').select('id, stock').ilike('name', cleanName).maybeSingle();
          if (prod) await restoreStock(prod.id, item.quantity);
        }
      }
    }
    onUpdate(orderId, { status });
  };

  const handleDrop = (status: OrderStatus) => {
    if (!dragId) return;
    void handleStatusChange(dragId, status);
    setDragId(null);
  };

  return (
    <div className="no-scrollbar flex flex-col gap-4 sm:flex-row sm:overflow-x-auto pb-4">
      {ORDER_COLUMNS.map((col) => {
        const meta = ORDER_STATUS_META[col.key];
        const colOrders = orders.filter((o) => o.status === col.key);
        return (
          <div
            key={col.key}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(col.key as OrderStatus)}
            className="flex flex-col sm:min-w-[300px] sm:flex-1 rounded-2xl bg-stone-50 p-3"
          >
            <div 
              className="mb-3 flex min-h-[44px] cursor-pointer items-center gap-2 px-1 sm:cursor-default"
              onClick={() => setActiveMobileCol(activeMobileCol === col.key ? '' : col.key)}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${meta.dot}`} />
              <b className="text-sm font-bold text-stone-700">{col.label}</b>
              <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs font-bold text-stone-400">{colOrders.length}</span>
            </div>
            <div className={`space-y-2 ${activeMobileCol === col.key ? 'block' : 'hidden'} sm:block`}>
              {colOrders.map((order) => {
                const isExpanded = expanded === order.id;
                return (
                  <div
                    key={order.id}
                    draggable
                    onDragStart={() => setDragId(order.id)}
                    onClick={() => setExpanded(isExpanded ? null : order.id)}
                    className="cursor-grab rounded-xl border border-stone-200 bg-white p-3 shadow-sm transition hover:shadow-md active:cursor-grabbing"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="rounded bg-stone-100 px-1.5 py-0.5 text-[10px] font-bold text-stone-500">{order.order_code}</span>
                        <p className="mt-1.5 truncate text-sm font-bold text-stone-800">{order.customer_name}</p>
                        <p className="text-xs text-stone-400">{fmtDate(order.created_at)}</p>
                      </div>
                      <span className="flex-shrink-0 text-sm font-bold text-orange-700">{money(order.total)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span className={`rounded-full ${meta.bg} px-2 py-0.5 text-[10px] font-bold ${meta.color}`}>
                        {meta.label}
                      </span>
                      {order.is_paid ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Pagado</span>
                      ) : (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">No pagado</span>
                      )}
                      <span className="text-[10px] text-stone-400">
                        {order.payment_method === 'cash' ? 'Efectivo' : 'Transferencia'}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="mt-3 border-t border-stone-100 pt-3">
                        <div className="mb-3">
                          <label className="mb-1 block text-xs font-bold text-stone-500">Cambiar estado:</label>
                          <select
                            value={order.status}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => void handleStatusChange(order.id, e.target.value as OrderStatus)}
                            className="min-h-[44px] w-full rounded-lg border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700"
                          >
                            {ORDER_COLUMNS.map((c) => (
                              <option key={c.key} value={c.key}>{c.label}</option>
                            ))}
                          </select>
                        </div>
                        
                        <p className="text-xs font-bold text-stone-500">Productos:</p>
                        {(orderItems[order.id] ?? []).map((item) => (
                          <div key={item.id} className="flex justify-between py-1 text-xs text-stone-600">
                            <span>{item.quantity}x {item.product_name}</span>
                            <span>{money(item.line_total)}</span>
                          </div>
                        ))}
                        {!orderItems[order.id] && <p className="text-xs text-stone-400">Cargando...</p>}
                        
                        <div className="mt-3 flex flex-wrap gap-2">
                          {order.delivery_type === 'delivery' && order.delivery_lat && (
                            <a
                              href={`https://www.google.com/maps?q=${order.delivery_lat},${order.delivery_lng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex min-h-[44px] items-center gap-1 rounded-full bg-blue-50 px-3 py-2 text-xs font-bold text-blue-600"
                            >
                              <MapPin size={14} /> Ver ubicación
                            </a>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); onDelete(order.id); }}
                            className="flex min-h-[44px] items-center gap-1 rounded-full bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                          >
                            <Trash2 size={14} /> Eliminar
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onUpdate(order.id, { is_paid: !order.is_paid }); }}
                            className={`min-h-[44px] rounded-full px-3 py-2 text-xs font-bold ${order.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}
                          >
                            {order.is_paid ? 'Pagado' : 'Marcar pagado'}
                          </button>
                          <select
                            value={order.payment_method}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => { onUpdate(order.id, { payment_method: e.target.value as 'cash' | 'transfer' }); }}
                            className="min-h-[44px] rounded-full border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-600"
                          >
                            <option value="cash">Efectivo</option>
                            <option value="transfer">Transferencia</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {!colOrders.length && <p className="py-6 text-center text-xs text-stone-400">Sin pedidos</p>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
