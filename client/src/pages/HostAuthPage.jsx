import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function HostAuthPage() {
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        if (!name.trim()) {
          setError('Please enter your full name or title.');
          setSubmitting(false);
          return;
        }
        await register(name, email, password);
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.error ||
        (mode === 'login' ? 'Failed to sign in. Check email and password.' : 'Failed to create account.');
      setError(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Platform Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-md">
            <span className="text-white text-3xl font-black">✝</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-navy">Host Quiz Portal</h1>
          <p className="text-muted text-xs sm:text-sm mt-1">
            Sign in or create an account to manage your church quizzes
          </p>
        </div>

        {/* Auth Card */}
        <div className="card shadow-md">
          {/* Tab Switcher */}
          <div className="flex bg-slate-100 rounded-lg p-1 mb-5">
            <button
              type="button"
              id="tab-host-login"
              onClick={() => { setMode('login'); setError(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all ${
                mode === 'login'
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-muted hover:text-navy'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              id="tab-host-register"
              onClick={() => { setMode('register'); setError(''); }}
              className={`flex-1 py-2 text-xs sm:text-sm font-semibold rounded-md transition-all ${
                mode === 'register'
                  ? 'bg-white text-navy shadow-sm'
                  : 'text-muted hover:text-navy'
              }`}
            >
              Create Account
            </button>
          </div>

          {/* Error Notification */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-xs sm:text-sm px-3.5 py-2.5 rounded-lg mb-4 flex items-center gap-2">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="label" htmlFor="host-name">
                  Full Name or Title
                </label>
                <input
                  id="host-name"
                  type="text"
                  required
                  placeholder="e.g. Pastor David"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input"
                />
              </div>
            )}

            <div>
              <label className="label" htmlFor="host-email">
                Email Address
              </label>
              <input
                id="host-email"
                type="email"
                required
                placeholder="pastor@church.org"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </div>

            <div>
              <label className="label" htmlFor="host-password">
                Password
              </label>
              <input
                id="host-password"
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </div>

            {mode === 'register' && (
              <p className="text-xs text-muted leading-relaxed">
                💡 All existing quizzes and questions will be saved and linked directly to your host account.
              </p>
            )}

            <button
              id="btn-host-auth-submit"
              type="submit"
              disabled={submitting}
              className="btn-primary w-full shadow py-2.5 font-bold mt-2"
            >
              {submitting ? (
                'Processing...'
              ) : mode === 'login' ? (
                'Sign In to Dashboard →'
              ) : (
                'Create Host Account →'
              )}
            </button>
          </form>

          {/* Footnote / Link to Participant Join */}
          <div className="mt-5 pt-4 border-t border-border text-center">
            <button
              type="button"
              onClick={() => navigate('/join')}
              className="text-xs text-muted hover:text-primary-600 transition"
            >
              Participant wanting to play? <span className="font-semibold underline">Go to Join Quiz</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
