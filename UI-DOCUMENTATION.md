# EventConnect - User Interface Documentation

This document provides a comprehensive list of all user interfaces in the EventConnect application, including pages, components, and their descriptions.

---

## Overview

EventConnect is an intelligent attendance tracking system with GPS verification for events. The application has two main user roles:
- **Organizers**: Create and manage events (Web-only access)
- **Participants**: Join events and check in/out (Mobile-only access)

---

## Main Pages

### 1. Landing Page (`Index.tsx`)
**Route:** `/`
**Description:** The main landing page that introduces EventConnect to new users. Features include:
- Hero section with application overview
- Role selection (Organizer or Participant)
- Feature showcase highlighting QR code check-in, GPS verification, real-time tracking, and live dashboard
- Login and registration call-to-action buttons
- Light theme design with gradient background

---

### 2. Login Page (`Login.tsx`)
**Route:** `/login`
**Access:** Public
**Description:** User authentication page that allows both organizers and participants to log into their accounts.
- Role selection (Organizer/Participant)
- Email and password authentication
- Pre-selection of role from URL parameters
- Role validation to ensure users log in with correct credentials
- Redirect to appropriate dashboard based on user role
- Support for invitation-based login with return URL

---

### 3. Register Page (`Register.tsx`)
**Route:** `/register`
**Access:** Public
**Description:** User registration page for creating new accounts.
- Role-based registration (Organizer/Participant)
- Form fields: Name, Email, Password, Confirm Password
- Role pre-selection from URL parameters
- Automatic redirect to appropriate dashboard after successful registration
- Password validation and confirmation

---

### 4. Organizer Dashboard (`OrganizerDashboard.tsx`)
**Route:** `/organizer-dashboard`
**Access:** Protected (Organizer only, Web-only)
**Description:** Main dashboard for event organizers with comprehensive event management capabilities.

**Features:**
- **Real-time Statistics:**
  - Total events count
  - Active events count
  - Total participants across all events
  - Currently present participants

- **Event List View:**
  - Table displaying all events with details
  - Event information: Title, Date, Location, Status
  - Participant counts (Total, Checked In, Currently Present)
  - Quick actions dropdown for each event

- **Event Actions:**
  - Reports: View detailed attendance reports
  - Invitations: Send event invitations to participants
  - QR Code: Display and download event QR codes
  - Geofence: View and edit event location boundaries
  - Settings: Configure event parameters
  - Make Public/Private: Toggle event visibility
  - Feedback: Manage event feedback forms
  - Delete: Remove completed events

- **Additional Features:**
  - Create new event button
  - Export reports for all events
  - Filter view: Active & Upcoming or All Events
  - Auto-checkout system for ended events
  - Real-time data refresh (30-second intervals)
  - Dark mode support
  - Multi-day event support

---

### 5. Participant Dashboard (`ParticipantDashboard.tsx`)
**Route:** `/participant-dashboard`
**Access:** Protected (Participant only, Mobile-only)
**Description:** Mobile-optimized dashboard for event participants with QR code scanning and event management.

**Main Views:**
- **Upcoming Events:** Events that haven't started yet
- **Active Events:** Currently ongoing events with check-in capability
- **Completed Events:** Past events with feedback options
- **Public Events:** Browse and join published events
- **Profile:** User profile management
- **Settings:** App settings and preferences
- **Organization:** Organization membership management

**Key Features:**
- **QR Code Scanner:**
  - Camera-based QR code scanning
  - Flash support for low-light environments
  - Manual code entry option
  - Image upload for QR codes
  - Scan history tracking

- **Event Check-in/Check-out:**
  - GPS-based location verification
  - Real-time timer display during events
  - Early departure warnings
  - Attendance availability status
  - Registration form submission (if required)

- **Event Information:**
  - Event details (title, date, time, location)
  - Organizer information
  - Participant count
  - Check-in/check-out times
  - Duration tracking
  - Attendance status (On time, Late, Early, Absent)

