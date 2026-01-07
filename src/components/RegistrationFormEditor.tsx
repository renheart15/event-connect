import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { API_CONFIG } from '@/config';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import AddFieldSection from './RegistrationFormEditor/AddFieldSection';
import FormPreviewSection from './RegistrationFormEditor/FormPreviewSection';
import { FieldType, RegistrationField, NewField } from '@/types/registration';

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
      // Create mode - set default fields with permanent flag for name and email
      setFields([
        {
          id: '1',
          type: 'text',
          label: 'Full Name',
          placeholder: 'Enter your full name',
          required: true,
          isPermanent: true  // Cannot be deleted
        },
        {
          id: '2',
          type: 'email',
          label: 'Email Address',
          placeholder: 'Enter your email',
          required: true,
          isPermanent: true  // Cannot be deleted
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
      const response = await fetch(`${API_CONFIG.API_BASE}/registration-forms/${formId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const result = await response.json();
      
      if (result.success) {
        const form = result.data.registrationForm;
        // Mark full name and email fields as permanent
        const fieldsWithPermanent = form.fields.map((field: RegistrationField) => {
          // Check if this is the full name or email field
          const isNameField = field.type === 'text' &&
            (field.label.toLowerCase().includes('name') || field.label.toLowerCase().includes('full'));
          const isEmailField = field.type === 'email';

          return {
            ...field,
            isPermanent: isNameField || isEmailField
          };
        });
        setFields(fieldsWithPermanent);
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

    if ((newField.type === 'select' || newField.type === 'radio') && newField.options.filter(opt => opt.trim()).length === 0) {
      toast({
        title: "Options required",
        description: "Please add at least one option for dropdown and radio button fields",
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
      options: (newField.type === 'select' || newField.type === 'radio') ? newField.options.filter(opt => opt.trim()) : undefined
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
    // Check if the field is permanent
    const field = fields.find(f => f.id === fieldId);
    if (field?.isPermanent) {
      toast({
        title: "Cannot remove field",
        description: "Full Name and Email fields are required and cannot be removed.",
        variant: "destructive",
      });
      return;
    }

    setFields(prev => prev.filter(field => field.id !== fieldId));
    toast({
      title: "Field removed",
      description: "Field has been removed from the form",
    });
  };

  const toggleRequired = (fieldId: string) => {
    // Check if the field is permanent - permanent fields must stay required
    const field = fields.find(f => f.id === fieldId);
    if (field?.isPermanent) {
      toast({
        title: "Cannot modify requirement",
        description: "Full Name and Email fields must remain required.",
        variant: "destructive",
      });
      return;
    }

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
          type: field.type === 'radio' ? 'select' : field.type, // Map radio to select for backend compatibility
          label: field.label,
          placeholder: field.placeholder || '',
          required: field.required,
          options: field.options || []
        }))
      };

      const url = mode === 'edit'
        ? `${API_CONFIG.API_BASE}/registration-forms/${formId}`
        : `${API_CONFIG.API_BASE}/registration-forms`;
      
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

        // Navigate back to dashboard and refresh the page
        navigate('/organizer-dashboard');
        // Small delay to ensure navigation completes before refresh
        setTimeout(() => {
          window.location.reload();
        }, 100);
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
    // Small delay to ensure navigation completes before refresh
    setTimeout(() => {
      window.location.reload();
    }, 100);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-indigo-50/20 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {/* Header - scaled to 75% */}
      <header className="border-b border-border/60 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 lg:px-6">
          <div className="flex justify-between items-center h-14">
            <div className="space-y-0.5">
              <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                {mode === 'edit' ? 'Edit Registration Form' : 'Create Registration Form'}
              </h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                Event: <span className="font-semibold text-foreground">{currentEventTitle}</span>
              </p>
            </div>
            <Button
              variant="outline"
              onClick={cancelEdit}
              className="h-8 px-4 text-sm border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              disabled={saving}
            >
              {mode === 'edit' ? 'Cancel Changes' : 'Skip for Now'}
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content - scaled to 75% */}
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6">
        <div className="space-y-6">
          {/* Add Field Section - scaled to 75% */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm px-4 py-2 rounded-full border border-gray-200/60 dark:border-gray-700/60">
              <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
                <Plus className="h-3 w-3 text-white" />
              </div>
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Build Your Registration Form</span>
            </div>

            <Dialog open={isAddFieldModalOpen} onOpenChange={setIsAddFieldModalOpen}>
              <DialogTrigger asChild>
                <Button
                  className="h-10 px-6 text-sm font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={saving}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add New Field
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="text-base font-semibold">Add New Field</DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
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

          {/* Form Preview with enhanced styling */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-2xl"></div>
            <FormPreviewSection
              formTitle={`Registration for ${currentEventTitle}`}
              formDescription="Please fill out this form to register for the event."
              fields={fields}
              onRemoveField={removeField}
              onToggleRequired={toggleRequired}
            />
          </div>

          {/* Action Buttons - scaled to 75% */}
          <div className="flex flex-col sm:flex-row gap-3 max-w-xl mx-auto pt-4">
            <Button
              onClick={saveForm}
              className="flex-1 h-10 text-sm font-semibold bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg hover:shadow-xl transition-all duration-200"
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
              className="flex-1 h-10 text-sm border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
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
