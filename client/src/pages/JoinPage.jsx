import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { getQuizByCode } from '../services/api';
import { generateSessionId } from '../utils/helpers';

import Footer from '../components/common/Footer';

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
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 w-full max-w-md mx-auto">
        <div className="w-full">
          {/* Logo */}
          <div className="text-center mb-6 sm:mb-8">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-md">
              <span className="text-white text-3xl font-black">✝</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-navy tracking-tight">Bible Quiz</h1>
            <p className="text-muted text-xs sm:text-sm mt-1">Enter your room code to join the live fellowship quiz</p>
          </div>

          <div className="card shadow-md p-5 sm:p-6">
            <form onSubmit={handleJoin} className="space-y-4">
              {/* Code input */}
              <div>
                <label className="label text-xs sm:text-sm font-semibold" htmlFor="quiz-code">Quiz Code</label>
                <input
                  id="quiz-code"
                  className="input text-center text-xl sm:text-2xl font-bold tracking-widest uppercase py-3"
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
                <label className="label text-xs sm:text-sm font-semibold" htmlFor="player-name">Your Full Name</label>
                <input
                  id="player-name"
                  className="input text-base sm:text-lg py-2.5"
                  placeholder="e.g. John"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  maxLength={100}
                  autoComplete="given-name"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-danger rounded-lg px-3 py-2.5 text-xs sm:text-sm">
                  {error}
                </div>
              )}

              <button
                id="btn-join-quiz"
                type="submit"
                className="btn-primary btn-lg w-full text-base font-bold shadow-md active:scale-[0.99] transition-transform"
                disabled={loading}
              >
                {loading ? 'Joining Live Quiz…' : 'JOIN QUIZ NOW →'}
              </button>
            </form>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-200/80 text-center">
            <p className="text-xs text-muted mb-2">Are you the quiz coordinator or pastor?</p>
            <Link
              to="/host"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-700 bg-primary-50 hover:bg-primary-100 border border-primary-200 px-4 py-2 rounded-xl transition"
            >
              👑 Go to Host Dashboard →
            </Link>
          </div>

          <p className="text-center text-xs text-muted mt-3">
            Participants join here · No account required
          </p>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default JoinPage;