- **Additional Features:**
  - Location permission management
  - Battery level monitoring
  - Offline event list caching
  - Real-time notifications
  - Event feedback submission
  - Organization management
  - Profile editing with password change
  - Attendance history with detailed records

---

### 6. Create Event Page (`CreateEvent.tsx`)
**Route:** `/create-event`
**Access:** Protected (Organizer only, Web-only)
**Description:** Form for creating new events with comprehensive configuration options.

**Event Configuration:**
- **Basic Information:**
  - Event title
  - Event description
  - Event type (Single-day or Multi-day)

- **Date and Time:**
  - Single-day: Date, Start Time, End Time
  - Multi-day: Start Date, End Date, Daily Start Time, Daily End Time
  - Singapore timezone support

- **Location and Geofence:**
  - Interactive map for location selection
  - Adjustable geofence radius (in meters)
  - Automatic address lookup via reverse geocoding
  - Visual geofence boundary display

- **Attendance Settings:**
  - Maximum time outside geofence (in minutes)
  - Event code generation (for participant access)

- **Validation:**
  - Past date prevention
  - End time after start time validation
  - Required fields enforcement

- **Post-Creation:**
  - Automatic redirect to registration form builder

---

### 7. Event Monitor Page (`EventMonitor.tsx`)
**Route:** `/event/:eventId/monitor` or `/event-monitor`
**Access:** Protected (Organizer only, Web-only)
**Description:** Real-time attendance monitoring dashboard for active events.

**Two Main Tabs:**

**Attendance Monitor:**
- **Live Statistics:**
  - Total checked in
  - Currently present
  - Late arrivals
  - Absent count

- **Event Details Card:**
  - Event date (with multi-day support)
  - Event time (start and end)
  - Event location

- **Participant List:**
  - Expandable accordion for each participant
  - Participant name and email
  - Status badge (Present, Left Early, Low Battery, etc.)
  - Check-in time
  - Check-out time (if applicable)
  - Duration in minutes (real-time calculation for active participants)
  - Battery level indicator

**Location Tracking Tab:**
- GPS tracking status for all participants
- Real-time location updates
- Geofence boundary visualization
- Location alerts and warnings

**Additional Features:**
- Current time display (12-hour format)
- Connection status indicator (Online/Offline)
- Last update timestamp
- Manual refresh button
- Auto-refresh every 45 seconds
- Event selection dropdown (if no event specified)
- Network error handling with retry logic

---

### 8. All Events Page (`AllEvents.tsx`)
**Route:** `/all-events`
**Access:** Protected (Organizer only, Web-only)
**Description:** Comprehensive view of all events created by the organizer, regardless of status.
- Event listing with sorting by date
- Status-based filtering (Active, Upcoming, Completed)
- Quick navigation to event details and monitoring
- Event management actions

---

### 9. Public Events Page (`PublicEvents.tsx`)
**Route:** `/public-events`
**Access:** Public
**Description:** Browse and discover published events that are open for public registration.

**Features:**
- Grid/list view of public events
- Event cards displaying:
  - Event title and description
  - Event type (Single-day or Multi-day)
  - Date and time
  - Location with map pin icon
  - Organizer information
  - Current participant count
  - Event status badge

- Quick join functionality with event code
- Visual indicators for event type
- Responsive design for mobile and desktop
- Empty state when no public events available
- Time formatting in 12-hour format with AM/PM

---

### 10. Create Registration Form Page (`CreateRegistrationForm.tsx`)
**Route:** `/events/:eventId/registration/create`
**Access:** Protected (Organizer only, Web-only)
**Description:** Build custom registration forms for events with drag-and-drop functionality.

**Features:**
- Form builder interface with field types:
  - Text input
  - Email
  - Number
  - Dropdown/Select
  - Checkbox
  - Radio buttons
  - Text area
  - Date picker
  - File upload

- Field configuration:
  - Field label
  - Placeholder text
  - Required/Optional toggle
  - Field-specific options

- Form preview in real-time
- Drag-and-drop reordering
- Field deletion
- Form validation settings
- Save and publish options

