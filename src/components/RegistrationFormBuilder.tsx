import RegistrationFormEditor from './RegistrationFormEditor';

interface RegistrationFormBuilderProps {
  eventId: string;
  eventTitle: string;
}

const RegistrationFormBuilder = ({ eventId, eventTitle }: RegistrationFormBuilderProps) => {
  return (
    <RegistrationFormEditor 
      formId="" 
      mode="create" 
      eventId={eventId} 
      eventTitle={eventTitle} 
    />
  );
};

export default RegistrationFormBuilder;