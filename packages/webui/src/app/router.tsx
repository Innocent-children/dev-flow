import { AnchorHTMLAttributes, useEffect, useState } from "react";

export type Route =
  | { page: "dashboard" }
  | { page: "tasks" }
  | { page: "open-task" }
  | { page: "system" }
  | { page: "task"; taskID: string }
  | { page: "not-found" };

export function currentRoute(): Route {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { page: "dashboard" };
  if (path === "/tasks") return { page: "tasks" };
  if (path === "/tasks/new") return { page: "open-task" };
  if (path === "/system") return { page: "system" };
  const match = path.match(/^\/tasks\/([^/]+)$/);
  if (match !== null) return { page: "task", taskID: decodeURIComponent(match[1]) };
  return { page: "not-found" };
}

export function navigate(path: string): void {
  if (`${window.location.pathname}${window.location.search}` === path) return;
  const next = new URL(path, window.location.origin);
  const pageChanged = next.pathname !== window.location.pathname;
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
  if (pageChanged) window.requestAnimationFrame(() => document.getElementById("main-content")?.focus());
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => currentRoute());
  useEffect(() => {
    const update = (event: PopStateEvent) => {
      setRoute(currentRoute());
      if (event.isTrusted) window.requestAnimationFrame(() => document.getElementById("main-content")?.focus());
    };
    window.addEventListener("popstate", update);
    return () => window.removeEventListener("popstate", update);
  }, []);
  return route;
}

export function AppLink({ href, children, onClick, ...attributes }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...attributes}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;
        if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) {
          event.preventDefault();
          navigate(href);
        }
      }}
    >
      {children}
    </a>
  );
}
