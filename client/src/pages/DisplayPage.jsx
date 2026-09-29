import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import socket, { EVENTS } from '../socket/socketClient';
import useSocket from '../hooks/useSocket';
import useTimer from '../hooks/useTimer';
import { formatTime } from '../utils/helpers';

import QRCodeCard from '../components/common/QRCodeCard';

const DisplayPage = () => {
  const { code } = useParams();
  const quizCode = code?.toUpperCase();
  const { on } = useSocket();

  const [view, setView] = useState('waiting');
  // views: waiting | question | result | final

  const [quizTitle, setQuizTitle] = useState('Bible Quiz');
  const [participantCount, setParticipantCount] = useState(0);
  const [question, setQuestion] = useState(null);
  const [top10, setTop10] = useState([]);
  const [finalLeaderboard, setFinalLeaderboard] = useState([]);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (!quizCode) return;
    if (!socket.connected) socket.connect();

    const doJoin = () => {
      socket.emit(EVENTS.DISPLAY_JOIN, { quizCode });
    };

    socket.on('connect', doJoin);
    if (socket.connected) doJoin();

    return () => socket.off('connect', doJoin);
  }, [quizCode]);

  useEffect(() => {
    on(EVENTS.PARTICIPANT_JOINED, ({ count, name: _n }) => setParticipantCount(count));
    on(EVENTS.PARTICIPANT_COUNT, ({ count }) => setParticipantCount(count));

    on(EVENTS.QUIZ_STARTED, ({ quizTitle: t, totalQuestions }) => {
      if (t) setQuizTitle(t);
      setView('waiting');
    });

    on(EVENTS.QUESTION_STARTED, (data) => {
      setQuestion(data);
      setView('question');
      setPaused(false);
    });

    on(EVENTS.QUESTION_ENDED, ({ allAnswered, message }) => {
      setQuestion((prev) => prev ? { ...prev, ended: true, allAnswered, message } : prev);
      setView('question');
    });

    on(EVENTS.QUIZ_PAUSED, () => setPaused(true));
    on(EVENTS.QUIZ_RESUMED, ({ endsAt }) => {
      setPaused(false);
      setQuestion((prev) => prev ? { ...prev, endsAt } : prev);
    });

    on(EVENTS.QUIZ_ENDED, ({ finalLeaderboard: fl, top3 }) => {
      setFinalLeaderboard(fl || top3 || []);
      setView('final');
    });
  }, [on]);

  if (view === 'final') return <FinalScreen quizTitle={quizTitle} leaderboard={finalLeaderboard} />;
  if (view === 'question') return <QuestionScreen quizTitle={quizTitle} question={question} paused={paused} />;

  // Waiting screen with real QR code
  return (
    <div className="projector-layout justify-center items-center p-8 md:p-16">
      <div className="w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-12 bg-white rounded-3xl p-10 md:p-16 shadow-2xl border border-border">
        {/* Left Side: Instructions */}
        <div className="flex-1 text-center md:text-left space-y-6">
          <div className="flex items-center justify-center md:justify-start gap-4">
            <div className="w-16 h-16 bg-primary-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white text-3xl font-bold">✝</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-navy">{quizTitle}</h1>
          </div>

          <div className="bg-primary-600 text-white rounded-2xl p-8 text-center md:text-left shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-primary-200 mb-1">
              ROOM CODE
            </p>
            <p className="text-6xl md:text-7xl font-bold tracking-widest font-mono">
              {quizCode}
            </p>
            <p className="text-primary-100 text-sm mt-2">
              Connect phone to church Wi-Fi and open the site or scan QR code
            </p>
          </div>

          <p className="text-2xl font-bold text-navy flex items-center justify-center md:justify-start gap-3">
            <span className="w-4 h-4 rounded-full bg-success animate-ping inline-block" />
            <span>{participantCount} participants joined</span>
          </p>
        </div>

        {/* Right Side: QR Code */}
        <div className="flex-shrink-0">
          <QRCodeCard quizCode={quizCode} size={240} className="shadow-xl" />
        </div>
      </div>

      <div className="text-center py-4 text-xs font-medium text-slate-400">
        Developer @Bethesda Baptist Church • Bible Quiz Platform
      </div>
    </div>
  );
};

