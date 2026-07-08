import React from 'react';
import Modal from '@/components/ui/Modal';
import { Lock } from 'lucide-react';

export default function PaymentModal({ onClose, document }) {
  return (
    <Modal isOpen={true} onClose={onClose} title="Payment Required">
      <div className="p-4 text-center">
        <div className="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
          <Lock className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-bold text-gray-800 mb-2">Download Blocked</h3>
        <p className="text-xs text-gray-500 mb-4">
          You cannot download <strong>{document?.originalName || 'this file'}</strong> because it has been blocked. Please complete the pending payments to access this file.
        </p>
        <button 
          onClick={onClose} 
          className="w-full py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-xs hover:bg-blue-700 transition"
        >
          Understood
        </button>
      </div>
    </Modal>
  );
}
