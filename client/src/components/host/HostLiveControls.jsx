import { useState, useEffect } from 'react';
import useTimer from '../../hooks/useTimer';
import Modal from '../common/Modal';
import socket, { EVENTS } from '../../socket/socketClient';

const RankMovementBadge = ({ rankChange, previousRank }) => {
  if (previousRank === null || previousRank === undefined) {
    return (
      <span className="inline-flex items-center gap-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-1.5 py-0.5 rounded" title="Starting position">
        <span>⭐</span>
        <span>START</span>
      </span>
    );
  }
  if (rankChange > 0) {
    return (
      <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 text-[11px] font-black px-1.5 py-0.5 rounded shadow-xs" title={`Gained ${rankChange} position${rankChange > 1 ? 's' : ''}`}>
        <span>▲</span>
        <span>+{rankChange}</span>
      </span>
    );
  }
  if (rankChange < 0) {
    return (
      <span className="inline-flex items-center gap-0.5 bg-red-100 text-red-700 border border-red-300 text-[11px] font-black px-1.5 py-0.5 rounded shadow-xs" title={`Dropped ${Math.abs(rankChange)} position${Math.abs(rankChange) > 1 ? 's' : ''}`}>
        <span>▼</span>
        <span>{rankChange}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-slate-400 font-bold text-xs px-1.5 py-0.5" title="Maintained position">
      <span>━</span>
    </span>
  );
};

const HostLiveControls = ({
  quiz,
  questions,
  liveQuestion,
  participantCount,
  onNext,
  onPause,
  onResume,
  onEnd,
  onRestart,
  endModal,
  setEndModal,
  handleEndQuiz,
  onEnterPresentMode,
}) => {
  const [paused, setPaused] = useState(false);
  const [answeredCount, setAnsweredCount] = useState(0);
  const [optionCounts, setOptionCounts] = useState({ A: 0, B: 0, C: 0, D: 0 });
  const [liveLeaderboard, setLiveLeaderboard] = useState([]);
  const [questionStats, setQuestionStats] = useState(null);

  const { remaining, isUrgent, isWarning } = useTimer(
    paused || liveQuestion?.ended ? null : liveQuestion?.endsAt
  );

  // Reset answered count & option counts when question changes
  useEffect(() => {
    setAnsweredCount(0);
    setOptionCounts({ A: 0, B: 0, C: 0, D: 0 });
    setQuestionStats(null);
  }, [liveQuestion?.questionId]);

  // Listen for real-time answer submissions and live leaderboard updates
  useEffect(() => {
    const handleProgress = (data) => {
      if (data?.answeredCount !== undefined) {
        setAnsweredCount(data.answeredCount);
      }
      if (data?.optionCounts) {
        setOptionCounts(data.optionCounts);
      }
    };

    const handleQuestionEnded = (data) => {
      if (data?.top10) {
        setLiveLeaderboard(data.top10);
      }
      if (data?.stats) {
        setQuestionStats(data.stats);
        setOptionCounts({
          A: parseInt(data.stats.count_a, 10) || 0,
          B: parseInt(data.stats.count_b, 10) || 0,
          C: parseInt(data.stats.count_c, 10) || 0,
          D: parseInt(data.stats.count_d, 10) || 0,
        });
      }
    };

    const handleLiveLeaderboard = (data) => {
      if (data?.top10) {
        setLiveLeaderboard(data.top10);
      }
    };

    socket.on(EVENTS.ANSWERS_PROGRESS, handleProgress);
    socket.on(EVENTS.QUESTION_ENDED, handleQuestionEnded);
    socket.on('live_leaderboard', handleLiveLeaderboard);

    return () => {
      socket.off(EVENTS.ANSWERS_PROGRESS, handleProgress);
      socket.off(EVENTS.QUESTION_ENDED, handleQuestionEnded);
      socket.off('live_leaderboard', handleLiveLeaderboard);
    };
  }, []);

  // Sync leaderboard if provided in liveQuestion payload
  useEffect(() => {
    if (liveQuestion?.top10 && liveQuestion.top10.length > 0) {
      setLiveLeaderboard(liveQuestion.top10);
    }
    if (liveQuestion?.stats) {
      setQuestionStats(liveQuestion.stats);
      setOptionCounts({
        A: parseInt(liveQuestion.stats.count_a, 10) || 0,
        B: parseInt(liveQuestion.stats.count_b, 10) || 0,
        C: parseInt(liveQuestion.stats.count_c, 10) || 0,
        D: parseInt(liveQuestion.stats.count_d, 10) || 0,
      });
    }
  }, [liveQuestion]);

  const handlePause = () => {
    setPaused(true);
    onPause();
  };

  const handleResume = () => {
    setPaused(false);
    onResume();
  };

  const qNum = liveQuestion?.questionNumber || 1;
  const totalQ = liveQuestion?.totalQuestions || questions.length || 1;
  const isLastQuestion = qNum >= totalQ;
  const totalPossible = participantCount || 1;
  const answerPercentage = Math.min(100, Math.round((answeredCount / totalPossible) * 100));

  const options = liveQuestion?.options
    ? Object.entries(liveQuestion.options)
    : [
        ['A', 'Option A'],
        ['B', 'Option B'],
        ['C', 'Option C'],
        ['D', 'Option D'],
      ];

  const correctAnswer = liveQuestion?.correctAnswer || liveQuestion?.correct_answer;

  return (
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top Host Command Bar */}
      <header className="bg-navy text-white px-6 py-3 flex items-center justify-between shadow-md border-b border-navy-700 z-10 sticky top-0">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-success animate-pulse" />
          <span className="font-bold text-lg text-white truncate max-w-sm">
            {quiz.title}
          </span>
          <span className="badge badge-green font-bold text-xs">LIVE HOST MODE</span>
          <span className="font-mono text-xs text-primary-200 bg-primary-900/60 px-2 py-0.5 rounded border border-primary-700">
            CODE: {quiz.code}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm text-slate-300 font-medium">
            👥 <strong>{participantCount}</strong> {participantCount === 1 ? 'player' : 'players'} connected
          </span>

          <button
            onClick={onEnterPresentMode}
            className="btn-primary btn-sm bg-indigo-600 hover:bg-indigo-700 font-semibold shadow-sm text-xs"
            title="Switch to full presentation view"
          >
            📽️ Presenter View
          </button>

          {!liveQuestion?.ended && (
            <button
              onClick={paused ? handleResume : handlePause}
              className="btn-secondary btn-sm text-xs bg-white/10 hover:bg-white/20 text-white border-white/20"
            >
              {paused ? '▶ Resume' : '⏸ Pause'}
            </button>
          )}

          <button
            onClick={onRestart}
            className="btn-secondary btn-sm text-xs bg-white/10 hover:bg-white/20 text-white border-white/20"
            title="Reset question timer"
          >
            ↺ Reset Timer
          </button>

          <button
            id="btn-end-quiz"
            onClick={() => setEndModal(true)}
            className="btn-danger btn-sm text-xs"
          >
            End Quiz
          </button>
        </div>
      </header>

      {/* Main Grid: Left = Question & Controls | Right = Live Analytics & Position Movements */}
      <main className="max-w-7xl mx-auto px-6 py-6 w-full flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* LEFT COLUMN: QUESTION & HOST CONTROLS (7 Cols) */}
        <section className="lg:col-span-7 space-y-6">
          {liveQuestion ? (
            <div className="card shadow-md space-y-5 border-t-4 border-t-primary-600">
              {/* Question Header & Countdown */}
              <div className="flex items-start justify-between gap-4 border-b border-border/80 pb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge badge-blue font-bold text-xs uppercase tracking-wider">
                      Question {qNum} of {totalQ}
                    </span>
                    {liveQuestion.ended ? (
                      <span className="badge badge-green font-bold text-xs">
                        {liveQuestion.allAnswered ? '✓ All Players Answered' : "⌛ Time's Up"}
                      </span>
                    ) : (
                      <span className="text-xs text-muted font-medium">
                        {liveQuestion.points || 10} Points
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-extrabold text-navy leading-snug">
                    {liveQuestion.questionText}
                  </h2>
                </div>

                {/* Big Timer or Status */}
                {!liveQuestion.ended ? (
                  <div
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-extrabold font-mono border-4 shadow-inner flex-shrink-0 ${
                      isUrgent
                        ? 'border-red-500 text-red-600 bg-red-50 animate-pulse'
                        : isWarning
                        ? 'border-amber-400 text-amber-600 bg-amber-50'
                        : 'border-primary-500 text-primary-700 bg-primary-50'
                    }`}
                  >
                    {paused ? '⏸' : `${remaining}s`}
                  </div>
                ) : (
                  <div className="bg-emerald-50 border-2 border-emerald-300 text-emerald-800 rounded-2xl p-3 text-center flex-shrink-0">
                    <span className="text-2xl block">✓</span>
                    <span className="text-xs font-bold uppercase">Closed</span>
                  </div>
                )}
              </div>

              {/* Real-time Option Distribution Analytics (A, B, C, D) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold uppercase text-muted tracking-wider">
                    Option Analytics & Live Answers (Correct answer highlighted)
                  </p>
                  <span className="text-xs font-semibold text-slate-600">
                    {answeredCount} / {participantCount} answered
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {options.map(([letter, text]) => {
                    const isCorrect = correctAnswer === letter;
                    const optCount = optionCounts[letter] || 0;
                    const optPct = answeredCount > 0 ? Math.round((optCount / answeredCount) * 100) : 0;

                    return (
                      <div
                        key={letter}
                        className={`relative overflow-hidden p-3.5 rounded-xl border-2 transition-all flex flex-col justify-between ${
                          liveQuestion.ended && isCorrect
                            ? 'bg-emerald-50/90 border-emerald-500 shadow-sm'
                            : liveQuestion.ended && optCount > 0
                            ? 'bg-red-50/40 border-red-200'
                            : 'bg-slate-50 border-border'
                        }`}
                      >
                        {/* Background Progress Fill */}
                        <div
                          className={`absolute top-0 bottom-0 left-0 transition-all duration-500 opacity-20 ${
                            isCorrect ? 'bg-emerald-500' : 'bg-primary-500'
                          }`}
                          style={{ width: `${optPct}%` }}
                        />

                        <div className="relative z-10 flex items-start gap-3">
                          <span
                            className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm text-white shadow-sm flex-shrink-0 ${
                              isCorrect ? 'bg-emerald-600' : 'bg-slate-500'
                            }`}
                          >
                            {letter}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-semibold truncate ${isCorrect ? 'text-emerald-950 font-bold' : 'text-navy'}`}>
                              {text}
                            </p>
                            {isCorrect && (
                              <span className="text-[11px] font-bold text-emerald-700 flex items-center gap-1 mt-0.5">
                                ✓ Correct Answer
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Votes & Percentage indicator */}
                        <div className="relative z-10 flex items-center justify-between mt-2 pt-2 border-t border-border/50 text-xs">
                          <span className="font-mono font-bold text-slate-700">
                            {optCount} {optCount === 1 ? 'vote' : 'votes'}
                          </span>
                          <span className={`font-mono font-extrabold ${isCorrect ? 'text-emerald-700' : 'text-slate-500'}`}>
                            {optPct}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Comprehensive Question Performance Analytics */}
              <div className="bg-slate-50 rounded-xl p-4 border border-border space-y-3">
                <div className="flex items-center justify-between text-sm font-bold text-navy">
                  <span className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-primary-600 animate-pulse" />
                    Live Response Progress:
                  </span>
                  <span className="font-mono text-primary-700">
                    {answeredCount} / {participantCount} ({answerPercentage}%)
                  </span>
                </div>

                <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-primary-600 h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${answerPercentage}%` }}
                  />
                </div>

                {/* Accuracy & Speed breakdown */}
                {questionStats ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-center text-xs font-semibold">
                    <div className="bg-emerald-100/90 text-emerald-800 py-2 px-2 rounded-lg border border-emerald-200">
                      <span className="block text-[10px] uppercase tracking-wider text-emerald-700">Correct</span>
                      <span className="text-base font-black font-mono">✓ {questionStats.correct || 0}</span>
                    </div>
                    <div className="bg-red-100/90 text-red-800 py-2 px-2 rounded-lg border border-red-200">
                      <span className="block text-[10px] uppercase tracking-wider text-red-700">Incorrect</span>
                      <span className="text-base font-black font-mono">✕ {questionStats.incorrect || 0}</span>
                    </div>
                    <div className="bg-amber-100/90 text-amber-900 py-2 px-2 rounded-lg border border-amber-200">
                      <span className="block text-[10px] uppercase tracking-wider text-amber-700">Accuracy</span>
                      <span className="text-base font-black font-mono">
                        {questionStats.answered > 0 ? Math.round((questionStats.correct / questionStats.answered) * 100) : 0}%
                      </span>
                    </div>
                    <div className="bg-slate-200 text-slate-800 py-2 px-2 rounded-lg border border-slate-300">
                      <span className="block text-[10px] uppercase tracking-wider text-slate-600">Avg Speed</span>
                      <span className="text-base font-black font-mono">⏱ {questionStats.avg_time_seconds || 0}s</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs text-muted pt-1">
                    <span>Awaiting player submissions…</span>
                    <span>Tie-breakers evaluated by submission speed</span>
                  </div>
                )}
              </div>

              {/* PRIMARY HOST ACTION: BIG NEXT QUESTION BUTTON */}
              <div className="pt-2">
                <button
                  id="btn-host-next-question"
                  onClick={onNext}
                  className={`w-full py-4 px-6 rounded-2xl font-black text-lg shadow-lg flex items-center justify-center gap-3 transition-all ${
                    liveQuestion.ended
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white animate-bounce shadow-emerald-200'
                      : 'bg-primary-600 hover:bg-primary-700 text-white shadow-primary-200'
                  }`}
                >
                  {isLastQuestion ? (
                    <>
                      <span>🏁</span>
                      <span>Finish Quiz & View Final Podium →</span>
                    </>
                  ) : liveQuestion.ended ? (
                    <>
                      <span>Next Question {qNum + 1} of {totalQ}</span>
                      <span>⏭</span>
                    </>
                  ) : (
                    <>
                      <span>Advance to Next Question {qNum + 1}</span>
                      <span>⏭</span>
                    </>
                  )}
                </button>
                <p className="text-center text-xs text-muted mt-2">
                  {liveQuestion.ended
                    ? 'All answers are evaluated. Click above to send the next question to players.'
                    : 'Clicking Next Question will close and evaluate the current question immediately.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="card text-center py-16">
              <div className="animate-pulse text-4xl mb-3">⏳</div>
              <p className="text-muted font-medium">Starting question...</p>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: LIVE STANDINGS & MOVEMENT OF POSITIONS (5 Cols) */}
        <section className="lg:col-span-5 space-y-6">
          <div className="card shadow-md border-t-4 border-t-amber-500 space-y-4">
            <div className="flex items-center justify-between border-b border-border/80 pb-3">
              <div>
                <h3 className="font-extrabold text-navy text-base flex items-center gap-2">
                  <span>🏆</span> Live Leaderboard & Movement
                </h3>
                <p className="text-xs text-muted">Real-time positions & rank shifts after each round</p>
              </div>
              <span className="badge badge-yellow font-bold text-xs">
                {liveLeaderboard.length} Players
              </span>
            </div>

            {/* Top 1 Spotlight (Champion Card) */}
            {liveLeaderboard.length > 0 ? (
              <div className="space-y-3">
                {/* 1st Place Highlight */}
                {liveLeaderboard[0] && (
                  <div className="bg-gradient-to-r from-amber-50 via-yellow-50 to-amber-100 border-2 border-amber-400 rounded-2xl p-4 shadow-sm relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">🥇</span>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wider">
                              Leader
                            </span>
                            <RankMovementBadge
                              rankChange={liveLeaderboard[0].rank_change}
                              previousRank={liveLeaderboard[0].previous_rank}
                            />
                          </div>
                          <p className="text-lg font-black text-navy truncate max-w-[160px]">
                            {liveLeaderboard[0].name}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-2xl font-black text-amber-900 font-mono">
                          {liveLeaderboard[0].total_score} pts
                        </span>
                        <div className="text-[11px] font-semibold text-amber-800 flex items-center justify-end gap-1.5 mt-0.5">
                          <span>🎯 {liveLeaderboard[0].correct_answers} correct</span>
                          <span>•</span>
                          <span>⏱ {Number(liveLeaderboard[0].total_time_seconds || 0).toFixed(1)}s</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2nd, 3rd, and rest of leaderboard */}
                <div className="divide-y divide-border border border-border rounded-xl overflow-hidden max-h-[380px] overflow-y-auto">
                  {liveLeaderboard.slice(1).map((player, idx) => {
                    const rankNum = idx + 2;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 transition-colors ${
                          rankNum === 2
                            ? 'bg-slate-50'
                            : rankNum === 3
                            ? 'bg-orange-50/40'
                            : 'hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                              rankNum === 2
                                ? 'bg-slate-200 text-slate-700'
                                : rankNum === 3
                                ? 'bg-orange-200 text-orange-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {rankNum === 2 ? '🥈' : rankNum === 3 ? '🥉' : rankNum}
                          </span>

                          <RankMovementBadge
                            rankChange={player.rank_change}
                            previousRank={player.previous_rank}
                          />

                          <span className="font-bold text-sm text-navy truncate max-w-[120px] sm:max-w-[150px]">
                            {player.name}
                          </span>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <span className="font-bold text-sm text-primary-600 font-mono block">
                            {player.total_score} pts
                          </span>
                          <span className="text-[10px] text-muted font-medium">
                            {player.correct_answers} hit · ⏱ {Number(player.total_time_seconds || 0).toFixed(1)}s
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-border">
                <span className="text-3xl block mb-2">👥</span>
                <p className="text-sm font-semibold text-navy">
                  {participantCount > 0 ? `${participantCount} Players Connected` : 'Waiting for Players…'}
                </p>
                <p className="text-xs text-muted max-w-xs mx-auto mt-1">
                  Live standings and position movements (▲ / ▼) will update right here after Question 1 is answered!
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* End Quiz Modal */}
      <Modal open={endModal} title="End Quiz?" onClose={() => setEndModal(false)} danger>
        <p className="text-muted text-sm mb-5">
          This will immediately end the quiz for all {participantCount} participants and show the final celebration podium and full analytics.
        </p>
        <div className="flex gap-3 justify-end">
          <button className="btn-secondary" onClick={() => setEndModal(false)}>
            Cancel
          </button>
          <button id="btn-confirm-end-quiz" className="btn-danger" onClick={handleEndQuiz}>
            End Quiz
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default HostLiveControls;
