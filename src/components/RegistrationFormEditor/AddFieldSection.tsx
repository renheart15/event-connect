import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Trash2, Plus } from 'lucide-react';

type FieldType = 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'checkbox';

interface NewField {
  type: FieldType;
  label: string;
  placeholder: string;
  required: boolean;
  options: string[];
}

interface AddFieldSectionProps {
  newField: NewField;
  onFieldChange: (field: Partial<NewField>) => void;
  onAddField: () => void;
  onOptionChange: (index: number, value: string) => void;
  onAddOption: () => void;
  onRemoveOption: (index: number) => void;
}

const fieldTypes = [
  { value: 'text', label: 'Text Input' },
  { value: 'email', label: 'Email' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'number', label: 'Number' },
  { value: 'textarea', label: 'Long Text' },
  { value: 'select', label: 'Dropdown' },
  { value: 'checkbox', label: 'Checkbox' }
];

const AddFieldSection = ({
  newField,
  onFieldChange,
  onAddField,
  onOptionChange,
  onAddOption,
  onRemoveOption
}: AddFieldSectionProps) => {
  return (
    <div className="space-y-6 p-2">
      <div className="space-y-3">
        <Label className="text-sm font-medium text-card-foreground">Field Type</Label>
        <Select 
          value={newField.type} 
          onValueChange={(value: FieldType) => onFieldChange({ type: value })}
        >
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {fieldTypes.map(type => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium text-card-foreground">Field Label</Label>
        <Input
          value={newField.label}
          onChange={(e) => onFieldChange({ label: e.target.value })}
          placeholder="e.g., Full Name, Organization..."
          className="h-10"
        />
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium text-card-foreground">
          Placeholder Text <span className="text-muted-foreground">(Optional)</span>
        </Label>
        <Input
          value={newField.placeholder}
          onChange={(e) => onFieldChange({ placeholder: e.target.value })}
          placeholder="Hint text for participants..."
          className="h-10"
        />
      </div>

      {newField.type === 'select' && (
        <div className="space-y-3">
          <Label className="text-sm font-medium text-card-foreground">Options</Label>
          <div className="space-y-2">
            {newField.options.map((option, index) => (
              <div key={index} className="flex gap-2">
                <Input
                  value={option}
                  onChange={(e) => onOptionChange(index, e.target.value)}
                  placeholder={`Option ${index + 1}`}
                  className="h-9"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onRemoveOption(index)}
                  className="h-9 w-9 p-0"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              onClick={onAddOption}
              className="w-full h-9"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Option
            </Button>
          </div>
        </div>
      )}

      <div className="flex items-center space-x-3 pt-2">
        <Checkbox
          id="required"
          checked={newField.required}
          onCheckedChange={(checked) => onFieldChange({ required: !!checked })}
        />
        <Label htmlFor="required" className="text-sm font-medium text-card-foreground cursor-pointer">
          Required field
        </Label>
      </div>

      <Button onClick={onAddField} className="w-full h-10">
        <Plus className="h-4 w-4 mr-2" />
        Add Field
      </Button>
    </div>
  );
};

export default AddFieldSection;