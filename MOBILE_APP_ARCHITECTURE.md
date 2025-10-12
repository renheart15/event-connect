# 📱 Mobile App Architecture

## Overview

Event Connect has a **strict platform separation** architecture based on user roles:

- **📱 Mobile App**: **Participants only** (check-in, notifications, attendance tracking)
- **💻 Web Browser**: **Organizers only** (dashboard, event creation, monitoring)

Each platform is exclusively dedicated to its user type for optimal experience and security.

## Architecture Design

### Role-Based Platform Access

```
┌─────────────────────────────────────────────────────────┐
│                    Event Connect                         │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────────────┐          ┌──────────────────┐     │
│  │  Participants   │          │   Organizers     │     │
│  │                 │          │                  │     │
│  │  📱 Mobile App  │          │  💻 Web Browser  │     │
│  │                 │          │                  │     │
│  │  ✓ Check-in     │          │  ✓ Dashboard     │     │
│  │  ✓ Notifications│          │  ✓ Create Events │     │
│  │  ✓ Attendance   │          │  ✓ Live Monitor  │     │
│  │  ✓ QR Scanner   │          │  ✓ Reports       │     │
│  │  ✓ Events List  │          │  ✓ Invitations   │     │
│  └─────────────────┘          └──────────────────┘     │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### How It Works

The app uses two complementary guard components:

#### **`MobileAccessGuard`** - Blocks organizers on mobile
1. **Detects Platform**: Uses Capacitor to check if running on native mobile
2. **Checks User Role**: Reads user role from localStorage
3. **Applies Access Rules**:
   - Organizers on Mobile: ❌ Blocked from organizer features
   - Organizers on Web: ✅ Full access to organizer features

#### **`WebAccessGuard`** - Blocks participants on web
1. **Detects Platform**: Uses Capacitor to check if running on web
2. **Checks User Role**: Reads user role from localStorage
3. **Applies Access Rules**:
   - Participants on Web: ❌ Blocked from participant dashboard
   - Participants on Mobile: ✅ Full access to mobile app

## Implementation Details

### MobileAccessGuard Component

Located at: `src/components/MobileAccessGuard.tsx`

**Features:**
- Detects native platform using `Capacitor.isNativePlatform()`
- Blocks organizer routes on mobile devices
- Shows helpful message directing organizers to web browser
- Provides "Copy Web URL" button for easy access
- Optional warning mode instead of complete blocking

**Usage:**

```tsx
<MobileAccessGuard allowedRoles={['organizer-web-only']}>
  <OrganizerDashboard />
</MobileAccessGuard>
```

### WebAccessGuard Component

Located at: `src/components/WebAccessGuard.tsx`

**Features:**
- Detects web platform using `!Capacitor.isNativePlatform()`
- Blocks participant routes on web browsers
- Shows helpful message directing participants to mobile app
- Provides "Download Mobile App" button
- Optional warning mode instead of complete blocking

**Usage:**

```tsx
<WebAccessGuard allowedRoles={['participant-mobile-only']}>
  <ParticipantDashboard />
