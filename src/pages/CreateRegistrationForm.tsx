import { useLocation, useParams } from 'react-router-dom';
import RegistrationFormBuilder from '@/components/RegistrationFormBuilder';

const CreateRegistrationForm = () => {
  const location = useLocation();
  const { eventId } = useParams();
  const { eventTitle } = location.state || {};

  if (!eventId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Missing Event Information</h1>
          <p className="text-gray-600">Unable to create registration form without event details.</p>
        </div>
      </div>
    );
  }

  return <RegistrationFormBuilder eventId={eventId} eventTitle={eventTitle} />;
};

export default CreateRegistrationForm;