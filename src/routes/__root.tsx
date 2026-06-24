import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";

import appCss from "../styles.css?url";
import { AuthProvider } from "@/hooks/use-auth";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AdBanner } from "@/components/AdBanner";
import { RandomShout } from "@/components/RandomShout";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface max-w-md p-8 text-center">
        <h1 className="text-6xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">That page doesn't exist.</p>
        <Link to="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Back to marketplace</Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="surface max-w-md p-8 text-center">
        <h2 className="text-lg font-semibold">Something broke</h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Retry</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "EscrowDesk · P2P Crypto Escrow with Telegram" },
      { name: "description", content: "Professional peer-to-peer crypto trading with on-platform escrow and a fully integrated Telegram bot." },
      { property: "og:title", content: "EscrowDesk · P2P Crypto Escrow with Telegram" },
      { property: "og:description", content: "Professional peer-to-peer crypto trading with on-platform escrow and a fully integrated Telegram bot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "EscrowDesk · P2P Crypto Escrow with Telegram" },
      { name: "twitter:description", content: "Professional peer-to-peer crypto trading with on-platform escrow and a fully integrated Telegram bot." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/peORSSGOUbVYHZ2SdkRQJyaSbu53/social-images/social-1779122852004-1000076389.webp" },
      { name: "twitter:image", content: "https://{/* rest omitted for brevity */}53/social-images/social-1779122852004-1000076389.webp" },
      { name: "theme-color", content: "#0f172a" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <div className="flex min-h-screen flex-col">
          <SiteHeader />
          <AdBanner placement="top" dismissable className="mx-auto w-full max-w-[1600px] px-3 pt-3 sm:px-6 lg:px-8" />
          <main className="mx-auto w-full max-w-[1600px] flex-1 px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
            <RandomShout className="mb-4" />
            <Outlet />
          </main>
          <AdBanner placement="bottom" className="mx-auto w-full max-w-[1600px] px-3 pb-4 sm:px-6 lg:px-8" />
          <AdBanner placement="footer_banner" className="mx-auto w-full max-w-[1600px] px-3 pb-2 sm:px-6 lg:px-8" />
          <SiteFooter />
        </div>
        <Toaster theme="dark" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
