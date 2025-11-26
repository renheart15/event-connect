import React, { useState, useEffect } from 'react';
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

  // Debug logging
  console.log('🎨 [REGISTRATION MODAL] Component rendered with props:', {
    isOpen,
    eventId,
    eventTitle,
    isRequired,
    hasRegistrationForm: !!registrationForm,
    fields: registrationForm?.fields?.length
  });

  // Auto-fill name and email fields from logged-in user account
  useEffect(() => {
    if (isOpen && registrationForm?.fields) {
      const userData = localStorage.getItem('user');
      if (userData) {
        try {
          const user = JSON.parse(userData);
          const autoFilledData: Record<string, any> = {};

          // Split user's full name into first and last name
          const nameParts = user.name ? user.name.split(' ') : [];
          const firstName = nameParts[0] || '';
          const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

          registrationForm.fields.forEach(field => {
            const labelLower = field.label.toLowerCase();

            // Auto-fill first name field
            if ((labelLower.includes('first name') || labelLower === 'first name') &&
                field.type === 'text' &&
                firstName) {
              autoFilledData[field.id] = firstName;
              console.log(`✅ [AUTO-FILL] Pre-filling "${field.label}" with: ${firstName}`);
            }

            // Auto-fill last name field
            if ((labelLower.includes('last name') || labelLower === 'last name') &&
                field.type === 'text' &&
                lastName) {
              autoFilledData[field.id] = lastName;
              console.log(`✅ [AUTO-FILL] Pre-filling "${field.label}" with: ${lastName}`);
            }

            // Auto-fill full name field (fallback for forms that still use single name field)
            if ((labelLower.includes('full name') || (labelLower.includes('name') && !labelLower.includes('first') && !labelLower.includes('last'))) &&
                field.type === 'text' &&
                user.name &&
                !labelLower.includes('first') &&
                !labelLower.includes('last')) {
              autoFilledData[field.id] = user.name;
              console.log(`✅ [AUTO-FILL] Pre-filling "${field.label}" with: ${user.name}`);
            }

            // Auto-fill email field
            if ((labelLower.includes('email') || labelLower.includes('e-mail')) &&
                field.type === 'email' &&
                user.email) {
              autoFilledData[field.id] = user.email;
              console.log(`✅ [AUTO-FILL] Pre-filling "${field.label}" with: ${user.email}`);
            }
          });

          if (Object.keys(autoFilledData).length > 0) {
            setFormData(autoFilledData);
            console.log('✅ [AUTO-FILL] Form data initialized:', autoFilledData);
          }
        } catch (error) {
          console.error('❌ [AUTO-FILL] Error parsing user data:', error);
        }
      }
    }
  }, [isOpen, registrationForm]);

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
      console.log('📤 [REGISTRATION MODAL] Submitting registration:', {
        eventId,
        eventTitle,
        responses: formData,
        apiUrl: `${API_CONFIG.API_BASE}/registration-responses`
      });

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
      console.log('📥 [REGISTRATION MODAL] Registration response:', result);

      if (result.success) {
        // Check if this is a pending approval request
        if (result.requiresApproval) {
          toast({
            title: "Request Submitted",
            description: result.message || "Your access request has been submitted. The organizer will review and approve your request.",
            variant: "default",
          });
          onClose(); // Close the modal
        } else {
          toast({
            title: "Registration submitted",
            description: "Your registration has been submitted successfully. You can now join the event.",
            variant: "default",
          });
          onSubmitSuccess();
        }
      } else {
        // Show detailed validation errors if available
        let errorMessage = result.message || 'Registration submission failed';
        if (result.errors && Array.isArray(result.errors)) {
          const errorDetails = result.errors.map((e: any) => e.msg).join(', ');
          errorMessage = `${result.message}: ${errorDetails}`;
        }
        console.error('❌ [REGISTRATION MODAL] Submission failed:', {
          message: result.message,
          errors: result.errors
        });
        throw new Error(errorMessage);
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

  // Handle dialog open change - properly handle the boolean parameter from Dialog
  const handleOpenChange = (open: boolean) => {
    console.log('🔔 [REGISTRATION MODAL] Dialog onOpenChange called with:', open);
    console.log('🔔 [REGISTRATION MODAL] isRequired:', isRequired);

    // If dialog is being closed (open = false) and form is not required, call onClose
    if (!open && !isRequired) {
      console.log('🔔 [REGISTRATION MODAL] Calling onClose handler');
      onClose();
    } else if (!open && isRequired) {
      console.log('⚠️ [REGISTRATION MODAL] Close prevented - form is required');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
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