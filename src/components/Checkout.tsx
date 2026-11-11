import { MapContainer, TileLayer, CircleMarker, Circle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Check, MapPin, Minus, Package, Phone, Plus, Trash2, Truck, X } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { CartItem, DeliveryType, Product, Settings } from '@/types';
import { WA_NUMBER, MAX_DELIVERY_KM } from '@/lib/constants';
import { money, haversine, generateOrderCode, mapsLink } from '@/lib/utils';
import { decrementStock } from '@/lib/stock';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';

function LocationPicker({ position, onPick }: { position: [number, number] | null; onPick: (p: [number, number]) => void }) {
  useMapEvents({ click(event) { onPick([event.latlng.lat, event.latlng.lng]); } });
  return position ? <CircleMarker center={position} radius={10} pathOptions={{ color: '#e85d20', fillColor: '#e85d20', fillOpacity: 0.85 }} /> : null;
}

interface CheckoutProps {
  cart: CartItem[];
  settings: Settings;
  onClose: () => void;
  onClear: () => void;
  onAdd: (product: Product) => void;
  onRemove: (productId: string, redeemed?: boolean) => void;
}

export default function Checkout({ cart, settings, onClose, onClear, onAdd, onRemove }: CheckoutProps) {
  const [type, setType] = useState<DeliveryType>('pickup');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [position, setPosition] = useState<[number, number] | null>(null);
  const [sent, setSent] = useState(false);
  const { user } = useAuth();

  const subtotal = cart.reduce((sum, item) => sum + (item.redeemed_with_points ? 0 : item.price) * item.quantity, 0);
  const totalPointsCost = cart.reduce((sum, item) => sum + (item.redeemed_with_points ? (item.points_cost || 0) : 0) * item.quantity, 0);
  const distance = position ? haversine(settings.store_lat, settings.store_lng, position[0], position[1]) : 0;
  const inZone = distance <= MAX_DELIVERY_KM;
  const delivery = type === 'delivery' && position && inZone ? settings.delivery_base + distance * settings.delivery_per_km : 0;
  const total = subtotal + delivery;
  const hasMapPin = position !== null;
  const canSubmit = type === 'pickup' || (type === 'delivery' && hasMapPin && inZone);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const cleanName = name.trim();
    const cleanPhone = phone.trim();
    if (!cleanName || !cleanPhone || !canSubmit) return;

    if (totalPointsCost > 0) {
      if (!user || user.points < totalPointsCost) {
        alert(`No tenés suficientes puntos para estas recompensas. Necesitás ${totalPointsCost} pts.`);
        return;
      }
    }

    const orderCode = generateOrderCode();
    const earnedPoints = user ? cart.reduce((sum, item) => sum + (item.redeemed_with_points ? 0 : (item.points || 0)) * item.quantity, 0) : 0;

    const { data: order } = await supabase.from('store_orders').insert({
      order_code: orderCode,
      customer_name: cleanName,
      customer_phone: cleanPhone,
      customer_notes: notes.trim(),
      delivery_type: type,
      delivery_address: address.trim(),
      delivery_lat: position?.[0] ?? null,
      delivery_lng: position?.[1] ?? null,
      subtotal,
      delivery_fee: delivery,
      total,
      status: 'pending',
      is_paid: false,
      payment_method: 'cash',
      customer_username: user ? user.username : null,
      earned_points: earnedPoints
    }).select().maybeSingle();

    if (order) {
      await supabase.from('store_order_items').insert(
        cart.map((item) => ({
          order_id: order.id,
          product_name: item.name + (item.redeemed_with_points ? ' (Canje)' : ''),
          quantity: item.quantity,
          unit_price: item.redeemed_with_points ? 0 : item.price,
          line_total: (item.redeemed_with_points ? 0 : item.price) * item.quantity
        }))
      );
      // Decrement stock in DB (local stock was already decremented when adding to cart)
      for (const item of cart) {
        await decrementStock(item, item.quantity);
      }
      if (user && totalPointsCost > 0) {
        const { data: current } = await supabase.from('store_user_points').select('*').eq('username', user.username).maybeSingle();
        if (current) {
          await supabase.from('store_user_points').update({ points: current.points - totalPointsCost }).eq('id', current.id);
          await supabase.from('store_point_movements').insert({ username: user.username, delta: -totalPointsCost, reason: `Canje en Pedido ${orderCode}` });
        }
      }
    }

    const lines = cart
      .map((item) => `▪ ${item.quantity}x ${item.name} - ${item.redeemed_with_points ? `${(item.points_cost || 0) * item.quantity} pts (Canje)` : money(item.price * item.quantity)}`)
      .join('\n');
    const mapsUrl = position ? mapsLink(position[0], position[1]) : '';
    const textLines = [
      'Hola La Cabrera, quiero hacer este pedido:',
      '',
      `Pedido ID: ${orderCode}`,
      '',
      lines,
      '',
      `Subtotal: ${money(subtotal)}`,
      type === 'delivery'
        ? `Envío (${distance.toFixed(1)} km): ${money(delivery)}\nDirección: ${address.trim() || 'Marcada en el mapa'}\nUbicación: ${mapsUrl}`
        : 'Retiro por el local',
      `Total: ${money(total)}`,
      '',
      `Cliente: ${cleanName}`,
      `Teléfono: ${cleanPhone}`,
      notes.trim() ? `Notas: ${notes.trim()}` : '',
    ].filter(Boolean).join('\n');

    const waUrl = `https://wa.me/${encodeURIComponent(WA_NUMBER)}?text=${encodeURIComponent(textLines)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
    setSent(true);
    onClear();
  };

  if (sent) return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/40 p-4">
      <div className="w-full max-w-md rounded-[28px] bg-[#fffaf5] p-8 text-center shadow-2xl">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700"><Check size={32} /></div>
        <h2 className="mt-5 font-display text-3xl font-bold text-stone-800">Pedido enviado</h2>
        <p className="mt-2 text-stone-500">Abrimos WhatsApp para que puedas confirmar todos los detalles con nosotros.</p>
        <button onClick={onClose} className="mt-7 w-full rounded-full bg-orange-600 py-3 font-bold text-white">Listo</button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-stone-900/40">
      <div className="flex h-full w-full max-w-xl flex-col overflow-y-auto bg-[#fffaf5] shadow-2xl">
        <div className="flex items-center justify-between border-b border-orange-100 px-6 py-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[.2em] text-orange-600">Último paso</p>
            <h2 className="font-display text-3xl font-bold text-stone-800">Confirmá tu pedido</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-stone-400 hover:bg-orange-50"><X /></button>
        </div>
        <form onSubmit={submit} className="space-y-6 p-6">
          {/* Cart items with +/- controls */}
          <div className="rounded-2xl bg-white p-4">
            <p className="mb-3 text-sm font-bold text-stone-700">Tu pedido</p>
            {cart.map((item) => {
              const isRedeemed = !!item.redeemed_with_points;
              return (
                <div key={`${item.id}-${isRedeemed ? 'pts' : 'buy'}`} className="flex items-center justify-between gap-2 border-b border-stone-100 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-stone-800">{item.name}</p>
                    {isRedeemed ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                        🪙 Canje — {item.points_cost} pts c/u
                      </span>
                    ) : (
                      <p className="text-xs text-stone-400">{money(item.price)} c/u</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className={`flex items-center gap-1.5 rounded-full px-1.5 py-1 ${isRedeemed ? 'bg-amber-50' : 'bg-orange-50'}`}>
                      <button
                        type="button"
                        onClick={() => onRemove(item.id, isRedeemed)}
                        className={`rounded-full p-1 transition ${isRedeemed ? 'text-amber-700 hover:bg-amber-100' : 'text-orange-700 hover:bg-orange-100'}`}
                      >
                        {item.quantity === 1 ? <Trash2 size={13} /> : <Minus size={13} />}
                      </button>
                      <b className="min-w-5 text-center text-xs text-stone-800">{item.quantity}</b>
                      {!isRedeemed && (
                        <button
                          type="button"
                          onClick={() => onAdd(item as Product)}
                          disabled={item.stock !== null && item.stock <= 0}
                          className={`rounded-full p-1 transition ${
                            item.stock !== null && item.stock <= 0
                              ? 'cursor-not-allowed opacity-40 text-stone-400'
                              : 'text-orange-700 hover:bg-orange-100'
                          }`}
                          title={item.stock !== null && item.stock <= 0 ? 'Sin más stock disponible' : 'Agregar unidad'}
                        >
                          <Plus size={13} />
                        </button>
                      )}
                    </div>
                    <b className="w-20 text-right text-sm text-stone-800">
                      {isRedeemed ? `${(item.points_cost || 0) * item.quantity} pts` : money(item.price * item.quantity)}
                    </b>
                  </div>
                </div>
              );
            })}
            <div className="mt-3 flex justify-between pt-2 text-sm font-bold">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            {totalPointsCost > 0 && (
              <div className="mt-1 flex justify-between text-sm font-bold text-amber-700">
                <span>Puntos a descontar</span>
                <span>-{totalPointsCost} pts</span>
              </div>
            )}
          </div>

          <div>
            <p className="mb-3 text-sm font-bold text-stone-700">¿Cómo querés recibirlo?</p>
            <div className="grid grid-cols-2 gap-3">
              <button type="button" onClick={() => setType('pickup')} className={`rounded-2xl border p-4 text-left ${type === 'pickup' ? 'border-orange-500 bg-orange-50' : 'border-stone-200 bg-white'}`}>
                <Package className="mb-2 text-orange-600" size={20} />
                <b className="block text-sm">Retiro por el local</b>
                <span className="text-xs text-stone-500">San Lorenzo 230, Paraná</span>
              </button>
              <button type="button" onClick={() => setType('delivery')} className={`rounded-2xl border p-4 text-left ${type === 'delivery' ? 'border-orange-500 bg-orange-50' : 'border-stone-200 bg-white'}`}>
                <Truck className="mb-2 text-orange-600" size={20} />
                <b className="block text-sm">Envío a domicilio</b>
                <span className="text-xs text-stone-500">Solo dentro de Paraná</span>
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="field" />
            <input required value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="WhatsApp / teléfono" className="field" />
          </div>

          {type === 'delivery' && (
            <div className="space-y-3">
              <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Dirección escrita (opcional si marcás el mapa)" className="field w-full" />
              <div className="overflow-hidden rounded-2xl border border-orange-100">
                <MapContainer center={[settings.store_lat, settings.store_lng]} zoom={13} scrollWheelZoom className="h-56 w-full">
                  <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Circle center={[settings.store_lat, settings.store_lng]} radius={MAX_DELIVERY_KM * 1000} pathOptions={{ color: '#e85d20', fillColor: '#e85d20', fillOpacity: 0.06, dashArray: '6 8' }} />
                  <LocationPicker position={position} onPick={setPosition} />
                </MapContainer>
              </div>
              {position && !inZone && (
                <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  No hacemos envíos a esa zona. Marcá un punto dentro de Paraná (radio máximo de {MAX_DELIVERY_KM} km desde el local).
                </div>
              )}
              {position && inZone && (
                <p className="flex items-center gap-2 text-xs text-stone-500">
                  <MapPin size={14} className="text-orange-600" />
                  {distance.toFixed(1)} km desde el local · Envío: {money(delivery)} · Ubicación confirmada
                </p>
              )}
              {!position && (
                <p className="flex items-center gap-2 text-xs text-stone-500">
                  <MapPin size={14} className="text-orange-600" />
                  Tocá el mapa para marcar tu ubicación. Si marcás acá, la dirección escrita es opcional.
                </p>
              )}
            </div>
          )}

          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas para tu pedido (opcional)" rows={2} className="field w-full resize-none" />

          <div className="rounded-2xl bg-[#2c211d] p-5 text-white">
            <div className="flex justify-between text-sm text-orange-100">
              <span>{type === 'delivery' ? 'Envío' : 'Retiro'}</span>
              <span>{delivery ? money(delivery) : 'Sin costo'}</span>
            </div>
            <div className="mt-3 flex items-end justify-between border-t border-white/10 pt-3">
              <span className="font-bold">Total a pagar</span>
              <strong className="text-2xl text-[#ffbd70]">{money(total)}</strong>
            </div>
            {user && (
              <p className="mt-2 text-xs text-[#ffbd70]">Sumás {cart.reduce((s, i) => s + (i.redeemed_with_points ? 0 : (i.points || 0)) * i.quantity, 0)} puntos con este pedido</p>
            )}
          </div>

          <button type="submit" disabled={!canSubmit} className={`flex w-full items-center justify-center gap-2 rounded-full py-4 font-extrabold text-white shadow-lg transition ${canSubmit ? 'bg-[#25d366] hover:bg-[#1dbb59] shadow-green-100' : 'cursor-not-allowed bg-stone-300 text-stone-500'}`}>
            <Phone size={19} /> Pedir por WhatsApp
          </button>
        </form>
      </div>
    </div>
  );
}
