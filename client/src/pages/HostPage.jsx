import { useState, useEffect, useCallback } from 'react';
import {
  getAllQuizzes, createQuiz, getQuizById, updateQuiz, addQuestion,
  updateQuestion, deleteQuestion, reorderQuestions, duplicateQuestion,
  setQuizWaiting, getResults, exportResults, deleteQuiz as deleteQuizApi,
  duplicateQuiz as duplicateQuizApi, resetQuiz as resetQuizApi,
} from '../services/api';
import socket, { EVENTS } from '../socket/socketClient';
import useSocket from '../hooks/useSocket';
import Modal from '../components/common/Modal';
import ConnectionStatus from '../components/common/ConnectionStatus';
import QuizDashboard from '../components/host/QuizDashboard';
import QuestionBuilder from '../components/host/QuestionBuilder';
import QuestionList from '../components/host/QuestionList';
import HostLobby from '../components/host/HostLobby';
import HostLiveControls from '../components/host/HostLiveControls';
import HostResults from '../components/host/HostResults';
import HostPresentMode from '../components/host/HostPresentMode';
import HostAuthPage from './HostAuthPage';
import { useAuth } from '../context/AuthContext';
import { downloadBlob } from '../utils/helpers';
import Footer from '../components/common/Footer';

const TIMER_OPTIONS = [10, 15, 20, 30, 45, 60];

const DEFAULT_QUESTION = {
  questionText: '',
  optionA: '', optionB: '', optionC: '', optionD: '',
  correctAnswer: 'A',
  durationSeconds: 20,
  points: 10,
};

