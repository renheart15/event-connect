# 📱 Mobile App Architecture

## Overview

Event Connect has a **hybrid architecture** that separates mobile and web experiences based on user roles:

- **📱 Mobile App**: Optimized for **participants** (check-in, notifications, attendance tracking)
- **💻 Web App**: Optimized for **organizers** (dashboard, event creation, monitoring)

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

The app uses **`MobileAccessGuard`** component to control access:

1. **Detects Platform**: Uses Capacitor to check if running on native mobile
2. **Checks User Role**: Reads user role from localStorage
3. **Applies Access Rules**:
   - Participants: ✅ Full mobile app access
   - Organizers on Mobile: ❌ Blocked from organizer features
   - Organizers on Web: ✅ Full access

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

### Protected Routes

All organizer-specific routes are wrapped with MobileAccessGuard:

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

**Participant routes remain accessible on mobile:**
- `/participant-dashboard`
- `/public-events`
- `/invitations`
- `/join/:eventCode`
- `/invitation/:code`

## User Experience

### Participant (Mobile App)
1. Download "Event Connect Mobile" from app store
2. Login as participant
3. Full access to all participant features
4. Receives push notifications for events
5. Can scan QR codes, check in/out, view events

### Organizer (Web Browser)
1. Visit Event Connect website
2. Login as organizer
3. Full access to dashboard, event management
4. Create events, send invitations, monitor attendance
5. View real-time location tracking and reports

### Organizer (Attempts Mobile Access)
1. Opens mobile app as organizer
2. Sees informative message explaining platform requirements
3. Can copy web URL to clipboard
4. Redirected to use web browser instead
5. Can still access participant features if needed

## Benefits

✅ **Optimized User Experience**: Each role gets the best platform for their needs

✅ **Clear Separation**: Reduces confusion about which features work where

✅ **Better Performance**: Mobile app focused on participant features only

✅ **Easier Maintenance**: Organizer features can use desktop-optimized components

✅ **Push Notifications**: Participants get native mobile notifications

✅ **Professional UX**: Organizers get full-featured web dashboard

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

### Test Mobile Access Control

1. **Build Mobile App:**
   ```bash
   npm run build
   npx cap sync
   ```

2. **Test on Mobile Device/Emulator:**
   - Login as organizer → Should see "Web Only" message
   - Login as participant → Should access dashboard normally

3. **Test on Web Browser:**
   - Both organizers and participants work normally
   - No restrictions applied

### Verify Guard is Working

Check browser console/logs:
```
Mobile Access Guard: Native platform detected
Mobile Access Guard: User role = organizer
Mobile Access Guard: Blocking access (role not in allowed list)
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
