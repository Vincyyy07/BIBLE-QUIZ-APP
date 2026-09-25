import { useState } from 'react';
import Modal from '../common/Modal';
import { useAuth } from '../../context/AuthContext';

const statusBadge = (status) => {
  switch (status) {
    case 'LIVE':
      return (
        <span className="badge badge-green flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
          LIVE
        </span>
      );
    case 'WAITING':
      return <span className="badge badge-blue">WAITING</span>;
    case 'COMPLETED':
      return <span className="badge bg-purple-100 text-purple-700">COMPLETED</span>;
    case 'DRAFT':
    default:
      return <span className="badge badge-yellow">DRAFT</span>;
  }
};

const QuizDashboard = ({
  quizzes = [],
  loading = false,
  onSelectQuiz,
  onCreateQuiz,
  onDeleteQuiz,
  onDuplicateQuiz,
  onResetQuiz,
  creating = false,
}) => {
  const { user, logout } = useAuth();
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState('');

  const filteredQuizzes = quizzes.filter(
    (q) =>
      q.title.toLowerCase().includes(search.toLowerCase()) ||
      q.code?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onCreateQuiz({ title: newTitle.trim(), description: newDesc.trim() });
    setNewTitle('');
    setNewDesc('');
    setShowCreateModal(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setActionLoading('delete');
    try {
      await onDeleteQuiz(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setActionLoading('');
    }
  };

  const handleConfirmReset = async () => {
    if (!resetTarget) return;
    setActionLoading('reset');
    try {
      await onResetQuiz(resetTarget.id);
      setResetTarget(null);
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Top Header */}
      <header className="bg-white border-b border-border sticky top-0 z-20 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow">
              <span className="text-white text-xl font-black">✝</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-navy leading-tight">Quiz Dashboard</h1>
              <p className="text-xs text-muted">Manage, edit, and host all your church Bible quizzes</p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
            <button
              id="btn-create-quiz-dash"
              onClick={() => setShowCreateModal(true)}
              className="btn-primary flex items-center gap-2 shadow font-bold text-sm"
            >
              <span>+</span> Create New Quiz
            </button>

            {user && (
              <div className="flex items-center gap-3 pl-3 sm:border-l sm:border-border">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-bold text-navy leading-tight">{user.name}</p>
                  <p className="text-[11px] text-muted truncate max-w-[150px]">{user.email}</p>
                </div>
                <button
                  id="btn-host-logout"
                  onClick={logout}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition"
                  title="Sign out of host account"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Metric Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Total Quizzes</p>
              <p className="text-2xl font-bold text-navy mt-0.5">{quizzes.length}</p>
            </div>
            <span className="text-3xl opacity-60">📚</span>
          </div>
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Ready / Waiting</p>
              <p className="text-2xl font-bold text-primary-600 mt-0.5">
                {quizzes.filter((q) => q.status === 'WAITING' || q.status === 'LIVE').length}
              </p>
            </div>
            <span className="text-3xl opacity-60">🚀</span>
          </div>
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Drafts</p>
              <p className="text-2xl font-bold text-amber-600 mt-0.5">
                {quizzes.filter((q) => q.status === 'DRAFT').length}
              </p>
            </div>
            <span className="text-3xl opacity-60">✏️</span>
          </div>
          <div className="card p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Completed</p>
              <p className="text-2xl font-bold text-purple-600 mt-0.5">
                {quizzes.filter((q) => q.status === 'COMPLETED').length}
              </p>
            </div>
            <span className="text-3xl opacity-60">🏆</span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="relative w-full sm:w-80">
            <input
              type="text"
              placeholder="Search by title or code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-9 text-sm"
            />
            <span className="absolute left-3 top-2.5 text-muted text-sm">🔍</span>
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-2 text-muted hover:text-navy text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <p className="text-xs text-muted self-end sm:self-center">
            Showing {filteredQuizzes.length} of {quizzes.length} quizzes
          </p>
        </div>

        {/* Quiz Cards List */}
        {loading ? (
          <div className="card text-center py-16">
            <div className="text-4xl animate-bounce mb-3">⏳</div>
            <p className="text-muted text-sm font-medium">Loading your quizzes...</p>
          </div>
        ) : filteredQuizzes.length === 0 ? (
          <div className="card text-center py-16 border-dashed border-2">
            <div className="text-5xl mb-4">📖</div>
            <h3 className="text-lg font-bold text-navy mb-1">
              {search ? 'No quizzes match your search' : 'No quizzes created yet'}
            </h3>
            <p className="text-muted text-sm max-w-md mx-auto mb-6">
              {search
                ? 'Try searching with a different keyword or clear the search field.'
                : 'Create your first interactive Bible quiz now! Add questions, host live, and project on the big screen.'}
            </p>
            {!search && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary font-semibold shadow"
              >
                + Create Your First Quiz
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredQuizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="bg-white rounded-2xl border border-border hover:border-primary-300 hover:shadow-lg transition-all duration-200 flex flex-col justify-between overflow-hidden group"
              >
                {/* Card Header */}
                <div className="p-5 border-b border-border/60">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 tracking-wider">
                      CODE: {quiz.code}
                    </span>
                    {statusBadge(quiz.status)}
                  </div>
                  <h3 className="text-lg font-bold text-navy leading-snug line-clamp-1 group-hover:text-primary-600 transition-colors">
                    {quiz.title}
                  </h3>
                  {quiz.description ? (
                    <p className="text-xs text-muted mt-1 line-clamp-2">{quiz.description}</p>
                  ) : (
                    <p className="text-xs text-slate-400 italic mt-1">No description provided</p>
                  )}
                </div>

                {/* Card Stats */}
                <div className="px-5 py-3 bg-slate-50/60 flex items-center justify-between text-xs text-muted border-b border-border/60">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span>❓</span> {quiz.question_count || 0} Questions
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span>🎯</span> {(quiz.question_count || 0) * 10} Total Pts
                  </span>
                  <span className="text-slate-400">
                    {new Date(quiz.created_at).toLocaleDateString()}
                  </span>
                </div>

                {/* Card Action Buttons */}
                <div className="p-4 bg-white flex flex-col gap-2">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Primary Action: Host / Start */}
                    <button
                      onClick={() => onSelectQuiz(quiz, 'lobby')}
                      className="btn-primary btn-sm flex items-center justify-center gap-1.5 font-semibold shadow-sm"
                      title="Open Lobby to host or present this quiz"
                    >
                      <span>🚀</span> Start / Host
                    </button>

                    {/* Edit Questions */}
                    <button
                      onClick={() => onSelectQuiz(quiz, 'setup')}
                      className="btn-secondary btn-sm flex items-center justify-center gap-1.5 font-semibold"
                      title="Edit questions and answers"
                    >
                      <span>✏️</span> Edit Quiz
                    </button>
                  </div>

                  {/* Secondary Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50 text-xs">
                    <div className="flex gap-2">
                      {/* Results button */}
                      <button
                        onClick={() => onSelectQuiz(quiz, 'results')}
                        className="text-primary-600 hover:text-primary-800 font-semibold flex items-center gap-1 py-1"
                        title="View final rankings & accuracy"
                      >
                        <span>📊</span> Results
                      </button>

                      {/* Reset for replay */}
                      <button
                        onClick={() => setResetTarget(quiz)}
                        className="text-slate-600 hover:text-navy font-semibold flex items-center gap-1 py-1"
                        title="Clear previous players and scores so you can replay this quiz"
                      >
                        <span>🔄</span> Replay
                      </button>

                      {/* Duplicate */}
                      <button
                        onClick={() => onDuplicateQuiz(quiz.id)}
                        className="text-slate-600 hover:text-navy font-semibold flex items-center gap-1 py-1"
                        title="Create a copy of this quiz"
                      >
                        <span>📋</span> Copy
                      </button>
                    </div>

                    {/* Delete */}
                    <button
                      onClick={() => setDeleteTarget(quiz)}
                      className="text-danger hover:text-red-700 font-semibold p-1 rounded hover:bg-red-50"
                      title="Delete quiz"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Quiz Modal */}
      <Modal
        open={showCreateModal}
        title="Create New Bible Quiz"
        onClose={() => setShowCreateModal(false)}
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="modal-quiz-title">
              Quiz Title *
            </label>
            <input
              id="modal-quiz-title"
              className="input"
              placeholder="e.g. Youth Bible Championship — Genesis to Revelation"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              maxLength={255}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="label" htmlFor="modal-quiz-desc">
              Description (optional)
            </label>
            <textarea
              id="modal-quiz-desc"
              className="input resize-none"
              rows={2}
              placeholder="Details about round, target audience, or scripture references..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
          </div>
          <div className="flex gap-3 justify-end pt-3">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={creating || !newTitle.trim()}
            >
              {creating ? 'Creating…' : 'Create & Build Questions →'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        title="Delete Quiz?"
        onClose={() => setDeleteTarget(null)}
        danger
      >
        <p className="text-muted text-sm mb-4">
          Are you sure you want to delete <strong>&quot;{deleteTarget?.title}&quot;</strong>? This will permanently remove all questions, participant records, and results.
        </p>
        <div className="flex gap-3 justify-end">
          <button
            className="btn-secondary"
            onClick={() => setDeleteTarget(null)}
            disabled={actionLoading === 'delete'}
          >
            Cancel
          </button>
          <button
            className="btn-danger"
            onClick={handleConfirmDelete}
            disabled={actionLoading === 'delete'}
          >
            {actionLoading === 'delete' ? 'Deleting…' : 'Delete Quiz'}
          </button>
        </div>
      </Modal>

      {/* Reset Confirmation Modal */}
      <Modal
        open={!!resetTarget}
        title="Reset Quiz for Replay?"
        onClose={() => setResetTarget(null)}
      >
        <p className="text-muted text-sm mb-4">
          Resetting <strong>&quot;{resetTarget?.title}&quot;</strong> will clear previous participant answers and scores so you can start a fresh game session with a new audience. Questions will be preserved!
        </p>
        <div className="flex gap-3 justify-end">
          <button
            className="btn-secondary"
            onClick={() => setResetTarget(null)}
            disabled={actionLoading === 'reset'}
          >
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleConfirmReset}
            disabled={actionLoading === 'reset'}
          >
            {actionLoading === 'reset' ? 'Resetting…' : 'Reset & Open Lobby'}
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default QuizDashboard;
