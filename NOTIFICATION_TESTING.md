# 🚨 Participant Notification System - Testing Guide

## ✅ **Successfully Implemented Features:**

### **1. ⏰ Event Countdown Notifications (NEW!):**
- Automatic notifications for upcoming events
- **1 hour before event**: "Event Starting Soon" notification
- **15 minutes before event**: "Event Starting Very Soon!" notification
- **At event start time**: "Event is Starting Now!" notification
- Works on both mobile app and web browsers
- Notifications scheduled automatically when events are loaded
- Requires notification permissions (requested automatically on first use)

### **2. 📍 Location & Premises Notifications:**
- Shows when participant is outside event premises
- Live timer counting time spent outside  
- Color-coded warnings (yellow → red as time increases)
- Persistent notifications that can't be dismissed for critical alerts

### **2. 🔋 Battery Level Monitoring:**
- Warning at 25% battery (if not charging)
- Critical alert at 10% battery (if not charging)  
- Real-time battery percentage display
- Shows charging status with ⚡ icon
- Uses web Battery API (works in most browsers)

### **3. 📶 Network Connectivity Alerts:**
- Immediate notification when going offline
- Persistent red alert when no internet connection
- Toast notification when connection restored
- Explains impact on app functionality

### **4. 📳 Enhanced Features:**
- **Haptic feedback**: Vibration for critical alerts
- **Browser notifications**: Background notifications even when app not focused
- **Smart management**: Non-intrusive, dismissible info notifications
- **Real-time updates**: Live counters and status monitoring

## 🧪 **How to Test Each Feature:**

### **Testing Event Countdown Notifications:**
1. Login as participant
2. Accept an event invitation for an upcoming event, OR
3. Check into an active/upcoming event
4. The app will automatically schedule notifications:
   - 1 hour before event start
   - 15 minutes before event start
   - At event start time
5. **To test immediately (without waiting)**:
   - Create a test event with start time set to 2 minutes from now
   - Accept the invitation
   - Wait and you'll receive notifications
6. **Mobile Testing**:
   - Notifications work even when app is closed
   - Check notification center for scheduled notifications
7. **Web Testing**:
   - Keep browser tab open or in background
   - Browser notifications will appear at scheduled times

### **Testing Location Notifications:**
1. Login as participant
2. Check into an event (location tracking starts automatically)
3. The notification will show based on your actual location status
4. If implemented with mock data, you'll see location status in the UI

### **Testing Battery Notifications:**
**Option 1 - Actual Battery (if supported by browser):**
- Works in Chrome/Edge on some devices
- Battery level will show real device battery

**Option 2 - Simulate Low Battery:**
1. Edit `src/components/ParticipantNotifications.tsx`
2. Uncomment lines 87-88:
   ```typescript
   setBatteryLevel(20); // This will trigger low battery notification
   setIsCharging(false);
   ```
3. Save the file - you'll see immediate low battery notification

### **Testing Network Notifications:**
**Option 1 - Actual Network:**
1. Disconnect your internet/WiFi
2. Immediate red network alert will appear
3. Reconnect internet - green restoration toast appears

**Option 2 - Simulate Offline:**
1. Edit `src/components/ParticipantNotifications.tsx`
2. Change line 47-49 to:
   ```typescript
   const [isOnline, setIsOnline] = useState<boolean>(
     false  // Simulates offline mode
     // navigator.onLine
   );
   ```

### **Testing Haptic Feedback:**
- Enable on mobile device or mobile browser
- Critical alerts (red notifications) trigger vibration
- Different vibration intensities for different alert types

### **Testing Browser Notifications:**
1. Allow notification permissions when prompted
2. Critical alerts will show browser notifications
3. Notifications appear even when app is in background
4. Click notification to focus the app

## 🎯 **Expected Behavior:**

### **Notification Hierarchy:**
- **🔴 Critical (Red)**: Time exceeded, critical battery, no internet
- **🟡 Warning (Yellow)**: Time approaching limit, low battery  
- **🔵 Info (Blue)**: General location status, informational alerts

### **Notification Persistence:**
- **Persistent**: Critical alerts stay visible until condition resolved
- **Dismissible**: Warning/info alerts can be manually dismissed
- **Auto-refresh**: Status updates automatically every 15 seconds

### **Visual Indicators:**
- **Icons**: Location (📍), Battery (🔋), Network (📶)
- **Live counters**: Time outside premises updates every second
- **Battery percentage**: Shows current level and charging status
- **Action buttons**: Quick access to relevant settings

## 🛠️ **Technical Notes:**

- **Cross-platform**: Works on web and mobile browsers
- **Graceful fallbacks**: Uses web APIs when native plugins unavailable
- **Performance optimized**: Smart re-rendering and state management
- **Error handling**: Robust error boundaries and logging

## 📱 **Browser Compatibility:**

- **Battery API**: Chrome, Edge (limited mobile support)
- **Network API**: All modern browsers
- **Notifications**: All modern browsers (with permission)
- **Haptics**: Mobile browsers + Capacitor native apps

## 🚀 **Ready for Testing!**

The notification system is fully functional and ready for testing. Uncomment the simulation lines mentioned above to see immediate results, or test with real device conditions for authentic behavior.

---

**Navigation**: 
- Participant Dashboard: `http://localhost:8080/login?role=participant`
- Test with mobile view: Press F12 → Device Emulation 📱