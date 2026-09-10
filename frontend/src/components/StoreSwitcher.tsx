"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { getMyStores } from "@/lib/api";

interface StoreEntry {
  id: number;
  shop_domain: string;
  connected: boolean;
}

export default function StoreSwitcher() {
  const { token, shop, setShop, logout } = useAuth();
  const router = useRouter();
  const [stores, setStores] = useState<StoreEntry[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;
    getMyStores(token)
      .then((data) => setStores((data as { stores: StoreEntry[] }).stores))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const switchStore = useCallback(
    (domain: string) => {
      setShop(domain);
      setOpen(false);
      router.refresh();
    },
    [setShop, router],
  );

  const currentLabel = shop
    ? shop.replace(".myshopify.com", "")
    : "No store";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-3 py-1 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition"
      >
        <span className="text-gray-400 text-xs">Store:</span>
        <span className="text-white truncate max-w-[140px]">{currentLabel}</span>
        <span className={`text-xs ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-60 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50">
          {stores.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">No stores found</p>
          )}
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => switchStore(s.shop_domain)}
              className={`w-full text-left px-4 py-2 text-sm transition ${
                s.shop_domain === shop
                  ? "bg-blue-600/20 text-blue-300"
                  : "text-white hover:bg-gray-700"
              }`}
            >
              <span className="truncate block">{s.shop_domain}</span>
              {!s.connected && (
                <span className="text-xs text-yellow-400">not connected</span>
              )}
            </button>
          ))}
          <button
            onClick={() => {
              setOpen(false);
              router.push("/dashboard/connect");
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 border-t border-gray-700 transition"
          >
            + Add another store
          </button>
          <button
            onClick={() => {
              setOpen(false);
              logout();
              router.push("/login");
            }}
            className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-red-300 hover:bg-gray-700 border-t border-gray-700 transition"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}