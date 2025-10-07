import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

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
import LocationDebugger from "./pages/LocationDebugger";
import NotFound from "./pages/NotFound";
import JoinEvent from "./pages/JoinEvent";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AutoLocationPermission />
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/organizer-dashboard" element={
                <ProtectedRoute requiredRole="organizer">
                  <OrganizerDashboard />
                </ProtectedRoute>
              } />
              <Route path="/organization" element={
                <ProtectedRoute requiredRole="organizer">
                  <OrganizationManagement />
                </ProtectedRoute>
              } />
              <Route path="/all-events" element={
                <ProtectedRoute requiredRole="organizer">
                  <AllEvents />
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
                  <SendInvitations />
                </ProtectedRoute>
              } />
              <Route path="/invitation-summary" element={
                <ProtectedRoute requiredRole="organizer">
                  <InvitationSummary />
                </ProtectedRoute>
              } />
              <Route path="/invitation/:code" element={<InvitationView />} />
              <Route
                path="/events/:eventId/registration/create"
                element={
                  <ProtectedRoute requiredRole="organizer">
                    <CreateRegistrationForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/registration-forms/:formId/edit"
                element={
                  <ProtectedRoute requiredRole="organizer">
                    <EditRegistrationForm />
                  </ProtectedRoute>
                }
              />
              <Route path="/participant-dashboard" element={
                <ProtectedRoute requiredRole="participant">
                  <ParticipantDashboard />
                </ProtectedRoute>
              } />
              <Route path="/create-event" element={
                <ProtectedRoute requiredRole="organizer">
                  <CreateEvent />
                </ProtectedRoute>
              } />
              <Route path="/event/:eventId/monitor" element={
                <ProtectedRoute requiredRole="organizer">
                  <EventMonitor />
                </ProtectedRoute>
              } />
              <Route path="/event-monitor" element={
                <ProtectedRoute requiredRole="organizer">
                  <EventMonitor />
                </ProtectedRoute>
              } />
              <Route path="/event/:eventId/location-debug" element={
                <ProtectedRoute requiredRole="organizer">
                  <LocationDebugger />
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

export default App;