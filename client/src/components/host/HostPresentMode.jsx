import { useState, useEffect } from 'react';
import useTimer from '../../hooks/useTimer';
import { formatTime } from '../../utils/helpers';
import QRCodeCard from '../common/QRCodeCard';
import socket, { EVENTS } from '../../socket/socketClient';

const HostPresentMode = ({
  quiz,
  questions,
  liveQuestion,
  participantCount,
  view, // 'lobby' | 'live' | 'results'
  finalResults,
  onNext,
  onPause,
  onResume,
  onEnd,
  onRestart,
  onStart,
  onExport,
  onNewQuiz,
  onExitPresentMode,
}) => {
  const [paused, setPaused] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);

  useEffect(() => {
    setAnsweredCount(0);
  }, [liveQuestion?.questionId]);

  useEffect(() => {
    const handleProgress = (data) => {
      if (data?.answeredCount !== undefined) {
        setAnsweredCount(data.answeredCount);
      }
    };
    socket.on(EVENTS.ANSWERS_PROGRESS, handleProgress);
    return () => socket.off(EVENTS.ANSWERS_PROGRESS, handleProgress);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handlePause = () => {
    setPaused(true);
    onPause?.();
  };

  const handleResume = () => {
    setPaused(false);
    onResume?.();
  };

  const qNum = liveQuestion?.questionNumber || 1;
  const totalQ = liveQuestion?.totalQuestions || questions?.length || 1;
  const options = liveQuestion?.options
    ? Object.entries(liveQuestion.options)
    : [['A', 'Option A'], ['B', 'Option B'], ['C', 'Option C'], ['D', 'Option D']];

  const { remaining, isUrgent, isWarning } = useTimer(
    paused || liveQuestion?.ended ? null : liveQuestion?.endsAt
  );

  return (
    <div className="fixed inset-0 z-50 bg-surface flex flex-col select-none overflow-hidden">
      {/* Top Floating Presenter Bar */}
      <header className="bg-navy text-white px-6 py-3 flex items-center justify-between shadow-md border-b border-navy-700 z-10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="font-bold text-lg tracking-wide uppercase text-primary-200">
            📽️ Present Mode
          </span>
          <span className="text-slate-400 text-sm hidden sm:inline">|</span>
          <span className="font-semibold text-white truncate max-w-xs">{quiz.title}</span>
          <span className="bg-primary-700/80 text-xs font-mono px-2.5 py-1 rounded text-primary-100 font-bold tracking-wider">
            CODE: {quiz.code}
          </span>
        </div>

        {/* Presenter Action Controls */}
        <div className="flex items-center gap-2">
          {view === 'live' && (
            <>
              {liveQuestion?.ended ? (
                <button
                  onClick={onNext}
                  className="btn-success btn-sm font-bold text-sm px-4 py-1.5 shadow"
                  title="Show Next Question"
                >
                  Next Question ⏭
                </button>
              ) : (
                <>
                  <button
                    onClick={paused ? handleResume : handlePause}
                    className="btn-secondary btn-sm text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
                    title={paused ? 'Resume timer' : 'Pause timer'}
                  >
                    {paused ? '▶ Resume' : '⏸ Pause'}
                  </button>
                  <button
                    onClick={onRestart}
                    className="btn-secondary btn-sm text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
                    title="Restart current timer"
                  >
                    ↺ Reset Timer
                  </button>
                  <button
                    onClick={onNext}
                    className="btn-primary btn-sm text-xs px-3 py-1.5 shadow"
                    title="Advance to answer reveal"
                  >
                    Reveal Answer →
                  </button>
                </>
              )}
              <button
                onClick={onEnd}
                className="btn-danger btn-sm text-xs px-3 py-1.5"
                title="End Quiz"
              >
                End Quiz
              </button>
            </>
          )}

          {view === 'lobby' && (
            <button
              onClick={onStart}
              disabled={participantCount === 0}
              className="btn-success btn-sm font-bold text-sm px-5 py-1.5 shadow"
            >
              {participantCount === 0 ? 'Waiting for Players...' : `Start Quiz (${participantCount}) ▶`}
            </button>
          )}

          {view === 'results' && (
            <>
              <button
                onClick={onExport}
                className="btn-secondary btn-sm text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
              >
                📥 Export CSV
              </button>
              <button
                onClick={onNewQuiz}
                className="btn-primary btn-sm text-xs px-3 py-1.5"
              >
                + New Quiz
              </button>
            </>
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded hover:bg-white/10 text-white text-sm"
            title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
          >
            {isFullscreen ? '⛶ Normal' : '⛶ Fullscreen'}
          </button>

          {/* Return to host control panel */}
          <button
            onClick={onExitPresentMode}
            className="btn-secondary btn-sm text-xs px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700"
            title="Switch back to dashboard view"
          >
            ✕ Exit Presenter
          </button>
        </div>
      </header>

      {/* Main Slide Presentation View (16:9 Responsive) */}
      <main className="flex-1 flex flex-col justify-center items-center p-6 md:p-12 overflow-y-auto">
        {/* VIEW 1: LOBBY PRESENTATION */}
        {view === 'lobby' && (
          <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-10 bg-white rounded-3xl p-8 md:p-14 shadow-2xl border border-border">
            {/* Left: Instructions & Join Code */}
            <div className="flex-1 text-center md:text-left space-y-6">
              <div className="flex items-center justify-center md:justify-start gap-3">
                <div className="w-12 h-12 bg-primary-600 rounded-2xl flex items-center justify-center shadow">
                  <span className="text-white text-2xl font-bold">✝</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-extrabold text-navy tracking-tight">
                  {quiz.title}
                </h1>
              </div>

              {quiz.description && (
                <p className="text-lg text-muted">{quiz.description}</p>
              )}

              <div className="bg-primary-50 border-2 border-primary-200 rounded-2xl p-6 text-center md:text-left">
                <p className="text-xs font-bold text-primary-700 tracking-widest uppercase mb-1">
                  ROOM CODE
                </p>
                <p className="text-6xl md:text-7xl font-mono font-black text-primary-900 tracking-widest">
                  {quiz.code}
                </p>
                <p className="text-sm text-primary-700 font-medium mt-2">
                  Connect phone to church Wi-Fi and open the site or scan QR code
                </p>
              </div>

              <div className="flex items-center justify-center md:justify-start gap-3 pt-2">
                <span className="inline-block w-4 h-4 rounded-full bg-success animate-ping" />
                <span className="text-2xl font-bold text-navy">
                  {participantCount} {participantCount === 1 ? 'Player' : 'Players'} Joined
                </span>
              </div>
            </div>

            {/* Right: Big Scannable QR Code */}
            <div className="flex-shrink-0">
              <QRCodeCard quizCode={quiz.code} size={240} className="shadow-xl" />
            </div>
          </div>
        )}

        {/* VIEW 2: LIVE QUESTION PRESENTATION (neutral, no intermediate results) */}
        {view === 'live' && liveQuestion && (
          <div className="w-full max-w-5xl flex flex-col justify-between h-full max-h-[85vh] space-y-6">
            {/* Question Header & Timer */}
            <div className="bg-white rounded-2xl p-6 shadow-md border border-border flex items-center justify-between">
              <div className="flex-1 pr-4">
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xs font-bold text-primary-600 uppercase tracking-widest">
                    Question {qNum} of {totalQ}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                    {answeredCount} / {participantCount} answered
                  </span>
                  {liveQuestion.ended && (
                    <span className="badge badge-green font-bold">
                      {liveQuestion.allAnswered ? '✓ All Participants Answered!' : "⌛ Time's Up"}
                    </span>
                  )}
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold text-navy leading-snug">
                  {liveQuestion.questionText}
                </h2>
              </div>

              {/* Action Button or Countdown Timer */}
              {liveQuestion.ended ? (
                <button
                  onClick={onNext}
                  className="btn-success btn-lg font-black text-lg px-7 py-3 shadow-xl animate-bounce flex-shrink-0"
                >
                  Next Question ⏭
                </button>
              ) : (
                <div
                  className={`w-24 h-24 rounded-2xl flex items-center justify-center text-4xl font-extrabold font-mono border-4 shadow-inner ml-6 flex-shrink-0 transition-colors ${
                    isUrgent
                      ? 'border-red-500 text-red-600 bg-red-50 animate-pulse'
                      : isWarning
                      ? 'border-amber-400 text-amber-600 bg-amber-50'
                      : 'border-primary-500 text-primary-700 bg-primary-50'
                  }`}
                >
                  {paused ? '⏸' : `${remaining}s`}
                </div>
              )}
            </div>

            {/* Options Grid (PowerPoint 2x2 layout, neutral presentation) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
              {options.map(([letter, text]) => (
                <div
                  key={letter}
                  className="bg-white rounded-2xl p-6 border-2 border-border shadow-md flex items-center gap-5 transition"
                >
                  <span className="w-14 h-14 rounded-xl bg-primary-600 text-white text-2xl font-bold flex items-center justify-center flex-shrink-0 shadow">
                    {letter}
                  </span>
                  <span className="text-xl md:text-2xl font-semibold text-navy leading-normal">
                    {text}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center text-sm text-muted px-2">
              <span>{participantCount} participants connected</span>
              <span className="font-mono font-semibold">Join Code: {quiz.code}</span>
            </div>
          </div>
        )}

        {/* VIEW 4: FINAL RESULTS / PODIUM */}
        {view === 'results' && (
          <div className="w-full max-w-5xl bg-white rounded-3xl p-8 md:p-12 shadow-2xl border border-border text-center space-y-8">
            <div>
              <span className="text-4xl">🏆</span>
              <h1 className="text-4xl md:text-5xl font-black text-navy mt-2">
                Final Quiz Results
              </h1>
              <p className="text-muted text-lg mt-1">{quiz.title}</p>
            </div>

            {/* Top 3 Podium */}
            {finalResults?.top10 && finalResults.top10.length > 0 ? (
              <div className="grid grid-cols-3 gap-4 max-w-3xl mx-auto items-end pt-8">
                {/* 2nd Place */}
                {finalResults.top10[1] && (
                  <div className="bg-slate-50 border-2 border-slate-300 rounded-2xl p-6 shadow order-1">
                    <span className="text-4xl">🥈</span>
                    <p className="text-xs font-bold text-slate-500 uppercase mt-2">2nd Place</p>
                    <p className="text-2xl font-black text-navy mt-1 truncate">
                      {finalResults.top10[1].name}
                    </p>
                    <p className="text-3xl font-extrabold text-primary-600 mt-2 font-mono">
                      {finalResults.top10[1].total_score} pts
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-2 text-xs font-semibold text-slate-600">
                      <span>🎯 {finalResults.top10[1].accuracy_percent !== undefined ? `${finalResults.top10[1].accuracy_percent}%` : `${finalResults.top10[1].correct_answers} hit`}</span>
                      <span>•</span>
                      <span>⏱ {finalResults.top10[1].total_time_seconds || 0}s</span>
                    </div>
                  </div>
                )}

                {/* 1st Place */}
                {finalResults.top10[0] && (
                  <div className="bg-amber-50 border-4 border-amber-400 rounded-2xl p-8 shadow-xl order-2 transform scale-105">
                    <span className="text-5xl">🥇</span>
                    <p className="text-xs font-bold text-amber-700 uppercase mt-2">Champion</p>
                    <p className="text-3xl font-black text-navy mt-1 truncate">
                      {finalResults.top10[0].name}
                    </p>
                    <p className="text-4xl font-extrabold text-primary-700 mt-2 font-mono">
                      {finalResults.top10[0].total_score} pts
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-2 text-xs font-semibold text-amber-800">
                      <span>🎯 {finalResults.top10[0].accuracy_percent !== undefined ? `${finalResults.top10[0].accuracy_percent}%` : `${finalResults.top10[0].correct_answers} hit`}</span>
                      <span>•</span>
                      <span>⏱ {finalResults.top10[0].total_time_seconds || 0}s</span>
                    </div>
                  </div>
                )}

                {/* 3rd Place */}
                {finalResults.top10[2] && (
                  <div className="bg-orange-50 border-2 border-orange-300 rounded-2xl p-6 shadow order-3">
                    <span className="text-4xl">🥉</span>
                    <p className="text-xs font-bold text-orange-700 uppercase mt-2">3rd Place</p>
                    <p className="text-2xl font-black text-navy mt-1 truncate">
                      {finalResults.top10[2].name}
                    </p>
                    <p className="text-3xl font-extrabold text-primary-600 mt-2 font-mono">
                      {finalResults.top10[2].total_score} pts
                    </p>
                    <div className="flex items-center justify-center gap-2 mt-2 text-xs font-semibold text-orange-800">
                      <span>🎯 {finalResults.top10[2].accuracy_percent !== undefined ? `${finalResults.top10[2].accuracy_percent}%` : `${finalResults.top10[2].correct_answers} hit`}</span>
                      <span>•</span>
                      <span>⏱ {finalResults.top10[2].total_time_seconds || 0}s</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xl text-muted py-10">No final participant scores recorded.</p>
            )}

            <div className="flex justify-center gap-4 pt-6">
              <button onClick={onExport} className="btn-secondary btn-lg font-semibold">
                📥 Download Results CSV
              </button>
              <button onClick={onNewQuiz} className="btn-primary btn-lg font-bold">
                + Create New Quiz
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default HostPresentMode;
