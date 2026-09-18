import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { PrototypeShell } from "./layout/PrototypeShell";
import { HomePage } from "./pages/HomePage";
import { DetailsPage } from "./pages/DetailsPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<PrototypeShell />}>
          <Route path="/home" element={<HomePage />} />
          <Route path="/details" element={<DetailsPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
