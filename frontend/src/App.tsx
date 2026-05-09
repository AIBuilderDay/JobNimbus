import { BrowserRouter, Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

const LandingPage = lazy(() => import("./pages/LandingPage"));
const AddressPage = lazy(() => import("./pages/AddressPage"));
const EstimatorPage = lazy(() => import("./pages/EstimatorPage"));
const PricingPage = lazy(() => import("./pages/PricingPage"));
const ProposalPage = lazy(() => import("./pages/ProposalPage"));
const FinalizationPage = lazy(() => import("./pages/FinalizationPage"));
const EstimatesPage = lazy(() => import("./pages/EstimatesPage"));
const BlueprintPage = lazy(() => import("./pages/BlueprintPage"));

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0e1830]">
      <div className="text-white/60 font-mono text-sm">Loading…</div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/address" element={<AddressPage />} />
          <Route path="/estimator" element={<EstimatorPage />} />
          <Route path="/pricing" element={<PricingPage />} />
          <Route path="/proposal" element={<ProposalPage />} />
          <Route path="/finalization" element={<FinalizationPage />} />
          <Route path="/estimates" element={<EstimatesPage />} />
          <Route path="/blueprint" element={<BlueprintPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
