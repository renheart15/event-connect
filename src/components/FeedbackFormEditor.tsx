import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
import { 
  Plus, 
  Trash2, 
  GripVertical, 
  Type, 
  AlignLeft, 
  Star, 
  List, 
  Save,
  X
} from 'lucide-react';
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

interface FeedbackFormEditorProps {
  formId: string;
  eventId: string;
  eventTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onFormUpdated: () => void;
}

const questionTypeIcons = {
  text: Type,
  textarea: AlignLeft,
  rating: Star,
  'multiple-choice': List
};

const questionTypeLabels = {
  text: 'Short Text',
  textarea: 'Long Text',
  rating: 'Rating (1-5)',
  'multiple-choice': 'Multiple Choice'
};

const FeedbackFormEditor = ({ 
  formId, 
  eventId, 
  eventTitle, 
  isOpen, 
  onClose, 
  onFormUpdated 
}: FeedbackFormEditorProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<FeedbackForm | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allowAnonymous, setAllowAnonymous] = useState(false);

  useEffect(() => {
    if (isOpen && formId) {
      loadFeedbackForm();
    }
  }, [isOpen, formId]);

  const loadFeedbackForm = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/feedback-forms/${formId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      const result = await response.json();

      if (result.success) {
        const form = result.data.feedbackForm;
        setFormData(form);
        setTitle(form.title);
        setDescription(form.description || '');
        setQuestions(form.questions || []);
        setAllowAnonymous(form.allowAnonymous || false);
      } else {
        throw new Error(result.message || 'Failed to load feedback form');
      }
    } catch (error: any) {
      console.error('Error loading feedback form:', error);
      toast({
        title: "Load Failed",
        description: error.message || "Failed to load feedback form.",
        variant: "destructive",
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const generateQuestionId = () => {
    return `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const addQuestion = (type: Question['type']) => {
    const newQuestion: Question = {
      id: generateQuestionId(),
      type,
      title: '',
      required: false,
      ...(type === 'multiple-choice' && { options: [''] })
    };
    setQuestions([...questions, newQuestion]);
  };

  const updateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map(q => 
      q.id === id ? { ...q, ...updates } : q
    ));
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter(q => q.id !== id));
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    const newQuestions = [...questions];
    const [movedQuestion] = newQuestions.splice(fromIndex, 1);
    newQuestions.splice(toIndex, 0, movedQuestion);
    setQuestions(newQuestions);
  };

  const addOption = (questionId: string) => {
    updateQuestion(questionId, {
      options: [...(questions.find(q => q.id === questionId)?.options || []), '']
    });
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = questions.find(q => q.id === questionId);
    if (question && question.options) {
      const newOptions = [...question.options];
      newOptions[optionIndex] = value;
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const question = questions.find(q => q.id === questionId);
    if (question && question.options) {
      const newOptions = question.options.filter((_, index) => index !== optionIndex);
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const validateForm = () => {
    if (!title.trim()) {
      toast({
        title: "Validation Error",
        description: "Form title is required.",
        variant: "destructive",
      });
      return false;
    }

    if (questions.length === 0) {
      toast({
        title: "Validation Error",
        description: "At least one question is required.",
        variant: "destructive",
      });
      return false;
    }

    for (const question of questions) {
      if (!question.title.trim()) {
        toast({
          title: "Validation Error",
          description: "All questions must have a title.",
          variant: "destructive",
        });
        return false;
      }

      if (question.type === 'multiple-choice') {
        if (!question.options || question.options.length === 0 || 
            !question.options.some(opt => opt.trim())) {
          toast({
            title: "Validation Error",
            description: `Multiple choice question "${question.title}" must have at least one option.`,
            variant: "destructive",
          });
          return false;
        }
      }
    }

    return true;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      
      // Clean up questions before sending
      const cleanQuestions = questions.map(q => ({
        ...q,
        title: q.title.trim(),
        ...(q.type === 'multiple-choice' && {
          options: q.options?.filter(opt => opt.trim()).map(opt => opt.trim())
        })
      }));

      const response = await fetch(`/api/feedback-forms/${formId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          questions: cleanQuestions,
          allowAnonymous
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Form Updated",
          description: "Feedback form has been successfully updated.",
        });
        onFormUpdated();
      } else {
        throw new Error(result.message || 'Failed to update feedback form');
      }
    } catch (error: any) {
      console.error('Error updating feedback form:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update feedback form.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const renderQuestionEditor = (question: Question, index: number) => {
    const IconComponent = questionTypeIcons[question.type];

    return (
      <Card key={question.id} className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
              <IconComponent className="w-4 h-4" />
              <Select
                value={question.type}
                onValueChange={(value) => updateQuestion(question.id, { 
                  type: value as Question['type'],
                  ...(value === 'multiple-choice' && !question.options ? { options: [''] } : {}),
                  ...(value !== 'multiple-choice' ? { options: undefined } : {})
                })}
              >
                <SelectTrigger className="w-32 h-6 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <Type className="w-3 h-3" />
                      Short Text
                    </div>
                  </SelectItem>
                  <SelectItem value="textarea">
                    <div className="flex items-center gap-2">
                      <AlignLeft className="w-3 h-3" />
                      Long Text
                    </div>
                  </SelectItem>
                  <SelectItem value="rating">
                    <div className="flex items-center gap-2">
                      <Star className="w-3 h-3" />
                      Rating (1-5)
                    </div>
                  </SelectItem>
                  <SelectItem value="multiple-choice">
                    <div className="flex items-center gap-2">
                      <List className="w-3 h-3" />
                      Multiple Choice
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                Question {index + 1}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={`required-${question.id}`} className="text-xs">
                  Required
                </Label>
                <Switch
                  id={`required-${question.id}`}
                  checked={question.required}
                  onCheckedChange={(checked) => 
                    updateQuestion(question.id, { required: checked })
                  }
                />
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Question</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this question? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => removeQuestion(question.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label htmlFor={`title-${question.id}`}>Question Title</Label>
            <Input
              id={`title-${question.id}`}
              value={question.title}
              onChange={(e) => updateQuestion(question.id, { title: e.target.value })}
              placeholder="Enter your question..."
              className="mt-1"
            />
          </div>

          {question.type === 'multiple-choice' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label>Options</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addOption(question.id)}
                >
                  <Plus className="w-3 h-3 mr-1" />
                  Add Option
                </Button>
              </div>
              <div className="space-y-2">
                {question.options?.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <Input
                      value={option}
                      onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                      placeholder={`Option ${optionIndex + 1}`}
                    />
                    {question.options && question.options.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOption(question.id, optionIndex)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {question.type === 'rating' && (
            <div className="p-3 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                This will display as a 1-5 star rating scale for participants.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-2">Loading feedback form...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Edit Feedback Form - {eventTitle}</DialogTitle>
          <DialogDescription>
            Modify your feedback form to collect the insights you need from participants.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-6 pr-2">
            {/* Form Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Form Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="title">Form Title</Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter form title..."
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Switch
                      id="allowAnonymous"
                      checked={allowAnonymous}
                      onCheckedChange={setAllowAnonymous}
                    />
                    <Label htmlFor="allowAnonymous">Allow anonymous responses</Label>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Provide context or instructions for participants..."
                    rows={3}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Questions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Questions</CardTitle>
                  <Select onValueChange={(value) => addQuestion(value as Question['type'])}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Add Question" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">
                        <div className="flex items-center gap-2">
                          <Type className="w-4 h-4" />
                          Short Text
                        </div>
                      </SelectItem>
                      <SelectItem value="textarea">
                        <div className="flex items-center gap-2">
                          <AlignLeft className="w-4 h-4" />
                          Long Text
                        </div>
                      </SelectItem>
                      <SelectItem value="rating">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4" />
                          Rating (1-5)
                        </div>
                      </SelectItem>
                      <SelectItem value="multiple-choice">
                        <div className="flex items-center gap-2">
                          <List className="w-4 h-4" />
                          Multiple Choice
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {questions.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                      <List className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <p className="text-muted-foreground">
                      No questions yet. Add your first question using the dropdown above.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {questions.map((question, index) => 
                      renderQuestionEditor(question, index)
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between pt-6 border-t bg-background">
          <div className="text-sm text-muted-foreground">
            {questions.length} question{questions.length !== 1 ? 's' : ''} • 
            {questions.filter(q => q.required).length} required
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving || questions.length === 0}
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackFormEditor;