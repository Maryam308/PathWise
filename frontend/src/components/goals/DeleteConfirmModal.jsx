/**
 * DeleteConfirmModal
 *
 * Extracted from GoalsPage to keep it focused.
 * Shown when the user clicks the delete button on a GoalCard.
 */

import { Spinner } from "../ui/primitives.jsx";

const DeleteConfirmModal = ({ onConfirm, onCancel, loading }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
    <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
      <div className="w-12 h-12 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14H6L5 6"/>
          <path d="M10 11v6M14 11v6"/>
        </svg>
      </div>
      <h3 className="text-lg font-black text-gray-900 text-center mb-1">Delete goal?</h3>
      <p className="text-sm text-gray-400 text-center mb-6">
        This action cannot be undone. All progress will be lost.
      </p>
      <div className="flex gap-3">
        <button onClick={onCancel}
          className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 text-sm transition-colors">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={loading}
          className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 disabled:bg-gray-200 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2">
          {loading ? <><Spinner size="sm" color="white" /> Deleting…</> : "Delete"}
        </button>
      </div>
    </div>
  </div>
);

export default DeleteConfirmModal;