---

### 11. Edit Registration Form Page (`EditRegistrationForm.tsx`)
**Route:** `/registration-forms/:formId/edit`
**Access:** Protected (Organizer only, Web-only)
**Description:** Edit existing registration forms for events.
- All features from Create Registration Form page
- Load existing form structure
- Update form fields and settings
- Version control for form updates

---

### 12. Send Invitations Page (`SendInvitations.tsx`)
**Route:** `/send-invitations`
**Access:** Protected (Organizer only, Web-only)
**Description:** Send event invitations to participants via email.

**Three Invitation Methods:**

**Manual Entry Tab:**
- Add participants individually
- Name and email fields
- Add/remove participant rows
- Bulk entry support

**Upload Tab:**
- CSV file upload
- Excel file upload (.xlsx, .xls)
- File parsing and validation
- Preview uploaded participants
- Sample file download

**Organization Tab:**
- Select from organization members
- Member list with roles
- Multi-select functionality
- Filter by role (Admin, Member, Owner)
- Member count display

**Email Configuration:**
- Gmail app password entry
- Optional email address override
- Remember credentials option
- Secure credential storage
- Email preview before sending

**Additional Features:**
- Event information display
- Participant count summary
- Email template customization
- Invitation tracking
- Resend capabilities
- Invitation history

---

### 13. Invitation Summary Page (`InvitationSummary.tsx`)
**Route:** `/invitation-summary`
**Access:** Protected (Organizer only, Web-only)
**Description:** View summary and statistics of sent invitations.
- Invitation status tracking (Sent, Opened, Accepted, Declined)
- Participant response rates
- Invitation analytics
- Export invitation data
- Resend options for non-responders

---

### 14. Invitation View Page (`InvitationView.tsx`)
**Route:** `/invitation/:code`
**Access:** Public (with unique invitation code)
**Description:** View and respond to event invitations.
- Event details display
- Accept/Decline invitation buttons
- RSVP functionality
- Add to calendar options
- Share invitation
- Login/Register prompt for non-authenticated users

---

### 15. Invitations Page (`Invitations.tsx`)
**Route:** `/invitations`
**Access:** Protected (Any authenticated user)
**Description:** View all received invitations.
- List of all invitations
- Filter by status (Pending, Accepted, Declined)
- Event details preview
- Quick accept/decline actions
- Search and sort functionality

---

### 16. Join Event Page (`JoinEvent.tsx`)
**Route:** `/join/:eventCode`
**Access:** Public (redirects to login if not authenticated)
**Description:** Public page for joining events using event codes.

**Features:**
- Event code validation
- Event details display
- Published event verification
- Join confirmation modal
- Registration form handling
- Automatic event addition to participant's dashboard
- Login/Register redirect for unauthenticated users
- Error handling for invalid codes
- Visual event information:
  - Event title and description
  - Date and time
  - Location
  - Organizer details
  - Current participant count

---

### 17. Organization Management Page (`OrganizationManagement.tsx`)
**Route:** `/organization`
**Access:** Protected (Any authenticated user, Web-only for organizers)
**Description:** Manage organization membership and settings.

**For Organizers:**
- **Create Organization:**
  - Organization name
  - Organization description
  - Auto-generated or custom organization code
  - Settings configuration

- **Owned Organizations List:**
  - Organization overview
  - Member count
  - Organization code
  - Quick actions

- **Joined Organizations List:**
  - Organizations where user is member/admin
  - Role display (Owner, Admin, Member)
  - Member count
  - View details

- **Organization Details:**
  - Members table with roles
  - Owner information
  - Member roles (Owner, Admin, Member)
  - Join date for each member
  - Organization code sharing

- **Join Organization:**
  - Join via organization code
  - Multiple organization support

**For Participants:**
- View current organization
- Organization details and member list
- Leave organization option
- Join organization via code
- Single organization limitation

**Additional Features:**
- Copy organization code to clipboard
- Role-based badges with icons
- Real-time member count
- Organization code generation
- Member management (future feature)

