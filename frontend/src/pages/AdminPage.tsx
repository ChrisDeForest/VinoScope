import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AdminStats, WineDetail, WineListItem } from "../types/wine";
import { getAdminKey, setAdminKey, clearAdminKey } from "../services/adminAuth";
import { getAdminStats } from "../services/adminApi";
import { listWines, getWine, ApiError } from "../services/api";
import { WineEditPanel } from "../components/admin/WineEditPanel";
import { ErrorMessage } from "../components/common/ErrorMessage";
import { LoadMoreButton } from "../components/explore/LoadMoreButton";

const PAGE_SIZE = 20;

export function AdminPage() {
  const [authed, setAuthed] = useState(() => getAdminKey() !== null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<WineListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [expandedWine, setExpandedWine] = useState<WineDetail | null>(null);
  const statsRequestId = useRef(0);
  const winesRequestId = useRef(0);

  useEffect(() => {
    if (!authed) return;
    const id = ++statsRequestId.current;
    setStatsError(null);
    getAdminStats()
      .then((data) => {
        if (id !== statsRequestId.current) return;
        setStats(data);
      })
      .catch((err) => {
        if (id !== statsRequestId.current) return;
        if (err instanceof ApiError && err.status === 401) {
          clearAdminKey();
          setAuthed(false);
          setLoginError("Session expired, please log in again");
        } else {
          setStatsError(err instanceof ApiError ? err.message : "Failed to load statistics");
        }
      });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const id = ++winesRequestId.current;
    setItems([]);
    setLoadMoreError(null);
    listWines({ q: query || undefined, limit: PAGE_SIZE, offset: 0 })
      .then((data) => {
        if (id !== winesRequestId.current) return;
        setItems(data.items);
        setTotal(data.total);
      })
      .catch(() => {
        if (id !== winesRequestId.current) return;
        setItems([]);
        setTotal(0);
      });
  }, [authed, query]);

  async function handleLoadMore() {
    const id = ++winesRequestId.current;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const data = await listWines({ q: query || undefined, limit: PAGE_SIZE, offset: items.length });
      if (id !== winesRequestId.current) return;
      setItems((prev) => [...prev, ...data.items]);
      setTotal(data.total);
    } catch (err) {
      if (id !== winesRequestId.current) return;
      setLoadMoreError(err instanceof ApiError ? err.message : "Failed to load more wines");
    } finally {
      if (id !== winesRequestId.current) return;
      setLoadingMore(false);
    }
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setAdminKey(password);
    try {
      const data = await getAdminStats();
      setStats(data);
      setAuthed(true);
    } catch (err) {
      clearAdminKey();
      setLoginError(err instanceof ApiError && err.status === 401 ? "Invalid admin key" : "Failed to log in");
    }
  }

  function handleLogout() {
    clearAdminKey();
    setAuthed(false);
    setStats(null);
    setExpandedWine(null);
    setPassword("");
  }

  async function handleRowClick(wineId: number) {
    if (expandedWine?.id === wineId) {
      setExpandedWine(null);
      return;
    }
    try {
      const wine = await getWine(wineId);
      setExpandedWine(wine);
    } catch {
      // Failed to load the wine (deleted, network blip) — leave expandedWine as-is.
    }
  }

  if (!authed) {
    return (
      <form onSubmit={handleLogin} className="max-w-sm flex flex-col gap-3">
        <h1 className="font-serif text-2xl text-ink">Admin Login</h1>
        <label className="flex flex-col gap-1 text-sm text-ink-muted">
          Admin key
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink"
          />
        </label>
        {loginError ? <p className="text-sm text-red-500">{loginError}</p> : null}
        <button type="submit" className="self-start bg-accent text-surface text-sm px-3 py-1 rounded">
          Log in
        </button>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-2xl text-ink">Admin</h1>
        <button type="button" onClick={handleLogout} className="text-sm text-accent">
          Log out
        </button>
      </div>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-2">Statistics</h2>
        {statsError ? (
          <ErrorMessage message={statsError} />
        ) : stats ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink">
              {stats.wines_count} wines &middot; {stats.wineries_count} wineries &middot; {stats.retailers_count}{" "}
              retailers &middot; {stats.listings_count} listings
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(stats.numeric).map(([column, s]) => (
                <div key={column} className="border border-surface-border rounded p-2 text-sm">
                  <p className="text-ink-muted uppercase text-xs">{column}</p>
                  <p className="text-ink">
                    min {s.min ?? "—"} &middot; max {s.max ?? "—"} &middot; avg {s.avg ?? "—"}
                  </p>
                  <p className="text-ink-muted text-xs">{s.null_count} missing</p>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(stats.categorical).map(([column, counts]) => (
                <div key={column} className="border border-surface-border rounded p-2 text-sm">
                  <p className="text-ink-muted uppercase text-xs">{column}</p>
                  {Object.entries(counts).map(([value, count]) => (
                    <p key={value} className="text-ink">
                      {value}: {count}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section>
        <h2 className="text-sm uppercase tracking-wide text-ink-muted mb-2">Wines ({total})</h2>
        <input
          aria-label="Search wines"
          placeholder="Search by name or winery"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="bg-surface-raised border border-surface-border rounded px-2 py-1 text-ink mb-3 w-full max-w-sm"
        />
        <div className="flex flex-col gap-1">
          {items.map((item) => (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => handleRowClick(item.id)}
                className="w-full text-left flex gap-3 items-center border-b border-surface-border py-2 text-sm text-ink hover:text-accent"
              >
                <span className="flex-1">{item.name}</span>
                <span className="text-ink-muted">{item.winery}</span>
                <span className="text-ink-muted">{item.vintage ?? "NV"}</span>
                <span className="text-ink-muted">{item.type}</span>
              </button>
              {expandedWine?.id === item.id ? (
                <WineEditPanel wine={expandedWine} onUpdated={setExpandedWine} />
              ) : null}
            </div>
          ))}
        </div>
        {loadMoreError ? <ErrorMessage message={loadMoreError} onRetry={handleLoadMore} /> : null}
        {items.length < total ? <LoadMoreButton onClick={handleLoadMore} loading={loadingMore} /> : null}
      </section>
    </div>
  );
}
