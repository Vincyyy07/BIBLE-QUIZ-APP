import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socket, { EVENTS } from '../socket/socketClient';
import useSocket from '../hooks/useSocket';
import TimerDisplay from '../components/player/TimerDisplay';
import ConnectionStatus from '../components/common/ConnectionStatus';
import { getOrdinal } from '../utils/helpers';
import Footer from '../components/common/Footer';

const VIEWS = {
  CONNECTING: 'connecting',
  WAITING:    'waiting',
  QUESTION:   'question',
  ANSWERED:   'answered',
  ENDED:      'ended',
};

const PlayPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { on } = useSocket();

  const stored = {
    quizCode:   localStorage.getItem('quizCode'),
    playerName: localStorage.getItem('playerName'),
    sessionId:  localStorage.getItem('sessionId'),
  };
  const state = location.state || stored;

  const { quizCode, playerName, sessionId, quizTitle } = state || {};

  // Redirect if no state
  useEffect(() => {
    if (!quizCode || !sessionId) {
      navigate('/join', { replace: true });
    }
  }, [quizCode, sessionId, navigate]);

  const [view, setView] = useState(VIEWS.CONNECTING);
  const [participantCount, setParticipantCount] = useState(0);
  const [joinedData, setJoinedData] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({}); // { [questionId]: 'A' }
  const [myRank, setMyRank] = useState(null);
  const [finalData, setFinalData] = useState(null);
  const [error, setError] = useState('');
  const [paused, setPaused] = useState(false);
  const [pausedRemaining, setPausedRemaining] = useState(null);

  // Connect socket and join quiz
  useEffect(() => {
    if (!quizCode || !sessionId) return;

    if (!socket.connected) socket.connect();

    const doJoin = () => {
      // Try reconnect first, then join
      socket.emit(EVENTS.RECONNECT_SESSION, { quizCode, sessionId });
    };

    socket.on('connect', doJoin);
    if (socket.connected) doJoin();

    return () => {
      socket.off('connect', doJoin);
    };
  }, [quizCode, sessionId]);

  // Socket event listeners
  useEffect(() => {
    on(EVENTS.JOINED, (data) => {
      setJoinedData(data);
      setParticipantCount(data.count);
      setView(VIEWS.WAITING);
      setError('');
    });

    on(EVENTS.SESSION_RESTORED, (data) => {
      setJoinedData({ name: data.name, quizTitle: data.quizTitle });
      if (data.currentState) {
        // Quiz is live — check if question is active
        const remaining = new Date(data.currentState.endsAt) - Date.now();
        if (remaining > 0) {
          setQuestion({
            ...data.currentState,
            alreadyAnswered: data.currentState.alreadyAnswered || null,
          });
          if (data.currentState.alreadyAnswered) {
            setSelectedAnswers((prev) => ({
              ...prev,
              [data.currentState.questionId]: data.currentState.alreadyAnswered,
            }));
            setView(VIEWS.ANSWERED);
          } else {
            setView(VIEWS.QUESTION);
          }
        } else {
          setView(VIEWS.WAITING);
        }
      } else {
        setView(VIEWS.WAITING);
      }
      if (data.score?.rank) setMyRank(data.score);
    });

    // Session not found → fresh join
    on(EVENTS.ERROR, ({ code, message }) => {
      if (code === 'SESSION_NOT_FOUND') {
        socket.emit(EVENTS.JOIN_QUIZ, { quizCode, name: playerName, sessionId });
      } else {
        setError(message);
        setView(VIEWS.WAITING);
      }
    });

    on(EVENTS.PARTICIPANT_JOINED, ({ count }) => setParticipantCount(count));
    on(EVENTS.PARTICIPANT_COUNT, ({ count }) => setParticipantCount(count));

    on(EVENTS.QUIZ_STARTED, () => setView(VIEWS.WAITING));

    on(EVENTS.QUESTION_STARTED, (data) => {
      setQuestion(data);
      if (data.alreadyAnswered) {
        setSelectedAnswers((prev) => ({ ...prev, [data.questionId]: data.alreadyAnswered }));
        setView(VIEWS.ANSWERED);
      } else {
        setView(VIEWS.QUESTION);
      }
      setPaused(false);
    });

    on(EVENTS.ANSWER_ACCEPTED, ({ questionId: qId, selectedOption: opt }) => {
      if (qId) {
        setSelectedAnswers((prev) => ({ ...prev, [qId]: opt }));
      }
      setView(VIEWS.ANSWERED);
    });

    on(EVENTS.QUESTION_ENDED, (data) => {
      setQuestion((prev) => (prev ? { ...prev, ended: true, allAnswered: data?.allAnswered } : prev));
    });

    on('question_result', (data) => {
      setQuestion((prev) =>
        prev
          ? {
              ...prev,
              ended: true,
              allAnswered: data.allAnswered,
            }
          : prev
      );
      setMyRank({
        rank: data.rank,
        total_score: data.totalScore,
        total_participants: data.totalParticipants,
      });
    });

    on(EVENTS.MY_FINAL_RANK, (rank) => {
      setMyRank(rank);
    });

    on(EVENTS.QUIZ_PAUSED, ({ remainingMs }) => {
      setPaused(true);
      setPausedRemaining(remainingMs);
    });

    on(EVENTS.QUIZ_RESUMED, ({ endsAt }) => {
      setPaused(false);
      setQuestion((prev) => prev ? { ...prev, endsAt } : prev);
    });

    on(EVENTS.QUIZ_ENDED, ({ top3, finalLeaderboard }) => {
      setFinalData({ top3, finalLeaderboard });
      setView(VIEWS.ENDED);
    });
  }, [on, quizCode, playerName, sessionId]);

  // Submit answer
  const handleAnswer = (option) => {
    if (!question || question.ended) return;
    const qId = question.questionId;
    if (selectedAnswers[qId]) return;
    setSelectedAnswers((prev) => ({ ...prev, [qId]: option }));
    socket.emit(EVENTS.SUBMIT_ANSWER, {
      quizCode,
      questionId: qId,
      selectedOption: option,
      sessionId,
    });
    setView(VIEWS.ANSWERED);
  };

  const name = joinedData?.name || playerName;

  // ── Render views ───────────────────────────────
  if (view === VIEWS.CONNECTING) {
    return <CenteredScreen><LoadingSpinner /><p className="text-muted mt-4">Connecting…</p></CenteredScreen>;
  }

  if (view === VIEWS.ENDED) {
    return <EndedScreen name={name} finalData={finalData} myRank={myRank} />;
  }

  if (view === VIEWS.QUESTION || view === VIEWS.ANSWERED) {
    const currentSelectedOption = question?.questionId ? (selectedAnswers[question.questionId] || null) : null;
    return (
      <QuestionScreen
        key={`q-${question?.questionId || question?.questionNumber}`}
        question={question}
        selectedOption={currentSelectedOption}
        onAnswer={handleAnswer}
        paused={paused}
        view={view}
        name={name}
        myRank={myRank}
      />
    );
  }

  // WAITING view
  return (
    <CenteredScreen>
      <div className="text-center w-full max-w-sm px-4">
        <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-5">
          <span className="text-white text-2xl">✝</span>
        </div>
        <h1 className="text-2xl font-bold text-navy mb-1">You're In!</h1>
        <p className="text-lg font-semibold text-primary-600 mb-1">{name}</p>
        <p className="text-muted text-sm mb-6">{joinedData?.quizTitle || quizTitle}</p>

        <div className="card-sm mb-4">
          <p className="text-sm font-medium text-muted text-center">Waiting for the host to start…</p>
          <div className="flex justify-center mt-3">
            <LoadingDots />
          </div>
        </div>

        {participantCount > 0 && (
          <p className="text-xs text-muted">{participantCount} participant{participantCount !== 1 ? 's' : ''} joined</p>
        )}

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-danger rounded-lg px-3 py-2.5 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4">
          <ConnectionStatus />
        </div>
      </div>
    </CenteredScreen>
  );
};

