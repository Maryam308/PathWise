const DeleteConfirm = ({ goal, onConfirm, onClose }) => (
   <Modal title="Delete Goal" onClose={onClose}>
     <p className="text-gray-600 mb-2">
       Are you sure you want to delete <strong className="text-gray-900">"{goal.name}"</strong>?
     </p>
     <p className="text-gray-400 text-sm mb-6">This will also remove it from your monthly savings commitment. This cannot be undone.</p>
     <div className="flex gap-3">
       <button onClick={onClose}
         className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-colors">
         Cancel
       </button>
       <button onClick={onConfirm}
         className="flex-1 py-2.5 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors">
         Delete
       </button>
     </div>
   </Modal>
 );

export default DeleteConfirm;