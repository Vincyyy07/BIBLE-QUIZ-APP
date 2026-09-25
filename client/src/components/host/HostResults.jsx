const HostResults = ({ quiz, results, onExport, onNewQuiz, onBackToDashboard }) => {
  const leaderboard = results?.leaderboard || [];
  const stats = results?.stats || {};
  const questionStats = results?.questionStats || [];

  return (
    <div className="min-h-screen bg-surface">
      <div className="bg-white border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="btn-secondary btn-sm flex items-center gap-1.5"
              title="Return to Dashboard"
            >
              <span>←</span> Dashboard
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-navy">{quiz?.title}</h1>
            <p className="text-sm text-muted">Final Results & Leaderboard</p>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={onExport} className="btn-secondary" id="btn-export-csv">
            ⬇ Export CSV
          </button>
          {onBackToDashboard && (
            <button onClick={onBackToDashboard} className="btn-primary" id="btn-return-dashboard">
              🏠 Back to Dashboard
            </button>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* Tie-breaker explanation banner */}
        <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-center gap-3 text-sm text-primary-900">
          <span className="text-xl">⏱️</span>
          <div>
            <span className="font-bold">Evaluation & Tie-Breaker Rule:</span> Ranking is calculated primarily by accuracy and score. If players finish with the same score, the player with the faster cumulative response time is awarded the higher rank!
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="card text-center">
            <p className="text-3xl font-bold text-navy">{stats.total_participants || 0}</p>
            <p className="text-xs text-muted mt-1">Total Participants</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-primary-600">{stats.total_questions || 0}</p>
            <p className="text-xs text-muted mt-1">Questions</p>
          </div>
          <div className="card text-center">
            <p className="text-3xl font-bold text-success">{stats.participated || 0}</p>
            <p className="text-xs text-muted mt-1">Participated</p>
          </div>
        </div>

        {/* Top 3 */}
        {leaderboard.length > 0 && (
          <div className="card">
            <h2 className="text-lg font-semibold text-navy mb-5">🏆 Top Results & Winners</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {['🥇', '🥈', '🥉'].map((medal, i) => (
                leaderboard[i] && (
                  <div key={i} className={`text-center rounded-xl p-5 border-2
                    ${i === 0 ? 'border-yellow-400 bg-yellow-50'
                      : i === 1 ? 'border-slate-300 bg-slate-50'
                      : 'border-orange-300 bg-orange-50'}`}>
                    <div className="text-4xl mb-2">{medal}</div>
                    <p className="font-bold text-navy text-lg truncate">{leaderboard[i].name}</p>
                    <p className="text-primary-600 font-bold text-2xl">{leaderboard[i].total_score} pts</p>
                    <div className="flex items-center justify-center gap-3 mt-2 text-xs font-semibold text-slate-700">
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                        🎯 {leaderboard[i].accuracy_percent !== undefined ? `${leaderboard[i].accuracy_percent}%` : `${leaderboard[i].correct_answers} correct`}
                      </span>
                      <span className="bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                        ⏱ {leaderboard[i].total_time_seconds || 0}s
                      </span>
                    </div>
                  </div>
                )
              ))}
            </div>

            {/* Full leaderboard table */}
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-muted font-semibold text-xs">Rank</th>
                    <th className="text-left px-4 py-2.5 text-muted font-semibold text-xs">Name</th>
                    <th className="text-right px-4 py-2.5 text-muted font-semibold text-xs">Score</th>
                    <th className="text-right px-4 py-2.5 text-muted font-semibold text-xs">Accuracy</th>
                    <th className="text-right px-4 py-2.5 text-muted font-semibold text-xs">Total Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {leaderboard.map((row, i) => (
                    <tr key={i} className={i < 3 ? 'bg-primary-50/50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-2.5 font-bold text-muted">{row.rank}</td>
                      <td className="px-4 py-2.5 font-medium text-navy">{row.name}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-primary-600">{row.total_score}</td>
                      <td className="px-4 py-2.5 text-right font-medium text-slate-700">
                        {row.accuracy_percent !== undefined ? `${row.accuracy_percent}%` : `${row.correct_answers} correct`}
                        <span className="text-xs text-muted ml-1">({row.correct_answers} hit)</span>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-600">
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
          <div className="card">
            <h2 className="text-lg font-semibold text-navy mb-4">Question Statistics</h2>
            <div className="space-y-3">
              {questionStats.map((q, i) => {
                const total = parseInt(q.answered) || 0;
                const correct = parseInt(q.correct) || 0;
                const pct = total > 0 ? Math.round((correct / total) * 100) : 0;
                return (
                  <div key={i} className="border border-border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-2">
                      <p className="text-sm font-medium text-navy flex-1 pr-4">
                        <span className="text-muted font-normal text-xs mr-2">Q{q.question_number}</span>
                        {q.question_text}
                      </p>
                      <span className={`badge flex-shrink-0 ${pct >= 70 ? 'badge-green' : pct >= 40 ? 'badge-yellow' : 'badge-red'}`}>
                        {pct}% correct
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs text-muted">
                      <span>{q.answered} answered</span>
                      <span className="text-success">{q.correct} correct</span>
                      <span className="text-danger">{q.incorrect} incorrect</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full mt-2 overflow-hidden">
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
  );
};

export default HostResults;
