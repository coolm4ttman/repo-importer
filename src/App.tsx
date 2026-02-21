import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProjectsPage } from "@/pages/ProjectsPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { TransformationPage } from "@/pages/TransformationPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { BatchMigrationPage } from "@/pages/BatchMigrationPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { LandingPage } from "@/pages/LandingPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route element={<AppLayout />}>
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route
          path="/projects/:id/transform/*"
          element={<TransformationPage />}
        />
        <Route path="/projects/:id/dashboard" element={<DashboardPage />} />
        <Route path="/projects/:id/batch" element={<BatchMigrationPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
