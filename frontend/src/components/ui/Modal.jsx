// src/components/ui/Modal.jsx

const Modal = ({ title, onClose, children, wide }) => (
  <div
    className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
    onClick={(e) => e.target === e.currentTarget && onClose()}
  >
    <div
      className={`bg-white rounded-2xl shadow-2xl w-full ${
        wide ? "max-w-2xl" : "max-w-lg"
      } max-h-[90vh] overflow-y-auto`}
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white rounded-t-2xl z-10">
        <h3 className="text-lg font-black text-gray-900">{title}</h3>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400"
        >
          ✕
        </button>
      </div>

      <div className="px-6 py-5">{children}</div>
    </div>
  </div>
);

export default Modal;