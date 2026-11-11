import { Link } from 'react-router-dom';
import { Lock, ArrowLeft, ShieldAlert, Clock } from 'lucide-react';
import { useState, useEffect, type FormEvent } from 'react';
import { ADMIN_PIN } from '@/lib/constants';

interface PinLockProps {
  onUnlock: () => void;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 60;

export default function PinLock({ onUnlock }: PinLockProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(() => {
    try {
      return Number(sessionStorage.getItem('admin_pin_attempts') || '0');
    } catch {
      return 0;
    }
  });
  const [lockoutRemaining, setLockoutRemaining] = useState(() => {
    try {
      const lockUntil = Number(sessionStorage.getItem('admin_pin_lockout_until') || '0');
      const diff = Math.ceil((lockUntil - Date.now()) / 1000);
      return diff > 0 ? diff : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    if (lockoutRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockoutRemaining((prev) => {
        if (prev <= 1) {
          try {
            sessionStorage.removeItem('admin_pin_lockout_until');
            sessionStorage.setItem('admin_pin_attempts', '0');
          } catch {
            // ignore
          }
          setFailedAttempts(0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockoutRemaining]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (lockoutRemaining > 0) return;

    if (pin === ADMIN_PIN) {
      try {
        sessionStorage.removeItem('admin_pin_attempts');
        sessionStorage.removeItem('admin_pin_lockout_until');
      } catch {
        // ignore
      }
      onUnlock();
    } else {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      setError(true);
      setPin('');

      try {
        sessionStorage.setItem('admin_pin_attempts', String(nextAttempts));
      } catch {
        // ignore
      }

      if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
        const lockUntil = Date.now() + LOCKOUT_SECONDS * 1000;
        try {
          sessionStorage.setItem('admin_pin_lockout_until', String(lockUntil));
        } catch {
          // ignore
        }
        setLockoutRemaining(LOCKOUT_SECONDS);
      }
    }
  };

  const isLocked = lockoutRemaining > 0;

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-5">
      <div className="w-full max-w-sm rounded-[28px] border border-orange-100 bg-white p-8 text-center shadow-[0_16px_40px_rgba(91,47,23,.08)]">
        <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${isLocked ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-700'}`}>
          {isLocked ? <ShieldAlert size={28} /> : <Lock size={28} />}
        </div>
        <h1 className="mt-5 font-display text-3xl font-bold text-stone-800">Acceso restringido</h1>
        <p className="mt-2 text-sm text-stone-500">Ingresá el PIN del panel para continuar.</p>

        {isLocked ? (
          <div className="mt-6 rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            <div className="flex items-center justify-center gap-2 font-bold">
              <Clock size={16} /> Demasiados intentos fallidos
            </div>
            <p className="mt-1 text-xs">
              Por seguridad, el panel está bloqueado. Reintentá en <b className="text-red-900">{lockoutRemaining}s</b>.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6">
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              disabled={isLocked}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value);
                setError(false);
              }}
              placeholder="• • • • • •"
              className={`field text-center text-2xl tracking-[0.5em] ${error ? 'border-red-400' : ''}`}
            />
            {error && (
              <p className="mt-2 text-xs font-semibold text-red-600">
                PIN incorrecto ({failedAttempts}/{MAX_FAILED_ATTEMPTS} intentos).
              </p>
            )}
            <button
              type="submit"
              disabled={isLocked || !pin.trim()}
              className="mt-5 w-full rounded-full bg-orange-600 py-3 font-bold text-white transition hover:bg-[#c84a16] disabled:cursor-not-allowed disabled:bg-stone-300"
            >
              Ingresar
            </button>
            <Link
              to="/"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-stone-400 hover:text-orange-700"
            >
              <ArrowLeft size={15} /> Volver a la carta
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
