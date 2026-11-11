import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Gift, Sparkles, Coins, Minus, Plus } from 'lucide-react';
import { useAuth } from '@/lib/authContext';
import { supabase } from '@/lib/supabase';
import { sanitizeUrl } from '@/lib/utils';
import type { CartItem, Product } from '@/types';

interface RewardsPageProps {
  addRewardToCart: (product: Product, userPoints: number) => { ok: boolean; message?: string };
  /** removeFromCart needed to decrement redeemed items */
  cart: CartItem[];
  onRemoveReward: (productId: string) => void;
}

export default function RewardsPage({ addRewardToCart, cart, onRemoveReward }: RewardsPageProps) {
  const { user } = useAuth();
  const [rewards, setRewards] = useState<Product[]>([]);
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  useEffect(() => {
    void supabase.from('store_products').select('*').eq('is_reward', true).eq('available', true).then(({ data }) => setRewards(data ?? []));
  }, []);

  // Points already committed to redemptions in the cart
  const pointsCommitted = cart.reduce((sum, i) => sum + (i.redeemed_with_points ? (i.points_cost || 0) * i.quantity : 0), 0);
  const pointsAvailable = (user?.points ?? 0) - pointsCommitted;

  // How many units of this reward are already in cart as redeemed
  const redeemedQty = (id: string) => {
    const item = cart.find((i) => i.id === id && i.redeemed_with_points);
    return item?.quantity ?? 0;
  };

  const handleAdd = (reward: Product) => {
    if (!user) return;
    const result = addRewardToCart(reward, user.points);
    if (!result.ok && result.message) {
      setFeedback((prev) => ({ ...prev, [reward.id]: result.message! }));
      setTimeout(() => setFeedback((prev) => { const next = { ...prev }; delete next[reward.id]; return next; }), 3500);
    }
    // No success toast needed — the quantity counter updates immediately
  };

  const handleRemove = (reward: Product) => {
    onRemoveReward(reward.id);
  };

  return (
    <main className="mx-auto max-w-4xl px-5 py-12 lg:px-8">
      <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-stone-400 hover:text-orange-700">
        <ArrowLeft size={15} /> Volver a la carta
      </Link>

      {/* Hero banner */}
      {user ? (
        <div className="rounded-3xl bg-gradient-to-br from-[#2c211d] to-[#3d2d24] p-8 text-white">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#ffbd70]/20 text-[#ffbd70]">
                <Sparkles size={28} />
              </div>
              <div>
                <p className="text-sm text-orange-100">Hola {user.name}! Tus puntos acumulados:</p>
                <b className="font-display text-4xl text-[#ffbd70]">{user.points} pts</b>
              </div>
            </div>
            {/* Live balance tracker */}
            <div className="rounded-2xl bg-white/10 px-4 py-3 text-right">
              <p className="text-xs text-orange-200">En tu pedido</p>
              <p className="font-bold text-orange-300">{pointsCommitted > 0 ? `-${pointsCommitted} pts` : '—'}</p>
              <p className="text-xs text-orange-200">Disponibles: <b className="text-[#ffbd70]">{pointsAvailable} pts</b></p>
            </div>
          </div>
          <p className="mt-4 text-sm text-orange-100">
            Sumás puntos con cada compra pagada. Canjeá todas las recompensas que quieras mientras te alcancen los puntos — <strong className="text-[#ffbd70]">cada unidad cuesta sus puntos</strong>.
          </p>
        </div>
      ) : (
        <div className="rounded-3xl bg-gradient-to-br from-[#2c211d] to-[#3d2d24] p-8 text-white">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[#ffbd70]/20 text-[#ffbd70]">
              <Gift size={28} />
            </div>
            <div>
              <p className="text-lg font-bold text-[#ffbd70]">Recompensas</p>
              <p className="text-sm text-orange-100">Registrate para acumular puntos y canjear productos gratis.</p>
            </div>
          </div>
        </div>
      )}

      <h2 className="mt-10 font-display text-3xl font-bold text-stone-800">Recompensas disponibles</h2>
      <p className="mt-2 text-sm text-stone-500">
        Canjeá tantas unidades como quieras mientras te alcancen los puntos. Para comprarlas con dinero, encontralas en <Link to="/" className="font-semibold text-orange-600 hover:underline">la carta</Link>.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rewards.map((reward) => {
          const pointsCost = reward.points_cost || 0;
          const canAfford = pointsAvailable >= pointsCost;
          const qty = redeemedQty(reward.id);
          const outOfStock = reward.stock === 0;
          const msg = feedback[reward.id];

          return (
            <div key={reward.id} className="flex flex-col overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-sm">
              {reward.image_url ? (
                <div className="relative h-44 overflow-hidden">
                  <img src={sanitizeUrl(reward.image_url)} alt={reward.name} className="h-full w-full object-cover" />
                  <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#ffbd70] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-stone-900">
                    <Coins size={11} /> Recompensa
                  </span>
                </div>
              ) : (
                <div className="relative flex h-44 w-full items-center justify-center bg-orange-50 text-orange-600">
                  <Gift size={40} />
                  <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#ffbd70] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-stone-900">
                    <Coins size={11} /> Recompensa
                  </span>
                </div>
              )}

              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-lg font-bold text-stone-800">{reward.name}</h3>
                <p className="mt-1 flex-1 text-sm text-stone-500">{reward.description}</p>

                {/* Cost badge */}
                <p className="mt-3 font-bold text-amber-600">{pointsCost} pts por unidad</p>

                {/* Feedback message */}
                {msg && (
                  <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                    {msg}
                  </p>
                )}

                <div className="mt-4">
                  {!user ? (
                    <Link to="/login" className="flex w-full items-center justify-center gap-2 rounded-full bg-[#ffbd70]/20 px-4 py-2.5 text-sm font-bold text-stone-600 transition hover:bg-orange-100">
                      <Coins size={15} /> Ingresá para canjear
                    </Link>
                  ) : outOfStock ? (
                    <div className="flex w-full items-center justify-center gap-2 rounded-full bg-stone-100 px-4 py-2.5 text-sm font-bold text-stone-400">
                      Sin stock
                    </div>
                  ) : qty === 0 ? (
                    /* First unit: show simple button */
                    <button
                      onClick={() => handleAdd(reward)}
                      disabled={!canAfford}
                      className={`flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition ${
                        canAfford
                          ? 'bg-[#ffbd70] text-stone-900 hover:bg-amber-400'
                          : 'cursor-not-allowed bg-stone-100 text-stone-400'
                      }`}
                    >
                      <Coins size={15} />
                      {canAfford ? `Canjear — ${pointsCost} pts` : `Necesitás ${pointsCost} pts`}
                    </button>
                  ) : (
                    /* Already has units: show +/- controls */
                    <div className="flex items-center gap-3">
                      <div className="flex flex-1 items-center justify-between rounded-full bg-amber-50 px-2 py-1">
                        <button
                          onClick={() => handleRemove(reward)}
                          className="rounded-full p-1.5 text-amber-700 transition hover:bg-amber-100"
                        >
                          <Minus size={15} />
                        </button>
                        <div className="text-center">
                          <b className="text-sm text-stone-800">{qty}</b>
                          <p className="text-[10px] text-amber-700 font-semibold">{pointsCost * qty} pts</p>
                        </div>
                        <button
                          onClick={() => handleAdd(reward)}
                          disabled={!canAfford}
                          className={`rounded-full p-1.5 transition ${canAfford ? 'text-amber-700 hover:bg-amber-100' : 'cursor-not-allowed text-stone-300'}`}
                        >
                          <Plus size={15} />
                        </button>
                      </div>
                      <span className="text-xs text-stone-400 text-right">{pointsAvailable} pts<br/>disponibles</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {!rewards.length && (
          <p className="col-span-full text-stone-500">Todavía no hay recompensas configuradas. Volvé pronto.</p>
        )}
      </div>
    </main>
  );
}
