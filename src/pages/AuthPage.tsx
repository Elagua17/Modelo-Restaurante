import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, User, Key, Mail } from 'lucide-react';
import { useAuth } from '@/lib/authContext';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!username.trim() || !password.trim() || (!isLogin && !name.trim())) { 
      setError('Por favor, completá todos los campos'); 
      return; 
    }
    
    setError('');
    try {
      if (isLogin) {
        await signIn(username.trim().toLowerCase(), password);
      } else {
        await signUp(username.trim().toLowerCase(), password, name.trim());
      }
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la solicitud');
    }
  };

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 py-12">
      <div className="w-full max-w-md rounded-[28px] border border-orange-100 bg-white p-8 shadow-[0_16px_40px_rgba(91,47,23,.08)]">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-stone-400 hover:text-orange-700">
          <ArrowLeft size={15} /> Volver a la carta
        </Link>
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-orange-700">
          <User size={26} />
        </div>
        <h1 className="mt-5 text-center font-display text-3xl font-bold text-stone-800">
          {isLogin ? 'Iniciar Sesión' : 'Crear Cuenta'}
        </h1>
        <p className="mt-2 text-center text-sm text-stone-500">
          {isLogin 
            ? 'Ingresá para canjear tus puntos por recompensas.' 
            : 'Registrate para empezar a sumar puntos con cada compra.'}
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {!isLogin && (
            <label className="label block">
              Nombre completo
              <div className="mt-2 flex items-center gap-2">
                <User size={18} className="text-stone-400" />
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tu nombre" className="field" />
              </div>
            </label>
          )}
          <label className="label block">
            Usuario
            <div className="mt-2 flex items-center gap-2">
              <Mail size={18} className="text-stone-400" />
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Tu nombre de usuario" className="field" />
            </div>
          </label>
          <label className="label block">
            Contraseña
            <div className="mt-2 flex items-center gap-2">
              <Key size={18} className="text-stone-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña" className="field" />
            </div>
          </label>
          
          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
          
          <button type="submit" className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-orange-600 py-3 text-sm font-bold text-white transition hover:bg-[#c84a16]">
            {isLogin ? 'Ingresar' : 'Registrarme'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-stone-500">
          {isLogin ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}
          <button 
            onClick={() => { setIsLogin(!isLogin); setError(''); }} 
            className="ml-2 font-bold text-orange-700 hover:underline"
          >
            {isLogin ? 'Crear una ahora' : 'Iniciar sesión'}
          </button>
        </div>
      </div>
    </main>
  );
}
