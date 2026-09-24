import { Routes, Route } from "react-router-dom";
import { PageShell } from "./components/layout/PageShell";
import { HomePage } from "./pages/HomePage";
import { ExplorePage } from "./pages/ExplorePage";
import { WineDetailPage } from "./pages/WineDetailPage";
import { DiscoverPage } from "./pages/DiscoverPage";
import { AdminPage } from "./pages/AdminPage";
import { PairPage } from "./pages/PairPage";
import { ComparePage, LearnPage } from "./pages/StubPages";

export function App() {
  return (
    <PageShell>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/explore" element={<ExplorePage />} />
        <Route path="/wines/:id" element={<WineDetailPage />} />
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/pair" element={<PairPage />} />
        <Route path="/compare" element={<ComparePage />} />
        <Route path="/learn" element={<LearnPage />} />
      </Routes>
    </PageShell>
  );
}
