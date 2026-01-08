import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Home from "./pages/Home";
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
import Qualifications from "./pages/Qualifications";
import Privacy from "./pages/Privacy";
import AdminVessels from "./pages/admin/Vessels";
import AdminUsers from "./pages/admin/Users";
import RoleRules from "./pages/admin/RoleRules";
import ControlPoints from "./pages/admin/ControlPoints";
import NotFound from "./pages/NotFound";
import BackofficeLayout from "./components/layout/BackofficeLayout";
import BackofficeDashboard from "./pages/backoffice/Dashboard";
import Organizations from "./pages/backoffice/Organizations";
import OrganizationDetail from "./pages/backoffice/OrganizationDetail";

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
    return <Navigate to="/portal/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/portal" replace />;
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
    return <Navigate to="/portal" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public pages */}
      <Route path="/" element={<Home />} />
      <Route path="/privacy" element={<Privacy />} />
      
      {/* Portal routes */}
      <Route path="/portal/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/portal/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/portal" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/portal/logbook/new" element={<ProtectedRoute><NewLogbook /></ProtectedRoute>} />
      <Route path="/portal/logbook/:id" element={<ProtectedRoute><LogbookDetail /></ProtectedRoute>} />
      <Route path="/portal/deviations" element={<ProtectedRoute><Deviations /></ProtectedRoute>} />
      <Route path="/portal/deviations/:id" element={<ProtectedRoute><DeviationDetail /></ProtectedRoute>} />
      <Route path="/portal/fault-cases" element={<ProtectedRoute><FaultCases /></ProtectedRoute>} />
      <Route path="/portal/fault-cases/:id" element={<ProtectedRoute><FaultCaseDetail /></ProtectedRoute>} />
        <Route path="/portal/self-control" element={<ProtectedRoute><SelfControl /></ProtectedRoute>} />
        <Route path="/portal/qualifications" element={<ProtectedRoute><Qualifications /></ProtectedRoute>} />
        <Route path="/portal/admin/vessels" element={<ProtectedRoute adminOnly><AdminVessels /></ProtectedRoute>} />
      <Route path="/portal/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
      <Route path="/portal/admin/rules" element={<ProtectedRoute adminOnly><RoleRules /></ProtectedRoute>} />
      <Route path="/portal/admin/control-points" element={<ProtectedRoute adminOnly><ControlPoints /></ProtectedRoute>} />
      
      {/* Backoffice routes (superadmin only) */}
      <Route path="/backoffice" element={<BackofficeLayout><BackofficeDashboard /></BackofficeLayout>} />
      <Route path="/backoffice/organizations" element={<BackofficeLayout><Organizations /></BackofficeLayout>} />
      <Route path="/backoffice/organizations/:id" element={<BackofficeLayout><OrganizationDetail /></BackofficeLayout>} />
      
      {/* Legacy redirects */}
      <Route path="/login" element={<Navigate to="/portal/login" replace />} />
      <Route path="/register" element={<Navigate to="/portal/register" replace />} />
      
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
