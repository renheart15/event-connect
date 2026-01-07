import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';
import { FieldType, RegistrationField } from '@/types/registration';

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
    <Card className="border-0 shadow-xl bg-white/95 dark:bg-gray-900/95 backdrop-blur-sm">
      <CardHeader className="pb-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 rounded-t-lg border-b border-gray-100 dark:border-gray-800">
        <CardTitle className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <div className="w-2 h-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full"></div>
          Form Preview
        </CardTitle>
        <CardDescription className="text-xs text-gray-600 dark:text-gray-400">
          Live preview of how your registration form will appear to participants
        </CardDescription>
      </CardHeader>
      <CardContent className="p-5">
        <div className="space-y-5 p-5 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl bg-gradient-to-br from-gray-50/50 to-blue-50/30 dark:from-gray-800/50 dark:to-blue-900/10">
          {/* Form Header - scaled to 75% */}
          <div className="space-y-2 pb-4 border-b-2 border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {formTitle || 'Untitled Form'}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {formDescription || 'No description provided'}
            </p>
          </div>
          
          {/* Form Fields - scaled to 75% */}
          <div className="space-y-4">
            {fields.length === 0 ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-12 h-12 bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-full flex items-center justify-center mx-auto">
                  <Plus className="w-6 h-6 text-blue-500 dark:text-blue-400" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">No fields added yet</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Click "Add New Field" above to start building your registration form
                  </p>
                </div>
              </div>
            ) : (
              fields.map((field) => (
                <div key={field.id} className="group space-y-3 p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200">
                  {/* Field Header - scaled to 75% */}
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                      {field.label}
                      {field.required && (
                        <span className="text-red-500 text-xs font-bold">*</span>
                      )}
                      {field.isPermanent && (
                        <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded-full font-medium">
                          Required
                        </span>
                      )}
                    </Label>
                    {!field.isPermanent && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onRemoveField(field.id)}
                        className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all duration-200"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Field Input - scaled to 75% */}
                  <div className="space-y-3">
                    {field.type === 'textarea' ? (
                      <Textarea
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        disabled
                        className="h-18 resize-none bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    ) : field.type === 'select' ? (
                      <Select disabled>
                        <SelectTrigger className="h-9 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 text-sm">
                          <SelectValue placeholder={field.placeholder || 'Select an option'} />
                        </SelectTrigger>
                      </Select>
                    ) : field.type === 'radio' ? (
                      <RadioGroup disabled className="space-y-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                        {field.options?.map((option, index) => (
                          <div key={index} className="flex items-center space-x-2">
                            <RadioGroupItem value={option} className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                            <Label className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                              {option}
                            </Label>
                          </div>
                        ))}
                      </RadioGroup>
                    ) : field.type === 'checkbox' ? (
                      <div className="flex items-center space-x-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-600">
                        <Checkbox disabled className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                        <Label className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                          {field.placeholder || field.label}
                        </Label>
                      </div>
                    ) : (
                      <Input
                        type={field.type}
                        placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                        disabled
                        className="h-9 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-600 focus:border-blue-500 focus:ring-blue-500 text-sm"
                      />
                    )}

                    {/* Field Settings - scaled to 75% */}
                    <div className="flex items-center gap-3 pt-1.5 pb-0.5 border-t border-gray-100 dark:border-gray-700">
                      {!field.isPermanent && (
                        <div className="flex items-center space-x-1.5">
                          <Checkbox
                            checked={field.required}
                            onCheckedChange={() => onToggleRequired(field.id)}
                            className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500 h-3.5 w-3.5"
                          />
                          <Label className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer font-medium">
                            Required field
                          </Label>
                        </div>
                      )}
                      {field.isPermanent && (
                        <div className="flex items-center space-x-1.5 text-xs text-gray-500 dark:text-gray-400 italic">
                          <span>✓ This field is always required</span>
                        </div>
                      )}
                      <div className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded-md font-mono">
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
