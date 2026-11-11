import { Link, useLocation } from 'react-router-dom';
import { ShoppingBag, User, LogOut, Gift, Sparkles } from 'lucide-react';
import { useAuth } from '@/lib/authContext';

function Logo() {
  return <img src="/logo-la-cabrera.jpg" alt="La Cabrera" className="h-12 w-auto object-contain rounded-full border border-orange-500/30" />;
}

interface HeaderProps {
  count: number;
  onCart: () => void;
}

export default function Header({ count, onCart }: HeaderProps) {
  const location = useLocation();
  const { user, signOut } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b-2 border-[#1f110b] bg-gradient-to-r from-[#2b1810] via-[#3a2215] to-[#2b1810] shadow-md">
      <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <Logo />
          <span className="hidden border-l border-[#5e3822] pl-3 text-xs font-bold uppercase tracking-[0.2em] text-[#c2a38b] sm:block">Sabores que abrazan</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link to="/" className={`border px-3 py-2 text-sm font-mono uppercase transition ${location.pathname === '/' ? 'border-orange-400 bg-orange-400/10 text-orange-400' : 'border-transparent text-[#eaddcf] hover:border-orange-500/50 hover:text-orange-400'}`}>Carta</Link>
          <Link to="/rewards" className={`flex items-center gap-1.5 border px-3 py-2 text-sm font-mono uppercase transition ${location.pathname === '/rewards' ? 'border-orange-400 bg-orange-400/10 text-orange-400' : 'border-transparent text-[#eaddcf] hover:border-orange-500/50 hover:text-orange-400'}`}>
            <Gift size={15} /> <span className="hidden sm:inline">Recompensas</span> {user && <b className="text-orange-400">{user.points} pts</b>}
          </Link>
          <Link to="/admin" className={`border px-3 py-2 text-sm font-mono uppercase transition ${location.pathname === '/admin' ? 'border-orange-400 bg-orange-400/10 text-orange-400' : 'border-transparent text-[#eaddcf] hover:border-orange-500/50 hover:text-orange-400'}`}>Admin</Link>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-1.5 border border-orange-500/50 bg-transparent px-3 py-2 text-xs font-mono font-bold uppercase text-orange-400 sm:flex">
                <Sparkles size={13} /> {user.name}
              </span>
              <button onClick={signOut} className="border border-transparent p-2 text-[#c2a38b] hover:border-orange-500/50 hover:text-orange-400" title="Cerrar sesión">
                <LogOut size={17} />
              </button>
            </div>
          ) : (
            <Link to="/login" className="flex items-center gap-1.5 border border-transparent px-3 py-2 text-sm font-mono uppercase text-[#eaddcf] transition hover:border-orange-500/50 hover:text-orange-400">
              <User size={16} /> <span className="hidden sm:block">Ingresar</span>
            </Link>
          )}
          <button onClick={onCart} className="relative flex items-center gap-2 border border-orange-500 bg-transparent px-4 py-2 font-mono text-sm font-bold uppercase text-orange-500 transition hover:bg-orange-500 hover:text-white">
            <ShoppingBag size={17} /> <span className="hidden sm:block">Mi pedido</span>
            {count > 0 && <b className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center border border-[#3a2215] bg-orange-500 px-1 text-[10px] text-white">{count}</b>}
          </button>
        </nav>
      </div>
    </header>
  );
}
