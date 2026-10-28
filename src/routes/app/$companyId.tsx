import { createFileRoute, Outlet } from "@tanstack/react-router";

import { CartProvider } from "@/lib/cart";

export const Route = createFileRoute("/app/$companyId")({
  component: CompanyLayout,
});

function CompanyLayout() {
  const { companyId } = Route.useParams();
  return (
    <CartProvider companyId={companyId}>
      <Outlet />
    </CartProvider>
  );
}
