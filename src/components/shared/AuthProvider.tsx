import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { HYPR_CLIENT_ID, HYPR_DOMAIN } from '../../lib/constants';

interface HyprUser {
  name: string;
  email: string;
}

interface AuthContextType {
  user: HyprUser | null;
  login: () => void;
  logout: () => void;
  isHypr: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  login: () => {},
  logout: () => {},
  isHypr: false,
});

export const useAuth = () => useContext(AuthContext);

function parseJwt(token: string): Record<string, string> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(
      decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      )
    );
  } catch {
    return null;
  }
}

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<HyprUser | null>(null);

  const onCredential = useCallback((response: { credential: string }) => {
    const payload = parseJwt(response.credential);
    if (!payload) return;
    if (!payload.email?.endsWith(HYPR_DOMAIN)) {
      alert('Acesso restrito a usuários ' + HYPR_DOMAIN);
      setUser(null);
      return;
    }
    const newUser = { name: payload.name || payload.email, email: payload.email };
    setUser(newUser);
  }, []);

  // Load Google Identity Services script on demand
  const gsiReady = useRef(false);
  const gsiLoading = useRef(false);

  const loadGsi = useCallback((): Promise<void> => {
    if (gsiReady.current) return Promise.resolve();
    if (gsiLoading.current) {
      return new Promise(resolve => {
        const check = setInterval(() => { if (gsiReady.current) { clearInterval(check); resolve(); } }, 100);
      });
    }
    gsiLoading.current = true;
    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.onload = () => {
        if (typeof google !== 'undefined' && google.accounts) {
          google.accounts.id.initialize({
            client_id: HYPR_CLIENT_ID,
            callback: onCredential,
            auto_select: false,
          });
          gsiReady.current = true;
        }
        resolve();
      };
      document.head.appendChild(script);
    });
  }, [onCredential]);

  const login = useCallback(async () => {
    if (user) return;
    await loadGsi();
    if (typeof google === 'undefined' || !google.accounts) return;
    google.accounts.id.prompt((notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        const tmp = document.createElement('div');
        tmp.style.cssText = 'position:fixed;top:60px;right:12px;z-index:9999;';
        document.body.appendChild(tmp);
        google.accounts.id.renderButton(tmp, {
          type: 'standard', theme: 'outline', size: 'large', text: 'signin_with', width: 280,
        });
        setTimeout(() => {
          const b = tmp.querySelector('[role="button"]') as HTMLElement;
          if (b) b.click();
        }, 200);
        setTimeout(() => tmp.remove(), 30000);
      }
    });
  }, [user, loadGsi]);

  const logout = useCallback(() => {
    if (confirm('Logado como ' + user?.email + '.\nDeseja sair?')) {
      setUser(null);
      if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.disableAutoSelect();
      }
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout, isHypr: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

// Declare Google Identity Services types
declare const google: {
  accounts: {
    id: {
      initialize: (config: Record<string, unknown>) => void;
      prompt: (callback: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
      renderButton: (el: HTMLElement, config: Record<string, unknown>) => void;
      disableAutoSelect: () => void;
    };
  };
};