const HostPage = () => {
  const { on, emit } = useSocket();
  const { user, loading: authLoading, isAuthenticated } = useAuth();

  // ── State ─────────────────────────────────────
  const [view, setView] = useState('dashboard');
  // views: dashboard | setup | lobby | live | results
  const [presentMode, setPresentMode] = useState(false);
  const [mobileTab, setMobileTab] = useState('editor'); // 'list' | 'editor' on mobile screens

  // Quizzes list for Dashboard
  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);

  // Active quiz state
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [selectedQIdx, setSelectedQIdx] = useState(0);

  // Creation state
  const [creating, setCreating] = useState(false);

  // Live quiz state
  const [participantCount, setParticipantCount] = useState(0);
  const [liveQuestion, setLiveQuestion] = useState(null);
  const [quizEnded, setQuizEnded] = useState(false);
  const [finalResults, setFinalResults] = useState(null);

  // Modals
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null });
  const [endModal, setEndModal] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Load all quizzes for Dashboard ───────────
  const loadQuizzes = useCallback(async () => {
    if (!isAuthenticated) return;
    setQuizzesLoading(true);
    try {
      const res = await getAllQuizzes();
      setQuizzes(res.data || []);
    } catch (err) {
      console.error('Failed to load quizzes', err);
    } finally {
      setQuizzesLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadQuizzes();
    }
  }, [isAuthenticated, loadQuizzes]);

  // ── Socket listeners ──────────────────────────
  useEffect(() => {
    on(EVENTS.PARTICIPANT_COUNT, ({ count }) => setParticipantCount(count));
    on(EVENTS.PARTICIPANT_JOINED, ({ count }) => setParticipantCount(count));

    on(EVENTS.QUIZ_STARTED, () => setView('live'));

    on(EVENTS.QUESTION_STARTED, (data) => {
      setLiveQuestion((prev) => ({
        ...data,
        top10: data.top10 || prev?.top10 || [],
      }));
      setView('live');
    });

    on('live_leaderboard', ({ top10 }) => {
      setLiveQuestion((prev) => (prev ? { ...prev, top10 } : { top10 }));
    });

    on(EVENTS.QUESTION_ENDED, (data) => {
      setLiveQuestion((prev) =>
        prev
          ? {
              ...prev,
              ended: true,
              allAnswered: data.allAnswered,
              correctAnswer: data.correctAnswer,
              stats: data.stats,
              top10: data.top10,
            }
          : prev
      );
    });

    on(EVENTS.QUIZ_ENDED, async () => {
      setQuizEnded(true);
      setView('results');
      const token = localStorage.getItem('hostToken');
      const id = localStorage.getItem('hostQuizId');
      if (id && token) {
        try {
          const res = await getResults(id);
          setFinalResults(res.data);
        } catch {}
      }
    });

    on(EVENTS.ERROR, ({ code, message }) => setError(message));
  }, [on]);

  // ── Select Quiz from Dashboard ────────────────
  const handleSelectQuiz = async (quizItem, targetView = 'setup') => {
    try {
      const hostToken = quizItem.hostToken;
      if (hostToken) localStorage.setItem('hostToken', hostToken);
      localStorage.setItem('hostQuizId', quizItem.id);

      const res = await getQuizById(quizItem.id);
      const q = res.data;
      const activeToken = q.hostToken || hostToken;
      if (activeToken) localStorage.setItem('hostToken', activeToken);

      setQuiz(q);
      const qList = q.questions || [];
      setQuestions(qList);
      if (qList.length > 0) {
        setEditingQuestion(qList[0]);
        setSelectedQIdx(0);
      } else {
        setEditingQuestion({ ...DEFAULT_QUESTION });
        setSelectedQIdx(0);
      }

      // Connect socket as host
      if (!socket.connected) socket.connect();
      socket.emit(EVENTS.HOST_JOIN, { quizId: q.id, hostToken: activeToken });

      if (targetView === 'results') {
        try {
          const resultsRes = await getResults(q.id);
          setFinalResults(resultsRes.data);
        } catch {}
        setView('results');
      } else if (targetView === 'lobby') {
        setView('lobby');
      } else {
        setView('setup');
      }
    } catch (err) {
      console.error('Failed to select quiz', err);
      setError('Could not load selected quiz details.');
    }
  };

  // ── Create Quiz from Dashboard ────────────────
  const handleCreateQuiz = async (formData) => {
    setCreating(true);
    setError('');
    try {
      const res = await createQuiz(formData);
      const { id, hostToken, ...quizData } = res.data;

      localStorage.setItem('hostToken', hostToken);
      localStorage.setItem('hostQuizId', id);

      const newQuizObj = { id, hostToken, ...quizData, questions: [] };
      setQuiz(newQuizObj);
      setQuestions([]);
      setEditingQuestion({ ...DEFAULT_QUESTION });
      setSelectedQIdx(0);
      setView('setup');

      if (!socket.connected) socket.connect();
      socket.emit(EVENTS.HOST_JOIN, { quizId: id, hostToken });

      loadQuizzes();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create quiz');
    } finally {
      setCreating(false);
    }
  };

  // ── Delete Quiz ───────────────────────────────
  const handleDeleteQuiz = async (id) => {
    try {
      await deleteQuizApi(id);
      if (quiz?.id === id) {
        setQuiz(null);
        setView('dashboard');
      }
      await loadQuizzes();
    } catch (err) {
      setError('Failed to delete quiz');
    }
  };

  // ── Duplicate Quiz ────────────────────────────
  const handleDuplicateQuiz = async (id) => {
    try {
      await duplicateQuizApi(id);
      await loadQuizzes();
    } catch (err) {
      setError('Failed to duplicate quiz');
    }
  };

  // ── Reset Quiz for Replay ─────────────────────
  const handleResetQuiz = async (id) => {
    try {
      const res = await resetQuizApi(id);
      await loadQuizzes();
      // Directly open lobby for the reset quiz
      await handleSelectQuiz(res.data, 'lobby');
    } catch (err) {
      setError('Failed to reset quiz');
    }
  };

  // ── Return to Dashboard ───────────────────────
  const handleBackToDashboard = () => {
    setView('dashboard');
    loadQuizzes();
  };

  // ── Save question ─────────────────────────────
  const handleSaveQuestion = async (formData) => {
    setSaving(true);
    setError('');
    try {
      if (editingQuestion?.id) {
        const res = await updateQuestion(editingQuestion.id, formData);
        setQuestions((prev) => prev.map((q) => (q.id === editingQuestion.id ? res.data : q)));
        setEditingQuestion(res.data);
      } else {
        const res = await addQuestion(quiz.id, formData);
        setQuestions((prev) => [...prev, res.data]);
        setSelectedQIdx(questions.length);
        setEditingQuestion(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete question ───────────────────────────
  const handleDeleteQuestion = async () => {
    if (!deleteModal.id) return;
    try {
      await deleteQuestion(deleteModal.id);
      setQuestions((prev) => prev.filter((q) => q.id !== deleteModal.id));
      setDeleteModal({ open: false, id: null });
      setEditingQuestion(null);
    } catch (err) {
      setError('Failed to delete question');
    }
  };

  // ── Duplicate question ────────────────────────
  const handleDuplicate = async (questionId) => {
    try {
      const res = await duplicateQuestion(questionId);
      setQuestions((prev) => [...prev, res.data]);
    } catch {}
  };

  // ── Reorder questions ─────────────────────────
  const handleReorder = async (newOrder) => {
    setQuestions(newOrder);
    try {
      await reorderQuestions(quiz.id, newOrder.map((q) => q.id));
    } catch {}
  };

  // ── Move to lobby ─────────────────────────────
  const handleGoToLobby = async () => {
    if (questions.length === 0) return setError('Add at least one question first');
    try {
      await setQuizWaiting(quiz.id);
      setQuiz((prev) => ({ ...prev, status: 'WAITING' }));
      setView('lobby');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to open lobby');
    }
  };

  // ── Start quiz ────────────────────────────────
  const handleStartQuiz = () => {
    const token = localStorage.getItem('hostToken');
    emit(EVENTS.START_QUIZ, { quizId: quiz.id, hostToken: token });
  };

  // ── Next question ─────────────────────────────
  const handleNextQuestion = () => {
    const token = localStorage.getItem('hostToken');
    emit(EVENTS.NEXT_QUESTION, { quizId: quiz.id, hostToken: token });
  };

  // ── Pause / Resume ────────────────────────────
  const handlePause = () => {
    const token = localStorage.getItem('hostToken');
    emit(EVENTS.PAUSE_QUIZ, { quizId: quiz.id, hostToken: token });
  };
  const handleResume = () => {
    const token = localStorage.getItem('hostToken');
    emit(EVENTS.RESUME_QUIZ, { quizId: quiz.id, hostToken: token });
  };

  // ── End quiz ──────────────────────────────────
  const handleEndQuiz = () => {
    const token = localStorage.getItem('hostToken');
    emit(EVENTS.END_QUIZ, { quizId: quiz.id, hostToken: token });
    setEndModal(false);
  };

  // ── Restart question ──────────────────────────
  const handleRestartQuestion = () => {
    const token = localStorage.getItem('hostToken');
    emit(EVENTS.RESTART_QUESTION, { quizId: quiz.id, hostToken: token });
  };

  // ── Export CSV ────────────────────────────────
  const handleExport = async () => {
    try {
      const res = await exportResults(quiz.id);
      downloadBlob(res.data, `${quiz.title}_results.csv`);
    } catch {}
  };

  // ── Render Views ───────────────────────────────

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white gap-4">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-400 text-sm">Verifying Host Session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <HostAuthPage />;
  }

  // 1. Dashboard View
  if (view === 'dashboard' || !quiz) {
    return (
      <QuizDashboard
        quizzes={quizzes}
        loading={quizzesLoading}
        onSelectQuiz={handleSelectQuiz}
        onCreateQuiz={handleCreateQuiz}
        onDeleteQuiz={handleDeleteQuiz}
        onDuplicateQuiz={handleDuplicateQuiz}
        onResetQuiz={handleResetQuiz}
        creating={creating}
      />
    );
  }

  // 2. Fullscreen Presenter Mode
  if (presentMode) {
    return (
      <HostPresentMode
        quiz={quiz}
        questions={questions}
        liveQuestion={liveQuestion}
        participantCount={participantCount}
        view={view}
        finalResults={finalResults}
        onNext={handleNextQuestion}
        onPause={handlePause}
        onResume={handleResume}
        onEnd={() => setEndModal(true)}
        onRestart={handleRestartQuestion}
        onStart={handleStartQuiz}
        onExport={handleExport}
        onNewQuiz={handleBackToDashboard}
        onExitPresentMode={() => setPresentMode(false)}
      />
    );
  }

  // 3. Results View
  if (view === 'results') {
    return (
      <HostResults
        quiz={quiz}
        results={finalResults}
        onExport={handleExport}
        onNewQuiz={handleBackToDashboard}
        onBackToDashboard={handleBackToDashboard}
      />
    );
  }

  // 4. Lobby View
  if (view === 'lobby') {
    return (
      <div>
        {/* Breadcrumb Header */}
        <div className="bg-white border-b border-border px-6 py-2.5 flex items-center justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            <button
              onClick={handleBackToDashboard}
              className="text-primary-600 hover:text-primary-800 font-bold flex items-center gap-1"
            >
              <span>🏠</span> Dashboard
            </button>
            <span className="text-slate-400">/</span>
            <button
              onClick={() => setView('setup')}
              className="font-semibold text-slate-600 hover:text-navy flex items-center gap-1"
            >
              <span>✏️</span> {quiz.title} (Edit)
            </button>
            <span className="text-slate-400">/</span>
            <span className="text-navy font-bold flex items-center gap-1">
              <span>📢</span> Starting Quiz (Lobby)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBackToDashboard}
              className="btn-secondary btn-sm text-xs flex items-center gap-1"
            >
              <span>←</span> All Quizzes
            </button>
          </div>
        </div>

        <HostLobby
          quiz={quiz}
          participantCount={participantCount}
          questions={questions}
          onStart={handleStartQuiz}
          onBack={() => setView('setup')}
          onBackToDashboard={handleBackToDashboard}
          onEnterPresentMode={() => setPresentMode(true)}
        />
      </div>
    );
  }

  // 5. Live Controls View
  if (view === 'live') {
    return (
      <HostLiveControls
        quiz={quiz}
        questions={questions}
        liveQuestion={liveQuestion}
        participantCount={participantCount}
        onNext={handleNextQuestion}
        onPause={handlePause}
        onResume={handleResume}
        onEnd={() => setEndModal(true)}
        onRestart={handleRestartQuestion}
        endModal={endModal}
        setEndModal={setEndModal}
        handleEndQuiz={handleEndQuiz}
        onEnterPresentMode={() => setPresentMode(true)}
      />
    );
  }

  // 6. Setup / Question Builder View
  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top Breadcrumbs Bar (Dashboard > Quiz Title (Edit) > Lobby) */}
      <header className="bg-white border-b border-border px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs sm:text-sm sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-2 overflow-x-auto py-1 whitespace-nowrap">
          <button
            onClick={handleBackToDashboard}
            className="text-primary-600 hover:text-primary-800 font-bold flex items-center gap-1"
            title="Return to All Quizzes"
          >
            <span>🏠</span> Dashboard
          </button>
          <span className="text-slate-400 font-bold">/</span>
          <span className="text-navy font-bold flex items-center gap-1 truncate max-w-[150px] sm:max-w-none">
            <span>✏️</span> {quiz.title}
          </span>
          <span className="text-slate-400">/</span>
          <button
            onClick={handleGoToLobby}
            disabled={questions.length === 0}
            className={`font-semibold flex items-center gap-1 ${
              questions.length === 0
                ? 'text-slate-300 cursor-not-allowed'
                : 'text-slate-600 hover:text-navy'
            }`}
            title="Move to Starting the Quiz"
          >
            <span>📢</span> Lobby
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button
            onClick={handleBackToDashboard}
            className="btn-secondary btn-sm text-xs flex items-center gap-1"
          >
            <span>←</span> Dashboard
          </button>
          <button
            id="btn-top-open-lobby"
            onClick={handleGoToLobby}
            disabled={questions.length === 0}
            className="btn-primary btn-sm text-xs font-semibold shadow-sm"
          >
            Start / Lobby →
          </button>
        </div>
      </header>

      {/* Mobile Tab Switcher for Setup (Screen < 768px) */}
      <div className="md:hidden flex bg-slate-100 p-1.5 border-b border-border">
        <button
          onClick={() => setMobileTab('list')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mobileTab === 'list'
              ? 'bg-white text-navy shadow-sm'
              : 'text-muted hover:text-navy'
          }`}
        >
          📋 Questions List ({questions.length})
        </button>
        <button
          onClick={() => setMobileTab('editor')}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            mobileTab === 'editor'
              ? 'bg-white text-navy shadow-sm'
              : 'text-muted hover:text-navy'
          }`}
        >
          ✏️ Question Editor
        </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Sidebar */}
        <aside className={`w-full md:w-72 bg-white md:border-r border-border flex-col md:h-[calc(100vh-45px)] md:sticky md:top-[45px] ${
          mobileTab === 'list' ? 'flex' : 'hidden md:flex'
        }`}>
          <div className="p-4 sm:p-5 border-b border-border">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 bg-primary-600 rounded-md flex items-center justify-center">
                <span className="text-white text-xs font-bold">BQ</span>
              </div>
              <span className="font-bold text-navy truncate">{quiz.title}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted mt-1">
              <span>Code: <strong className="font-mono text-slate-700">{quiz.code}</strong></span>
              <span className="badge badge-yellow text-[10px]">{quiz.status}</span>
            </div>
          </div>

          <div className="p-3 sm:p-4 flex-1 overflow-y-auto max-h-[50vh] md:max-h-none">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
              Questions ({questions.length})
            </p>
            <QuestionList
              questions={questions}
              selectedIdx={selectedQIdx}
              onSelect={(idx) => {
                setSelectedQIdx(idx);
                setEditingQuestion(questions[idx]);
                setMobileTab('editor');
              }}
              onAdd={() => {
                setEditingQuestion({ ...DEFAULT_QUESTION });
                setSelectedQIdx(questions.length);
                setMobileTab('editor');
              }}
              onDelete={(id) => setDeleteModal({ open: true, id })}
              onDuplicate={handleDuplicate}
              onReorder={handleReorder}
            />
          </div>

          <div className="p-4 border-t border-border space-y-2 bg-slate-50">
            <button
              id="btn-open-lobby"
              onClick={handleGoToLobby}
              disabled={questions.length === 0}
              className="btn-primary btn-lg w-full font-bold shadow"
            >
              Start Quiz / Lobby →
            </button>
            <ConnectionStatus className="justify-center w-full" />
          </div>
        </aside>

        {/* Main Editor */}
        <main className={`flex-1 overflow-y-auto ${
          mobileTab === 'editor' ? 'block' : 'hidden md:block'
        }`}>
          <div className="max-w-3xl mx-auto px-4 sm:px-8 py-6 sm:py-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-navy">{quiz.title}</h1>
                {quiz.description && <p className="text-muted text-xs sm:text-sm mt-1">{quiz.description}</p>}
              </div>
              <div className="flex items-center gap-3">
                <span className="badge badge-blue">
                  {questions.length} question{questions.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-danger rounded-lg px-4 py-3 text-sm mb-6 flex justify-between items-center">
                <span>{error}</span>
                <button onClick={() => setError('')} className="ml-3 underline text-xs font-semibold">
                  Dismiss
                </button>
              </div>
            )}

            {/* Question builder or empty state */}
            {editingQuestion !== null ? (
              <QuestionBuilder
                key={editingQuestion?.id ? `q-${editingQuestion.id}` : `new-${selectedQIdx}`}
                initialData={editingQuestion}
                questionNumber={selectedQIdx + 1}
                totalQuestions={questions.length}
                timerOptions={TIMER_OPTIONS}
                onSave={async (data) => {
                  await handleSaveQuestion(data);
                  setMobileTab('list');
                }}
                onCancel={() => setEditingQuestion(null)}
                onDelete={
                  editingQuestion?.id
                    ? () => setDeleteModal({ open: true, id: editingQuestion.id })
                    : null
                }
                saving={saving}
              />
            ) : (
              <div className="card text-center py-12 sm:py-16">
                <div className="text-4xl sm:text-5xl mb-4">✝</div>
                <h2 className="text-lg sm:text-xl font-semibold text-navy mb-2">
                  {questions.length === 0 ? 'Add Your First Question' : 'Select or Add a Question'}
                </h2>
                <p className="text-muted text-xs sm:text-sm mb-6 max-w-md mx-auto">
                  {questions.length === 0
                    ? 'Build your Bible quiz by clicking the button below or using the question list.'
                    : 'Click a question in the list to edit its prompt, options, and points, or click below to add another question.'}
                </p>
                <button
                  id="btn-add-first-question"
                  onClick={() => {
                    setEditingQuestion({ ...DEFAULT_QUESTION });
                    setSelectedQIdx(questions.length);
                  }}
                  className="btn-primary font-semibold shadow"
                >
                  + Add Question
                </button>
              </div>
            )}
          </div>
        </main>
      </div>

      <Footer />

      {/* Delete Question Confirmation Modal */}
      <Modal
        open={deleteModal.open}
        title="Delete Question?"
        onClose={() => setDeleteModal({ open: false, id: null })}
        danger
      >
        <p className="text-muted text-sm mb-5">
          Are you sure you want to delete this question? This cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={() => setDeleteModal({ open: false, id: null })}>
            Cancel
          </button>
          <button className="btn-danger" onClick={handleDeleteQuestion}>
            Delete
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default HostPage;