---

### 18. Location Debugger Page (`LocationDebugger.tsx`)
**Route:** `/event/:eventId/location-debug`
**Access:** Protected (Organizer only, Web-only)
**Description:** Debug and troubleshoot location tracking issues for events.
- Real-time GPS data visualization
- Geofence boundary display
- Participant location history
- Location accuracy metrics
- GPS signal strength indicators
- Troubleshooting tools

---

### 19. Not Found Page (`NotFound.tsx`)
**Route:** `*` (catch-all)
**Access:** Public
**Description:** 404 error page displayed when users navigate to non-existent routes.
- Friendly error message
- Navigation back to home or appropriate dashboard
- Suggested pages or actions
- Consistent branding

---

## Key Components

### Dashboard Components

#### DashboardHeader (`DashboardHeader.tsx`)
Navigation header for dashboard pages with user profile and logout functionality.

#### DashboardStats (`DashboardStats.tsx`)
Display key statistics in card format:
- Total events
- Active events
- Total participants
- Currently present participants

---

### Forms and Builders

#### RegistrationFormBuilder (`RegistrationFormBuilder.tsx`)
Visual form builder for creating custom registration forms with drag-and-drop functionality.

#### RegistrationFormEditor (`RegistrationFormEditor.tsx`)
Edit interface for registration forms with components:
- `AddFieldSection.tsx`: Add new form fields
- `FormPreviewSection.tsx`: Real-time form preview

#### RegistrationFormModal (`RegistrationFormModal.tsx`)
Modal dialog for participants to fill out event registration forms during check-in.

#### FeedbackFormBuilder (`FeedbackFormBuilder.tsx`)
Create custom feedback forms for events with various question types.

#### FeedbackFormEditor (`FeedbackFormEditor.tsx`)
Edit existing feedback forms.

#### FeedbackFormView (`FeedbackFormView.tsx`)
Display and submit feedback forms to participants.

#### FeedbackFormManager (`FeedbackFormManager.tsx`)
Manage feedback forms for events (create, edit, publish, view responses).

#### FeedbackManagement (`FeedbackManagement.tsx`)
Overview of all feedback forms and their responses.

---

### Location and Maps

#### GeofenceMap (`GeofenceMap.tsx`)
Interactive map component for setting and visualizing event geofence boundaries:
- Draggable center marker
- Adjustable radius slider
- Circle visualization
- Save geofence changes
- OpenStreetMap integration

#### LocationStatusDisplay (`LocationStatusDisplay.tsx`)
Real-time location tracking status for participants:
- GPS accuracy
- Last location update
- Battery level
- Distance from geofence center
- Inside/outside geofence indicator

#### LocationAlertsWidget (`LocationAlertsWidget.tsx`)
Display location-based alerts and warnings for participants.

#### LocationPermissionEnabler (`LocationPermissionEnabler.tsx`)
Guide users through enabling location permissions.

#### AutoLocationPermission (`AutoLocationPermission.tsx`)
Automatically request location permissions when needed.

---

### QR Code Components

#### QRCodeDisplay (`QRCodeDisplay.tsx`)
Display and generate QR codes for events:
- QR code generation
- Download QR code as image
- Event code display
- Share functionality
- Print option

---

### Reports and Analytics

#### ParticipantReports (`ParticipantReports.tsx`)
Detailed attendance reports for individual events:
- Participant list with attendance data
- Check-in/check-out times
- Duration calculations
- Attendance status
- Export to CSV/Excel
- Filter and search functionality

#### EventExportDialog (`EventExportDialog.tsx`)
Export event data in various formats:
- CSV export
- Excel export
- PDF export (summary)
- Custom date range selection
- Multi-event export

---

### Settings and Configuration

#### EventSettings (`EventSettings.tsx`)
Configure event parameters:
- Event details editing
- Geofence settings
- Max time outside adjustment
- Notification settings
- Event visibility (public/private)

