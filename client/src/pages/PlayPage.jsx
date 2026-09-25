import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import socket, { EVENTS } from '../socket/socketClient';
import useSocket from '../hooks/useSocket';
import TimerDisplay from '../components/player/TimerDisplay';
import ConnectionStatus from '../components/common/ConnectionStatus';
import { getOrdinal } from '../utils/helpers';

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
  const [selectedOption, setSelectedOption] = useState(null);
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
            setSelectedOption(data.currentState.alreadyAnswered);
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
      setSelectedOption(data.alreadyAnswered || null);
      setView(data.alreadyAnswered ? VIEWS.ANSWERED : VIEWS.QUESTION);
      setPaused(false);
    });

    on(EVENTS.ANSWER_ACCEPTED, ({ selectedOption: opt }) => {
      setSelectedOption(opt);
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
    if (selectedOption || !question || question.ended) return;
    setSelectedOption(option);
    socket.emit(EVENTS.SUBMIT_ANSWER, {
      quizCode,
      questionId: question.questionId,
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
    return (
      <QuestionScreen
        question={question}
        selectedOption={selectedOption}
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
  <div className="min-h-screen bg-surface flex items-center justify-center p-4">
    {children}
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
    <div className="min-h-screen bg-surface flex flex-col">
      {/* Top bar */}
      <div className="bg-primary-600 text-white px-4 py-2.5 flex items-center justify-between flex-shrink-0 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded">
            Q{question.questionNumber}/{question.totalQuestions}
          </span>
          <span className="font-semibold text-sm truncate max-w-[110px] sm:max-w-none">{name}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Small box in header for position */}
          {myRank?.rank ? (
            <div className="bg-white/20 border border-white/30 rounded-lg px-2.5 py-1 flex items-center gap-1.5 text-xs font-bold shadow-sm animate-fade-in">
              <span>{myRank.rank === 1 ? '🥇' : myRank.rank === 2 ? '🥈' : myRank.rank === 3 ? '🥉' : '🏆'}</span>
              <span>{getOrdinal(myRank.rank)}</span>
              <span className="text-white/40">|</span>
              <span className="text-amber-200 font-extrabold">{myRank.total_score} pts</span>
            </div>
          ) : null}
          <ConnectionStatus className="text-white opacity-90" />
        </div>
      </div>

      <div className="flex-1 flex flex-col px-4 py-5 max-w-lg mx-auto w-full">
        {/* Timer + paused */}
        <div className="flex justify-center mb-5">
          {paused ? (
            <div className="flex items-center gap-2 text-warning font-semibold">
              ⏸ Quiz paused
            </div>
          ) : question.ended ? (
            <div className="bg-slate-100 text-slate-700 font-bold px-4 py-2 rounded-full text-sm border border-slate-300">
              {question.allAnswered ? '✓ All Players Answered' : "⌛ Time's Up"}
            </div>
          ) : (
            <TimerDisplay endsAt={question.endsAt} />
          )}
        </div>

        {/* Question text */}
        <div className="card mb-5 flex-shrink-0">
          <p className="text-base font-semibold text-navy leading-snug text-center">
            {question.questionText}
          </p>
        </div>

        {/* Answer options */}
        <div className="space-y-3 flex-1">
          {options.map(([key, text]) => {
            const isSelected = selectedOption === key;
            const disabled = !!selectedOption || question.ended;

            return (
              <button
                key={key}
                id={`answer-btn-${key}`}
                onClick={() => onAnswer(key)}
                disabled={disabled}
                className={`answer-btn p-4 text-sm ${isSelected ? 'selected' : ''}`}
                aria-pressed={isSelected}
              >
                <div className="flex items-center gap-3">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0
                    ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-navy'}`}>
                    {key}
                  </span>
                  <span>{text}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Status banner */}
        {question.ended ? (
          <div className="mt-5 p-4 rounded-xl bg-slate-50 border border-slate-200 text-center animate-fade-in shadow-sm">
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
            <div className="inline-flex items-center gap-2 bg-primary-50 text-primary-700 border border-primary-200 rounded-full px-4 py-2 text-sm font-semibold">
              ✓ Answer recorded — waiting for other players…
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const EndedScreen = ({ name, finalData, myRank }) => (
  <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-4 text-center">
    <div className="w-full max-w-sm animate-slide-up">
      <div className="text-6xl mb-4">🎉</div>
      <h1 className="text-3xl font-bold text-navy mb-2">Quiz Complete!</h1>
      <p className="text-muted mb-4">Thank you for participating, {name}!</p>

      {/* Individual player result */}
      {myRank && (
        <div className="bg-primary-50 border-2 border-primary-300 rounded-2xl p-4 mb-5">
          <p className="text-xs font-bold text-primary-700 uppercase tracking-wider">Your Final Result</p>
          <p className="text-3xl font-black text-navy mt-1">Rank #{myRank.rank}</p>
          <p className="text-xl font-bold text-primary-600 mt-1">{myRank.total_score} points</p>
        </div>
      )}

      {finalData?.top3?.length > 0 && (
        <div className="card mb-4">
          <p className="text-xs text-muted font-semibold uppercase tracking-wider mb-3">Top 3</p>
          {finalData.top3.map((p, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <span className="text-lg">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
              <span className="font-semibold text-navy flex-1 text-left">{p.name}</span>
              <span className="font-bold text-primary-600">{p.total_score} pts</span>
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
        className="btn-primary w-full"
      >
        Play Again
      </button>
    </div>
  </div>
);

export default PlayPage;
