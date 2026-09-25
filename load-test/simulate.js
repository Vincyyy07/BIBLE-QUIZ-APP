/**
 * Bible Quiz — Socket.IO Load Test
 * Simulates N concurrent participant connections
 *
 * Usage:
 *   node load-test/simulate.js --clients 200 --code BIBLE25 --url http://localhost:3001
 *
 * What it tests:
 *   - Simultaneous WebSocket connections
 *   - Simultaneous answer submission
 *   - Reconnection handling
 *   - Server stability under load
 */

const { io } = require('socket.io-client');
const { randomUUID } = require('crypto');

const args = process.argv.slice(2);
const getArg = (name, def) => {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : def;
};

const NUM_CLIENTS  = parseInt(getArg('clients', 50));
const QUIZ_CODE    = getArg('code', 'TEST01');
const SERVER_URL   = getArg('url', 'http://localhost:3001');
const ANSWER_DELAY = parseInt(getArg('delay', 2000)); // ms after question starts

console.log(`\n🧪 Bible Quiz Load Test`);
console.log(`   Clients:  ${NUM_CLIENTS}`);
console.log(`   Code:     ${QUIZ_CODE}`);
console.log(`   Server:   ${SERVER_URL}`);
console.log(`   Delay:    ${ANSWER_DELAY}ms\n`);

const stats = {
  connected: 0,
  joined: 0,
  answers: 0,
  errors: 0,
  disconnects: 0,
};

const clients = [];

const printStats = () => {
  process.stdout.write(
    `\r  Connected: ${stats.connected}  Joined: ${stats.joined}  Answers: ${stats.answers}  Errors: ${stats.errors}  `
  );
};

for (let i = 0; i < NUM_CLIENTS; i++) {
  const sessionId = randomUUID();
  const name = `Tester_${i + 1}`;

  const client = io(SERVER_URL, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 500 + Math.random() * 1000,
  });

  let currentQuestionId = null;
  let answered = false;

  client.on('connect', () => {
    stats.connected++;
    printStats();

    // Join the quiz
    client.emit('join_quiz', { quizCode: QUIZ_CODE, name, sessionId });
  });

  client.on('joined', () => {
    stats.joined++;
    printStats();
  });

  client.on('question_started', (data) => {
    currentQuestionId = data.questionId;
    answered = false;

    // Simulate thinking time — answer after a random delay
    const delay = Math.random() * ANSWER_DELAY;
    setTimeout(() => {
      if (answered) return;
      const options = ['A', 'B', 'C', 'D'];
      const pick = options[Math.floor(Math.random() * 4)];

      client.emit('submit_answer', {
        quizCode: QUIZ_CODE,
        questionId: currentQuestionId,
        selectedOption: pick,
        sessionId,
      });
    }, delay);
  });

  client.on('answer_accepted', () => {
    answered = true;
    stats.answers++;
    printStats();
  });

  client.on('error', ({ code, message }) => {
    if (code !== 'ALREADY_ANSWERED' && code !== 'TIME_UP') {
      stats.errors++;
      printStats();
    }
  });

  client.on('disconnect', () => {
    stats.disconnects++;
    stats.connected = Math.max(0, stats.connected - 1);
    printStats();
  });

  client.on('quiz_ended', () => {
    console.log(`\n\n✅ Quiz ended. Final stats:`, stats);
    process.exit(0);
  });

  clients.push(client);

  // Stagger connections slightly to avoid thundering herd
  if (i % 10 === 9) await sleep(50);
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Print stats every second
setInterval(printStats, 1000);

// Timeout after 10 minutes
setTimeout(() => {
  console.log('\n\n⏰ Load test timeout. Final stats:', stats);
  clients.forEach(c => c.disconnect());
  process.exit(0);
}, 10 * 60 * 1000);

console.log('Connecting clients...');
