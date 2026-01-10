import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ResetPassword from "./pages/ResetPassword";
import NewLogbook from "./pages/NewLogbook";
import LogbookDetail from "./pages/LogbookDetail";
import Deviations from "./pages/Deviations";
import DeviationDetail from "./pages/DeviationDetail";
import FaultCases from "./pages/FaultCases";
import FaultCaseDetail from "./pages/FaultCaseDetail";
import SelfControl from "./pages/SelfControl";
import Qualifications from "./pages/Qualifications";
import Checklists from "./pages/Checklists";
import ChecklistExecute from "./pages/ChecklistExecute";
import Privacy from "./pages/Privacy";
import AdminVessels from "./pages/admin/Vessels";
import AdminUsers from "./pages/admin/Users";
import RoleRules from "./pages/admin/RoleRules";
import ControlPoints from "./pages/admin/ControlPoints";
import ChecklistTemplates from "./pages/admin/ChecklistTemplates";
import AdminStatus from "./pages/admin/Status";
import SeaDays from "./pages/admin/SeaDays";
import NotFound from "./pages/NotFound";
import BackofficeLayout from "./components/layout/BackofficeLayout";
import BackofficeDashboard from "./pages/backoffice/Dashboard";
import Organizations from "./pages/backoffice/Organizations";
import OrganizationDetail from "./pages/backoffice/OrganizationDetail";
import BookingCalendar from "./pages/bookings/BookingCalendar";
import NewBooking from "./pages/bookings/NewBooking";
import BookingDetail from "./pages/bookings/BookingDetail";
import MenusAdmin from "./pages/bookings/admin/MenusAdmin";
import DrinksAdmin from "./pages/bookings/admin/DrinksAdmin";

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
      <Route path="/portal/reset-password" element={<ResetPassword />} />
      <Route path="/portal" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/portal/logbook/new" element={<ProtectedRoute><NewLogbook /></ProtectedRoute>} />
      <Route path="/portal/logbook/:id" element={<ProtectedRoute><LogbookDetail /></ProtectedRoute>} />
      <Route path="/portal/deviations" element={<ProtectedRoute><Deviations /></ProtectedRoute>} />
      <Route path="/portal/deviations/:id" element={<ProtectedRoute><DeviationDetail /></ProtectedRoute>} />
      <Route path="/portal/fault-cases" element={<ProtectedRoute><FaultCases /></ProtectedRoute>} />
      <Route path="/portal/fault-cases/:id" element={<ProtectedRoute><FaultCaseDetail /></ProtectedRoute>} />
        <Route path="/portal/self-control" element={<ProtectedRoute><SelfControl /></ProtectedRoute>} />
        <Route path="/portal/qualifications" element={<ProtectedRoute><Qualifications /></ProtectedRoute>} />
        <Route path="/portal/checklists" element={<ProtectedRoute><Checklists /></ProtectedRoute>} />
        <Route path="/portal/checklists/execute" element={<ProtectedRoute><ChecklistExecute /></ProtectedRoute>} />
        <Route path="/portal/checklists/execute/:executionId" element={<ProtectedRoute><ChecklistExecute /></ProtectedRoute>} />
        <Route path="/portal/admin/vessels" element={<ProtectedRoute adminOnly><AdminVessels /></ProtectedRoute>} />
      <Route path="/portal/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
      <Route path="/portal/admin/rules" element={<ProtectedRoute adminOnly><RoleRules /></ProtectedRoute>} />
      <Route path="/portal/admin/control-points" element={<ProtectedRoute adminOnly><ControlPoints /></ProtectedRoute>} />
      <Route path="/portal/admin/checklists" element={<ProtectedRoute adminOnly><ChecklistTemplates /></ProtectedRoute>} />
      <Route path="/portal/admin/status" element={<ProtectedRoute adminOnly><AdminStatus /></ProtectedRoute>} />
      <Route path="/portal/admin/sea-days" element={<ProtectedRoute adminOnly><SeaDays /></ProtectedRoute>} />
      
      {/* Booking routes */}
      <Route path="/bookings" element={<ProtectedRoute><BookingCalendar /></ProtectedRoute>} />
      <Route path="/bookings/new" element={<ProtectedRoute><NewBooking /></ProtectedRoute>} />
      <Route path="/bookings/:id" element={<ProtectedRoute><BookingDetail /></ProtectedRoute>} />
      <Route path="/bookings/admin/menus" element={<ProtectedRoute adminOnly><MenusAdmin /></ProtectedRoute>} />
      <Route path="/bookings/admin/drinks" element={<ProtectedRoute adminOnly><DrinksAdmin /></ProtectedRoute>} />
      
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
          <OrganizationProvider>
            <AppRoutes />
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
