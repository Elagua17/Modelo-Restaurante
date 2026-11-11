import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Edit3, History, Lock, Plus, Save, Trash2, X, BarChart3, KanbanSquare, Users } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CashRegister, Category, Order, OrderItem, OrderStatus, PaymentMethod, Product, Settings, UserPoints } from '@/types';
import { MAX_DELIVERY_KM, initialSettings, photos } from '@/lib/constants';
import { money, fmtDate, sanitizeUrl } from '@/lib/utils';
import PinLock from '@/components/PinLock';
import KanbanBoard from '@/components/KanbanBoard';
import StatsDashboard from '@/components/StatsDashboard';

type Tab = 'overview' | 'catalog' | 'orders' | 'history' | 'stats' | 'cash' | 'clients' | 'settings';

interface AdminPageProps {
  unlocked: boolean;
  onUnlock: () => void;
}

export default function AdminPage({ unlocked, onUnlock }: AdminPageProps) {
  const [tab, setTab] = useState<Tab>('overview');
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [registers, setRegisters] = useState<CashRegister[]>([]);
  const [clients, setClients] = useState<UserPoints[]>([]);
  const [cashOpenedAt, setCashOpenedAt] = useState<string>(
    () => localStorage.getItem('lacabrera-cash-opened') || localStorage.getItem('rincon-cash-opened') || new Date().toISOString()
  );
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [editing, setEditing] = useState<Product | null>(null);
  const [creating, setCreating] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [newName, setNewName] = useState('');
  const [selectedClient, setSelectedClient] = useState<UserPoints | null>(null);
  const [clientOrders, setClientOrders] = useState<Order[]>([]);
  const [orderFilterStatus, setOrderFilterStatus] = useState<string>('all');
  const [orderFilterDateFrom, setOrderFilterDateFrom] = useState<string>('');
  const [orderFilterDateTo, setOrderFilterDateTo] = useState<string>('');
  const [cashFilterDateFrom, setCashFilterDateFrom] = useState<string>('');
  const [cashFilterDateTo, setCashFilterDateTo] = useState<string>('');
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [viewingOrderItems, setViewingOrderItems] = useState<OrderItem[]>([]);

  const refresh = async () => {
    const [{ data: cats }, { data: prods }, { data: ords }, { data: set }, { data: regs }, { data: usrs }] = await Promise.all([
      supabase.from('store_categories').select('*').order('display_order'),
      supabase.from('store_products').select('*').order('created_at', { ascending: false }),
      supabase.from('store_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('store_settings').select('*').maybeSingle(),
      supabase.from('store_cash_registers').select('*').order('closed_at', { ascending: false }),
      supabase.from('store_user_points').select('*').order('name'),
    ]);
    setCategories(cats ?? []);
    setProducts(prods ?? []);
    setOrders(ords ?? []);
    if (set) setSettings(set);
    setRegisters(regs ?? []);
    setClients(usrs ?? []);
  };

  useEffect(() => { if (unlocked) void refresh(); }, [unlocked]);

  const paid = orders.filter((o) => o.is_paid && o.status !== 'cancelled' && !o.closed_in_register);
  const cash = paid.filter((o) => o.payment_method === 'cash').reduce((s, o) => s + o.total, 0);
  const transfer = paid.filter((o) => o.payment_method === 'transfer').reduce((s, o) => s + o.total, 0);

  const updateOrder = async (id: string, patch: Partial<Order>) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    
    if (patch.is_paid !== undefined && patch.is_paid !== order.is_paid) {
      if (order.earned_points && order.customer_username) {
        const { data: user } = await supabase.from('store_user_points').select('*').eq('username', order.customer_username).maybeSingle();
        if (user) {
          const newPoints = patch.is_paid ? user.points + order.earned_points : Math.max(0, user.points - order.earned_points);
          await supabase.from('store_user_points').update({ points: newPoints }).eq('id', user.id);
          await supabase.from('store_point_movements').insert({ username: user.username, delta: patch.is_paid ? order.earned_points : -order.earned_points, reason: patch.is_paid ? `Puntos ganados por pedido ${order.order_code}` : `Reversión de puntos pedido ${order.order_code}` });
        }
      }
    }
    await supabase.from('store_orders').update(patch).eq('id', id);
    setOrders((list) => list.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  };

  const deleteOrder = async (id: string) => {
    await supabase.from('store_orders').delete().eq('id', id);
    setOrders((list) => list.filter((o) => o.id !== id));
  };

  const deleteCategory = async (id: string) => {
    await supabase.from('store_categories').delete().eq('id', id);
    void refresh();
  };

  const closeCash = async () => {
    const total = cash + transfer;
    await supabase.from('store_cash_registers').insert({ opened_at: cashOpenedAt, closed_at: new Date().toISOString(), cash_total: cash, transfer_total: transfer, grand_total: total, order_count: paid.length });
    const now = new Date().toISOString();
    localStorage.setItem('lacabrera-cash-opened', now);
    setCashOpenedAt(now);
    await supabase.from('store_orders').update({ closed_in_register: true }).in('id', paid.map((o) => o.id));
    void refresh();
  };
  const saveSettings = async (event: FormEvent) => { event.preventDefault(); await supabase.from('store_settings').upsert(settings); };
  const addCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!newName.trim()) return;
    await supabase.from('store_categories').insert({ name: newName, description: 'Nueva categoría', display_order: categories.length + 1 });
    setNewName('');
    void refresh();
  };
  const saveProduct = async (event: FormEvent) => {
    event.preventDefault();
    const product = editing ?? creating;
    if (!product) return;
    const cleanName = product.name.trim();
    if (!cleanName) {
      alert('El nombre del producto no puede estar vacío.');
      return;
    }
    const payload = {
      name: cleanName,
      description: product.description.trim(),
      price: Math.max(0, Number(product.price) || 0),
      category_id: product.category_id || null,
      available: Boolean(product.available),
      featured: Boolean(product.featured),
      image_url: sanitizeUrl(product.image_url, photos[0]),
      stock: product.stock === null ? null : Math.max(0, Math.floor(Number(product.stock) || 0)),
      points: Math.max(0, Math.floor(Number(product.points) || 0)),
      is_reward: Boolean(product.is_reward),
      points_cost: Math.max(0, Math.floor(Number(product.points_cost) || 0)),
    };
    let error;
    if (editing) {
      const res = await supabase.from('store_products').update(payload).eq('id', editing.id);
      error = res.error;
    } else {
      const res = await supabase.from('store_products').insert({ ...payload, available: true });
      error = res.error;
    }
    if (error) { alert(`Error al guardar: ${error.message}`); return; }
    setEditing(null); setCreating(null); void refresh();
  };

  const saveCategory = async (event: FormEvent) => {
    event.preventDefault();
    if (!editingCategory) return;
    const cleanName = editingCategory.name.trim();
    if (!cleanName) {
      alert('El nombre de la categoría no puede estar vacío.');
      return;
    }
    await supabase.from('store_categories').update({
      name: cleanName,
      description: editingCategory.description.trim(),
      image_url: editingCategory.image_url ? sanitizeUrl(editingCategory.image_url, '') : ''
    }).eq('id', editingCategory.id);
    setEditingCategory(null);
    void refresh();
  };

  const loadClientOrders = async (client: UserPoints) => {
    setSelectedClient(client);
    const { data } = await supabase.from('store_orders').select('*').eq('customer_username', client.username).eq('status', 'delivered').order('created_at', { ascending: false });
    setClientOrders(data ?? []);
  };

  const openOrderModal = async (order: Order) => {
    setViewingOrder(order);
    const { data } = await supabase.from('store_order_items').select('*').eq('order_id', order.id);
    setViewingOrderItems(data ?? []);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Resumen' },
    { key: 'catalog', label: 'Catálogo' },
    { key: 'orders', label: 'Pedidos' },
    { key: 'history', label: 'Historial' },
    { key: 'stats', label: 'Estadísticas' },
    { key: 'cash', label: 'Caja' },
    { key: 'clients', label: 'Clientes' },
    { key: 'settings', label: 'Envíos' },
  ];

  const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

  const processUploadedImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        reject(new Error('Formato no permitido. Solo se aceptan imágenes JPG, PNG o WEBP (no se permiten archivos SVG ni ejecutables).'));
        return;
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        reject(new Error('La imagen excede el límite máximo de 2 MB.'));
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result;
        if (typeof result === 'string' && result.startsWith('data:image/')) {
          resolve(result);
        } else {
          reject(new Error('Error al decodificar la imagen.'));
        }
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo.'));
      reader.readAsDataURL(file);
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const result = await processUploadedImage(file);
        if (editing) setEditing({ ...editing, image_url: result });
        else if (creating) setCreating({ ...creating, image_url: result });
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Error al procesar el archivo');
        e.target.value = '';
      }
    }
  };

  const blankProduct: Product = { id: '', category_id: null, name: '', description: '', price: 0, image_url: '', available: true, featured: false, stock: null, points: 0, is_reward: false, points_cost: 0 };
  const productForm = (product: Product) => (
    <div className="mt-5 space-y-3">
      <input value={product.name} onChange={(e) => editing ? setEditing({ ...editing, name: e.target.value }) : setCreating({ ...creating!, name: e.target.value })} placeholder="Nombre del producto" className="field w-full" />
      <textarea value={product.description} onChange={(e) => editing ? setEditing({ ...editing, description: e.target.value }) : setCreating({ ...creating!, description: e.target.value })} placeholder="Descripción" className="field w-full" rows={3} />
      <div className="grid gap-3 sm:grid-cols-2">
        <input type="number" value={product.price} onChange={(e) => editing ? setEditing({ ...editing, price: Number(e.target.value) }) : setCreating({ ...creating!, price: Number(e.target.value) })} placeholder="Precio" className="field" />
        <input type="number" value={product.points} onChange={(e) => editing ? setEditing({ ...editing, points: Number(e.target.value) }) : setCreating({ ...creating!, points: Number(e.target.value) })} placeholder="Puntos que otorga" className="field" />
      </div>
      <div className="flex items-center gap-3">
        {product.image_url && <img src={sanitizeUrl(product.image_url)} alt="preview" className="h-12 w-12 rounded-xl object-cover" />}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} className="field w-full flex-1" />
      </div>
      <select value={product.category_id ?? ''} onChange={(e) => editing ? setEditing({ ...editing, category_id: e.target.value }) : setCreating({ ...creating!, category_id: e.target.value })} className="select w-full">
        <option value="">Sin categoría</option>
        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <div className="flex gap-3">
        <label className="label flex flex-1 items-center gap-2">
          <input type="checkbox" checked={product.featured} onChange={(e) => editing ? setEditing({ ...editing, featured: e.target.checked }) : setCreating({ ...creating!, featured: e.target.checked })} /> Favorito
        </label>
        <label className="label flex flex-1 items-center gap-2">
          <input type="checkbox" checked={product.available} onChange={(e) => editing ? setEditing({ ...editing, available: e.target.checked }) : setCreating({ ...creating!, available: e.target.checked })} /> Disponible
        </label>
      </div>
      <div className="flex gap-3 mt-2 mb-2 p-3 bg-stone-50 rounded-xl">
        <label className="label flex flex-1 items-center gap-2">
          <input type="checkbox" checked={product.is_reward || false} onChange={(e) => editing ? setEditing({ ...editing, is_reward: e.target.checked }) : setCreating({ ...creating!, is_reward: e.target.checked })} /> Es recompensa
        </label>
        {(product.is_reward) && (
          <input type="number" value={product.points_cost || 0} onChange={(e) => editing ? setEditing({ ...editing, points_cost: Number(e.target.value) }) : setCreating({ ...creating!, points_cost: Number(e.target.value) })} placeholder="Costo pts" className="field w-24" />
        )}
      </div>
      <div className="rounded-xl bg-orange-50 p-4">
        <p className="label mb-2">Stock</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-stone-600">
            <input type="radio" checked={product.stock === null} onChange={() => editing ? setEditing({ ...editing, stock: null }) : setCreating({ ...creating!, stock: null })} /> Infinito
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-stone-600">
            <input type="radio" checked={product.stock !== null} onChange={() => editing ? setEditing({ ...editing, stock: 0 }) : setCreating({ ...creating!, stock: 0 })} /> Cantidad
          </label>
          {product.stock !== null && (
            <input type="number" min={0} value={product.stock} onChange={(e) => editing ? setEditing({ ...editing, stock: Number(e.target.value) }) : setCreating({ ...creating!, stock: Number(e.target.value) })} className="field w-28" />
          )}
        </div>
      </div>
    </div>
  );

  if (!unlocked) return <PinLock onUnlock={onUnlock} />;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-orange-100 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link to="/" className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-orange-700">
            <ArrowLeft size={16} /> Volver a la carta
          </Link>
          <h1 className="font-display text-4xl font-bold text-stone-800 sm:text-5xl">Panel de cocina</h1>
          <p className="mt-1 text-sm text-stone-500">Todo lo que necesitás para llevar La Cabrera.</p>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-orange-100 sm:block sm:px-5 sm:text-right">
          <p className="text-xs font-bold uppercase tracking-widest text-stone-400">Caja actual</p>
          <b className="text-xl text-orange-700 sm:text-2xl">{money(cash + transfer)}</b>
        </div>
      </div>

      {/* Tabs - scrollable on mobile */}
      <div className="no-scrollbar my-6 flex gap-2 overflow-x-auto pb-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-bold ${tab === t.key ? 'bg-[#2c211d] text-white' : 'bg-white text-stone-500 ring-1 ring-orange-100'}`}
          >
            {t.key === 'orders' && <KanbanSquare size={14} />}
            {t.key === 'history' && <History size={14} />}
            {t.key === 'stats' && <BarChart3 size={14} />}
            {t.key === 'clients' && <Users size={14} />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === 'overview' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="panel"><span>Pedidos recibidos</span><strong>{orders.length}</strong></div>
          <div className="panel"><span>Total efectivo</span><strong>{money(cash)}</strong><small>Pedidos pagos</small></div>
          <div className="panel"><span>Total transferencia</span><strong>{money(transfer)}</strong><small>Pedidos pagos</small></div>
          <div className="mt-2 rounded-3xl bg-[#2c211d] p-6 text-white sm:col-span-3">
            <p className="text-xs font-bold uppercase tracking-widest text-[#ffbd70]">Actividad reciente</p>
            {orders.filter(o => o.status === 'pending').slice(0, 5).map((o) => (
              <div key={o.id} className="flex flex-col justify-between gap-2 border-b border-white/10 py-3 text-sm sm:flex-row">
                <span><b>{o.order_code}</b> · {o.customer_name} · {o.delivery_type === 'delivery' ? 'Envío' : 'Retiro'}</span>
                <span className="font-bold text-[#ffbd70]">{money(o.total)}</span>
              </div>
            ))}
            {!orders.filter(o => o.status === 'pending').length && <p className="mt-4 text-orange-100">No hay pedidos pendientes.</p>}
          </div>
        </div>
      )}

      {/* Catalog */}
      {tab === 'catalog' && (
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[.8fr_1.2fr]">
          <div className="panel h-fit">
            <h2 className="section-title">Categorías</h2>
            <form onSubmit={addCategory} className="mt-4 flex gap-2">
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva categoría" className="field min-w-0 flex-1" />
              <button type="submit" className="rounded-xl bg-orange-600 px-4 text-white"><Plus size={18} /></button>
            </form>
            <div className="mt-5 space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-xl bg-orange-50 px-4 py-3 text-sm font-semibold">
                  <span>{c.name}<span className="ml-2 text-xs text-stone-400">{products.filter((p) => p.category_id === c.id).length} productos</span></span>
                  <div className="flex gap-2">
                    <button onClick={() => setEditingCategory(c)} className="rounded-full p-1.5 text-stone-400 transition hover:bg-orange-100 hover:text-orange-700" title="Editar"><Edit3 size={15} /></button>
                    <button onClick={() => void deleteCategory(c.id)} className="rounded-full p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600" title="Eliminar"><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="flex items-center justify-between">
              <h2 className="section-title">Productos</h2>
              <button onClick={() => setCreating({ ...blankProduct })} className="flex items-center gap-2 rounded-full bg-orange-600 px-4 py-2 text-sm font-bold text-white"><Plus size={16} /> Nuevo</button>
            </div>
            <div className="mt-5 space-y-3">
              {products.map((p) => (
                <div key={p.id} className="flex flex-col gap-3 rounded-2xl border border-stone-100 p-3 sm:flex-row sm:items-center">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <img src={sanitizeUrl(p.image_url)} alt="" className="h-12 w-12 flex-shrink-0 rounded-xl object-cover sm:h-14 sm:w-14" />
                    <div className="min-w-0 flex-1">
                      <b className="block truncate text-sm text-stone-800">{p.name}</b>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="text-sm font-bold text-orange-700">{money(p.price)}</span>
                        <span className="text-xs text-stone-400">{p.stock === null ? 'Stock ∞' : `${p.stock} en stock`}</span>
                        <span className="text-xs text-[#b8860b]">{p.points} pts</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:flex-shrink-0">
                    <button onClick={() => setEditing(p)} className="rounded-full p-2 text-stone-400 hover:bg-orange-50 hover:text-orange-700"><Edit3 size={16} /></button>
                    <button onClick={async () => { await supabase.from('store_products').delete().eq('id', p.id); void refresh(); }} className="rounded-full p-2 text-stone-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                    <button onClick={async () => { await supabase.from('store_products').update({ available: !p.available }).eq('id', p.id); void refresh(); }} className={`rounded-full px-3 py-1 text-xs font-bold ${p.available ? 'bg-green-100 text-green-700' : 'bg-stone-100 text-stone-500'}`}>{p.available ? 'Activo' : 'Oculto'}</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Orders - Kanban */}
      {tab === 'orders' && (
        <div className="panel">
          <div className="mb-4 flex items-center gap-2">
            <KanbanSquare className="text-orange-600" size={20} />
            <h2 className="section-title">Tablero de pedidos</h2>
          </div>
          <p className="mb-4 text-sm text-stone-500">Los pedidos finalizados o cancelados desaparecerán de aquí y se moverán al Historial.</p>
          <KanbanBoard orders={orders.filter(o => o.status === 'pending' || o.status === 'preparing')} onUpdate={updateOrder} onDelete={deleteOrder} />
        </div>
      )}

      {/* Orders - History */}
      {tab === 'history' && (
        <div className="panel">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2">
              <History className="text-orange-600" size={20} />
              <h2 className="section-title">Historial de pedidos</h2>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-semibold text-stone-500">Fecha inicio<input type="date" value={orderFilterDateFrom} onChange={(e) => setOrderFilterDateFrom(e.target.value)} className="field text-sm w-auto py-1.5 mt-1 block" /></label>
              <label className="text-xs font-semibold text-stone-500">Fecha fin<input type="date" value={orderFilterDateTo} onChange={(e) => setOrderFilterDateTo(e.target.value)} className="field text-sm w-auto py-1.5 mt-1 block" /></label>
              <select value={orderFilterStatus} onChange={(e) => setOrderFilterStatus(e.target.value)} className="select text-sm w-auto py-1.5">
                <option value="all">Todos los estados</option>
                <option value="delivered">Entregado</option>
                <option value="cancelled">Cancelado</option>
              </select>
            </div>
          </div>
          <div className="overflow-x-auto pb-2">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-stone-100 text-xs uppercase tracking-wider text-stone-400">
                <tr><th className="pb-3">Fecha</th><th className="pb-3">Cliente</th><th className="pb-3">Total</th><th className="pb-3">Estado</th><th className="pb-3">Pago</th><th className="pb-3">Método</th></tr>
              </thead>
              <tbody>
                {orders
                  .filter(o => o.status === 'delivered' || o.status === 'cancelled')
                  .filter(o => orderFilterStatus === 'all' ? true : o.status === orderFilterStatus)
                  .filter(o => {
                    if (orderFilterDateFrom && o.created_at < orderFilterDateFrom) return false;
                    if (orderFilterDateTo && o.created_at > orderFilterDateTo + 'T23:59:59') return false;
                    return true;
                  })
                  .map(o => (
                    <tr key={o.id} className="border-b border-stone-100">
                      <td className="py-4 text-stone-600 font-mono text-sm">{fmtDate(o.created_at)}</td>
                      <td className="py-4">
                        <b>{o.customer_name}</b>
                        <button onClick={() => openOrderModal(o)} className="block mt-1 font-mono text-xs font-bold text-orange-600 hover:text-orange-800 underline underline-offset-2">
                          {o.order_code}
                        </button>
                      </td>
                      <td className="py-4 font-mono font-bold text-orange-700">{money(o.total)}</td>
                      <td className="py-4">
                        <select
                          value={o.status}
                          onChange={(e) => updateOrder(o.id, { status: e.target.value as OrderStatus })}
                          className="select text-xs font-semibold py-1.5 min-w-[120px]"
                        >
                          <option value="pending">Pendiente (Mover a Kanban)</option>
                          <option value="preparing">En preparación (Mover a Kanban)</option>
                          <option value="delivered">Entregado</option>
                          <option value="cancelled">Cancelado</option>
                        </select>
                      </td>
                      <td className="py-4">
                        <button
                          onClick={() => updateOrder(o.id, { is_paid: !o.is_paid })}
                          className={`rounded-full px-3 py-1 text-xs font-bold ${o.is_paid ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}
                        >
                          {o.is_paid ? 'Pagado' : 'Pendiente'}
                        </button>
                      </td>
                      <td className="py-4">
                        <select
                          value={o.payment_method}
                          onChange={(e) => updateOrder(o.id, { payment_method: e.target.value as PaymentMethod })}
                          className="select text-xs font-semibold py-1.5"
                        >
                          <option value="cash">Efectivo</option>
                          <option value="transfer">Transferencia</option>
                        </select>
                      </td>
                    </tr>
                ))}
                {!orders.filter(o => o.status === 'delivered' || o.status === 'cancelled').length && <tr><td colSpan={6} className="py-6 text-center text-stone-400">No hay pedidos finalizados</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stats */}
      {tab === 'stats' && <StatsDashboard orders={orders} products={products} />}

      {/* Cash */}
      {tab === 'cash' && (
        <div className="space-y-6">
          <div className="panel">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="section-title">Caja actual</h2>
                <p className="mt-1 text-sm text-stone-500">Abierta desde el {fmtDate(cashOpenedAt)}</p>
              </div>
              <button onClick={() => void closeCash()} className="flex items-center gap-2 rounded-full bg-[#2c211d] px-5 py-3 font-bold text-white transition hover:bg-stone-800">
                <Lock size={16} /> Cerrar caja
              </button>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl bg-orange-50 p-5"><span className="block text-sm text-stone-500">Total efectivo</span><strong className="mt-1 block text-2xl text-orange-700">{money(cash)}</strong></div>
              <div className="rounded-2xl bg-stone-50 p-5"><span className="block text-sm text-stone-500">Total transferencia</span><strong className="mt-1 block text-2xl text-stone-700">{money(transfer)}</strong></div>
              <div className="rounded-2xl bg-[#2c211d] p-5 text-white"><span className="block text-sm text-orange-100">Total general</span><strong className="mt-1 block text-2xl text-[#ffbd70]">{money(cash + transfer)}</strong></div>
            </div>
          </div>
          <div className="panel">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-2"><History className="text-orange-600" size={20} /><h2 className="section-title">Historial de cierres</h2></div>
              <div className="flex items-end gap-2">
                <label className="text-xs font-semibold text-stone-500">Fecha inicio<input type="date" value={cashFilterDateFrom} onChange={(e) => setCashFilterDateFrom(e.target.value)} className="field text-sm w-auto py-1.5 mt-1 block" /></label>
                <label className="text-xs font-semibold text-stone-500">Fecha fin<input type="date" value={cashFilterDateTo} onChange={(e) => setCashFilterDateTo(e.target.value)} className="field text-sm w-auto py-1.5 mt-1 block" /></label>
              </div>
            </div>
            {registers.length ? (
              <div className="mt-5">
                <p className="mb-2 text-xs text-stone-400 sm:hidden">Deslizá para ver más 👉</p>
                <div className="overflow-x-auto pb-2">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="border-b border-stone-100 text-xs uppercase tracking-wider text-stone-400">
                      <tr><th className="pb-3">Apertura</th><th className="pb-3">Cierre</th><th className="pb-3">Efectivo</th><th className="pb-3">Transferencia</th><th className="pb-3">Total</th><th className="pb-3">Pedidos</th></tr>
                    </thead>
                    <tbody>
                      {registers
                        .filter(r => {
                          if (cashFilterDateFrom && r.opened_at < cashFilterDateFrom) return false;
                          if (cashFilterDateTo && r.opened_at > cashFilterDateTo + 'T23:59:59') return false;
                          return true;
                        })
                        .map((r) => (
                        <tr key={r.id} className="border-b border-stone-100">
                          <td className="py-4 text-stone-600">{fmtDate(r.opened_at)}</td>
                          <td className="py-4 text-stone-600">{fmtDate(r.closed_at)}</td>
                          <td className="py-4 font-semibold text-orange-700">{money(r.cash_total)}</td>
                          <td className="py-4 font-semibold text-stone-700">{money(r.transfer_total)}</td>
                          <td className="py-4 font-bold text-stone-800">{money(r.grand_total)}</td>
                          <td className="py-4 text-stone-500">{r.order_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : <p className="mt-4 text-stone-500">Todavía no hay cierres registrados.</p>}
          </div>
        </div>
      )}

      {/* Clients */}
      {tab === 'clients' && (
        <div className="panel">
          <div className="flex items-center gap-2 mb-6">
            <Users className="text-orange-600" size={20} />
            <h2 className="section-title">Registro de clientes</h2>
          </div>
          <div className="space-y-3">
            {clients.map((c) => (
              <div key={c.id} className="flex flex-col gap-3 rounded-2xl border border-stone-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <b className="block text-sm text-stone-800">{c.name}</b>
                  <span className="text-xs text-stone-400">@{c.username}</span>
                  <span className="mt-1 block text-sm font-bold text-[#b8860b]">{c.points} puntos</span>
                </div>
                <button onClick={() => void loadClientOrders(c)} className="rounded-full bg-orange-100 px-4 py-2 text-sm font-bold text-orange-800 transition hover:bg-orange-200">
                  Ver historial
                </button>
              </div>
            ))}
            {!clients.length && <p className="text-stone-500">Todavía no hay clientes registrados.</p>}
          </div>
        </div>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <form onSubmit={saveSettings} className="panel max-w-2xl">
          <h2 className="section-title">Configuración de envíos</h2>
          <p className="mt-2 text-sm text-stone-500">El costo se calcula automáticamente desde San Lorenzo 230, Paraná. Zona de envío limitada a {MAX_DELIVERY_KM} km.</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="label">Costo fijo base<input type="number" value={settings.delivery_base} onChange={(e) => setSettings({ ...settings, delivery_base: Number(e.target.value) })} className="field mt-2" /></label>
            <label className="label">Costo por kilómetro<input type="number" value={settings.delivery_per_km} onChange={(e) => setSettings({ ...settings, delivery_per_km: Number(e.target.value) })} className="field mt-2" /></label>
            <label className="label">Latitud del local<input type="number" step="any" value={settings.store_lat} onChange={(e) => setSettings({ ...settings, store_lat: Number(e.target.value) })} className="field mt-2" /></label>
            <label className="label">Longitud del local<input type="number" step="any" value={settings.store_lng} onChange={(e) => setSettings({ ...settings, store_lng: Number(e.target.value) })} className="field mt-2" /></label>
          </div>
          <button className="mt-6 flex items-center gap-2 rounded-full bg-orange-600 px-5 py-3 font-bold text-white"><Save size={17} /> Guardar configuración</button>
        </form>
      )}

      {/* Category modal */}
      {editingCategory && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 p-4">
          <form onSubmit={saveCategory} className="max-h-[90vh] w-full max-w-[95vw] overflow-y-auto rounded-3xl bg-[#fffaf5] p-6 shadow-2xl sm:max-w-lg">
            <div className="flex justify-between"><h2 className="section-title">Editar categoría</h2><button type="button" onClick={() => setEditingCategory(null)}><X /></button></div>
            <div className="mt-4 space-y-4">
              <label className="block text-sm font-bold text-stone-700">Nombre
                <input required value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} className="field mt-1 w-full" />
              </label>
              <label className="block text-sm font-bold text-stone-700">Descripción
                <textarea value={editingCategory.description} onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })} className="field mt-1 w-full" rows={3} />
              </label>
              <label className="block text-sm font-bold text-stone-700">Imagen
                <div className="mt-1 flex items-center gap-3">
                  {editingCategory.image_url && <img src={sanitizeUrl(editingCategory.image_url)} alt="" className="h-12 w-12 rounded-xl object-cover" />}
                  <input 
                    type="file" 
                    accept="image/jpeg,image/png,image/webp" 
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        try {
                          const result = await processUploadedImage(file);
                          setEditingCategory({ ...editingCategory, image_url: result });
                        } catch (err) {
                          alert(err instanceof Error ? err.message : 'Error al procesar la imagen');
                          e.target.value = '';
                        }
                      }
                    }} 
                    className="field w-full flex-1" 
                  />
                </div>
              </label>
            </div>
            <button className="mt-6 w-full rounded-full bg-orange-600 py-3 font-bold text-white transition hover:bg-orange-700">Guardar cambios</button>
          </form>
        </div>
      )}

      {/* Product modal */}
      {(editing || creating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
          <form onSubmit={saveProduct} className="max-h-[90vh] w-full max-w-[95vw] overflow-y-auto rounded-3xl bg-[#fffaf5] p-6 shadow-2xl sm:max-w-lg">
            <div className="flex justify-between"><h2 className="section-title">{editing ? 'Editar producto' : 'Nuevo producto'}</h2><button type="button" onClick={() => { setEditing(null); setCreating(null); }}><X /></button></div>
            {productForm(editing ?? creating!)}
            <button className="mt-5 w-full rounded-full bg-orange-600 py-3 font-bold text-white">{editing ? 'Guardar cambios' : 'Crear producto'}</button>
          </form>
        </div>
      )}

      {/* Client history modal */}
      {selectedClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-[95vw] overflow-y-auto border border-orange-500/30 bg-[#fffaf5] p-6 shadow-2xl sm:max-w-lg">
            <div className="flex justify-between"><h2 className="section-title">Historial de {selectedClient.name}</h2><button type="button" onClick={() => setSelectedClient(null)}><X /></button></div>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-sm text-stone-500">@{selectedClient.username}</span>
              <button
                type="button"
                title="Editar puntos"
                onClick={async () => {
                  const str = prompt(`Editar puntos de ${selectedClient.name}:`, String(selectedClient.points));
                  if (str === null) return;
                  const val = parseInt(str.trim(), 10);
                  if (isNaN(val) || val < 0 || !Number.isInteger(val)) {
                    alert('Por favor, ingresá un número entero positivo válido.');
                    return;
                  }
                  await supabase.from('store_user_points').update({ points: val }).eq('id', selectedClient.id);
                  await supabase.from('store_point_movements').insert({ username: selectedClient.username, delta: val - selectedClient.points, reason: `Edición manual de administrador` });
                  setSelectedClient({ ...selectedClient, points: val });
                  setClients((list) => list.map((c) => (c.id === selectedClient.id ? { ...c, points: val } : c)));
                }}
                className="flex items-center gap-1 border border-orange-400 bg-orange-50/90 px-3 py-1 font-mono text-xs font-bold text-orange-700 transition hover:bg-orange-200"
              >
                {selectedClient.points} pts <Edit3 size={12} />
              </button>
            </div>
            <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-widest text-stone-400">Compras finalizadas</p>
            {clientOrders.length ? (
              <div className="mt-3 space-y-2">
                {clientOrders.map((o) => (
                  <button key={o.id} onClick={() => openOrderModal(o)} className="flex w-full items-center justify-between border border-orange-500/30 bg-transparent p-3 text-sm transition hover:bg-orange-50/50">
                    <div className="text-left">
                      <b className="font-mono text-stone-800">{o.order_code}</b>
                      <span className="ml-2 font-mono text-[10px] text-stone-400">{fmtDate(o.created_at)}</span>
                    </div>
                    <b className="font-mono text-orange-700">{money(o.total)}</b>
                  </button>
                ))}
              </div>
            ) : <p className="mt-3 font-mono text-sm text-stone-500">Este cliente todavía no tiene compras finalizadas.</p>}
          </div>
        </div>
      )}

      {/* Viewing order modal */}
      {viewingOrder && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-stone-900/40 p-4">
          <div className="max-h-[90vh] w-full max-w-[95vw] overflow-y-auto border border-orange-500/30 bg-[#fffaf5] p-6 shadow-2xl sm:max-w-lg">
            <div className="flex justify-between"><h2 className="section-title">Pedido {viewingOrder.order_code}</h2><button type="button" onClick={() => setViewingOrder(null)}><X /></button></div>
            <div className="mt-4 space-y-3 font-mono text-sm">
              <p><span className="text-stone-400">Cliente:</span> {viewingOrder.customer_name} {viewingOrder.customer_username && `(@${viewingOrder.customer_username})`}</p>
              <p><span className="text-stone-400">Fecha:</span> {fmtDate(viewingOrder.created_at)}</p>
              <p><span className="text-stone-400">Entrega:</span> {viewingOrder.delivery_type === 'delivery' ? 'Envío' : 'Retiro'} {viewingOrder.delivery_type === 'delivery' && `- ${viewingOrder.delivery_address}`}</p>
              <p><span className="text-stone-400">Pago:</span> {viewingOrder.payment_method === 'cash' ? 'Efectivo' : 'Transferencia'} - {viewingOrder.is_paid ? <span className="text-green-600">Pagado</span> : <span className="text-red-500">Pendiente</span>}</p>
              {viewingOrder.customer_notes && <p><span className="text-stone-400">Notas:</span> {viewingOrder.customer_notes}</p>}
            </div>
            <div className="mt-5 border-t border-orange-500/30 pt-4">
              <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-stone-400">Detalle</h3>
              <div className="mt-2 space-y-2">
                {viewingOrderItems.map(item => (
                  <div key={item.id} className="flex justify-between font-mono text-sm">
                    <span>{item.quantity}x {item.product_name}</span>
                    <span>{money(item.line_total)}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex justify-between border-t border-orange-500/30 pt-3 font-mono text-lg font-bold text-orange-700">
                <span>Total</span>
                <span>{money(viewingOrder.total)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
