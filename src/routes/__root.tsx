import type { ErrorComponentProps } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useLocation,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useLayoutEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { UiLangProvider } from "@/lib/uiLang";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { initSentry, setSentryUser } from "../lib/sentry";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

const useIsomorphicLayoutEffect = typeof document !== "undefined" ? useLayoutEffect : useEffect;

function ScrollToTop() {
  const location = useLocation();
  useIsomorphicLayoutEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [location.pathname]);
  return null;
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      // Fallback title: the signed-in area renders in the browser only
      // (ssr: false), so its HTML would otherwise arrive without any title.
      { title: "Evoluir+ English AI" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Evoluir+ English AI" },
      { name: "theme-color", content: "#000000" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Sora:wght@500;600;700&display=swap",
      },
      // Browser tab only (user request): the owner's symbol without a background,
      // dark strokes on light tabs and light strokes on dark ones. The app icon
      // (apple-touch-icon, manifest) stays as it is.
      {
        rel: "icon",
        href: "/favicon-light.png?v=16",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        rel: "icon",
        href: "/favicon.png?v=16",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png?v=13" },
      { rel: "manifest", href: "/site.webmanifest?v=13" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var path = window.location.pathname;
                if (path === '/' || path === '/auth' || path.startsWith('/auth/')) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    initSentry();
    supabase.auth.getSession().then(({ data }) => {
      setSentryUser(data.session?.user.id ?? null);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setSentryUser(session?.user.id ?? null);
      // A reset link may land on any page (e.g. the Site URL when /reset-password
      // is not an allowed redirect): always finish on the new-password screen.
      if (event === "PASSWORD_RECOVERY" && window.location.pathname !== "/reset-password") {
        void router.navigate({ to: "/reset-password", replace: true });
        return;
      }
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ScrollToTop />
      <UiLangProvider>
        {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
        <Outlet />
      </UiLangProvider>
      <Toaster className="dashboard-shell dark" position="top-center" />
    </QueryClientProvider>
  );
}
