import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AppBuilder.AI" },
      { name: "description", content: "AppBuilder.AI — coming soon." },
      { property: "og:title", content: "AppBuilder.AI" },
      { property: "og:description", content: "AppBuilder.AI — coming soon." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <h1 className="text-4xl font-semibold tracking-tight text-foreground">AppBuilder.AI</h1>
    </main>
  );
}
