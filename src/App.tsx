import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import { initializeMobileAppDetection } from "./utils/mobileAppDetection";

// Initialize theme on app load
const initializeTheme = () => {
  try {
    const saved = localStorage.getItem('theme');
    if (saved) {
      if (saved === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  } catch (error) {
    console.error('Theme initialization error:', error);
    // Fallback to light theme
    document.documentElement.classList.remove('dark');
  }
};

// Initialize theme immediately
initializeTheme();
import Layout from "./components/Layout";
import AutoLocationPermission from "./components/AutoLocationPermission";
import ErrorBoundary from "./components/ErrorBoundary";
import DeepLinkHandler from "./components/DeepLinkHandler";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import OrganizerDashboard from "./pages/OrganizerDashboard";
import ParticipantDashboard from "./pages/ParticipantDashboard";
import CreateEvent from "./pages/CreateEvent";
import CreateRegistrationForm from "./pages/CreateRegistrationForm";
import EditRegistrationForm from "./pages/EditRegistrationForm";
import EventMonitor from "./pages/EventMonitor";
import AllEvents from "./pages/AllEvents";
import PublicEvents from "./pages/PublicEvents";
import Invitations from "./pages/Invitations";
import SendInvitations from "./pages/SendInvitations";
import InvitationSummary from "./pages/InvitationSummary";
import InvitationView from "./pages/InvitationView";
import OrganizationManagement from "./pages/OrganizationManagement";
import NotFound from "./pages/NotFound";
import JoinEvent from "./pages/JoinEvent";
import Reports from "./pages/Reports";
import ProtectedRoute from "./components/ProtectedRoute";
import MobileAccessGuard from "./components/MobileAccessGuard";
import WebAccessGuard from "./components/WebAccessGuard";
import { UpdatePrompt } from "./components/UpdatePrompt";

const queryClient = new QueryClient();

const App = () => {
  // Initialize mobile app detection on mount
  useEffect(() => {
    initializeMobileAppDetection();
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <UpdatePrompt />
          <AutoLocationPermission />
          <BrowserRouter>
            <DeepLinkHandler />
            <Layout>
              <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/organizer-dashboard" element={
                <ProtectedRoute requiredRole="organizer">
                  <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                    <OrganizerDashboard />
                  </MobileAccessGuard>
                </ProtectedRoute>
              } />
              <Route path="/organization" element={
                <ProtectedRoute requiredRole="organizer">
                  <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                    <OrganizationManagement />
                  </MobileAccessGuard>
                </ProtectedRoute>
              } />
              <Route path="/all-events" element={
                <ProtectedRoute requiredRole="organizer">
                  <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                    <AllEvents />
                  </MobileAccessGuard>
                </ProtectedRoute>
              } />
              <Route path="/public-events" element={<PublicEvents />} />
              <Route path="/invitations" element={
                <ProtectedRoute>
                  <Invitations />
                </ProtectedRoute>
              } />
              <Route path="/send-invitations" element={
                <ProtectedRoute requiredRole="organizer">
                  <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                    <SendInvitations />
                  </MobileAccessGuard>
                </ProtectedRoute>
              } />
              <Route path="/invitation-summary" element={
                <ProtectedRoute requiredRole="organizer">
                  <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                    <InvitationSummary />
                  </MobileAccessGuard>
                </ProtectedRoute>
              } />
              <Route path="/invitation/:code" element={<InvitationView />} />
              <Route
                path="/events/:eventId/registration/create"
                element={
                  <ProtectedRoute requiredRole="organizer">
                    <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                      <CreateRegistrationForm />
                    </MobileAccessGuard>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/registration-forms/:formId/edit"
                element={
                  <ProtectedRoute requiredRole="organizer">
                    <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                      <EditRegistrationForm />
                    </MobileAccessGuard>
                  </ProtectedRoute>
                }
              />
              <Route path="/participant-dashboard" element={
                <ProtectedRoute requiredRole="participant">
                  <WebAccessGuard allowedRoles={['participant-mobile-only']}>
                    <ParticipantDashboard />
                  </WebAccessGuard>
                </ProtectedRoute>
              } />
              <Route path="/create-event" element={
                <ProtectedRoute requiredRole="organizer">
                  <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                    <CreateEvent />
                  </MobileAccessGuard>
                </ProtectedRoute>
              } />
              <Route path="/event/:eventId/monitor" element={
                <ProtectedRoute requiredRole="organizer">
                  <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                    <EventMonitor />
                  </MobileAccessGuard>
                </ProtectedRoute>
              } />
              <Route path="/event-monitor" element={
                <ProtectedRoute requiredRole="organizer">
                  <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                    <EventMonitor />
                  </MobileAccessGuard>
                </ProtectedRoute>
              } />
              <Route path="/reports" element={
                <ProtectedRoute requiredRole="organizer">
                  <MobileAccessGuard allowedRoles={['organizer-web-only']}>
                    <Reports />
                  </MobileAccessGuard>
                </ProtectedRoute>
              } />
              <Route path="/join/:eventCode" element={<JoinEvent />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;