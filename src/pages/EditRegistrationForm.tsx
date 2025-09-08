import { useParams, useLocation } from 'react-router-dom';
import RegistrationFormEditor from '@/components/RegistrationFormEditor';

const EditRegistrationForm = () => {
  const { formId } = useParams();
  const location = useLocation();
  const { eventId, eventTitle } = location.state || {};

  if (!formId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Form Not Found</h1>
          <p className="text-gray-600">Invalid registration form ID.</p>
        </div>
      </div>
    );
  }

  return (
    <RegistrationFormEditor 
      formId={formId} 
      mode="edit" 
      eventId={eventId} 
      eventTitle={eventTitle} 
    />
  );
};

export default EditRegistrationForm;