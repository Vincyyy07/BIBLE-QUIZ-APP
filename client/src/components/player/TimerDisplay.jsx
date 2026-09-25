import useTimer from '../../hooks/useTimer';
import { formatTime } from '../../utils/helpers';

/**
 * Timer ring display for the participant phone UI
 */
const TimerDisplay = ({ endsAt, className = '' }) => {
  const { remaining, isUrgent, isWarning } = useTimer(endsAt);

  const colorClass = isUrgent
    ? 'text-danger border-danger'
    : isWarning
    ? 'text-warning border-warning'
    : 'text-primary-600 border-primary-300';

  return (
    <div
      className={`flex items-center justify-center w-16 h-16 rounded-full border-4
                  font-bold text-2xl tabular-nums transition-colors duration-300
                  ${colorClass} ${className}`}
      role="timer"
      aria-label={`${remaining} seconds remaining`}
    >
      {formatTime(remaining)}
    </div>
  );
};

export default TimerDisplay;
