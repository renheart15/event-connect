import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';

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
    <Card className="border-0 shadow-2xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
      <CardHeader className="pb-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-t-lg border-b border-gray-100 dark:border-gray-800">
        <CardTitle className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <div className="w-3 h-3 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
          Form Preview
        </CardTitle>
        <CardDescription className="text-sm text-gray-600 dark:text-gray-400">
          Live preview of how your registration form will appear to participants
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <div className="space-y-8 p-8 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gradient-to-br from-gray-50/50 to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/10">
          {/* Form Header */}
          <div className="space-y-3 pb-6 border-b-2 border-gray-200 dark:border-gray-700">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
              {formTitle || 'Untitled Form'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {formDescription || 'No description provided'}
            </p>
          </div>
          
          {/* Form Fields */}
          <div className="space-y-6">
            {fields.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full flex items-center justify-center mx-auto">
                  <Plus className="w-8 h-8 text-blue-500 dark:text-blue-400" />
                </div>
                <div className="space-y-2">
                  <p className="text-lg font-medium text-gray-700 dark:text-gray-300">No fields added yet</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Click "Add New Field" above to start building your registration form
                  </p>
                </div>
              </div>
            ) : (
              fields.map((field) => (
                <div key={field.id} className="group space-y-4 p-6 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200">
                  {/* Field Header */}
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
                      {field.label}
                      {field.required && (
                        <span className="text-red-500 text-sm font-bold">*</span>
                      )}
                    </Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveField(field.id)}
                      className="h-9 w-9 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all duration-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  {/* Field Input */}
                  <div className="space-y-4">
                    {field.type === 'textarea' ? (
                      <Textarea
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        disabled
                        className="h-24 resize-none bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500"
                      />
                    ) : field.type === 'select' ? (
                      <Select disabled>
                        <SelectTrigger className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600">
                          <SelectValue placeholder={field.placeholder || 'Select an option'} />
                        </SelectTrigger>
                      </Select>
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                        <Checkbox disabled className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                        <Label className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                          {field.placeholder || field.label}
                        </Label>
                      </div>
                    ) : (
                      <Input
                        type={field.type}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        disabled
                        className="h-12 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 text-base"
                      />
                    )}

                    {/* Field Settings */}
                    <div className="flex items-center gap-4 pt-2 pb-1 border-t border-gray-100 dark:border-gray-700">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={field.required}
                          onCheckedChange={() => onToggleRequired(field.id)}
                          className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                        />
                        <Label className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer font-medium">
                          Required field
                        </Label>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md font-mono">
                        {field.type}
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