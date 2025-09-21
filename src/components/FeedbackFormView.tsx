import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Question {
  id: string;
  type: 'text' | 'textarea' | 'rating' | 'multiple-choice';
  title: string;
  required: boolean;
  options?: string[];
}

interface FeedbackForm {
  _id: string;
  title: string;
  description: string;
  questions: Question[];
  allowAnonymous: boolean;
  event: {
    _id: string;
    title: string;
  };
}

interface FeedbackFormViewProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (responses: Record<string, any>) => void;
}

const FeedbackFormView = ({ eventId, isOpen, onClose, onSubmit }: FeedbackFormViewProps) => {
  const { toast } = useToast();
  const [form, setForm] = useState<FeedbackForm | null>(null);
  const [loading, setLoading] = useState(false);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  // Load feedback form when dialog opens
  useEffect(() => {
    if (isOpen && eventId) {
      loadFeedbackForm();
    }
  }, [isOpen, eventId]);

  const loadFeedbackForm = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/feedback-forms/event/${eventId}`);
      const result = await response.json();

      if (result.success) {
        setForm(result.data.feedbackForm);
        setIsAnonymous(result.data.feedbackForm.allowAnonymous);
      } else {
        toast({
          title: "No Feedback Form",
          description: "No feedback form is available for this event yet.",
          variant: "destructive",
        });
        onClose();
      }
    } catch (error) {
      console.error('Error loading feedback form:', error);
      toast({
        title: "Error",
        description: "Failed to load feedback form. Please try again.",
        variant: "destructive",
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (questionId: string, value: any) => {
    setResponses(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleSubmit = async () => {
    if (!form) return;

    // Validate required fields
    const missingRequired = form.questions
      .filter(q => q.required && !responses[q.id])
      .map(q => q.title);

    if (missingRequired.length > 0) {
      toast({
        title: "Missing Required Fields",
        description: `Please answer: ${missingRequired.join(', ')}`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const token = localStorage.getItem('token');
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };

      // Include token if available and not anonymous
      if (token && !isAnonymous) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`/api/feedback-forms/${form._id}/responses`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          responses,
          isAnonymous
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Feedback Submitted",
          description: "Thank you for your feedback!",
        });

        setHasSubmitted(true);
        
        if (onSubmit) {
          onSubmit(responses);
        }
        
        // Close after 2 seconds
        setTimeout(() => {
          onClose();
          setHasSubmitted(false);
          setResponses({});
        }, 2000);
      } else {
        throw new Error(result.message || 'Failed to submit feedback');
      }
    } catch (error: any) {
      console.error('Error submitting feedback:', error);
      toast({
        title: "Submission Failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderQuestion = (question: Question) => {
    switch (question.type) {
      case 'text':
        return (
          <Input
            value={responses[question.id] || ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder="Your answer..."
            disabled={isSubmitting || hasSubmitted}
          />
        );
      
      case 'textarea':
        return (
          <Textarea
            value={responses[question.id] || ''}
            onChange={(e) => handleResponseChange(question.id, e.target.value)}
            placeholder="Your detailed response..."
            rows={4}
            disabled={isSubmitting || hasSubmitted}
          />
        );
      
      case 'rating':
        return (
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                type="button"
                onClick={() => handleResponseChange(question.id, rating)}
                className={`p-1 rounded transition-colors ${
                  responses[question.id] >= rating 
                    ? 'text-yellow-500' 
                    : 'text-gray-300 hover:text-yellow-400'
                }`}
                disabled={isSubmitting || hasSubmitted}
              >
                <Star className="w-6 h-6 fill-current" />
              </button>
            ))}
            {responses[question.id] && (
              <span className="ml-2 text-sm text-muted-foreground">
                {responses[question.id]} out of 5
              </span>
            )}
          </div>
        );
      
      case 'multiple-choice':
        return (
          <RadioGroup
            value={responses[question.id] || ''}
            onValueChange={(value) => handleResponseChange(question.id, value)}
            disabled={isSubmitting || hasSubmitted}
          >
            {question.options?.map((option, index) => (
              <div key={index} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${index}`} />
                <Label htmlFor={`${question.id}-${index}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      
      default:
        return null;
    }
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

  if (!form) {
    return null;
  }

  if (hasSubmitted) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl">
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Feedback Submitted!</h3>
            <p className="text-muted-foreground">Thank you for taking the time to share your feedback.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{form.title}</DialogTitle>
          {form.description && (
            <p className="text-muted-foreground">{form.description}</p>
          )}
        </DialogHeader>

        <div className="space-y-6">
          {/* Anonymous Option */}
          {form.allowAnonymous && (
            <div className="flex items-center space-x-2 p-4 bg-muted/50 rounded-lg">
              <Checkbox
                id="anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(!!checked)}
                disabled={isSubmitting}
              />
              <Label htmlFor="anonymous" className="text-sm">
                Submit feedback anonymously
              </Label>
            </div>
          )}

          {form.questions.map((question, index) => (
            <Card key={question.id}>
              <CardHeader className="pb-4">
                <div className="flex items-start gap-2">
                  <CardTitle className="text-base leading-relaxed">
                    {index + 1}. {question.title}
                  </CardTitle>
                  {question.required && (
                    <Badge variant="secondary" className="text-xs">Required</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {renderQuestion(question)}
              </CardContent>
            </Card>
          ))}

          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={isSubmitting}
              className="flex-1"
            >
              <Send className="w-4 h-4 mr-2" />
              {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackFormView;