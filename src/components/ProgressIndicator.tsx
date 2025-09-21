import React from 'react';

interface ProgressIndicatorProps {
  label: string;
  isLoading: boolean;
  className?: string;
}

const ProgressIndicator: React.FC<ProgressIndicatorProps> = ({
  label,
  isLoading,
  className = ''
}) => {
  if (!isLoading) return null;

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      <div className="flex flex-col items-center space-y-2">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="text-sm text-gray-600">{label}</span>
      </div>
    </div>
  );
};

export default ProgressIndicator;