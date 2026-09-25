import ConnectionStatus from '../common/ConnectionStatus';
import QRCodeCard from '../common/QRCodeCard';

const HostLobby = ({ quiz, participantCount, questions, onStart, onBack, onEnterPresentMode, onBackToDashboard }) => {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="w-full max-w-3xl">
        {/* Header */}
        <div className="text-center mb-6">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest mb-1">HOST CONTROL</p>
          <h1 className="text-3xl font-bold text-navy">{quiz.title}</h1>
          {quiz.description && <p className="text-muted mt-1">{quiz.description}</p>}
        </div>

        {/* Join Code + QR Code Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6 items-stretch">
          {/* Join Code Card */}
          <div className="card text-center bg-primary-600 text-white border-primary-600 flex flex-col justify-center p-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-primary-100 mb-2">
              ROOM CODE
            </p>
            <p
              className="text-6xl md:text-7xl font-bold tracking-widest font-mono my-2"
              aria-label={`Join code: ${quiz.code}`}
            >
              {quiz.code}
            </p>
            <p className="text-primary-100 text-sm mt-2">
              Join directly on phone at <strong className="text-white">/join</strong>
            </p>
          </div>

          {/* Scannable QR Code */}
          <QRCodeCard quizCode={quiz.code} size={150} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="card-sm text-center">
            <p className="text-3xl font-bold text-primary-600">{participantCount}</p>
            <p className="text-xs text-muted mt-1 font-medium">Participants</p>
          </div>
          <div className="card-sm text-center">
            <p className="text-3xl font-bold text-navy">{questions.length}</p>
            <p className="text-xs text-muted mt-1 font-medium">Questions</p>
          </div>
          <div className="card-sm text-center flex flex-col items-center justify-center">
            <ConnectionStatus />
            <p className="text-xs text-muted mt-1 font-medium">Status</p>
          </div>
        </div>

        {/* Presenter Mode and Projector link */}
        <div className="card-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 bg-indigo-50/70 border-indigo-100">
          <div>
            <p className="text-sm font-bold text-navy">Presentation View</p>
            <p className="text-xs text-muted">Run the quiz presentation right inside this screen or open on a projector</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button
              onClick={onEnterPresentMode}
              className="btn-primary btn-sm flex-1 sm:flex-none font-semibold bg-indigo-600 hover:bg-indigo-700"
            >
              📽️ Present Mode (This Screen)
            </button>
            <a
              href={`/display/${quiz.code}`}
              target="_blank"
              rel="noreferrer"
              id="btn-open-projector"
              className="btn-secondary btn-sm flex-1 sm:flex-none text-xs"
            >
              External Window ↗
            </a>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="btn-secondary flex-shrink-0"
              id="btn-lobby-dashboard"
            >
              🏠 Dashboard
            </button>
          )}
          <button
            onClick={onBack}
            className="btn-secondary flex-shrink-0"
          >
            ← Edit Questions
          </button>
          <button
            id="btn-start-quiz"
            onClick={onStart}
            disabled={participantCount === 0}
            className="btn-success btn-lg flex-1"
          >
            {participantCount === 0
              ? 'Waiting for participants…'
              : `Start Quiz with ${participantCount} participant${participantCount !== 1 ? 's' : ''}`}
          </button>
        </div>

        {participantCount === 0 && (
          <p className="text-center text-xs text-muted mt-3">
            The Start button will enable once participants join
          </p>
        )}
      </div>
    </div>
  );
};

export default HostLobby;
