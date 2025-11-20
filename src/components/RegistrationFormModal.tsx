import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { API_CONFIG } from '@/config';

interface RegistrationField {
  id: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'checkbox';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface RegistrationForm {
  _id: string;
  title: string;
  description?: string;
  fields: RegistrationField[];
}

interface RegistrationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  eventId: string;
  eventTitle: string;
  registrationForm: RegistrationForm;
  onSubmitSuccess: () => void;
  token: string;
  isRequired?: boolean; // If true, modal cannot be dismissed until form is submitted
}

export default function RegistrationFormModal({
  isOpen,
  onClose,
  eventId,
  eventTitle,
  registrationForm,
  onSubmitSuccess,
  token,
  isRequired = false
}: RegistrationFormModalProps) {
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleInputChange = (fieldId: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Validate required fields
      const requiredFields = registrationForm.fields.filter(field => field.required);
      const missingFields = requiredFields.filter(field => !formData[field.id] || formData[field.id].toString().trim() === '');

      if (missingFields.length > 0) {
        toast({
          title: "Missing required fields",
          description: `Please fill in: ${missingFields.map(f => f.label).join(', ')}`,
          variant: "destructive",
        });
        return;
      }

      // Submit registration form
      const response = await fetch(`${API_CONFIG.API_BASE}/registration-responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          eventId,
          responses: formData
        })
      });

      const result = await response.json();

      if (result.success) {
        toast({
          title: "Registration submitted",
          description: "Your registration has been submitted successfully. You can now join the event.",
          variant: "default",
        });
        onSubmitSuccess();
      } else {
        throw new Error(result.message || 'Registration submission failed');
      }
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderField = (field: RegistrationField) => {
    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
      case 'number':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Input
              id={field.id}
              type={field.type}
              placeholder={field.placeholder}
              value={formData[field.id] || ''}
              onChange={(e) => handleInputChange(field.id, e.target.value)}
              required={field.required}
            />
          </div>
        );

      case 'textarea':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Textarea
              id={field.id}
              placeholder={field.placeholder}
              value={formData[field.id] || ''}
              onChange={(e) => handleInputChange(field.id, e.target.value)}
              required={field.required}
            />
          </div>
        );

      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <Label htmlFor={field.id}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
            <Select
              value={formData[field.id] || ''}
              onValueChange={(value) => handleInputChange(field.id, value)}
              required={field.required}
            >
              <SelectTrigger>
                <SelectValue placeholder={field.placeholder || 'Select an option'} />
              </SelectTrigger>
              <SelectContent>
                {field.options?.map((option, index) => (
                  <SelectItem key={index} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );

      case 'checkbox':
        return (
          <div key={field.id} className="flex items-center space-x-2">
            <Checkbox
              id={field.id}
              checked={formData[field.id] || false}
              onCheckedChange={(checked) => handleInputChange(field.id, checked)}
              required={field.required}
            />
            <Label htmlFor={field.id}>
              {field.label} {field.required && <span className="text-red-500">*</span>}
            </Label>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={isRequired ? undefined : onClose}>
      <DialogContent
        className="max-w-2xl max-h-[80vh] overflow-y-auto"
        onInteractOutside={(e) => {
          // Prevent closing when clicking outside if form is required
          if (isRequired) {
            e.preventDefault();
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with ESC key if form is required
          if (isRequired) {
            e.preventDefault();
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{registrationForm.title}</DialogTitle>
          <DialogDescription>
            {isRequired ? (
              <span className="text-amber-600 dark:text-amber-400 font-medium">
                This registration form is required to complete your registration for "{eventTitle}"
              </span>
            ) : (
              `Please complete this registration form to join "${eventTitle}"`
            )}
            {registrationForm.description && (
              <div className="mt-2 text-sm text-muted-foreground">
                {registrationForm.description}
              </div>
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {registrationForm.fields.map(field => renderField(field))}

          <DialogFooter>
            {!isRequired && (
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting}
              className={isRequired ? 'w-full' : ''}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Registration'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}