</WebAccessGuard>
```

### Protected Routes

**Organizer routes** (wrapped with MobileAccessGuard - web only):

- `/organizer-dashboard`
- `/organization`
- `/all-events`
- `/create-event`
- `/event/:eventId/monitor`
- `/send-invitations`
- `/invitation-summary`
- `/events/:eventId/registration/create`
- `/registration-forms/:formId/edit`
- `/event/:eventId/location-debug`

**Participant routes** (wrapped with WebAccessGuard - mobile only):

- `/participant-dashboard`

**Public routes** (accessible on both platforms):

- `/public-events`
- `/invitations`
- `/join/:eventCode`
- `/invitation/:code`
- `/login`
- `/register`

## User Experience

### Participant (Mobile App) ✅
1. Download "Event Connect Mobile" from app store
2. Login as participant
3. Full access to all participant features
4. Receives push notifications for events
5. Can scan QR codes, check in/out, view events

### Participant (Attempts Web Access) ❌
1. Opens website as participant
2. Sees informative message explaining mobile requirement
3. Can download mobile app via provided link
4. Redirected to use mobile app instead

### Organizer (Web Browser) ✅
1. Visit Event Connect website
2. Login as organizer
3. Full access to dashboard, event management
4. Create events, send invitations, monitor attendance
5. View real-time location tracking and reports

### Organizer (Attempts Mobile Access) ❌
1. Opens mobile app as organizer
2. Sees informative message explaining web requirement
3. Can copy web URL to clipboard
4. Redirected to use web browser instead

## Benefits

✅ **Optimized User Experience**: Each role gets the best platform for their needs

✅ **Strict Platform Separation**: Complete isolation of organizer and participant experiences

✅ **Enhanced Security**: Role-based platform access reduces potential attack vectors

✅ **Better Performance**: Each platform optimized for specific use case

✅ **Easier Maintenance**: Clear separation allows independent development

✅ **Push Notifications**: Participants get native mobile notifications

✅ **Professional UX**: Organizers get full-featured desktop dashboard

✅ **Mobile-First Participants**: QR scanning, location, and native features work perfectly

✅ **Desktop-First Organizers**: Complex dashboards and data visualization optimized for web

## Configuration

### Allow/Block Modes

**Current Configuration** (Block Mode):
```tsx
<MobileAccessGuard allowedRoles={['organizer-web-only']}>
```
- Completely blocks access on mobile
- Shows helpful redirection message

**Alternative** (Warning Mode):
```tsx
<MobileAccessGuard
  allowedRoles={['organizer-web-only']}
  showWarning={true}
>
```
- Shows warning but allows access
- Useful for testing or gradual rollout

### Customization

To change which roles can access mobile:

```tsx
// Allow organizers on mobile (not recommended)
<MobileAccessGuard allowedRoles={['organizer', 'participant']}>

// Participant-only (default)
<MobileAccessGuard allowedRoles={['participant']}>

// Custom role restrictions
<MobileAccessGuard
  allowedRoles={['participant', 'admin']}
  redirectTo="/custom-dashboard"
>
```

## Testing

### Test Platform Access Control

1. **Build and Deploy:**
   ```bash
   npm run build
   npx cap sync
   ```

2. **Test on Mobile Device/Emulator:**
   - Login as organizer → Should see "Organizer Dashboard - Web Only" message
   - Login as participant → Should access participant dashboard normally
   - Try to access organizer routes → Blocked with helpful message

3. **Test on Web Browser:**
   - Login as organizer → Should access organizer dashboard normally
   - Login as participant → Should see "Participant Dashboard - Mobile Only" message
   - Try to access participant dashboard → Blocked with helpful message

### Verify Guards are Working

**MobileAccessGuard** (blocks organizers on mobile):
Check console logs on mobile:
```
Mobile Access Guard: Native platform detected
Mobile Access Guard: User role = organizer
Mobile Access Guard: Blocking access (role not in allowed list)
```

**WebAccessGuard** (blocks participants on web):
Check console logs on web:
```
Web Access Guard: Web platform detected
Web Access Guard: User role = participant
Web Access Guard: Blocking access (role not in allowed list)
```

## Deployment

### Mobile App (Participants Only)
```bash
# Build and sync
npm run build
npx cap sync

# Open in platform-specific IDE
npx cap open android  # For Android
npx cap open ios      # For iOS

# Build and distribute through app stores
```

### Web App (All Features)
```bash
# Build for production
npm run build

# Deploy to hosting (Vercel, Netlify, etc.)
vercel deploy --prod
```

## Future Enhancements

Potential improvements:

1. **Separate App Bundles**: Build completely separate apps for organizers/participants
2. **Feature Flags**: Dynamic feature toggling per role
3. **Offline Mode**: Enhanced offline capabilities for mobile participants
4. **Analytics**: Track platform usage patterns by role
5. **Progressive Web App**: PWA fallback for organizers who want mobile access

## Technical Notes

- Uses **Capacitor** for native platform detection
- Works with existing authentication system
- No backend changes required
- Pure frontend routing logic
- Compatible with all Capacitor platforms (iOS, Android, Web)

---

**Questions or Issues?**
Check the implementation in `src/components/MobileAccessGuard.tsx` and `src/App.tsx`
