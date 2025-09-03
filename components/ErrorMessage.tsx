
import React from 'react';
import { AlertCircleIcon } from './Icons';

interface ErrorMessageProps {
  message: string;
  onRetry: () => void;
}

const ErrorMessage: React.FC<ErrorMessageProps> = ({ message, onRetry }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
        <div className="bg-red-900/30 border border-red-500/50 p-6 rounded-lg max-w-lg">
            <div className="flex flex-col items-center">
                <AlertCircleIcon className="h-12 w-12 text-red-400 mb-4" />
                <h3 className="text-xl font-semibold text-red-300 mb-2">Analysis Failed</h3>
                <p className="text-red-200 mb-6">{message}</p>
                <button
                onClick={onRetry}
                className="px-6 py-2 font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                >
                Try Again
                </button>
            </div>
        </div>
    </div>
  );
};

export default ErrorMessage;
