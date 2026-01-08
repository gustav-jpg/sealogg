import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import NewLogbook from "./pages/NewLogbook";
import LogbookDetail from "./pages/LogbookDetail";
import Deviations from "./pages/Deviations";
import DeviationDetail from "./pages/DeviationDetail";
import FaultCases from "./pages/FaultCases";
import FaultCaseDetail from "./pages/FaultCaseDetail";
import SelfControl from "./pages/SelfControl";
import AdminVessels from "./pages/admin/Vessels";
import AdminUsers from "./pages/admin/Users";
import AdminCertificates from "./pages/admin/Certificates";
import VesselCertificates from "./pages/admin/VesselCertificates";
import ControlPoints from "./pages/admin/ControlPoints";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/logbook/new" element={<ProtectedRoute><NewLogbook /></ProtectedRoute>} />
      <Route path="/logbook/:id" element={<ProtectedRoute><LogbookDetail /></ProtectedRoute>} />
      <Route path="/deviations" element={<ProtectedRoute><Deviations /></ProtectedRoute>} />
      <Route path="/deviations/:id" element={<ProtectedRoute><DeviationDetail /></ProtectedRoute>} />
      <Route path="/fault-cases" element={<ProtectedRoute><FaultCases /></ProtectedRoute>} />
      <Route path="/fault-cases/:id" element={<ProtectedRoute><FaultCaseDetail /></ProtectedRoute>} />
      <Route path="/self-control" element={<ProtectedRoute><SelfControl /></ProtectedRoute>} />
      <Route path="/admin/vessels" element={<ProtectedRoute adminOnly><AdminVessels /></ProtectedRoute>} />
      <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
      <Route path="/admin/certificates" element={<ProtectedRoute adminOnly><AdminCertificates /></ProtectedRoute>} />
      <Route path="/admin/rules" element={<ProtectedRoute adminOnly><VesselCertificates /></ProtectedRoute>} />
      <Route path="/admin/control-points" element={<ProtectedRoute adminOnly><ControlPoints /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
