import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { API_CONFIG } from '@/config';

interface TimerData {
  eventTitle: string;
  eventId: string;
  maxTimeOutside: number;
  currentTimeOutside: number;
  status: string;
  isStale: boolean;
  timerActive: boolean;
  startTime?: string;
}

interface ParticipantTimerModalProps {
  participantId: string;
}

const ParticipantTimerModal: React.FC<ParticipantTimerModalProps> = ({ participantId }) => {
  const [timerData, setTimerData] = useState<TimerData | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Fetch timer data
  useEffect(() => {
    if (!participantId) return;

    const fetchTimerData = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`${API_CONFIG.API_BASE}/location-tracking/participant/${participantId}/timer`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            setTimerData(result.data);
            setDismissed(false); // Reset dismissed state when new timer data arrives
          } else {
            setTimerData(null);
          }
        }
      } catch (error) {
        console.error('Error fetching timer data:', error);
      }
    };

    // Fetch immediately
    fetchTimerData();

    // Poll every 2 seconds
    const interval = setInterval(fetchTimerData, 2000);

    return () => clearInterval(interval);
  }, [participantId]);

  // Update countdown timer
  useEffect(() => {
    if (!timerData || !timerData.timerActive) return;

    const updateTimer = () => {
      if (timerData.startTime) {
        const startTime = new Date(timerData.startTime).getTime();
        const now = Date.now();
        const elapsedSeconds = Math.floor((now - startTime) / 1000);
        const totalElapsed = timerData.currentTimeOutside + elapsedSeconds;
        setCurrentTime(totalElapsed);
      } else {
        setCurrentTime(timerData.currentTimeOutside);
      }
    };

    // Update immediately
    updateTimer();

    // Update every second
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [timerData]);

  // Don't show if no timer data, dismissed, or timer not active
  if (!timerData || !timerData.timerActive || dismissed) {
    return null;
  }

  const maxTimeSeconds = timerData.maxTimeOutside * 60;
  const remainingSeconds = Math.max(0, maxTimeSeconds - currentTime);
  const remainingMinutes = Math.floor(remainingSeconds / 60);
  const remainingSecondsDisplay = remainingSeconds % 60;
  const percentageUsed = (currentTime / maxTimeSeconds) * 100;

  // Determine status color
  // Determine if this is a stale data issue or an outside premises issue
  const isStaleIssue = timerData.isStale;

  const getStatusColor = () => {
    // Different colors for stale vs outside
    if (isStaleIssue) {
      // Purple/violet theme for stale (connectivity issue)
      return 'bg-purple-600';
    }
    // Orange/red theme for outside premises (location issue)
    if (percentageUsed >= 100) return 'bg-red-600';
    if (percentageUsed >= 80) return 'bg-orange-600';
    if (percentageUsed >= 60) return 'bg-yellow-600';
    return 'bg-orange-500';
  };

  const getStatusText = () => {
    if (isStaleIssue) {
      return '🔌 Location Updates Stopped';
    }
    if (percentageUsed >= 100) return '📍 Time Limit Exceeded';
    if (percentageUsed >= 80) return '📍 Approaching Time Limit';
    if (percentageUsed >= 60) return '📍 Warning: Time Running Low';
    return '📍 Outside Event Premises';
  };

  const getMessage = () => {
    if (isStaleIssue) {
      return 'Your device has stopped sending location updates. Please check your settings and ensure the app stays in the foreground.';
    }
    return 'You are outside the event premises. Please return within the time limit to avoid being marked absent.';
  };

  const getDetailedInstructions = () => {
    if (isStaleIssue) {
      return [
        '• Keep this tab/app active and in the foreground',
        '• Ensure location services are enabled',
        '• Check your internet connection',
        '• Disable battery saver mode if enabled'
      ];
    }
    return [
      '• Return to the event venue immediately',
      '• You have a limited time before being marked absent',
      '• Contact organizers if you need assistance'
    ];
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <Card className={`${getStatusColor()} text-white shadow-2xl border-2 ${isStaleIssue ? 'border-purple-300' : 'border-orange-300'}`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="mt-1">
                {isStaleIssue ? (
                  <AlertTriangle className="w-7 h-7 animate-pulse" />
                ) : percentageUsed >= 80 ? (
                  <AlertTriangle className="w-7 h-7 animate-pulse" />
                ) : (
                  <Clock className="w-7 h-7" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-xl">{getStatusText()}</h3>
                  <div className="text-3xl font-mono font-bold">
                    {remainingMinutes}:{remainingSecondsDisplay.toString().padStart(2, '0')}
                  </div>
                </div>

                <p className="text-base font-semibold opacity-95 mb-3">
                  📅 {timerData.eventTitle}
                </p>

                <div className={`${isStaleIssue ? 'bg-purple-700/50' : 'bg-orange-700/50'} rounded-lg p-3 mb-3`}>
                  <p className="font-semibold mb-2">
                    {getMessage()}
                  </p>
                  <ul className="text-sm space-y-1 opacity-90">
                    {getDetailedInstructions().map((instruction, idx) => (
                      <li key={idx}>{instruction}</li>
                    ))}
                  </ul>
                </div>

                {isStaleIssue ? (
                  <div className="bg-white/20 rounded p-2 mb-3">
                    <p className="text-xs italic">
                      ⚠️ This is a <strong>connectivity issue</strong>, not a location issue. Your device is not sending updates.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white/20 rounded p-2 mb-3">
                    <p className="text-xs italic">
                      ⚠️ This is a <strong>location issue</strong>. You are actively outside the event boundaries.
                    </p>
                  </div>
                )}

                {/* Progress bar */}
                <div className="mt-3 bg-white/30 rounded-full h-3 overflow-hidden">
                  <div
                    className={`${isStaleIssue ? 'bg-purple-300' : 'bg-white'} h-full transition-all duration-1000`}
                    style={{ width: `${Math.min(100, percentageUsed)}%` }}
                  />
                </div>
              </div>
            </div>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDismissed(true)}
              className="text-white hover:bg-white/20 flex-shrink-0"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ParticipantTimerModal;
