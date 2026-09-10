"use client";

import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";

interface AuthContextType {
  token: string | null;
  shop: string | null;
  setToken: (token: string | null) => void;
  setShop: (shop: string | null) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  shop: null,
  setToken: () => {},
  setShop: () => {},
  logout: () => {},
});

function getStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(() =>
    getStored("token")
  );
  const [shop, setShopState] = useState<string | null>(() =>
    getStored("shop")
  );

  const setToken = (t: string | null) => {
    setTokenState(t);
    if (t) localStorage.setItem("token", t);
    else localStorage.removeItem("token");
  };

  const setShop = (s: string | null) => {
    setShopState(s);
    if (s) localStorage.setItem("shop", s);
    else localStorage.removeItem("shop");
  };

  const logout = () => {
    setToken(null);
    setShop(null);
  };

  return (
    <AuthContext.Provider value={{ token, shop, setToken, setShop, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
