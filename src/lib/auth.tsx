import { useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';
import { hashPassword } from './utils';
import type { UserPoints } from '@/types';
import { AuthContext } from './authContext';

/** Elimina credenciales sensibles antes de persistir o exponer en estado */
function sanitizeUser(u: UserPoints): UserPoints {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password, ...safeUser } = u;
  return safeUser as UserPoints;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserPoints | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('lacabrera-user') || localStorage.getItem('rincon-user');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as UserPoints;
        if (parsed && parsed.username) {
          void supabase
            .from('store_user_points')
            .select('*')
            .eq('username', parsed.username)
            .maybeSingle()
            .then(({ data }) => {
              if (data) {
                const safe = sanitizeUser(data);
                setUser(safe);
                localStorage.setItem('lacabrera-user', JSON.stringify(safe));
              } else {
                setUser(sanitizeUser(parsed));
              }
              setLoading(false);
            })
            .catch(() => {
              setUser(sanitizeUser(parsed));
              setLoading(false);
            });
          return;
        }
      } catch {
        localStorage.removeItem('lacabrera-user');
        localStorage.removeItem('rincon-user');
      }
    }
    setLoading(false);
  }, []);

  const signIn = async (username: string, password: string) => {
    const cleanUsername = username.trim().toLowerCase();
    const { data: existing } = await supabase
      .from('store_user_points')
      .select('*')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (!existing) {
      throw new Error('El usuario no existe. Por favor, creá una cuenta.');
    }

    const hashedInput = await hashPassword(password);
    const passwordMatches =
      existing.password === hashedInput || existing.password === password;

    if (!passwordMatches) {
      throw new Error('Contraseña incorrecta');
    }

    // Si la contraseña anterior estaba en texto plano, migrarla automáticamente al hash SHA-256
    if (existing.password === password && existing.password !== hashedInput) {
      await supabase
        .from('store_user_points')
        .update({ password: hashedInput })
        .eq('id', existing.id);
    }

    const safeUser = sanitizeUser(existing);
    setUser(safeUser);
    localStorage.setItem('lacabrera-user', JSON.stringify(safeUser));
  };

  const signUp = async (username: string, password: string, name?: string) => {
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      throw new Error('El nombre de usuario debe tener al menos 3 caracteres');
    }
    if (password.length < 6) {
      throw new Error('La contraseña debe tener al menos 6 caracteres');
    }

    const { data: existing } = await supabase
      .from('store_user_points')
      .select('id')
      .eq('username', cleanUsername)
      .maybeSingle();

    if (existing) {
      throw new Error('El nombre de usuario ya está en uso');
    }

    const hashedPassword = await hashPassword(password);
    const { data: created } = await supabase
      .from('store_user_points')
      .insert({
        username: cleanUsername,
        password: hashedPassword,
        name: name?.trim() || cleanUsername,
        points: 0,
      })
      .select()
      .maybeSingle();

    if (created) {
      const safeUser = sanitizeUser(created);
      setUser(safeUser);
      localStorage.setItem('lacabrera-user', JSON.stringify(safeUser));
    } else {
      throw new Error('Error al registrar usuario');
    }
  };

  const signOut = () => {
    setUser(null);
    localStorage.removeItem('lacabrera-user');
    localStorage.removeItem('rincon-user');
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
