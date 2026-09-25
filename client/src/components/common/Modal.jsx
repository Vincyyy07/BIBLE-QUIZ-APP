const Modal = ({ open, title, children, onClose, danger = false }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <h2 id="modal-title" className={`text-lg font-semibold mb-3 ${danger ? 'text-danger' : 'text-navy'}`}>
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
};

export default Modal;
