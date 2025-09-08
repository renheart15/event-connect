import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import AddFieldSection from './RegistrationFormEditor/AddFieldSection';
import FormPreviewSection from './RegistrationFormEditor/FormPreviewSection';

type FieldType = 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'checkbox';

interface RegistrationField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface RegistrationFormEditorProps {
  formId: string;
  mode: 'create' | 'edit';
  eventId?: string;
  eventTitle?: string;
}

const RegistrationFormEditor = ({ formId, mode, eventId, eventTitle }: RegistrationFormEditorProps) => {
  const navigate = useNavigate();
  const [fields, setFields] = useState<RegistrationField[]>([]);
  const [currentEventTitle, setCurrentEventTitle] = useState(eventTitle || '');
  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [isAddFieldModalOpen, setIsAddFieldModalOpen] = useState(false);

  const [newField, setNewField] = useState({
    type: 'text' as FieldType,
    label: '',
    placeholder: '',
    required: false,
    options: [] as string[]
  });

  // Load existing form data for editing
  useEffect(() => {
    if (mode === 'edit') {
      loadExistingForm();
    } else {
      // Create mode - set default fields
      setFields([
        {
          id: '1',
          type: 'text',
          label: 'Full Name',
          placeholder: 'Enter your full name',
          required: true
        },
        {
          id: '2',
          type: 'email',
          label: 'Email Address',
          placeholder: 'Enter your email',
          required: true
        },
        {
          id: '3',
          type: 'phone',
          label: 'Phone Number',
          placeholder: 'Enter your phone number',
          required: false
        }
      ]);
    }
  }, [formId, mode, eventTitle]);

  const loadExistingForm = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/registration-forms/${formId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        const form = result.data.registrationForm;
        setFields(form.fields);
        setCurrentEventTitle(form.event.title);
      } else {
        toast({
          title: "Error",
          description: result.message || "Failed to load registration form",
          variant: "destructive",
        });
        navigate('/organizer-dashboard');
      }
    } catch (error) {
      console.error('Error loading form:', error);
      toast({
        title: "Error",
        description: "Failed to load registration form",
        variant: "destructive",
      });
      navigate('/organizer-dashboard');
    } finally {
      setLoading(false);
    }
  };

  const addField = () => {
    if (!newField.label.trim()) {
      toast({
        title: "Field label required",
        description: "Please enter a label for the field",
        variant: "destructive",
      });
      return;
    }

    if (newField.type === 'select' && newField.options.filter(opt => opt.trim()).length === 0) {
      toast({
        title: "Options required",
        description: "Please add at least one option for dropdown fields",
        variant: "destructive",
      });
      return;
    }

    const field: RegistrationField = {
      id: Date.now().toString(),
      type: newField.type,
      label: newField.label.trim(),
      placeholder: newField.placeholder.trim() || undefined,
      required: newField.required,
      options: newField.type === 'select' ? newField.options.filter(opt => opt.trim()) : undefined
    };

    setFields(prev => [...prev, field]);
    setNewField({
      type: 'text',
      label: '',
      placeholder: '',
      required: false,
      options: []
    });
    setIsAddFieldModalOpen(false);

    toast({
      title: "Field added",
      description: `${field.label} field has been added to the form`,
    });
  };

  const removeField = (fieldId: string) => {
    setFields(prev => prev.filter(field => field.id !== fieldId));
    toast({
      title: "Field removed",
      description: "Field has been removed from the form",
    });
  };

  const toggleRequired = (fieldId: string) => {
    setFields(prev => prev.map(field => 
      field.id === fieldId 
        ? { ...field, required: !field.required }
        : field
    ));
  };

  const handleNewFieldChange = (updates: Partial<typeof newField>) => {
    setNewField(prev => ({ ...prev, ...updates }));
  };

  const handleOptionChange = (index: number, value: string) => {
    const newOptions = [...newField.options];
    newOptions[index] = value;
    setNewField(prev => ({ ...prev, options: newOptions }));
  };

  const addOption = () => {
    setNewField(prev => ({ ...prev, options: [...prev.options, ''] }));
  };

  const removeOption = (index: number) => {
    setNewField(prev => ({ 
      ...prev, 
      options: prev.options.filter((_, i) => i !== index) 
    }));
  };

  const saveForm = async () => {
    if (fields.length === 0) {
      toast({
        title: "No fields",
        description: "Please add at least one field to the form",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem('token');
      
      const formData = {
        title: `Registration for ${currentEventTitle}`,
        description: 'Please fill out this form to register for the event.',
        eventId: mode === 'create' ? eventId : undefined,
        fields: fields.map(field => ({
          id: field.id,
          type: field.type,
          label: field.label,
          placeholder: field.placeholder || '',
          required: field.required,
          options: field.options || []
        }))
      };

      const url = mode === 'edit' 
        ? `/api/registration-forms/${formId}` 
        : '/api/registration-forms';
      
      const method = mode === 'edit' ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: mode === 'edit' ? "Form updated!" : "Registration form created!",
          description: mode === 'edit' ? "Your changes have been saved" : "Participants can now register for your event",
        });

        // Navigate back to dashboard after successful save
        navigate('/organizer-dashboard');
      } else {
        throw new Error(result.message || 'Failed to save form');
      }
    } catch (error: any) {
      console.error('Error saving form:', error);
      toast({
        title: "Save failed",
        description: error.message || "Failed to save registration form",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    navigate('/organizer-dashboard');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading registration form...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-20">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-card-foreground">
                {mode === 'edit' ? 'Edit Registration Form' : 'Create Registration Form'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Event: <span className="font-medium">{currentEventTitle}</span>
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={cancelEdit} 
              className="h-10 px-6"
              disabled={saving}
            >
              {mode === 'edit' ? 'Cancel Changes' : 'Skip for Now'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Add Field Button */}
          <div className="flex justify-center">
            <Dialog open={isAddFieldModalOpen} onOpenChange={setIsAddFieldModalOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="h-12 px-8" disabled={saving}>
                  <Plus className="h-5 w-5 mr-3" />
                  Add Field to Form
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Field</DialogTitle>
                  <DialogDescription>
                    Create a custom registration field for your form
                  </DialogDescription>
                </DialogHeader>
                <AddFieldSection
                  newField={newField}
                  onFieldChange={handleNewFieldChange}
                  onAddField={addField}
                  onOptionChange={handleOptionChange}
                  onAddOption={addOption}
                  onRemoveOption={removeOption}
                />
              </DialogContent>
            </Dialog>
          </div>

          {/* Form Preview */}
          <FormPreviewSection
            formTitle={`Registration for ${currentEventTitle}`}
            formDescription="Please fill out this form to register for the event."
            fields={fields}
            onRemoveField={removeField}
            onToggleRequired={toggleRequired}
          />

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 max-w-2xl mx-auto">
            <Button 
              onClick={saveForm} 
              className="flex-1 h-12 text-base font-medium"
              size="lg"
              disabled={saving}
            >
              {saving 
                ? 'Saving...' 
                : mode === 'edit' 
                  ? 'Update Registration Form' 
                  : 'Create Registration Form'
              }
            </Button>
            <Button 
              variant="outline" 
              onClick={cancelEdit} 
              className="flex-1 h-12 text-base"
              size="lg"
              disabled={saving}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistrationFormEditor;