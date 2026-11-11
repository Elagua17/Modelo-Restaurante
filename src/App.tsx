import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { CartItem, Product, Settings } from '@/types';
import { initialSettings, WA_NUMBER } from '@/lib/constants';
import { AuthProvider } from '@/lib/auth';
import Header from '@/components/Header';
import Checkout from '@/components/Checkout';
import HomePage from '@/pages/HomePage';
import AdminPage from '@/pages/AdminPage';
import AuthPage from '@/pages/AuthPage';
import RewardsPage from '@/pages/RewardsPage';

/**
 * Cart key: uniquely identifies a cart line.
 * Same product bought with money vs redeemed with points = 2 separate lines.
 */
const cartKey = (id: string, redeemed: boolean | undefined) => `${id}__${redeemed ? 'pts' : 'buy'}`;

function AppShell() {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try {
      const stored = localStorage.getItem('lacabrera-cart') || localStorage.getItem('rincon-cart');
      return stored ? (JSON.parse(stored) as CartItem[]) : [];
    } catch {
      return [];
    }
  });
  const [checkout, setCheckout] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [products, setProducts] = useState<Product[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.setItem('lacabrera-cart', JSON.stringify(cart));
  }, [cart]);
  useEffect(() => {
    void supabase.from('store_settings').select('*').maybeSingle().then(({ data }) => { if (data) setSettings(data); });
  }, []);

  const count = cart.reduce((sum, item) => sum + item.quantity, 0);

  /** Add one unit of a product to the cart as a PAID purchase */
  const addToCart = (product: Product) => {
    const totalInCart = cart.filter((i) => i.id === product.id).reduce((s, i) => s + i.quantity, 0);
    const current = products.find((p) => p.id === product.id);
    
    let remainingStock: number | null = null;
    if (current && current.stock !== null) {
      remainingStock = current.stock;
    } else if (product.stock !== null) {
      // If products state is empty, use the passed product's original stock minus cart
      remainingStock = product.stock - totalInCart;
    }

    if (remainingStock !== null && remainingStock <= 0) return;

    if (current && current.stock !== null) {
      setProducts((prev) => prev.map((p) => p.id === product.id && p.stock !== null ? { ...p, stock: p.stock - 1 } : p));
    }

    setCart((items) => {
      const key = cartKey(product.id, false);
      const existing = items.find((i) => cartKey(i.id, i.redeemed_with_points) === key);
      if (existing) {
        return items.map((i) => (cartKey(i.id, i.redeemed_with_points) === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...items, { ...product, quantity: 1, redeemed_with_points: false }];
    });
  };

  /**
   * Add a reward product as a POINT REDEMPTION.
   * Each unit costs points_cost pts. Limited only by available balance and stock.
   */
  const addRewardToCart = (product: Product, userPoints: number): { ok: boolean; message?: string } => {
    const pointsCost = product.points_cost || 0;
    const pointsAlreadyCommitted = cart.reduce((sum, i) => sum + (i.redeemed_with_points ? (i.points_cost || 0) * i.quantity : 0), 0);
    const pointsAvailable = userPoints - pointsAlreadyCommitted;
    
    if (pointsAvailable < pointsCost) {
      return { ok: false, message: `No tenés puntos suficientes. Necesitás ${pointsCost} pts y te quedan ${pointsAvailable} pts disponibles.` };
    }

    const totalInCart = cart.filter((i) => i.id === product.id).reduce((s, i) => s + i.quantity, 0);
    const current = products.find((p) => p.id === product.id);
    
    let remainingStock: number | null = null;
    if (current && current.stock !== null) {
      remainingStock = current.stock;
    } else if (product.stock !== null) {
      remainingStock = product.stock - totalInCart;
    }

    if (remainingStock !== null && remainingStock <= 0) {
      return { ok: false, message: 'Sin stock disponible.' };
    }

    if (current && current.stock !== null) {
      setProducts((prev) => prev.map((p) => p.id === product.id && p.stock !== null ? { ...p, stock: p.stock - 1 } : p));
    }

    setCart((items) => {
      const key = cartKey(product.id, true);
      const existing = items.find((i) => cartKey(i.id, i.redeemed_with_points) === key);
      if (existing) {
        return items.map((i) => (cartKey(i.id, i.redeemed_with_points) === key ? { ...i, quantity: i.quantity + 1 } : i));
      }
      return [...items, { ...product, quantity: 1, redeemed_with_points: true }];
    });
    return { ok: true };
  };

  /**
   * Remove one unit from a SPECIFIC cart line (paid or redeemed).
   */
  const removeFromCart = (productId: string, redeemed: boolean = false) => {
    const key = cartKey(productId, redeemed);
    const item = cart.find((i) => cartKey(i.id, i.redeemed_with_points) === key);
    if (!item) return;
    
    // Always restore product stock regardless of whether it was paid or redeemed
    if (item.stock !== null) {
      setProducts((prev) => prev.map((p) => p.id === productId && p.stock !== null ? { ...p, stock: p.stock + 1 } : p));
    }
    
    setCart((items) => items.flatMap((i) =>
      cartKey(i.id, i.redeemed_with_points) === key
        ? (i.quantity > 1 ? [{ ...i, quantity: i.quantity - 1 }] : [])
        : [i]
    ));
  };

  const clearCart = () => { setCart([]); };

  return (
    <div className="min-h-screen bg-[#ebdccc]">
      <Header count={count} onCart={() => (cart.length ? setCheckout(true) : navigate('/'))} />
      <Routes>
        <Route path="/" element={
          <HomePage
            cart={cart}
            products={products}
            setProducts={setProducts}
            addToCart={addToCart}
            removeFromCart={(id) => removeFromCart(id, false)}
          />
        } />
        <Route path="/admin" element={<AdminPage unlocked={unlocked} onUnlock={() => setUnlocked(true)} />} />
        <Route path="/login" element={<AuthPage />} />
        <Route path="/rewards" element={<RewardsPage addRewardToCart={addRewardToCart} cart={cart} onRemoveReward={(id) => removeFromCart(id, true)} />} />
      </Routes>
      {checkout && (
        <Checkout
          cart={cart}
          settings={settings}
          onClose={() => setCheckout(false)}
          onClear={clearCart}
          onAdd={addToCart}
          onRemove={removeFromCart}
        />
      )}
      <footer className="mt-10 border-t border-orange-100 bg-[#fff3e5] px-5 py-8 text-center text-sm text-stone-500">
        <img src="/logo-la-cabrera.jpg" alt="La Cabrera" className="mx-auto h-12 w-auto object-contain rounded-full border border-orange-500/30" />
        <p className="mt-3">
          La Cabrera — San Lorenzo 230, Paraná, Entre Ríos —{' '}
          <a
            className="font-bold text-orange-700 hover:underline"
            href={`https://wa.me/${encodeURIComponent(WA_NUMBER)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Escribinos por WhatsApp
          </a>
        </p>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppShell />
      </AuthProvider>
    </BrowserRouter>
  );
}
