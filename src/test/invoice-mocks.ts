// Mock modules for the invoice screen tests. Kept free of route imports so a vi.mock factory can
// load it without a circular import. Use: vi.mock("@/lib/invoices", async () => (await import("./invoice-mocks")).api)
import type { ReactNode } from "react";
import { vi } from "vitest";

export const api = {
  listInvoices: vi.fn(),
  getInvoice: vi.fn(),
  decideInvoice: vi.fn(),
  submitInvoice: vi.fn(),
  askAssistant: vi.fn(),
  listSuppliers: vi.fn(),
  getOverview: vi.fn(),
};

export const authState: {
  isAdmin: boolean;
  user: { id: string; name: string; email: string } | null;
} = {
  isAdmin: false,
  user: { id: "u1", name: "Demo Reviewer", email: "demo@appbuilder.ai" },
};

export const mockAuthModule = {
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({
    user: authState.user,
    ready: true,
    isAdmin: authState.isAdmin,
    signIn: vi.fn(),
    signInDemo: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(async () => {}),
  }),
};
