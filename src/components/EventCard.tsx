import { useState, useEffect } from 'react';
import { Edit } from "lucide-react";
import { Link, useNavigate } from 'react-router-dom';
import { API_CONFIG } from '@/config';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, MapPin, Users, Monitor, Mail, Settings, QrCode, MessageSquare, Send, Globe, Lock } from 'lucide-react';
import QRCodeDisplay from '@/components/QRCodeDisplay';
import GeofenceMap from '@/components/GeofenceMap';
import { toast } from '@/hooks/use-toast';

interface EventCardProps {
  event: any;
  onInvitationClick: (eventId: string) => void;
  onReportsClick: (eventId: string) => void;
  onSettingsClick: (eventId: string) => void;
  onGeofenceUpdate: (eventId: string, center: [number, number], radius: number) => void;
  onFeedbackClick: (eventId: string) => void;
  onDeleteClick: (eventId: string, isCompleted: boolean) => void;
  onPublishClick: (eventId: string) => void;
  onPublishChangesClick?: (eventId: string) => void;
  hasUnpublishedChanges?: boolean;
  onQRClick?: (eventId: string) => void;
  onGeofenceClick?: (eventId: string) => void;
}

const EventCard = ({
  event,
  onInvitationClick,
  onReportsClick,
  onSettingsClick,
  onGeofenceUpdate,
  onFeedbackClick,
  onDeleteClick,
  onPublishClick,
  onPublishChangesClick,
  hasUnpublishedChanges = false,
  onQRClick,
  onGeofenceClick
}: EventCardProps) => {
  const isUpcoming = event.status === 'upcoming';
  const isActive = event.status === 'active';
  const isCompleted = event.status === 'completed';

  // Check if current time is within 1 hour prior to event start
  const isLiveMonitorAvailable = () => {
    if (isActive) return true; // Always available for active events
    if (!isUpcoming) return false; // Not available for completed events

    const now = new Date();
    const eventStartTime = event.startTime;

    // Combine event date and start time
    const eventDateTime = new Date(`${event.date}T${eventStartTime}`);

    // Calculate time difference in milliseconds
    const timeDiff = eventDateTime.getTime() - now.getTime();
    const oneHourInMs = 60 * 60 * 1000; // 1 hour in milliseconds

    // Available if 1 hour or less remaining until event start (and event hasn't started yet)
    return timeDiff <= oneHourInMs && timeDiff >= 0;
  };

  const liveMonitorAvailable = isLiveMonitorAvailable();
  const [hasRegistrationForm, setHasRegistrationForm] = useState<boolean | null>(null);
  const [registrationFormId, setRegistrationFormId] = useState<string | null>(null);
  const [hasFeedbackForm, setHasFeedbackForm] = useState<boolean | null>(null);
  const [checkingForm, setCheckingForm] = useState(false);
  const [checkingFeedback, setCheckingFeedback] = useState(false);
  
  const navigate = useNavigate();

  // Check if registration form exists for this event
  useEffect(() => {
    checkRegistrationFormExists();
    checkFeedbackFormExists();
  }, [event.id]);

  const checkRegistrationFormExists = async () => {
    setCheckingForm(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_CONFIG.API_BASE}/registration-forms/event/${event.id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setHasRegistrationForm(true);
          setRegistrationFormId(result.data.registrationForm._id);
        } else {
          setHasRegistrationForm(false);
        }
      } else {
        setHasRegistrationForm(false);
      }
    } catch (error) {
      console.error('Error checking registration form:', error);
      setHasRegistrationForm(false);
    } finally {
      setCheckingForm(false);
    }
  };

  const checkFeedbackFormExists = async () => {
    setCheckingFeedback(true);
    try {
      const response = await fetch(`${API_CONFIG.API_BASE}/feedback-forms/event/${event.id}`);
      
      if (response.ok) {
        const result = await response.json();
        setHasFeedbackForm(result.success);
      } else {
        setHasFeedbackForm(false);
      }
    } catch (error) {
      console.error('Error checking feedback form:', error);
      setHasFeedbackForm(false);
    } finally {
      setCheckingFeedback(false);
    }
  };

  const handleEditFormClick = () => {
    const currentPath = window.location.pathname;
    const returnPath = currentPath.includes('/all-events') ? '/all-events' : '/dashboard';

    if (hasRegistrationForm && registrationFormId) {
      // Navigate to edit existing form
      navigate(`/registration-forms/${registrationFormId}/edit`, {
        state: {
          eventId: event.id,
          eventTitle: event.title,
          mode: 'edit',
          returnPath: returnPath
        }
      });
    } else {
      // Navigate to create new form
      navigate(`/events/${event.id}/registration/create`, {
        state: {
          eventId: event.id,
          eventTitle: event.title,
          mode: 'create',
          returnPath: returnPath
        }
      });
    }
  };

  const handleFeedbackClick = () => {
    // Always open the feedback manager which handles both creation and management
    onFeedbackClick(event.id);
  };

  const getEditButtonText = () => {
    if (checkingForm) return 'Checking...';
    if (hasRegistrationForm) return 'Edit Reg. Form';
    return 'Create Reg. Form';
  };

  const getFeedbackButtonText = () => {
    if (checkingFeedback) return 'Checking...';
    return 'Manage Feedback';
  };

  const FeedbackIcon = MessageSquare;
  
  return (
    <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-gradient-to-br from-background to-muted/10">
      <CardHeader className="pb-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
                  {event.title}
                </h3>
                <Badge
                  variant={isActive ? "default" : "secondary"}
                  className={`${
                    isActive
                      ? 'bg-green-100 text-green-700 hover:bg-green-100'
                      : isCompleted
                      ? 'bg-gray-100 text-gray-700 hover:bg-gray-100'
                      : isUpcoming
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                      : 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {event.status}
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>
                    {event.endDate && event.endDate !== event.date ? (
                      // Multi-day event: show date range
                      `${new Date(event.date).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      })} - ${new Date(event.endDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}`
                    ) : (
                      // Single-day event: show full date
                      new Date(event.date).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })
                    )}
                  </span>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-300">
                  <MapPin className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate overflow-hidden text-ellipsis whitespace-nowrap max-w-[250px]" title={event.location?.address || event.location}>
                    {event.location?.address || event.location}
                  </span>
                </div>
              </div>
            </div>

            {(isActive || isUpcoming) && (
              <div className="flex flex-col gap-1.5 ml-3 min-w-[120px]">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-blue-700 border-blue-200 hover:bg-blue-50 hover:border-blue-300 dark:text-blue-400 dark:border-blue-800 dark:hover:bg-blue-950/30 whitespace-nowrap text-xs h-7"
                  onClick={handleEditFormClick}
                  disabled={checkingForm}
                >
                  <Edit className="w-3 h-3 mr-0" />
                  {getEditButtonText()}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className={`whitespace-nowrap text-xs h-7 ${event.published
                    ? 'text-red-700 border-red-200 hover:bg-red-50 hover:border-red-300 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/30'
                    : 'text-green-700 border-green-200 hover:bg-green-50 hover:border-green-300 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/30'
                  }`}
                  onClick={() => onPublishClick(event.id)}
                >
                  {event.published ? (
                    <>
                      <Lock className="w-3 h-3 mr-1" />
                      Private
                    </>
                  ) : (
                    <>
                      <Globe className="w-3 h-3 mr-1" />
                      Public
                    </>
                  )}
                </Button>

                {/* Publish Changes Button - Only for Active Events with Changes */}
                {isActive && onPublishChangesClick && hasUnpublishedChanges && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-purple-700 border-purple-200 hover:bg-purple-50 hover:border-purple-300 dark:text-purple-400 dark:border-purple-800 dark:hover:bg-purple-950/30 whitespace-nowrap text-xs h-7"
                    onClick={() => onPublishChangesClick(event.id)}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    Publish Changes
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 rounded-lg bg-muted/50">
            <div className="text-2xl font-bold text-foreground">{event.totalParticipants}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-green-50 dark:bg-green-950/30">
            <div className="text-2xl font-bold text-green-600">{event.checkedIn}</div>
            <div className="text-xs text-muted-foreground">Checked In</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-red-50 dark:bg-red-950/30">
            <div className="text-2xl font-bold text-red-600">
              {isCompleted ? event.currentlyPresent : (event.checkedIn - event.currentlyPresent)}
            </div>
            <div className="text-xs text-muted-foreground">Absent</div>
          </div>
        </div>

        {/* Action Tabs - Different for completed events */}
        {isCompleted ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                onClick={() => onReportsClick(event.id)}
                className="hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <Users className="w-4 h-4 mr-2" />
                Reports
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleFeedbackClick}
                className="hover:bg-primary hover:text-primary-foreground transition-colors"
                disabled={checkingFeedback}
              >
                <FeedbackIcon className="w-4 h-4 mr-2" />
                {getFeedbackButtonText()}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDeleteClick(event.id, isCompleted)}
                className="hover:bg-red-600 text-white transition-colors"
              >
                Delete
              </Button>
            </div>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/30">
              <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
              <TabsTrigger value="qr-code" className="text-xs">QR Code</TabsTrigger>
              <TabsTrigger value="geofence" className="text-xs">Geofence</TabsTrigger>
              <TabsTrigger value="feedback" className="text-xs">Feedback</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-2">
                {liveMonitorAvailable ? (
                  <Link to={`/event/${event.id}/monitor`}>
                    <Button size="sm" variant="outline" className="w-full hover:bg-primary hover:text-primary-foreground transition-colors">
                      <Monitor className="w-4 h-4 mr-2" />
                      Live Monitor
                    </Button>
                  </Link>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full opacity-50 cursor-not-allowed"
                    disabled
                    title={isUpcoming ? "Live Monitor available 1 hour before event start" : "Live Monitor not available"}
                  >
                    <Monitor className="w-4 h-4 mr-2" />
                    Live Monitor
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onInvitationClick(event.id)}
                  className="hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Invite
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onReportsClick(event.id)}
                  className="hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Users className="w-4 h-4 mr-2" />
                  Reports
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSettingsClick(event.id)}
                  className="hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Settings
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="qr-code" className="py-4">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Generate and download QR code for participants
                </p>
                <Button
                  onClick={() => onQRClick?.(event.id)}
                  className="w-full"
                >
                  <QrCode className="w-4 h-4 mr-2" />
                  View QR Code
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="geofence" className="py-4">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Configure location boundaries and geofence settings
                </p>
                <Button
                  onClick={() => onGeofenceClick?.(event.id)}
                  className="w-full"
                  variant="outline"
                >
                  <MapPin className="w-4 h-4 mr-2" />
                  Configure Geofence
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="feedback" className="py-4">
              <div className="text-center space-y-4">
                <p className="text-muted-foreground">
                  Create and manage feedback forms for participants
                </p>
                <Button 
                  onClick={handleFeedbackClick}
                  className="w-full"
                  disabled={checkingFeedback}
                >
                  <FeedbackIcon className="w-4 h-4 mr-2" />
                  {getFeedbackButtonText()}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
};

export default EventCard;