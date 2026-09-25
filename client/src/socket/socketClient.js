import { io } from 'socket.io-client';

const getSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) return import.meta.env.VITE_SOCKET_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    return `${window.location.protocol}//${window.location.hostname}:3001`;
  }
  return 'http://localhost:3001';
};

const SOCKET_URL = getSocketUrl();

// Create a single socket instance (lazy connect)
const socket = io(SOCKET_URL, {
  autoConnect: false,          // We connect manually after user joins
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
  transports: ['websocket', 'polling'],
});

export const EVENTS = {
  // Client → Server (player)
  JOIN_QUIZ:          'join_quiz',
  SUBMIT_ANSWER:      'submit_answer',
  RECONNECT_SESSION:  'reconnect_session',
  // Client → Server (host)
  HOST_JOIN:          'host_join',
  START_QUIZ:         'start_quiz',
  NEXT_QUESTION:      'next_question',
  PAUSE_QUIZ:         'pause_quiz',
  RESUME_QUIZ:        'resume_quiz',
  END_QUIZ:           'end_quiz',
  RESTART_QUESTION:   'restart_question',
  // Display
  DISPLAY_JOIN:       'display_join',
  // Server → Client
  JOINED:             'joined',
  PARTICIPANT_JOINED: 'participant_joined',
  PARTICIPANT_COUNT:  'participant_count',
  QUIZ_STARTED:       'quiz_started',
  QUESTION_STARTED:   'question_started',
  ANSWER_ACCEPTED:    'answer_accepted',
  QUESTION_ENDED:     'question_ended',
  ANSWERS_PROGRESS:   'answers_progress',
  MY_RANK:            'my_rank',
  MY_FINAL_RANK:      'my_final_rank',
  QUIZ_PAUSED:        'quiz_paused',
  QUIZ_RESUMED:       'quiz_resumed',
  QUIZ_ENDED:         'quiz_ended',
  SESSION_RESTORED:   'session_restored',
  ERROR:              'error',
};

export default socket;
