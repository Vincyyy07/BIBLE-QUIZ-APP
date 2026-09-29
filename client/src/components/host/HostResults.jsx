import Footer from '../common/Footer';

const HostResults = ({ quiz, results, onExport, onNewQuiz, onBackToDashboard }) => {
  const leaderboard = results?.leaderboard || [];
  const stats = results?.stats || {};
  const questionStats = results?.questionStats || [];

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <div>
        {/* Responsive Header */}
        <div className="bg-white border-b border-border px-4 sm:px-6 py-3 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-2xs">
          <div className="flex items-center gap-3">
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="btn-secondary btn-sm flex items-center gap-1.5 flex-shrink-0"
                title="Return to Dashboard"
              >
                <span>←</span> Dashboard
              </button>
            )}
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-bold text-navy truncate">{quiz?.title}</h1>
              <p className="text-xs sm:text-sm text-muted">Final Results & Accuracy</p>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button onClick={onExport} className="btn-secondary flex-1 sm:flex-none text-xs sm:text-sm py-2 font-semibold" id="btn-export-csv">
              ⬇ Export Excel/CSV
            </button>
            {onBackToDashboard && (
              <button onClick={onBackToDashboard} className="btn-primary flex-1 sm:flex-none text-xs sm:text-sm py-2 font-semibold" id="btn-return-dashboard">
                🏠 Back to Dashboard
              </button>
            )}
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
          {/* Tie-breaker explanation banner */}
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-3.5 sm:p-4 flex items-start sm:items-center gap-3 text-xs sm:text-sm text-primary-900 shadow-2xs">
            <span className="text-xl flex-shrink-0">⏱️</span>
            <div>
              <span className="font-bold">Evaluation & Tie-Breaker Rule:</span> Ranking is calculated primarily by accuracy and score. If players finish with the same score, the player with the faster cumulative response time is awarded the higher rank!
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 sm:gap-4">
            <div className="card text-center p-3 sm:p-5">
              <p className="text-2xl sm:text-3xl font-extrabold text-navy font-mono">{stats.total_participants || 0}</p>
              <p className="text-[11px] sm:text-xs text-muted mt-1 font-medium">Total Players</p>
            </div>
            <div className="card text-center p-3 sm:p-5">
              <p className="text-2xl sm:text-3xl font-extrabold text-primary-600 font-mono">{stats.total_questions || 0}</p>
              <p className="text-[11px] sm:text-xs text-muted mt-1 font-medium">Questions</p>
            </div>
            <div className="card text-center p-3 sm:p-5">
              <p className="text-2xl sm:text-3xl font-extrabold text-success font-mono">{stats.participated || 0}</p>
              <p className="text-[11px] sm:text-xs text-muted mt-1 font-medium">Participated</p>
            </div>
          </div>

          {/* Top 3 Podium (Responsive 1-col on mobile, 3-col on tablet/desktop) */}
          {leaderboard.length > 0 && (
            <div className="card p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold text-navy mb-4 flex items-center gap-2">
                <span>🏆</span> Top Results & Winners Podium
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
                {['🥇', '🥈', '🥉'].map((medal, i) => (
                  leaderboard[i] && (
                    <div key={i} className={`text-center rounded-2xl p-4 sm:p-5 border-2 shadow-2xs transition-all
                      ${i === 0 ? 'border-yellow-400 bg-yellow-50/70 sm:order-2 sm:scale-105'
                        : i === 1 ? 'border-slate-300 bg-slate-50/70 sm:order-1'
                        : 'border-orange-300 bg-orange-50/70 sm:order-3'}`}>
                      <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">{medal}</div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-0.5">
                        {i === 0 ? '1st Place Winner' : i === 1 ? '2nd Place' : '3rd Place'}
                      </p>
                      <p className="font-extrabold text-navy text-base sm:text-lg truncate">{leaderboard[i].name}</p>
                      <p className="text-primary-600 font-black text-2xl sm:text-3xl my-1 font-mono">{leaderboard[i].total_score} pts</p>
                      <div className="flex items-center justify-center gap-2 mt-2 text-xs font-semibold text-slate-700 flex-wrap">
                        <span className="bg-white/90 px-2 py-0.5 rounded-md border border-slate-200">
                          🎯 {leaderboard[i].accuracy_percent !== undefined ? `${leaderboard[i].accuracy_percent}%` : `${leaderboard[i].correct_answers} correct`}
                        </span>
                        <span className="bg-white/90 px-2 py-0.5 rounded-md border border-slate-200">
                          ⏱ {Number(leaderboard[i].total_time_seconds || 0).toFixed(1)}s
                        </span>
                      </div>
                    </div>
                  )
                ))}
              </div>

              {/* Full leaderboard table with horizontal scroll wrapper for mobile */}
              <div className="border border-border rounded-xl overflow-x-auto shadow-2xs">
                <table className="w-full text-xs sm:text-sm min-w-[500px]">
                  <thead className="bg-slate-50 border-b border-border">
                    <tr>
                      <th className="text-left px-3.5 py-2.5 text-muted font-bold text-xs uppercase tracking-wider">Rank</th>
                      <th className="text-left px-3.5 py-2.5 text-muted font-bold text-xs uppercase tracking-wider">Participant</th>
                      <th className="text-right px-3.5 py-2.5 text-muted font-bold text-xs uppercase tracking-wider">Score</th>
                      <th className="text-right px-3.5 py-2.5 text-muted font-bold text-xs uppercase tracking-wider">Accuracy</th>
                      <th className="text-right px-3.5 py-2.5 text-muted font-bold text-xs uppercase tracking-wider">Total Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {leaderboard.map((row, i) => (
                      <tr key={i} className={i < 3 ? 'bg-primary-50/40 font-medium' : 'hover:bg-slate-50'}>
                        <td className="px-3.5 py-2.5 font-bold text-slate-600 font-mono">
                          {i === 0 ? '🥇 1' : i === 1 ? '🥈 2' : i === 2 ? '🥉 3' : `#${row.rank}`}
                        </td>
                        <td className="px-3.5 py-2.5 font-bold text-navy truncate max-w-[180px]">{row.name}</td>
                        <td className="px-3.5 py-2.5 text-right font-black text-primary-600 font-mono text-sm sm:text-base">{row.total_score} pts</td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-slate-700 font-mono">
                          {row.accuracy_percent !== undefined ? `${row.accuracy_percent}%` : `${row.correct_answers} correct`}
                          <span className="text-[11px] text-muted ml-1">({row.correct_answers} hit)</span>
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-semibold text-slate-600">
                          {row.total_time_seconds ? `${Number(row.total_time_seconds).toFixed(1)}s` : '0.0s'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Per-question stats */}
          {questionStats.length > 0 && (
            <div className="card p-4 sm:p-6 shadow-sm">
              <h2 className="text-base sm:text-lg font-bold text-navy mb-4 flex items-center gap-2">
                <span>📊</span> Question-by-Question Breakdown
              </h2>
              <div className="space-y-3">
                {questionStats.map((q, i) => {
                  const total = parseInt(q.answered) || 0;
                  const correct = parseInt(q.correct) || 0;
                  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                  return (
                    <div key={i} className="border border-border rounded-xl p-3.5 sm:p-4 bg-slate-50/50">
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1.5 mb-2">
                        <p className="text-xs sm:text-sm font-bold text-navy flex-1">
                          <span className="bg-primary-100 text-primary-800 font-mono px-2 py-0.5 rounded mr-2 text-xs">Q{q.question_number}</span>
                          {q.question_text}
                        </p>
                        <span className={`badge self-start sm:self-auto flex-shrink-0 text-xs font-bold ${
                          pct >= 70 ? 'badge-green' : pct >= 40 ? 'badge-yellow' : 'badge-red'
                        }`}>
                          {pct}% answered correctly
                        </span>
                      </div>
                      <div className="flex gap-4 text-xs text-muted font-medium mt-1">
                        <span>{q.answered} submissions</span>
                        <span className="text-success font-bold">✓ {q.correct} correct</span>
                        <span className="text-danger font-bold">✕ {q.incorrect} incorrect</span>
                      </div>
                      <div className="h-2 bg-slate-200/80 rounded-full mt-2.5 overflow-hidden">
                        <div
                          className="h-full bg-success rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default HostResults;
