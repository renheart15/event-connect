import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Star, MessageSquare, Download, Users } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeedbackResponse {
  _id: string;
  participant?: {
    name: string;
    email: string;
  };
  isAnonymous: boolean;
  responses: Record<string, any>;
  rating?: number;
  submittedAt: string;
}

interface FeedbackStats {
  totalResponses: number;
  averageRating: number;
  responsesByRating: Record<number, number>;
  anonymousResponses: number;
}

interface FeedbackManagementProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const FeedbackManagement = ({ eventId, eventTitle, isOpen, onClose }: FeedbackManagementProps) => {
  const { toast } = useToast();
  const [feedbackForm, setFeedbackForm] = useState<any>(null);
  const [responses, setResponses] = useState<FeedbackResponse[]>([]);
  const [stats, setStats] = useState<FeedbackStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedResponse, setSelectedResponse] = useState<FeedbackResponse | null>(null);

  useEffect(() => {
    if (isOpen && eventId) {
      loadFeedbackData();
    }
  }, [isOpen, eventId]);

  const loadFeedbackData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      
      // First, get the feedback form for this event
      const formResponse = await fetch(`/api/feedback-forms/event/${eventId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (!formResponse.ok) {
        toast({
          title: "No Feedback Form",
          description: "No feedback form found for this event.",
          variant: "destructive",
        });
        onClose();
        return;
      }

      const formResult = await formResponse.json();
      if (!formResult.success) {
        throw new Error('Failed to load feedback form');
      }

      setFeedbackForm(formResult.data.feedbackForm);

      // Then get the responses
      const responsesResponse = await fetch(`/api/feedback-forms/${formResult.data.feedbackForm._id}/responses`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const responsesResult = await responsesResponse.json();
      
      if (responsesResult.success) {
        setResponses(responsesResult.data.responses);
        setStats(responsesResult.data.stats);
      } else {
        throw new Error(responsesResult.message || 'Failed to load responses');
      }
    } catch (error: any) {
      console.error('Error loading feedback data:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to load feedback data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportFeedback = () => {
    if (!feedbackForm || !responses.length) return;

    const csvHeaders = ['Submitted At', 'Participant', 'Type', 'Overall Rating'];
    
    // Add question headers
    feedbackForm.questions.forEach((question: any) => {
      csvHeaders.push(question.title);
    });

    const csvData = responses.map(response => {
      const row = [
        new Date(response.submittedAt).toLocaleString(),
        response.isAnonymous ? 'Anonymous' : response.participant?.name || 'Unknown',
        response.isAnonymous ? 'Anonymous' : 'Identified',
        response.rating?.toFixed(1) || 'N/A'
      ];

      // Add response data for each question
      feedbackForm.questions.forEach((question: any) => {
        const responseValue = response.responses[question.id];
        row.push(responseValue || 'No response');
      });

      return row;
    });

    const csvContent = [csvHeaders, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${eventTitle.replace(/\s+/g, '_')}_feedback.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Feedback Exported",
      description: "Feedback data has been downloaded as CSV file.",
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star 
        key={i} 
        className={`w-4 h-4 ${i < rating ? 'text-yellow-500 fill-current' : 'text-gray-300'}`} 
      />
    ));
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading feedback data...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Feedback Responses - {eventTitle}
            </DialogTitle>
            <DialogDescription>
              View and analyze participant feedback for your event
            </DialogDescription>
          </DialogHeader>

          {stats && (
            <div className="space-y-6">
              {/* Stats Overview */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{stats.totalResponses}</p>
                      <p className="text-sm text-gray-600">Total Responses</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 mb-1">
                        {renderStars(Math.round(stats.averageRating))}
                      </div>
                      <p className="text-lg font-bold text-yellow-600">{stats.averageRating.toFixed(1)}</p>
                      <p className="text-sm text-gray-600">Average Rating</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{stats.totalResponses - stats.anonymousResponses}</p>
                      <p className="text-sm text-gray-600">Identified</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-600">{stats.anonymousResponses}</p>
                      <p className="text-sm text-gray-600">Anonymous</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Rating Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Rating Distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {[5, 4, 3, 2, 1].map(rating => (
                      <div key={rating} className="flex items-center gap-3">
                        <div className="flex items-center gap-1">
                          <span className="text-sm w-4">{rating}</span>
                          <Star className="w-4 h-4 text-yellow-500 fill-current" />
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-yellow-500 h-2 rounded-full" 
                            style={{ 
                              width: `${stats.totalResponses > 0 ? (stats.responsesByRating[rating] / stats.totalResponses) * 100 : 0}%` 
                            }}
                          />
                        </div>
                        <span className="text-sm text-gray-600 w-8">
                          {stats.responsesByRating[rating]}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Individual Responses</h3>
                <Button onClick={exportFeedback} className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Export CSV
                </Button>
              </div>

              {/* Responses List */}
              <div className="space-y-4">
                {responses.length === 0 ? (
                  <Card>
                    <CardContent className="py-8 text-center">
                      <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No feedback responses yet</p>
                      <p className="text-sm text-gray-500">Responses will appear here once participants submit feedback</p>
                    </CardContent>
                  </Card>
                ) : (
                  responses.map((response) => (
                    <Card key={response._id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="pt-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Users className="w-4 h-4" />
                              <span className="font-medium">
                                {response.isAnonymous ? 'Anonymous User' : response.participant?.name || 'Unknown'}
                              </span>
                              {response.isAnonymous && (
                                <Badge variant="secondary">Anonymous</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">
                              {new Date(response.submittedAt).toLocaleString()}
                            </p>
                          </div>
                          <div className="text-right">
                            {response.rating && (
                              <div className="flex items-center gap-1 mb-1">
                                {renderStars(response.rating)}
                                <span className="text-sm text-gray-600 ml-1">
                                  {response.rating.toFixed(1)}
                                </span>
                              </div>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => setSelectedResponse(response)}
                            >
                              View Details
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Response Details Modal */}
      {selectedResponse && (
        <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Response Details</DialogTitle>
              <DialogDescription>
                Submitted by {selectedResponse.isAnonymous ? 'Anonymous User' : selectedResponse.participant?.name} 
                on {new Date(selectedResponse.submittedAt).toLocaleString()}
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              {feedbackForm?.questions.map((question: any) => (
                <Card key={question.id}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{question.title}</CardTitle>
                    <Badge variant="outline" className="w-fit">{question.type}</Badge>
                  </CardHeader>
                  <CardContent>
                    <div className="text-sm">
                      {question.type === 'rating' ? (
                        <div className="flex items-center gap-2">
                          {renderStars(selectedResponse.responses[question.id] || 0)}
                          <span>{selectedResponse.responses[question.id] || 0}/5</span>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">
                          {selectedResponse.responses[question.id] || 'No response'}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default FeedbackManagement;