// ── Sub-components ─────────────────────────────
const CenteredScreen = ({ children }) => (
  <div className="min-h-screen bg-surface flex flex-col justify-between">
    <div className="flex-1 flex items-center justify-center p-4">
      {children}
    </div>
    <Footer />
  </div>
);

const LoadingSpinner = () => (
  <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
);

const LoadingDots = () => (
  <div className="flex gap-1.5">
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-2 h-2 bg-primary-400 rounded-full animate-bounce"
        style={{ animationDelay: `${i * 0.15}s` }}
      />
    ))}
  </div>
);

const QuestionScreen = ({ question, selectedOption, onAnswer, paused, view, name, myRank }) => {
  if (!question) return null;

  const options = question.options
    ? Object.entries(question.options)
    : [['A', question.optionA], ['B', question.optionB], ['C', question.optionC], ['D', question.optionD]];

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-between">
      <div>
        {/* Top bar with sticky mobile header */}
        <div className="bg-primary-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between flex-shrink-0 shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded">
              Q{question.questionNumber}/{question.totalQuestions}
            </span>
            <span className="font-semibold text-xs sm:text-sm truncate max-w-[100px] sm:max-w-none">{name}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Small box in header for position */}
            {myRank?.rank ? (
              <div className="bg-white/20 border border-white/30 rounded-lg px-2 sm:px-2.5 py-1 flex items-center gap-1 sm:gap-1.5 text-xs font-bold shadow-xs animate-fade-in">
                <span>{myRank.rank === 1 ? '🥇' : myRank.rank === 2 ? '🥈' : myRank.rank === 3 ? '🥉' : '🏆'}</span>
                <span>{getOrdinal(myRank.rank)}</span>
                <span className="text-white/40">|</span>
                <span className="text-amber-200 font-extrabold">{myRank.total_score} pts</span>
              </div>
            ) : null}
            <ConnectionStatus className="text-white opacity-90 text-xs" />
          </div>
        </div>

        <div className="flex-1 flex flex-col px-3 sm:px-4 py-4 sm:py-5 max-w-lg mx-auto w-full">
          {/* Timer + paused */}
          <div className="flex justify-center mb-4 sm:mb-5">
            {paused ? (
              <div className="flex items-center gap-2 text-warning font-semibold text-sm">
                ⏸ Quiz paused by host
              </div>
            ) : question.ended ? (
              <div className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-full text-xs sm:text-sm border border-slate-300">
                {question.allAnswered ? '✓ All Players Answered' : "⌛ Time's Up"}
              </div>
            ) : (
              <TimerDisplay endsAt={question.endsAt} />
            )}
          </div>

          {/* Question text */}
          <div className="card mb-4 sm:mb-5 p-4 sm:p-6 flex-shrink-0 shadow-sm border border-border/80">
            <p className="text-base sm:text-lg font-bold text-navy leading-snug text-center">
              {question.questionText}
            </p>
          </div>

          {/* Answer options (large touch targets for mobile thumb tapping) */}
          <div className="space-y-2.5 sm:space-y-3 flex-1">
            {options.map(([key, text]) => {
              const isSelected = selectedOption === key;
              const disabled = !!selectedOption || question.ended;

              return (
                <button
                  key={key}
                  id={`answer-btn-${key}`}
                  onClick={() => onAnswer(key)}
                  disabled={disabled}
                  className={`answer-btn p-3.5 sm:p-4 text-sm sm:text-base font-semibold min-h-[52px] sm:min-h-[56px] ${
                    isSelected ? 'selected' : ''
                  }`}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0 transition-transform ${
                      isSelected ? 'bg-white/20 text-white scale-105' : 'bg-slate-100 text-navy'}`}>
                      {key}
                    </span>
                    <span className="text-left flex-1 break-words">{text}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Status banner */}
          {question.ended ? (
            <div className="mt-4 sm:mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center animate-fade-in shadow-xs">
              <div className="flex items-center justify-center gap-2 text-navy font-bold text-sm mb-1">
                <span>✓</span>
                <span>Question completed</span>
              </div>
              <p className="text-xs text-muted mb-3 font-medium">
                Waiting for host to start next question…
              </p>
              <div className="flex justify-center">
                <LoadingDots />
              </div>
            </div>
          ) : selectedOption ? (
            <div className="mt-4 text-center animate-fade-in">
              <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-full px-4 py-2 text-xs sm:text-sm font-semibold shadow-2xs">
                <span>✓</span>
                <span>Answer locked in — waiting for round to conclude…</span>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Subtle Mobile In-Game Footer */}
      <footer className="w-full py-2.5 px-3 text-center border-t border-slate-200/50 bg-white/40 text-[11px] text-slate-400">
        Developer @Bethesda Baptist Church
      </footer>
    </div>
  );
};

const EndedScreen = ({ name, finalData, myRank }) => (
  <div className="min-h-screen bg-surface flex flex-col justify-between">
    <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="text-5xl sm:text-6xl mb-3 sm:mb-4">🎉</div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-navy mb-2">Quiz Complete!</h1>
        <p className="text-muted text-sm mb-4">Thank you for participating, {name}!</p>

        {/* Individual player result */}
        {myRank && (
          <div className="bg-primary-50 border-2 border-primary-300 rounded-2xl p-4 sm:p-5 mb-5 shadow-sm">
            <p className="text-xs font-bold text-primary-700 uppercase tracking-wider">Your Final Result</p>
            <p className="text-3xl sm:text-4xl font-black text-navy mt-1">Rank #{myRank.rank}</p>
            <p className="text-lg sm:text-xl font-bold text-primary-600 mt-1">{myRank.total_score} points</p>
          </div>
        )}

        {finalData?.top3?.length > 0 && (
          <div className="card mb-4 p-4 shadow-sm">
            <p className="text-xs text-muted font-bold uppercase tracking-wider mb-3">Top 3 Winners</p>
            {finalData.top3.map((p, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                <span className="text-xl">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <span className="font-semibold text-navy flex-1 text-left truncate">{p.name}</span>
                <span className="font-bold text-primary-600 font-mono">{p.total_score} pts</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            localStorage.removeItem('quizCode');
            localStorage.removeItem('sessionId');
            localStorage.removeItem('playerName');
            window.location.href = '/join';
          }}
          className="btn-primary btn-lg w-full font-bold shadow-md"
        >
          Play Again
        </button>
      </div>
    </div>

    <Footer />
  </div>
);

export default PlayPage;
