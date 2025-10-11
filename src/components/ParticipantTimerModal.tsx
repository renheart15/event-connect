import React, { useState, useEffect } from 'react';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

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
        const response = await fetch(`/api/location-tracking/participant/${participantId}/timer`, {
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
  const getStatusColor = () => {
    if (percentageUsed >= 100) return 'bg-red-600';
    if (percentageUsed >= 80) return 'bg-orange-600';
    if (percentageUsed >= 60) return 'bg-yellow-600';
    return 'bg-blue-600';
  };

  const getStatusText = () => {
    if (percentageUsed >= 100) return 'Time Limit Exceeded';
    if (percentageUsed >= 80) return 'Approaching Time Limit';
    if (percentageUsed >= 60) return 'Warning: Time Running Low';
    return 'Time Remaining';
  };

  const getMessage = () => {
    if (timerData.isStale) {
      return 'Your location data is unavailable. Please ensure location sharing is enabled.';
    }
    return 'You are outside the event premises. Please return to avoid being marked absent.';
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <Card className={`${getStatusColor()} text-white shadow-2xl`}>
        <div className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 flex-1">
              <div className="mt-1">
                {percentageUsed >= 80 ? (
                  <AlertTriangle className="w-6 h-6 animate-pulse" />
                ) : (
                  <Clock className="w-6 h-6" />
                )}
              </div>

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-bold text-lg">{getStatusText()}</h3>
                  <div className="text-2xl font-mono font-bold">
                    {remainingMinutes}:{remainingSecondsDisplay.toString().padStart(2, '0')}
                  </div>
                </div>

                <p className="text-sm opacity-90 mb-2">
                  {timerData.eventTitle}
                </p>

                <p className="text-sm opacity-90">
                  {getMessage()}
                </p>

                {timerData.isStale && (
                  <p className="text-xs opacity-80 mt-2 italic">
                    Last location update was more than 3 minutes ago
                  </p>
                )}

                {/* Progress bar */}
                <div className="mt-3 bg-white/20 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-white h-full transition-all duration-1000"
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
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default ParticipantTimerModal;
