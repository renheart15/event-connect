import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import AutoLocationPermission from "./components/AutoLocationPermission";
import ErrorBoundary from "./components/ErrorBoundary";
import ProfileDropdown from "./components/ProfileDropdown";
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
import Invitations from "./pages/Invitations";
import SendInvitations from "./pages/SendInvitations";
import InvitationSummary from "./pages/InvitationSummary";
import InvitationView from "./pages/InvitationView";
import OrganizationManagement from "./pages/OrganizationManagement";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AutoLocationPermission />
        <BrowserRouter>
          <ProfileDropdown />
          <Layout>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/organizer-dashboard" element={<OrganizerDashboard />} />
              <Route path="/organization" element={<OrganizationManagement />} />
              <Route path="/all-events" element={<AllEvents />} />
              <Route path="/invitations" element={<Invitations />} />
              <Route path="/send-invitations" element={<SendInvitations />} />
              <Route path="/invitation-summary" element={<InvitationSummary />} />
              <Route path="/invitation/:code" element={<InvitationView />} />
              <Route
                path="/events/:eventId/registration/create"
                element={<CreateRegistrationForm />}
              />
              <Route
                path="/registration-forms/:formId/edit"
                element={<EditRegistrationForm />}
              />
              <Route path="/participant-dashboard" element={<ParticipantDashboard />} />
              <Route path="/create-event" element={<CreateEvent />} />
              <Route path="/event/:eventId/monitor" element={<EventMonitor />} />
              <Route path="/event-monitor" element={<EventMonitor />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;