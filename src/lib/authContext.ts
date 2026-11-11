import { createContext, useContext } from 'react';
import type { UserPoints } from '@/types';

export interface AuthState {
  user: UserPoints | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<void>;
  signUp: (username: string, password: string, name?: string) => Promise<void>;
  signOut: () => void;
}

export const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}
