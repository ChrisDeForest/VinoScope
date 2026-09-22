import { Routes, Route } from "react-router-dom";
import { PageShell } from "./components/layout/PageShell";
import { StubPage } from "./components/common/StubPage";
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { DiscoverPage, PairPage, ComparePage, LearnPage } from "./pages/StubPages";

export function App() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route
          path="/wines/:id"
          element={<StubPage title="Wine Detail" description="Wine detail pages are coming soon." />}
        />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/pair" element={<PairPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/learn" element={<LearnPage />} />
      </Routes>
    </PageShell>
  );
}
