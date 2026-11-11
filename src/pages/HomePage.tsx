import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { CartItem, Category, Product } from '@/types';
import { initialCategories, initialProducts, photos } from '@/lib/constants';
import { incrementPageView, trackProductView } from '@/lib/stock';
import { sanitizeUrl } from '@/lib/utils';
import ProductCard from '@/components/ProductCard';
import ProductModal from '@/components/ProductModal';

interface HomePageProps {
  cart: CartItem[];
  products: Product[];
  setProducts: Dispatch<SetStateAction<Product[]>>;
  addToCart: (product: Product) => void;
  removeFromCart: (productId: string) => void;
}

export default function HomePage({ cart, products, setProducts, addToCart, removeFromCart }: HomePageProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const active = searchParams.get('categoria') || 'all';
  const setActive = (catId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (catId === 'all') {
      nextParams.delete('categoria');
    } else {
      nextParams.set('categoria', catId);
    }
    setSearchParams(nextParams, { replace: true });
  };
  const [loading, setLoading] = useState(true);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    void incrementPageView();
    const load = async () => {
      let nextProds = products;
      let nextCats = categories;

      if (!products.length) {
        const [{ data: cats }, { data: prods }] = await Promise.all([
          supabase.from('store_categories').select('*').order('display_order'),
          supabase.from('store_products').select('*').eq('available', true).order('created_at'),
        ]);
        nextCats = cats ?? [];
        nextProds = prods ?? [];
        if (!nextCats.length) {
          const { data } = await supabase.from('store_categories').insert(initialCategories).select();
          nextCats = data ?? [];
        }
        if (!nextProds.length && nextCats.length) {
          const rows = initialProducts.map((p, i) => ({ ...p, category_id: nextCats[i % nextCats.length].id, available: true }));
          const { data } = await supabase.from('store_products').insert(rows).select();
          nextProds = data ?? [];
        }
        // Adjust initial stock based on what's already in the cart
        nextProds = nextProds.map((p) => {
          if (p.stock === null) return p;
          const inCart = cart.filter((i) => i.id === p.id).reduce((s, i) => s + i.quantity, 0);
          return { ...p, stock: Math.max(0, p.stock - inCart) };
        });
        setCategories(nextCats);
        setProducts(nextProds);
      }
      setLoading(false);
    };
    void load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = active === 'all' ? products : products.filter((p) => p.category_id === active);
  const quantity = (id: string) => cart.find((item) => item.id === id && !item.redeemed_with_points)?.quantity ?? 0;
  const canAddMore = (product: Product) => product.stock === null || product.stock > 0;

  return (
    <main className="bg-[#ebdccc]">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-orange-500/30 bg-[#ebdccc] text-stone-800">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjMyLCA5MyLCAzMiwgMC4xKSIvPjwvc3ZnPg==')] opacity-50" />
        <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 py-16 sm:py-20 lg:grid-cols-[1.1fr_.9fr] lg:px-8 lg:py-24 relative z-10">
          <div className="relative">
            <p className="mb-5 flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[.22em] text-orange-600">
              <span className="h-px w-8 bg-orange-600" /> SYS.ID: COCINA
            </p>
            <h1 className="max-w-2xl font-display text-5xl font-bold uppercase leading-[.9] tracking-tight sm:text-7xl">
              El sabor de casa, <br/><span className="text-orange-600">en tu mesa.</span>
            </h1>
            <p className="mt-7 max-w-lg font-mono text-sm leading-6 text-stone-600">
              [ DATA LOADED ] Parrilla, clásicos argentinos y ese gustito único que convierte cualquier día en una ocasión especial.
            </p>
            <a href="#carta" className="mt-8 inline-flex items-center gap-3 border border-orange-600 bg-transparent px-6 py-3 font-mono text-sm font-bold uppercase text-orange-600 transition hover:bg-orange-600 hover:text-[#fffaf5]">
              Inicializar carta <ArrowRight size={16} />
            </a>
          </div>
          <div className="relative hidden lg:block">
            <div className="overflow-hidden border border-orange-500/30 bg-orange-50/50 p-2">
              <img src="/restaurant.png" alt="La Cabrera" className="h-[370px] w-full object-cover grayscale-[30%] contrast-125" />
            </div>
            <div className="absolute -bottom-5 -left-8 border border-orange-500/50 bg-[#ebdccc] p-4 text-stone-800 shadow-[4px_4px_0px_rgba(232,93,32,0.2)]">
              <span className="block font-mono text-xs font-bold uppercase tracking-widest text-orange-600">STATUS</span>
              <b className="font-display text-xl uppercase">Hecho a mano</b>
            </div>
          </div>
        </div>
      </section>

      {/* Category cards — modern design */}
      <section className="mx-auto max-w-7xl px-5 pt-14 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end border-b border-orange-500/20 pb-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[.18em] text-orange-600">DIR.CATEGORIES</p>
            <h2 className="mt-2 font-display text-3xl font-bold uppercase text-stone-800">Categorías</h2>
          </div>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {/* "Todo" card */}
          <button
            onClick={() => { setActive('all'); document.getElementById('carta')?.scrollIntoView({ behavior: 'smooth' }); }}
            className={`group relative overflow-hidden rounded-none border transition-all duration-300 ${active === 'all' ? 'border-orange-500 bg-orange-500/5 scale-[1.02]' : 'border-orange-500/30 hover:border-orange-500 bg-[#fffaf5]'}`}
          >
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMiIgZmlsbD0icmdiYSgyMzIsIDkzLCAzMiwgMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
            <div className="relative flex items-center justify-between p-6 text-left text-stone-800">
              <div>
                <span className="inline-block border border-orange-500/30 bg-[#fffaf5] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-orange-600">INDEX</span>
                <h3 className="mt-3 font-display text-xl font-bold uppercase tracking-wide">Toda la carta</h3>
                <p className="mt-1 font-mono text-xs text-stone-500">[{products.length}] RECÓRDS</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center border border-orange-500/50 bg-[#fffaf5] text-orange-600 transition-transform group-hover:bg-orange-600 group-hover:text-[#fffaf5]">
                <ArrowRight size={18} />
              </div>
            </div>
          </button>
          {categories.map((cat, idx) => {
            const catProducts = products.filter((p) => p.category_id === cat.id);
            const rawImage = cat.image_url || catProducts[0]?.image_url || photos[idx % photos.length];
            const bgImage = sanitizeUrl(rawImage);
            return (
              <button
                key={cat.id}
                onClick={() => { setActive(cat.id); document.getElementById('carta')?.scrollIntoView({ behavior: 'smooth' }); }}
                className={`group relative overflow-hidden rounded-none border transition-all duration-300 ${active === cat.id ? 'border-orange-500 scale-[1.02]' : 'border-orange-500/30 hover:border-orange-500'}`}
              >
                <div className="absolute inset-0">
                  <img src={bgImage} alt="" className="h-full w-full object-cover opacity-20 grayscale transition-transform duration-500 group-hover:scale-105 group-hover:opacity-40" />
                  <div className="absolute inset-0 bg-[#fffaf5]/80 mix-blend-screen" />
                </div>
                <div className="relative flex items-center justify-between p-6 text-left text-stone-800">
                  <div>
                    <span className="inline-block border border-orange-500/30 bg-[#fffaf5]/90 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-orange-600 backdrop-blur-sm">DIR.{idx + 1}</span>
                    <h3 className="mt-3 font-display text-xl font-bold uppercase tracking-wide drop-shadow-sm">{cat.name}</h3>
                    <p className="mt-1 font-mono text-xs text-stone-600 line-clamp-1">{cat.description}</p>
                  </div>
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center border border-orange-500/50 bg-[#fffaf5]/90 text-orange-600 backdrop-blur-sm transition-transform group-hover:bg-orange-600 group-hover:text-[#fffaf5]">
                    <ArrowRight size={18} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* Product grid */}
      <section id="carta" className="mx-auto max-w-7xl px-5 py-14 lg:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end border-b border-orange-500/20 pb-4">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[.18em] text-orange-600">QUERY.ALL</p>
            <h2 className="mt-2 font-display text-4xl font-bold uppercase text-stone-800">Menú</h2>
          </div>
          <p className="max-w-xs font-mono text-xs leading-5 text-stone-500">[ PREPARING MODULES ] Ingredientes simples y precisos.</p>
        </div>
        <div className="no-scrollbar mt-6 flex gap-2 overflow-x-auto pb-4">
          <button onClick={() => setActive('all')} className={`whitespace-nowrap border px-4 py-1.5 font-mono text-xs font-bold uppercase transition ${active === 'all' ? 'border-orange-600 bg-orange-600 text-[#fffaf5]' : 'border-orange-500/30 bg-transparent text-stone-600 hover:border-orange-500 hover:text-orange-600'}`}>Todo</button>
          {categories.map((cat) => (
            <button key={cat.id} onClick={() => setActive(cat.id)} className={`whitespace-nowrap border px-4 py-1.5 font-mono text-xs font-bold uppercase transition ${active === cat.id ? 'border-orange-600 bg-orange-600 text-[#fffaf5]' : 'border-orange-500/30 bg-transparent text-stone-600 hover:border-orange-500 hover:text-orange-600'}`}>{cat.name}</button>
          ))}
        </div>
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="h-96 animate-pulse border border-orange-500/30 bg-orange-50/50" />
            <div className="h-96 animate-pulse border border-orange-500/30 bg-orange-50/50" />
            <div className="h-96 animate-pulse border border-orange-500/30 bg-orange-50/50" />
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                quantity={quantity(product.id)}
                onAdd={() => addToCart(product)}
                onRemove={() => removeFromCart(product.id)}
                canAddMore={canAddMore(product)}
                onClick={() => {
                  void trackProductView(product.id);
                  setSelectedProduct(product);
                }}
              />
            ))}
          </div>
        )}
      </section>

      {selectedProduct && (
        <ProductModal
          product={selectedProduct}
          quantity={quantity(selectedProduct.id)}
          onAdd={() => addToCart(selectedProduct)}
          onRemove={() => removeFromCart(selectedProduct.id)}
          canAddMore={canAddMore(selectedProduct)}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </main>
  );
}
