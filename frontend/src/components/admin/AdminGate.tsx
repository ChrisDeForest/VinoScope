import { useEffect, useState, type ReactNode } from "react";
import { checkAdminAccess } from "../../services/adminApi";
import { NotFoundPage } from "../../pages/NotFoundPage";

type Access = "checking" | "allowed" | "denied";

// Development: admin as usual (no nginx locally). Production: only when nginx confirms the
// visitor is at home; everyone else sees the 404 page. The admin API is locked by nginx too.
export function AdminGate({ children }: { children: ReactNode }) {
  const isDev = import.meta.env.DEV;
  const [access, setAccess] = useState<Access>(isDev ? "allowed" : "checking");

  useEffect(() => {
    if (isDev) return;
    let cancelled = false;
    void checkAdminAccess().then((allowed) => {
      if (!cancelled) setAccess(allowed ? "allowed" : "denied");
    });
    return () => {
      cancelled = true;
    };
  }, [isDev]);

  if (access === "allowed") return <>{children}</>;
  if (access === "denied") return <NotFoundPage />;
  return null;
}