#### Settings (`Settings.tsx`)
Application-wide settings:
- Theme toggle (light/dark mode)
- Notification preferences
- Language selection
- Account settings

#### EmailSettings (`EmailSettings.tsx`)
Email configuration for sending invitations:
- Gmail app password setup
- Email templates
- SMTP settings

---

### User Profile

#### Profile (`Profile.tsx`)
User profile management:
- View profile information
- Edit name and email
- Change password
- Account settings
- Activity history

#### ProfileDropdown (`ProfileDropdown.tsx`)
User menu dropdown in header:
- Profile link
- Settings link
- Logout button
- Dark mode toggle

---

### Notifications

#### ParticipantNotifications (`ParticipantNotifications.tsx`)
Real-time notifications for participants:
- Event reminders
- Check-in/check-out confirmations
- Location alerts
- Feedback requests
- System notifications

#### NotificationDropdown (`NotificationDropdown.tsx`)
Notification center dropdown:
- Unread notification count
- Notification list
- Mark as read
- Clear all

---

### Event Cards and Display

#### EventCard (`EventCard.tsx`)
Reusable event card component displaying:
- Event title and description
- Date and time
- Location
- Participant count
- Status badge
- Quick actions

---

### Invitations

#### InvitationForm (`InvitationForm.tsx`)
Form for sending invitations with participant selection and email customization.

---

### Utilities and Helpers

#### ProtectedRoute (`ProtectedRoute.tsx`)
Route wrapper for authentication and authorization:
- Check user authentication
- Verify user role
- Redirect to login if unauthorized

#### MobileAccessGuard (`MobileAccessGuard.tsx`)
Restrict access to mobile-only pages for non-mobile devices (Participant Dashboard).

#### WebAccessGuard (`WebAccessGuard.tsx`)
Restrict access to web-only pages for mobile devices (Organizer features).

#### Layout (`Layout.tsx`)
Main layout wrapper with:
- Sidebar navigation
- Header
- Footer
- Responsive design

#### AppSidebar (`AppSidebar.tsx`)
Collapsible sidebar navigation:
- Dashboard link
- Events link
- Organization link
- Settings link
- Profile link

#### ErrorBoundary (`ErrorBoundary.tsx`)
Global error boundary for handling runtime errors:
- Error display
- Error reporting
- Recovery options

#### ProgressIndicator (`ProgressIndicator.tsx`)
Visual progress indicator for multi-step processes.

#### ParticipantTimerModal (`ParticipantTimerModal.tsx`)
Modal displaying real-time timer during events:
- Time elapsed since check-in
- Time remaining until event end
- Early leave warning
- Check-out button

---

## UI Component Library (Shadcn/UI)

The application uses a comprehensive set of pre-built UI components based on Radix UI:

### Form Components
- `button.tsx` - Button component with variants
- `input.tsx` - Text input field
- `textarea.tsx` - Multi-line text input
- `label.tsx` - Form label
- `checkbox.tsx` - Checkbox input
- `radio-group.tsx` - Radio button group
- `select.tsx` - Dropdown select
- `switch.tsx` - Toggle switch
- `slider.tsx` - Range slider
- `input-otp.tsx` - OTP input field
- `form.tsx` - Form wrapper with validation

### Layout Components
- `card.tsx` - Card container
- `separator.tsx` - Horizontal/vertical divider
- `accordion.tsx` - Collapsible sections
- `tabs.tsx` - Tabbed interface
- `table.tsx` - Data table
- `resizable.tsx` - Resizable panels
- `scroll-area.tsx` - Scrollable container
- `aspect-ratio.tsx` - Maintain aspect ratio

### Navigation Components
- `navigation-menu.tsx` - Navigation menu bar
- `menubar.tsx` - Menu bar
- `dropdown-menu.tsx` - Dropdown menu
- `context-menu.tsx` - Right-click context menu
- `breadcrumb.tsx` - Breadcrumb navigation
- `sidebar.tsx` - Collapsible sidebar
- `pagination.tsx` - Page navigation

