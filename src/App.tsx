import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { CookieConsent } from "@/components/CookieConsent";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { OrganizationProvider } from "@/contexts/OrganizationContext";
import { usePageTracking } from "@/hooks/usePageTracking";
import { isNativePlatform } from "@/lib/capacitor";

// Lazy-loaded pages for better initial load performance
const Home = lazy(() => import("./pages/Home"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const NewLogbook = lazy(() => import("./pages/NewLogbook"));
const LogbookDetail = lazy(() => import("./pages/LogbookDetail"));
const Deviations = lazy(() => import("./pages/Deviations"));
const DeviationDetail = lazy(() => import("./pages/DeviationDetail"));
const FaultCases = lazy(() => import("./pages/FaultCases"));
const FaultCaseDetail = lazy(() => import("./pages/FaultCaseDetail"));
const SelfControl = lazy(() => import("./pages/SelfControl"));
const Qualifications = lazy(() => import("./pages/Qualifications"));
const Checklists = lazy(() => import("./pages/Checklists"));
const ChecklistExecute = lazy(() => import("./pages/ChecklistExecute"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const AdminVessels = lazy(() => import("./pages/admin/Vessels"));
const AdminVesselDetail = lazy(() => import("./pages/admin/VesselDetail"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const RoleRules = lazy(() => import("./pages/admin/RoleRules"));
const SettingsAdmin = lazy(() => import("./pages/admin/Settings"));
const ControlPoints = lazy(() => import("./pages/admin/ControlPoints"));
const ChecklistTemplates = lazy(() => import("./pages/admin/ChecklistTemplates"));
const AdminStatus = lazy(() => import("./pages/admin/Status"));
const BunkerStats = lazy(() => import("./pages/admin/BunkerStats"));
const ExercisesAdmin = lazy(() => import("./pages/admin/Exercises"));
const IntranetAdmin = lazy(() => import("./pages/admin/Intranet"));
const Startsida = lazy(() => import("./pages/Startsida"));
const NotFound = lazy(() => import("./pages/NotFound"));
const BackofficeLayout = lazy(() => import("./components/layout/BackofficeLayout"));
const BackofficeDashboard = lazy(() => import("./pages/backoffice/Dashboard"));
const Organizations = lazy(() => import("./pages/backoffice/Organizations"));
const OrganizationDetail = lazy(() => import("./pages/backoffice/OrganizationDetail"));
const AuditLogs = lazy(() => import("./pages/backoffice/AuditLogs"));
const BookingCalendar = lazy(() => import("./pages/bookings/BookingCalendar"));
const NewBooking = lazy(() => import("./pages/bookings/NewBooking"));
const BookingDetail = lazy(() => import("./pages/bookings/BookingDetail"));
const MenusAdmin = lazy(() => import("./pages/bookings/admin/MenusAdmin"));
const DrinksAdmin = lazy(() => import("./pages/bookings/admin/DrinksAdmin"));
const PassengerRegistration = lazy(() => import("./pages/PassengerRegistration"));
const PassengerSession = lazy(() => import("./pages/PassengerSession"));
const PassengerAdmin = lazy(() => import("./pages/admin/PassengerAdmin"));
const NotificationSettingsPage = lazy(() => import("./pages/admin/NotificationSettings"));
const Changelog = lazy(() => import("./pages/Changelog"));
const BackofficeChangelog = lazy(() => import("./pages/backoffice/Changelog"));
const Kartvisaren = lazy(() => import("./pages/Kartvisaren"));
const Documents = lazy(() => import("./pages/Documents"));

const queryClient = new QueryClient();

function LazyFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  );
}

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isLoading, isAdmin } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    // Save the current URL (including query params) so we can redirect back after login
    const currentPath = location.pathname + location.search;
    return <Navigate to="/portal/login" state={{ from: currentPath }} replace />;
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

function PageTracker() {
  usePageTracking();
  return null;
}

function AppRoutes() {
  return (
    <Suspense fallback={<LazyFallback />}>
      <PageTracker />
      <Routes>
        {/* Public pages */}
        <Route path="/" element={isNativePlatform() ? <Navigate to="/portal/login" replace /> : <Home />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        
        {/* Portal routes */}
        <Route path="/portal/login" element={<PublicRoute><Login /></PublicRoute>} />
        <Route path="/portal/register" element={<PublicRoute><Register /></PublicRoute>} />
        <Route path="/portal/reset-password" element={<ResetPassword />} />
        <Route path="/portal" element={<ProtectedRoute><Startsida /></ProtectedRoute>} />
        <Route path="/portal/startsida" element={<Navigate to="/portal" replace />} />
        <Route path="/portal/logbooks" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/portal/logbook/new" element={<ProtectedRoute><NewLogbook /></ProtectedRoute>} />
        <Route path="/portal/logbook/:id" element={<ProtectedRoute><LogbookDetail /></ProtectedRoute>} />
        <Route path="/portal/deviations" element={<ProtectedRoute><Deviations /></ProtectedRoute>} />
        <Route path="/portal/deviations/:id" element={<ProtectedRoute><DeviationDetail /></ProtectedRoute>} />
        <Route path="/portal/fault-cases" element={<ProtectedRoute><FaultCases /></ProtectedRoute>} />
        <Route path="/portal/fault-cases/:id" element={<ProtectedRoute><FaultCaseDetail /></ProtectedRoute>} />
          <Route path="/portal/self-control" element={<ProtectedRoute><SelfControl /></ProtectedRoute>} />
          {/* Spare parts is now a tab within self-control */}
          <Route path="/portal/qualifications" element={<ProtectedRoute><Qualifications /></ProtectedRoute>} />
          <Route path="/portal/checklists" element={<ProtectedRoute><Checklists /></ProtectedRoute>} />
          <Route path="/portal/kartvisaren" element={<ProtectedRoute><Kartvisaren /></ProtectedRoute>} />
          <Route path="/portal/documents" element={<ProtectedRoute><Documents /></ProtectedRoute>} />
          <Route path="/portal/checklists/execute" element={<ProtectedRoute><ChecklistExecute /></ProtectedRoute>} />
          <Route path="/portal/checklists/execute/:executionId" element={<ProtectedRoute><ChecklistExecute /></ProtectedRoute>} />
        <Route path="/portal/admin/vessels" element={<ProtectedRoute adminOnly><AdminVessels /></ProtectedRoute>} />
        <Route path="/portal/admin/vessels/:id" element={<ProtectedRoute adminOnly><AdminVesselDetail /></ProtectedRoute>} />
        <Route path="/portal/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />
        <Route path="/portal/admin/rules" element={<ProtectedRoute adminOnly><RoleRules /></ProtectedRoute>} />
        <Route path="/portal/admin/settings" element={<ProtectedRoute adminOnly><SettingsAdmin /></ProtectedRoute>} />
        <Route path="/portal/admin/control-points" element={<ProtectedRoute adminOnly><ControlPoints /></ProtectedRoute>} />
        <Route path="/portal/admin/checklists" element={<ProtectedRoute adminOnly><ChecklistTemplates /></ProtectedRoute>} />
        <Route path="/portal/admin/status" element={<ProtectedRoute adminOnly><AdminStatus /></ProtectedRoute>} />
        <Route path="/portal/admin/bunker" element={<ProtectedRoute adminOnly><BunkerStats /></ProtectedRoute>} />
        
        <Route path="/portal/admin/exercises" element={<ProtectedRoute adminOnly><ExercisesAdmin /></ProtectedRoute>} />
        <Route path="/portal/admin/intranet" element={<ProtectedRoute adminOnly><IntranetAdmin /></ProtectedRoute>} />
        <Route path="/portal/admin/startsida" element={<ProtectedRoute adminOnly><IntranetAdmin /></ProtectedRoute>} />
        <Route path="/portal/admin/passagerare" element={<ProtectedRoute adminOnly><PassengerAdmin /></ProtectedRoute>} />
        <Route path="/portal/admin/notifications" element={<ProtectedRoute adminOnly><NotificationSettingsPage /></ProtectedRoute>} />
        
        {/* Passenger registration routes */}
        <Route path="/portal/passagerare" element={<ProtectedRoute><PassengerRegistration /></ProtectedRoute>} />
        <Route path="/portal/passagerare/:sessionId" element={<ProtectedRoute><PassengerSession /></ProtectedRoute>} />
        
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
        <Route path="/backoffice/changelog" element={<BackofficeLayout><BackofficeChangelog /></BackofficeLayout>} />
        <Route path="/backoffice/audit-logs" element={<BackofficeLayout><AuditLogs /></BackofficeLayout>} />
        
        {/* Legacy redirects */}
        <Route path="/login" element={<Navigate to="/portal/login" replace />} />
        <Route path="/register" element={<Navigate to="/portal/register" replace />} />
        
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
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
            <CookieConsent />
          </OrganizationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
