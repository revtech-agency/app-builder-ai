// Order cart shared by New order and Inventory, kept in sessionStorage per company.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

export type CartLine = {
  sku: string;
  name: string;
  metres: number;
  metres_per_pack?: number | undefined;
  min_sale_packs?: number | undefined;
  price_per_pack?: number | undefined;
  stock_packs?: number | undefined;
  pack_type?: string | undefined;
};

type CartState = { lines: CartLine[]; deliveryDate: string };

type CartContextValue = CartState & {
  setDeliveryDate: (date: string) => void;
  // Replace the whole cart (assistant replies), keeping pack types we already know.
  replaceCart: (lines: CartLine[], deliveryDate?: string) => void;
  addLine: (line: CartLine) => void;
  setMetres: (sku: string, metres: number) => void;
  removeLine: (sku: string) => void;
  clear: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

const CART_EVENT = "appbuilder-cart-change";
const EMPTY: CartState = { lines: [], deliveryDate: "" };
const storageKey = (companyId: string) => `appbuilder-cart:${companyId}`;

function load(companyId: string): CartState {
  try {
    const raw = window.sessionStorage.getItem(storageKey(companyId));
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    return {
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      deliveryDate: typeof parsed.deliveryDate === "string" ? parsed.deliveryDate : "",
    };
  } catch {
    return EMPTY;
  }
}

export function CartProvider({ companyId, children }: { companyId: string; children: ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY);
  // Don't write the empty initial state over a stored cart before it has been read.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    setState(load(companyId));
    setLoadedFor(companyId);
  }, [companyId]);

  useEffect(() => {
    if (loadedFor !== companyId) return;
    try {
      window.sessionStorage.setItem(storageKey(companyId), JSON.stringify(state));
      window.dispatchEvent(new Event(CART_EVENT));
    } catch {
      // Storage can be unavailable (private mode); the cart then lives in memory only.
    }
  }, [state, companyId, loadedFor]);

  const setDeliveryDate = useCallback((deliveryDate: string) => {
    setState((s) => ({ ...s, deliveryDate }));
  }, []);

  const replaceCart = useCallback((lines: CartLine[], deliveryDate?: string) => {
    setState((s) => ({
      lines: lines.map((l) => ({
        ...l,
        pack_type: l.pack_type ?? s.lines.find((o) => o.sku === l.sku)?.pack_type,
      })),
      deliveryDate: deliveryDate || s.deliveryDate,
    }));
  }, []);

  const addLine = useCallback((line: CartLine) => {
    setState((s) => {
      const existing = s.lines.find((l) => l.sku === line.sku);
      return {
        ...s,
        lines: existing
          ? s.lines.map((l) =>
              l.sku === line.sku ? { ...l, ...line, metres: l.metres + line.metres } : l,
            )
          : [...s.lines, line],
      };
    });
  }, []);

  const setMetres = useCallback((sku: string, metres: number) => {
    setState((s) => ({ ...s, lines: s.lines.map((l) => (l.sku === sku ? { ...l, metres } : l)) }));
  }, []);

  const removeLine = useCallback((sku: string) => {
    setState((s) => ({ ...s, lines: s.lines.filter((l) => l.sku !== sku) }));
  }, []);

  const clear = useCallback(() => setState(EMPTY), []);

  const value = useMemo(
    () => ({ ...state, setDeliveryDate, replaceCart, addLine, setMetres, removeLine, clear }),
    [state, setDeliveryDate, replaceCart, addLine, setMetres, removeLine, clear],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside <CartProvider>");
  return ctx;
}

// Line count for the sidebar badge; the sidebar sits above the cart provider, so it reads storage.
// eslint-disable-next-line react-refresh/only-export-components
export function useCartCount(companyId: string | undefined) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!companyId) {
      setCount(0);
      return;
    }
    const read = () => setCount(load(companyId).lines.length);
    read();
    window.addEventListener(CART_EVENT, read);
    return () => window.removeEventListener(CART_EVENT, read);
  }, [companyId]);
  return count;
}
