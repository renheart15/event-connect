import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Trash2, Save, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Question {
  id: string;
  type: 'text' | 'textarea' | 'rating' | 'multiple-choice';
  title: string;
  required: boolean;
  options?: string[];
}

interface FeedbackFormBuilderProps {
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onFormCreated?: (formId: string) => void;
}

const FeedbackFormBuilder = ({ eventId, eventTitle, isOpen, onClose, onFormCreated }: FeedbackFormBuilderProps) => {
  const { toast } = useToast();
  const [formTitle, setFormTitle] = useState(`${eventTitle} - Feedback Form`);
  const [formDescription, setFormDescription] = useState('We value your feedback! Please share your thoughts about the event.');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allowAnonymous, setAllowAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);

  // New question form state
  const [newQuestionTitle, setNewQuestionTitle] = useState('');
  const [newQuestionType, setNewQuestionType] = useState<Question['type']>('text');
  const [newQuestionOptions, setNewQuestionOptions] = useState('');
  const [newQuestionRequired, setNewQuestionRequired] = useState(false);

  const addQuestion = () => {
    if (!newQuestionTitle.trim()) {
      toast({
        title: "Question Title Required",
        description: "Please enter a title for the question.",
        variant: "destructive",
      });
      return;
    }

    if (newQuestionType === 'multiple-choice') {
      const options = newQuestionOptions.split('\n').filter(opt => opt.trim());
      if (options.length === 0) {
        toast({
          title: "Options Required",
          description: "Please add at least one option for multiple choice questions.",
          variant: "destructive",
        });
        return;
      }
    }

    const newQuestion: Question = {
      id: Date.now().toString(),
      type: newQuestionType,
      title: newQuestionTitle.trim(),
      required: newQuestionRequired,
      options: newQuestionType === 'multiple-choice' 
        ? newQuestionOptions.split('\n').filter(opt => opt.trim())
        : undefined
    };

    setQuestions([...questions, newQuestion]);
    
    // Reset form
    setNewQuestionTitle('');
    setNewQuestionOptions('');
    setNewQuestionRequired(false);
    setNewQuestionType('text');

    toast({
      title: "Question Added",
      description: "Question has been added to the feedback form.",
    });
  };

  const removeQuestion = (questionId: string) => {
    setQuestions(questions.filter(q => q.id !== questionId));
    toast({
      title: "Question Removed",
      description: "Question has been removed from the form.",
    });
  };

  const toggleRequired = (questionId: string) => {
    setQuestions(questions.map(q => 
      q.id === questionId ? { ...q, required: !q.required } : q
    ));
  };

  const saveDraft = async () => {
    if (!formTitle.trim()) {
      toast({
        title: "Form Title Required",
        description: "Please enter a title for your feedback form.",
        variant: "destructive",
      });
      return;
    }

    if (questions.length === 0) {
      toast({
        title: "No Questions",
        description: "Please add at least one question to your feedback form.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      
      const formData = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        eventId: eventId,
        questions: questions.map(q => ({
          id: q.id,
          type: q.type,
          title: q.title,
          required: q.required,
          options: q.options || []
        })),
        allowAnonymous
      };

      const response = await fetch('/api/feedback-forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Feedback Form Created!",
          description: "Your feedback form has been saved and is now live for participants.",
        });

        if (onFormCreated) {
          onFormCreated(result.data.feedbackForm._id);
        }
        
        onClose();
      } else {
        throw new Error(result.message || 'Failed to create feedback form');
      }
    } catch (error: any) {
      console.error('Error creating feedback form:', error);
      toast({
        title: "Creation Failed",
        description: error.message || "Failed to create feedback form. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const publishForm = () => {
    // Since we auto-publish, this is the same as save
    saveDraft();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Feedback Form - {eventTitle}</DialogTitle>
          <DialogDescription>
            Create and customize a feedback form for your event participants.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Form Details */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="form-title">Form Title</Label>
              <Input
                id="form-title"
                value={formTitle}
                onChange={(e) => setFormTitle(e.target.value)}
                placeholder="Event Feedback Form"
                disabled={saving}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="form-description">Description (Optional)</Label>
              <Textarea
                id="form-description"
                value={formDescription}
                onChange={(e) => setFormDescription(e.target.value)}
                placeholder="Please share your thoughts about the event..."
                rows={3}
                disabled={saving}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="allow-anonymous"
                checked={allowAnonymous}
                onCheckedChange={(checked) => setAllowAnonymous(!!checked)}
                disabled={saving}
              />
              <Label htmlFor="allow-anonymous" className="text-sm">
                Allow anonymous responses
              </Label>
            </div>
          </div>

          {/* Existing Questions */}
          {questions.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Questions ({questions.length})</h3>
              
              {questions.map((question, index) => (
                <Card key={question.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm">Question {index + 1}</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge variant={question.required ? "default" : "secondary"}>
                          {question.required ? "Required" : "Optional"}
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleRequired(question.id)}
                          disabled={saving}
                        >
                          Toggle Required
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => removeQuestion(question.id)}
                          className="text-destructive hover:text-destructive"
                          disabled={saving}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <p className="font-medium">{question.title}</p>
                      <Badge variant="outline">{question.type}</Badge>
                      {question.options && (
                        <div className="text-sm text-muted-foreground">
                          Options: {question.options.join(', ')}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Add New Question */}
          <Card className="border-dashed">
            <CardHeader>
              <CardTitle className="text-sm">Add New Question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="question-title">Question</Label>
                <Input
                  id="question-title"
                  value={newQuestionTitle}
                  onChange={(e) => setNewQuestionTitle(e.target.value)}
                  placeholder="What did you think of the event?"
                  disabled={saving}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="question-type">Question Type</Label>
                  <Select 
                    value={newQuestionType} 
                    onValueChange={(value) => setNewQuestionType(value as Question['type'])}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Short Text</SelectItem>
                      <SelectItem value="textarea">Long Text</SelectItem>
                      <SelectItem value="rating">Rating (1-5)</SelectItem>
                      <SelectItem value="multiple-choice">Multiple Choice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Settings</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="new-question-required"
                      checked={newQuestionRequired}
                      onCheckedChange={(checked) => setNewQuestionRequired(!!checked)}
                      disabled={saving}
                    />
                    <Label htmlFor="new-question-required" className="text-sm">
                      Required
                    </Label>
                  </div>
                </div>
              </div>

              {newQuestionType === 'multiple-choice' && (
                <div className="space-y-2">
                  <Label htmlFor="question-options">Options (one per line)</Label>
                  <Textarea
                    id="question-options"
                    value={newQuestionOptions}
                    onChange={(e) => setNewQuestionOptions(e.target.value)}
                    placeholder="Excellent&#10;Good&#10;Average&#10;Poor"
                    rows={4}
                    disabled={saving}
                  />
                </div>
              )}

              <Button onClick={addQuestion} className="w-full" disabled={saving}>
                <Plus className="w-4 h-4 mr-2" />
                Add Question
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={publishForm} className="flex-1" disabled={saving}>
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Form...
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4 mr-2" />
                  Create & Publish Form
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackFormBuilder;