import { io } from 'socket.io-client';

const getSocketUrl = () => {
  let url = (import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || '').trim();
  if (url) {
    url = url.replace(/\/+$/, '');
    url = url.replace(/\/api$/, '');
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    if (typeof window !== 'undefined' && window.location?.protocol === 'https:' && url.startsWith('http://') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
      url = url.replace('http://', 'https://');
    }
    return url;
  }
  if (typeof window !== 'undefined' && window.location?.hostname) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
    return 'https://server-production-0c3b.up.railway.app';
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
  // Client â†’ Server (player)
  JOIN_QUIZ:          'join_quiz',
  SUBMIT_ANSWER:      'submit_answer',
  RECONNECT_SESSION:  'reconnect_session',
  // Client â†’ Server (host)
  HOST_JOIN:          'host_join',
  START_QUIZ:         'start_quiz',
  NEXT_QUESTION:      'next_question',
  PAUSE_QUIZ:         'pause_quiz',
  RESUME_QUIZ:        'resume_quiz',
  END_QUIZ:           'end_quiz',
  RESTART_QUESTION:   'restart_question',
  // Display
  DISPLAY_JOIN:       'display_join',
  // Server â†’ Client
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


