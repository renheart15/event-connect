export type FieldType = 'text' | 'email' | 'phone' | 'number' | 'textarea' | 'select' | 'radio' | 'checkbox';

export interface RegistrationField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
  isPermanent?: boolean;  // Flag to mark non-deletable fields
}

export interface NewField {
  type: FieldType;
  label: string;
  placeholder: string;
  required: boolean;
  options: string[];
}
