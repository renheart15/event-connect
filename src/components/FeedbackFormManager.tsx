import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { Edit, Trash2, Eye, MessageSquare, Plus, Calendar, Globe, EyeOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import FeedbackFormBuilder from './FeedbackFormBuilder';
import FeedbackFormEditor from './FeedbackFormEditor';
import FeedbackManagement from './FeedbackManagement';

interface Question {
  id: string;
  title: string;
  type: string;
  required: boolean;
  options?: string[];
}

interface FeedbackForm {
  _id: string;
  title: string;
  description: string;
  questions: Question[];
  isPublished: boolean;
  allowAnonymous: boolean;
  createdAt: string;
  event: {
    _id: string;
    title: string;
  };
}

interface FeedbackFormManagerProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

const FeedbackFormManager = ({ eventId, eventTitle, isOpen, onClose }: FeedbackFormManagerProps) => {
  const { toast } = useToast();
  const [feedbackForm, setFeedbackForm] = useState<FeedbackForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [showResponses, setShowResponses] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const loadFeedbackForm = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/feedback-forms/event/${eventId}/manage`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();

      if (result.success) {
        // Handle both cases: form exists or no form exists (null)
        setFeedbackForm(result.data.feedbackForm);
      } else {
        setFeedbackForm(null);
        toast({
          title: "Load Failed",
          description: result.message || "Failed to load feedback form.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error('Error loading feedback form:', error);
      setFeedbackForm(null);
      toast({
        title: "Load Failed",
        description: error.message || "Failed to load feedback form.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [eventId, toast]);

  useEffect(() => {
    if (isOpen && eventId) {
      loadFeedbackForm();
    }
  }, [isOpen, eventId, loadFeedbackForm]);

  const handleCreateForm = () => {
    setShowBuilder(true);
  };

  const handleEditForm = () => {
    setShowEditor(true);
  };

  const handleViewResponses = () => {
    setShowResponses(true);
  };

  const handleTogglePublish = async () => {
    if (!feedbackForm) return;

    const newPublishStatus = !feedbackForm.isPublished;
    
    // Show confirmation dialog for unpublishing
    if (feedbackForm.isPublished && !newPublishStatus) {
      const confirmed = window.confirm(
        "Are you sure you want to unpublish this feedback form? " +
        "Participants will no longer be able to submit responses until you publish it again."
      );
      if (!confirmed) return;
    }

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/feedback-forms/${feedbackForm._id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          isPublished: newPublishStatus
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: newPublishStatus ? "Form Published ✅" : "Form Unpublished ⏸️",
          description: newPublishStatus 
            ? "Feedback form is now live and available to participants."
            : "Feedback form is now hidden from participants.",
        });

        // Reload the form to show updated status
        loadFeedbackForm();
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('Toggle publish error:', error);
      toast({
        title: "Toggle Failed",
        description: error.message || "Failed to toggle form publish status.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteForm = async () => {
    if (!feedbackForm) return;

    setDeleting(true);
    try {
      // Check if localStorage is available
      if (typeof Storage === "undefined") {
        throw new Error("Local storage is not supported");
      }

      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await fetch(`/api/feedback-forms/${feedbackForm._id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Feedback Form Deleted",
          description: "The feedback form has been permanently deleted.",
        });
        setFeedbackForm(null);
      } else {
        throw new Error(result.message || 'Failed to delete feedback form');
      }
    } catch (error: any) {
      console.error('Error deleting feedback form:', error);
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete feedback form.",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleFormCreated = () => {
    setShowBuilder(false);
    loadFeedbackForm(); // Reload to show the new form
  };

  const handleFormUpdated = () => {
    setShowEditor(false);
    loadFeedbackForm(); // Reload to show updated form
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading feedback form...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Feedback Form Management - {eventTitle}
            </DialogTitle>
            <DialogDescription>
              Create, edit, or manage feedback forms for your event
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {feedbackForm ? (
              // Show existing feedback form
              <Card className="border-2 border-primary/20">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="text-xl text-primary cursor-pointer hover:underline">
                        {feedbackForm.title}
                      </CardTitle>
                      {feedbackForm.description && (
                        <p className="text-muted-foreground text-sm">{feedbackForm.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={feedbackForm.isPublished ? "default" : "secondary"}
                          className={feedbackForm.isPublished ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-200" : "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-200"}
                        >
                          {feedbackForm.isPublished ? (
                            <>
                              <Globe className="w-3 h-3 mr-1" />
                              Published
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 mr-1" />
                              Draft
                            </>
                          )}
                        </Badge>
                        {feedbackForm.allowAnonymous && (
                          <Badge variant="outline">Anonymous Allowed</Badge>
                        )}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          {new Date(feedbackForm.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent>
                  <div className="space-y-4">
                    {/* Form Stats */}
                    <div className="grid grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {feedbackForm.questions.length}
                        </div>
                        <div className="text-xs text-muted-foreground">Questions</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">
                          {feedbackForm.questions.filter(q => q.required).length}
                        </div>
                        <div className="text-xs text-muted-foreground">Required</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">
                          {feedbackForm.questions.filter(q => q.type === 'rating').length}
                        </div>
                        <div className="text-xs text-muted-foreground">Ratings</div>
                      </div>
                    </div>

                    {/* Question Preview */}
                    <div className="space-y-2">
                      <h4 className="font-medium text-sm">Questions Preview:</h4>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {feedbackForm.questions.map((question, index) => (
                          <div key={question.id || `question-${index}`} className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">{index + 1}.</span>
                            <span className="flex-1">{question.title || 'Untitled Question'}</span>
                            <Badge variant="outline" className="text-xs">
                              {question.type || 'text'}
                            </Badge>
                            {question.required && (
                              <Badge variant="secondary" className="text-xs">Required</Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-4 border-t">
                      <Button
                        onClick={handleTogglePublish}
                        variant={feedbackForm.isPublished ? "secondary" : "default"}
                        className="flex-1"
                      >
                        {feedbackForm.isPublished ? (
                          <>
                            <EyeOff className="w-4 h-4 mr-2" />
                            Unpublish
                          </>
                        ) : (
                          <>
                            <Globe className="w-4 h-4 mr-2" />
                            Publish
                          </>
                        )}
                      </Button>

                      <Button
                        onClick={handleEditForm}
                        variant="outline"
                        className="flex-1"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Form
                      </Button>
                      
                      <Button
                        onClick={handleViewResponses}
                        variant="outline"
                        className="flex-1"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Responses
                      </Button>

                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            disabled={deleting}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Feedback Form</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{feedbackForm.title}"? This will permanently delete the form and all associated responses. This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteForm}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deleting ? "Deleting..." : "Delete Form"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              // Show create new form option
              <Card className="border-dashed border-2">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                    <MessageSquare className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">No Feedback Form Yet</h3>
                  <p className="text-muted-foreground text-center mb-6 max-w-md">
                    Create a feedback form to collect valuable insights from your event participants.
                  </p>
                  <Button onClick={handleCreateForm} className="flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create Feedback Form
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Feedback Form Builder Dialog */}
      {showBuilder && (
        <FeedbackFormBuilder
          eventId={eventId}
          eventTitle={eventTitle}
          isOpen={showBuilder}
          onClose={() => setShowBuilder(false)}
          onFormCreated={handleFormCreated}
        />
      )}

      {/* Feedback Form Editor Dialog */}
      {showEditor && feedbackForm && (
        <FeedbackFormEditor
          formId={feedbackForm._id}
          eventId={eventId}
          eventTitle={eventTitle}
          isOpen={showEditor}
          onClose={() => setShowEditor(false)}
          onFormUpdated={handleFormUpdated}
        />
      )}

      {/* Feedback Responses Dialog */}
      {showResponses && (
        <FeedbackManagement
          eventId={eventId}
          eventTitle={eventTitle}
          isOpen={showResponses}
          onClose={() => setShowResponses(false)}
        />
      )}
    </>
  );
};

export default FeedbackFormManager;