// ── Question screen ─────────────────────────────
const QuestionScreen = ({ quizTitle, question, paused }) => {
  const { remaining, isUrgent, isWarning } = useTimer(paused || question?.ended ? null : question?.endsAt);

  if (!question) return null;

  const options = question.options
    ? Object.entries(question.options)
    : [['A', question.optionA], ['B', question.optionB], ['C', question.optionC], ['D', question.optionD]];

  const timerColor = question?.ended
    ? 'text-primary-700 bg-primary-50 border-primary-400'
    : isUrgent
    ? 'text-danger bg-red-50 border-danger'
    : isWarning
    ? 'text-warning bg-yellow-50 border-warning'
    : 'text-primary-600 bg-primary-50 border-primary-300';

  return (
    <div className="projector-layout">
      {/* Header bar */}
      <div className="projector-header">
        <div>
          <p className="text-primary-200 text-sm font-semibold uppercase tracking-widest">
            {quizTitle}
          </p>
          <p className="text-2xl font-bold">
            Question {question.questionNumber} of {question.totalQuestions}
          </p>
        </div>
        <div className={`text-4xl font-bold tabular-nums border-4 rounded-2xl w-32 h-24
                         flex items-center justify-center transition-colors duration-300 ${timerColor}`}>
          {question.ended ? (question.allAnswered ? '✓ Done' : '0:00') : paused ? '⏸' : formatTime(remaining)}
        </div>
      </div>

      {/* Question body */}
      <div className="flex-1 flex flex-col justify-center px-16 py-8">
        <div className="text-center mb-10">
          <h2 className="projector-question-text max-w-4xl mx-auto">
            {question.questionText}
          </h2>
        </div>

        {/* Options grid */}
        <div className="grid grid-cols-2 gap-5 max-w-5xl mx-auto w-full">
          {options.map(([key, text]) => (
            <div key={key} className="projector-option">
              <span className="projector-option-label">{key}</span>
              <span className="flex-1">{text}</span>
            </div>
          ))}
        </div>

        {/* Status notice when question ended */}
        {question.ended && (
          <div className="mt-8 text-center animate-fade-in">
            <span className="inline-block bg-primary-50 border border-primary-200 text-primary-800 font-bold text-lg px-8 py-3 rounded-full shadow-sm">
              {question.allAnswered ? '✓ All Participants Answered' : "⌛ Time's Up"} — Waiting for Next Question…
            </span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-16 py-4 border-t border-border bg-slate-50 flex justify-between text-sm text-muted">
        <span>{quizTitle}</span>
        <span>Join Code: <strong className="text-navy font-mono tracking-wider">
          {question.quizCode || ''}
        </strong></span>
      </div>
    </div>
  );
};

// ── Final results screen ────────────────────────
const FinalScreen = ({ quizTitle, leaderboard }) => {
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3, 10);

  return (
    <div className="projector-layout justify-center">
      <div className="projector-header w-full">
        <p className="text-2xl font-bold">{quizTitle}</p>
        <p className="text-primary-200 font-semibold text-lg">FINAL RESULTS</p>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-12 py-8">
        <h2 className="text-5xl font-bold text-navy mb-12 text-center">🏆 Final Results</h2>

        {/* Tie-breaker footnote */}
        <p className="text-sm font-medium text-slate-500 bg-white/70 border border-slate-200 rounded-full px-5 py-1.5 mb-8 shadow-sm">
          ⚡ Tie-Breaker Rule: Tied scores are resolved by fastest cumulative response time (seconds)
        </p>

        {/* Top 3 Podium */}
        <div className="grid grid-cols-3 gap-6 w-full max-w-4xl mb-10">
          {['🥇', '🥈', '🥉'].map((medal, i) => (
            top3[i] ? (
              <div
                key={i}
                className={`text-center rounded-2xl p-8 border-4 shadow-lg
                  ${i === 0
                    ? 'border-yellow-400 bg-yellow-50 order-2 transform scale-105'
                    : i === 1
                    ? 'border-slate-300 bg-slate-50 order-1'
                    : 'border-orange-300 bg-orange-50 order-3'}`}
              >
                <div className="text-6xl mb-3">{medal}</div>
                <p className="text-3xl font-bold text-navy mb-1 truncate">{top3[i].name}</p>
                <p className="text-4xl font-extrabold text-primary-600">{top3[i].total_score} pts</p>
                <div className="flex items-center justify-center gap-2 mt-2 text-sm font-semibold text-slate-700">
                  <span>🎯 {top3[i].accuracy_percent !== undefined ? `${top3[i].accuracy_percent}%` : `${top3[i].correct_answers} correct`}</span>
                  <span>•</span>
                  <span>⏱ {top3[i].total_time_seconds || 0}s</span>
                </div>
              </div>
            ) : null
          ))}
        </div>

        {/* 4th-10th */}
        {rest.length > 0 && (
          <div className="grid grid-cols-2 gap-3 w-full max-w-2xl">
            {rest.map((p, i) => (
              <div key={i} className="flex items-center gap-3 bg-white border border-border rounded-xl px-5 py-3 shadow-sm">
                <span className="text-xl font-bold text-muted w-8 text-center">{p.rank}.</span>
                <span className="flex-1 font-semibold text-navy text-lg truncate">{p.name}</span>
                <div className="text-right">
                  <span className="font-bold text-primary-600 text-lg block">{p.total_score} pts</span>
                  <span className="text-xs text-muted font-medium">
                    🎯 {p.accuracy_percent !== undefined ? `${p.accuracy_percent}%` : ''} · ⏱ {p.total_time_seconds || 0}s
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="text-center py-4 text-xs font-medium text-slate-400 mt-6">
          Developer @Bethesda Baptist Church • Bible Quiz Platform
        </div>
      </div>
    </div>
  );
};

export default DisplayPage;
