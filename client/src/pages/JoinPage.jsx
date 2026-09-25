import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getQuizByCode } from '../services/api';
import { generateSessionId } from '../utils/helpers';

const JoinPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const urlCode = (searchParams.get('code') || '').trim().toUpperCase();

  const [form, setForm] = useState({ code: urlCode, name: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (urlCode && !form.code) {
      setForm((prev) => ({ ...prev, code: urlCode }));
    }
  }, [urlCode]);

  const handleJoin = async (e) => {
    e.preventDefault();
    const code = form.code.trim().toUpperCase();
    const name = form.name.trim();

    if (!code) return setError('Please enter the quiz code.');
    if (!name) return setError('Please enter your name.');
    if (name.length > 100) return setError('Name is too long (max 100 characters).');

    setLoading(true);
    setError('');
    try {
      const res = await getQuizByCode(code);
      const quiz = res.data;

      if (quiz.status === 'COMPLETED') {
        return setError('This quiz has already ended.');
      }

      // Store session info in localStorage for reconnection
      let sessionId = localStorage.getItem('sessionId');
      if (!sessionId) {
        sessionId = generateSessionId();
        localStorage.setItem('sessionId', sessionId);
      }
      localStorage.setItem('quizCode', code);
      localStorage.setItem('playerName', name);

      // Navigate to play page with state
      navigate('/play', { state: { quizCode: code, playerName: name, sessionId, quizTitle: quiz.title } });
    } catch (err) {
      if (err.response?.status === 404) {
        setError('Quiz not found. Check the code and try again.');
      } else {
        setError(err.response?.data?.error || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md">
            <span className="text-white text-3xl">✝</span>
          </div>
          <h1 className="text-3xl font-bold text-navy">Bible Quiz</h1>
          <p className="text-muted text-sm mt-1">Enter the code from your host</p>
        </div>

        <div className="card shadow-md">
          <form onSubmit={handleJoin} className="space-y-4">
            {/* Code input */}
            <div>
              <label className="label" htmlFor="quiz-code">Quiz Code</label>
              <input
                id="quiz-code"
                className="input text-center text-2xl font-bold tracking-widest uppercase"
                placeholder="BIBLE25"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') })}
                maxLength={10}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
              />
            </div>

            {/* Name input */}
            <div>
              <label className="label" htmlFor="player-name">Your Name</label>
              <input
                id="player-name"
                className="input text-lg"
                placeholder="e.g. John"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                maxLength={100}
                autoComplete="given-name"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-danger rounded-lg px-3 py-2.5 text-sm">
                {error}
              </div>
            )}

            <button
              id="btn-join-quiz"
              type="submit"
              className="btn-primary btn-lg w-full text-base"
              disabled={loading}
            >
              {loading ? 'Joining…' : 'JOIN QUIZ'}
            </button>
          </form>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-200 text-center">
          <p className="text-xs text-muted mb-2">Are you running or creating the quiz?</p>
          <Link
            to="/host"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-4 py-2 rounded-xl transition"
          >
            👑 Go to Host Dashboard →
          </Link>
        </div>

        <p className="text-center text-xs text-muted mt-4">
          Participants join here · No account required
        </p>
      </div>
    </div>
  );
};

export default JoinPage;