### Feedback Components
- `toast.tsx` & `toaster.tsx` - Toast notifications
- `sonner.tsx` - Alternative toast system
- `alert.tsx` - Alert messages
- `alert-dialog.tsx` - Confirmation dialogs
- `dialog.tsx` - Modal dialogs
- `sheet.tsx` - Side panel
- `drawer.tsx` - Mobile drawer
- `progress.tsx` - Progress bar
- `skeleton.tsx` - Loading skeleton

### Display Components
- `badge.tsx` - Status badge
- `avatar.tsx` - User avatar
- `tooltip.tsx` - Hover tooltip
- `hover-card.tsx` - Hover card
- `popover.tsx` - Popover menu
- `calendar.tsx` - Date picker
- `chart.tsx` - Data visualization
- `carousel.tsx` - Image carousel
- `command.tsx` - Command palette

### Other Components
- `toggle.tsx` & `toggle-group.tsx` - Toggle buttons
- `collapsible.tsx` - Collapsible content

---

## Platform-Specific Access Control

### Web-Only Pages (Organizer Features)
The following pages are restricted to web browsers and blocked on mobile devices:
- Organizer Dashboard
- Create Event
- All Events
- Event Monitor
- Send Invitations
- Invitation Summary
- Create/Edit Registration Forms
- Organization Management (for organizers)
- Location Debugger

### Mobile-Only Pages (Participant Features)
The following pages are restricted to mobile devices and blocked on web browsers:
- Participant Dashboard (optimized for mobile QR scanning)

### Universal Access
The following pages are accessible on both web and mobile:
- Landing Page
- Login
- Register
- Public Events
- Join Event
- Invitation View
- Not Found

---

## Responsive Design

All pages and components are designed with responsive breakpoints:
- **Mobile:** < 640px (sm)
- **Tablet:** 640px - 1024px (md, lg)
- **Desktop:** > 1024px (xl, 2xl)

Mobile-first approach with progressive enhancement for larger screens.

---

## Theme Support

The application supports both light and dark themes:
- System preference detection
- Manual theme toggle
- Persistent theme selection (localStorage)
- Theme-aware components
- Smooth theme transitions

---

## Technology Stack

- **Frontend Framework:** React 18 with TypeScript
- **Routing:** React Router DOM v6
- **UI Framework:** Shadcn/UI (Radix UI + Tailwind CSS)
- **Styling:** Tailwind CSS with custom configuration
- **State Management:** React Hooks + Context API
- **Data Fetching:** TanStack Query (React Query)
- **Forms:** React Hook Form + Zod validation
- **Mobile:** Capacitor for native mobile features
- **Maps:** Leaflet / OpenStreetMap
- **QR Codes:** jsQR (scanning) + qrcode (generation)
- **Date/Time:** date-fns with timezone support
- **Charts:** Recharts
- **File Parsing:** PapaParse (CSV) + XLSX (Excel)

---

## Mobile-Specific Features (Capacitor)

### Camera
- QR code scanning
- Flash control
- Camera permission handling

### Geolocation
- High-accuracy GPS tracking
- Background location updates
- Location permissions

### Haptics
- Tactile feedback for user interactions
- Vibration patterns

### Status Bar
- Dynamic styling
- Theme-aware colors

### Splash Screen
- Native splash screen handling

### Local Notifications
- Event reminders
- Check-in/check-out alerts
- Location-based notifications

---

## Summary

EventConnect provides a comprehensive suite of user interfaces for intelligent event attendance tracking:

- **19 main pages** covering all user workflows
- **50+ reusable components** for consistent UI
- **40+ Shadcn/UI components** for polished design
- **Role-based access control** (Organizer/Participant)
- **Platform-specific features** (Web/Mobile)
- **Real-time monitoring and updates**
- **GPS-based attendance verification**
- **QR code check-in system**
- **Custom form builders**
- **Organization management**
- **Comprehensive reporting and analytics**

The application is designed for scale, security, and user experience, with responsive design, dark mode support, and mobile-native features.
