import { Plus, Minus } from 'lucide-react';
import type { Product } from '@/types';
import { money, sanitizeUrl } from '@/lib/utils';

interface ProductCardProps {
  product: Product;
  quantity: number;
  onAdd: () => void;
  onRemove: () => void;
  canAddMore: boolean;
  onClick?: () => void;
}

export default function ProductCard({ product, quantity, onAdd, onRemove, canAddMore, onClick }: ProductCardProps) {
  const outOfStock = product.stock === 0 && quantity === 0;
  const atLimit = !canAddMore || (product.stock === 0 && quantity > 0);

  return (
    <article className={`group flex flex-col overflow-hidden rounded-none border border-orange-500/30 bg-[#fffaf5] transition-colors hover:border-orange-500 ${outOfStock ? 'opacity-70' : ''}`}>
      <div 
        onClick={onClick} 
        className={`relative h-48 overflow-hidden border-b border-orange-500/30 bg-orange-50/50 ${onClick ? 'cursor-pointer' : ''}`}
      >
        <img src={sanitizeUrl(product.image_url)} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
        <div className="absolute inset-0 bg-stone-900/10 mix-blend-multiply" />
        {product.featured && <span className="absolute left-3 top-3 border border-orange-500 bg-[#fffaf5] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-orange-700">FAV</span>}
        {outOfStock && <span className="absolute right-3 top-3 border border-red-500 bg-[#fffaf5] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-red-600">OUT OF STOCK</span>}
        {product.points > 0 && <span className="absolute bottom-3 right-3 border border-orange-400 bg-orange-50/90 px-2 py-1 font-mono text-[10px] font-bold text-orange-700">+{product.points} PTS</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div onClick={onClick} className={`flex-1 ${onClick ? 'cursor-pointer' : ''}`}>
          <h3 className="font-display text-xl font-bold uppercase leading-tight text-stone-800 tracking-wide">{product.name}</h3>
          <p className="mt-2 min-h-10 font-mono text-xs leading-5 text-stone-500 line-clamp-2">{product.description}</p>
        </div>
        <div className="mt-5 flex items-end justify-between gap-3">
          <div className="flex flex-col">
            <span className="font-mono text-lg font-bold text-orange-700">{money(product.price)}</span>
            {product.points > 0 && (
              <span className="font-mono text-[10px] text-stone-500">+{product.points} pts / un</span>
            )}
            {product.stock !== null && !outOfStock && (
              <span className={`font-mono text-[10px] uppercase mt-1 ${product.stock <= 3 ? 'text-orange-600' : 'text-stone-500'}`}>
                Stock: {product.stock}
              </span>
            )}
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            {outOfStock ? (
              <span className="border border-stone-300 bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase text-stone-400">N/A</span>
            ) : quantity === 0 ? (
              <button onClick={(e) => { e.stopPropagation(); onAdd(); }} className="flex items-center gap-2 rounded-none border border-orange-600 bg-transparent px-4 py-2 font-mono text-xs font-bold uppercase text-orange-600 transition hover:bg-orange-600 hover:text-[#fffaf5]">
                <Plus size={14} /> ADD
              </button>
            ) : (
              <div className="flex items-center gap-2 border border-orange-600 bg-transparent px-1 py-1">
                <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 text-orange-600 transition hover:bg-orange-600 hover:text-[#fffaf5]"><Minus size={14} /></button>
                <b className="min-w-6 text-center font-mono text-sm text-stone-800">{quantity}</b>
                <button onClick={(e) => { e.stopPropagation(); onAdd(); }} disabled={atLimit} className={`p-1 transition ${atLimit ? 'cursor-not-allowed opacity-50' : 'text-orange-600 hover:bg-orange-600 hover:text-[#fffaf5]'}`} title={atLimit ? 'Stock máximo alcanzado' : ''}>
                  <Plus size={14} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
