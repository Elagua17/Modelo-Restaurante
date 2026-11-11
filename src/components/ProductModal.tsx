import { X, ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react';
import { useState } from 'react';
import type { Product } from '@/types';
import { money, sanitizeUrl } from '@/lib/utils';

interface ProductModalProps {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  canAddMore: boolean;
  onClose: () => void;
}

export default function ProductModal({ product, quantity, onAdd, onRemove, canAddMore, onClose }: ProductModalProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const outOfStock = product.stock === 0 && quantity === 0;
  const atLimit = !canAddMore || (product.stock === 0 && quantity > 0);

  const images = [product.image_url, ...(product.images || [])]
    .filter(Boolean)
    .map((url) => sanitizeUrl(url));

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden border border-orange-500/30 bg-white shadow-2xl md:flex-row" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/20 text-white backdrop-blur-md transition hover:bg-black/40">
          <X size={20} />
        </button>

        {/* Image Gallery */}
        <div className="relative h-64 w-full bg-stone-100 md:h-auto md:w-1/2">
          <img src={images[photoIndex]} alt={product.name} className="h-full w-full object-cover" />
          
          {images.length > 1 && (
            <>
              <button
                onClick={() => setPhotoIndex((i) => (i === 0 ? images.length - 1 : i - 1))}
                className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-stone-800 shadow backdrop-blur transition hover:bg-white"
              >
                <ChevronLeft size={20} />
              </button>
              <button
                onClick={() => setPhotoIndex((i) => (i === images.length - 1 ? 0 : i + 1))}
                className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/80 text-stone-800 shadow backdrop-blur transition hover:bg-white"
              >
                <ChevronRight size={20} />
              </button>
              <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-2">
                {images.map((_, idx) => (
                  <button key={idx} onClick={() => setPhotoIndex(idx)} className={`h-2 w-2 rounded-full transition-all ${idx === photoIndex ? 'bg-white w-4' : 'bg-white/50'}`} />
                ))}
              </div>
            </>
          )}

          {product.featured && <span className="absolute left-4 top-4 rounded-full bg-[#fff3d9] px-3 py-1 text-[10px] font-extrabold uppercase tracking-wider text-orange-900 shadow-md">Favorito</span>}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-y-auto p-6 md:p-10 bg-[#fffaf5]">
          <div className="flex-1">
            <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-stone-800 md:text-4xl">{product.name}</h2>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="font-mono text-2xl font-bold text-orange-700">{money(product.price)}</span>
              {product.points > 0 && (
                <span className="border border-orange-400 bg-orange-50/90 px-3 py-1 font-mono text-xs font-bold text-orange-700">
                  +{product.points} pts por compra
                </span>
              )}
            </div>
            
            <p className="mt-6 whitespace-pre-wrap font-mono text-sm leading-relaxed text-stone-600">{product.description}</p>
            
            {product.stock !== null && (
              <div className="mt-6 border border-orange-500/30 bg-orange-50/50 p-4">
                <p className="font-mono text-sm font-semibold text-orange-800">
                  STOCK DISPONIBLE: <b className="text-lg">{product.stock}</b>
                </p>
                {product.stock <= 5 && product.stock > 0 && (
                  <p className="mt-1 font-mono text-xs text-orange-600 uppercase">¡Quedan pocas unidades!</p>
                )}
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-orange-500/30 pt-6">
            {outOfStock ? (
              <button disabled className="w-full border border-stone-300 bg-transparent py-4 text-center font-mono text-sm font-bold uppercase text-stone-400">
                OUT OF STOCK
              </button>
            ) : quantity === 0 ? (
              <button
                onClick={onAdd}
                className="flex w-full items-center justify-center gap-2 border border-orange-600 bg-transparent py-4 font-mono text-sm font-bold uppercase text-orange-600 transition hover:bg-orange-600 hover:text-[#fffaf5]"
              >
                <Plus size={18} /> ADD
              </button>
            ) : (
              <div className="flex items-center justify-between border border-orange-600 bg-transparent p-2">
                <button
                  onClick={onRemove}
                  className="flex h-12 w-12 items-center justify-center text-orange-600 transition hover:bg-orange-600 hover:text-[#fffaf5]"
                >
                  <Minus size={20} />
                </button>
                <div className="text-center">
                  <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-orange-400">EN PEDIDO</span>
                  <b className="font-mono text-xl text-stone-800">{quantity}</b>
                </div>
                <button
                  onClick={onAdd}
                  disabled={atLimit}
                  className={`flex h-12 w-12 items-center justify-center transition ${atLimit ? 'cursor-not-allowed opacity-50' : 'text-orange-600 hover:bg-orange-600 hover:text-[#fffaf5]'}`}
                >
                  <Plus size={20} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
