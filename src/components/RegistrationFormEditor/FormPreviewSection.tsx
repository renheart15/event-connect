import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';

type FieldType = 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'checkbox';

interface RegistrationField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface FormPreviewSectionProps {
  formTitle: string;
  formDescription: string;
  fields: RegistrationField[];
  onRemoveField: (fieldId: string) => void;
  onToggleRequired: (fieldId: string) => void;
}

const FormPreviewSection = ({
  formTitle,
  formDescription,
  fields,
  onRemoveField,
  onToggleRequired
}: FormPreviewSectionProps) => {
  return (
    <Card className="border border-border bg-card">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold text-card-foreground">Form Preview</CardTitle>
        <CardDescription className="text-sm text-muted-foreground">
          Live preview of how your registration form will appear
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6 p-6 border border-border rounded-lg bg-background/50">
          {/* Form Header */}
          <div className="space-y-2 pb-4 border-b border-border">
            <h3 className="text-xl font-semibold text-foreground">
              {formTitle || 'Untitled Form'}
            </h3>
            <p className="text-sm text-muted-foreground">
              {formDescription || 'No description provided'}
            </p>
          </div>
          
          {/* Form Fields */}
          <div className="space-y-6">
            {fields.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No fields added yet</p>
                <p className="text-sm text-muted-foreground">
                  Add fields using the form builder on the left
                </p>
              </div>
            ) : (
              fields.map((field) => (
                <div key={field.id} className="space-y-3 p-4 bg-card rounded-lg border border-border">
                  {/* Field Header */}
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                      {field.label}
                      {field.required && (
                        <span className="text-destructive text-xs">*</span>
                      )}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveField(field.id)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Field Input */}
                  <div className="space-y-3">
                    {field.type === 'textarea' ? (
                      <Textarea 
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        disabled 
                        className="h-20 resize-none"
                      />
                    ) : field.type === 'select' ? (
                      <Select disabled>
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder={field.placeholder || 'Select an option'} />
                        </SelectTrigger>
                      </Select>
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center space-x-3">
                        <Checkbox disabled />
                        <Label className="text-sm text-muted-foreground">
                          {field.placeholder || field.label}
                        </Label>
                      </div>
                    ) : (
                      <Input 
                        type={field.type}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        disabled 
                        className="h-10"
                      />
                    )}
                    
                    {/* Field Settings */}
                    <div className="flex items-center gap-3 pt-1">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={field.required}
                          onCheckedChange={() => onToggleRequired(field.id)}
                        />
                        <Label className="text-xs text-muted-foreground cursor-pointer">
                          Required
                        </Label>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Type: {field.type}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default FormPreviewSection;