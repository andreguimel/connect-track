import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface ImpersonatedUser {
  user_id: string;
  email: string;
  full_name: string | null;
}

interface ImpersonationContextType {
  impersonatedUser: ImpersonatedUser | null;
  isImpersonating: boolean;
  startImpersonation: (user: ImpersonatedUser) => void;
  stopImpersonation: () => void;
  getEffectiveUserId: (realUserId: string) => string;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

const STORAGE_KEY = 'zapmassa_impersonation';

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [impersonatedUser, setImpersonatedUser] = useState<ImpersonatedUser | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setImpersonatedUser(JSON.parse(stored));
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const startImpersonation = (user: ImpersonatedUser) => {
    setImpersonatedUser(user);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  };

  const stopImpersonation = () => {
    setImpersonatedUser(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  const getEffectiveUserId = (realUserId: string) => {
    return impersonatedUser?.user_id || realUserId;
  };

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedUser,
        isImpersonating: !!impersonatedUser,
        startImpersonation,
        stopImpersonation,
        getEffectiveUserId
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation must be used within an ImpersonationProvider');
  }
  return context;
}
