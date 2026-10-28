// Shared harness for the invoice screen render tests: mocks the server functions and auth, then
// renders the real route tree (layout, sidebar and page) at a path with a memory history.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";

import { FIXTURE_INVOICES, FIXTURE_SUPPLIERS } from "@/lib/invoice-fixtures";
import { computeOverview } from "@/lib/invoice-mapping";
import type { InvoiceDetail, InvoiceSummary } from "@/lib/invoice-types";
import { Route as AppRouteImport } from "@/routes/app";
import { Route as IntakeRouteImport } from "@/routes/app/intake";
import { Route as InvoiceRouteImport } from "@/routes/app/invoices/$invoiceId";
import { Route as InvoicesRouteImport } from "@/routes/app/invoices/index";
import { Route as OverviewRouteImport } from "@/routes/app/overview";
import { Route as SuppliersRouteImport } from "@/routes/app/suppliers";

import { api, authState } from "./invoice-mocks";

export { api, authState };

export const strip = (d: InvoiceDetail): InvoiceSummary => {
  const {
    ibanOnInvoice: _a,
    vatAmount: _b,
    minFieldConfidence: _c,
    rawText: _d,
    lines: _e,
    audit: _f,
    approvedBy: _g,
    canDecide: _h,
    cannotDecideReason: _i,
    ...summary
  } = d;
  return summary;
};

// Fresh copies so a test can tweak a fixture without leaking into the next one.
export const freshInvoices = (): InvoiceDetail[] => structuredClone(FIXTURE_INVOICES);

export function resetApi(invoices: InvoiceDetail[] = freshInvoices()) {
  api.listInvoices.mockReset().mockImplementation(async () => invoices.map(strip));
  api.getInvoice
    .mockReset()
    .mockImplementation(async ({ data }: { data: { invoiceId: string } }) => {
      const found = invoices.find((i) => i.id === data.invoiceId);
      if (!found) throw new Error("Invoice not found.");
      return found;
    });
  api.decideInvoice
    .mockReset()
    .mockImplementation(async ({ data }: { data: { invoiceId: string } }) => {
      const found = invoices.find((i) => i.id === data.invoiceId)!;
      return strip(found);
    });
  api.submitInvoice.mockReset();
  api.askAssistant.mockReset();
  api.listSuppliers.mockReset().mockImplementation(async () => structuredClone(FIXTURE_SUPPLIERS));
  api.getOverview.mockReset().mockImplementation(async () => computeOverview(invoices.map(strip)));
  authState.isAdmin = false;
  authState.user = { id: "u1", name: "Demo Reviewer", email: "demo@appbuilder.ai" };
}

// The real route tree has a <html> shell that cannot mount inside jsdom, so this wires the real
// /app layout (with the sidebar) and the real invoice screens under a plain root, the same way
// src/routeTree.gen.ts does. Do not import @/routeTree.gen in a file that uses this: both would
// re-parent the same route objects.
function buildRouteTree() {
  const root = createRootRoute({ component: () => <Outlet /> });
  const child = (r: any, path: string, parent: any) =>
    r.update({ id: path, path, getParentRoute: () => parent } as any);
  const app = AppRouteImport.update({ id: "/app", path: "/app", getParentRoute: () => root } as any);
  return root.addChildren([
    app.addChildren([
      child(InvoicesRouteImport, "/invoices/", app),
      child(InvoiceRouteImport, "/invoices/$invoiceId", app),
      child(IntakeRouteImport, "/intake", app),
      child(OverviewRouteImport, "/overview", app),
      child(SuppliersRouteImport, "/suppliers", app),
    ]),
  ]);
}

let routeTree: ReturnType<typeof buildRouteTree> | undefined;

export function renderAt(path: string) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  routeTree ??= buildRouteTree();
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...utils, router, queryClient };
}
