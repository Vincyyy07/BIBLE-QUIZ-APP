/**
 * Generate a UUID v4 for participant session IDs
 */
export const generateSessionId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
};

/**
 * Format seconds into MM:SS display
 */
export const formatTime = (seconds) => {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}`;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/**
 * Get ordinal suffix for rank (1st, 2nd, 3rd, ...)
 */
export const getOrdinal = (n) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/**
 * Get status display info for quiz status
 */
export const getStatusInfo = (status) => {
  const map = {
    DRAFT:          { label: 'Draft',     color: 'badge-gray'   },
    WAITING:        { label: 'Waiting',   color: 'badge-yellow' },
    LIVE:           { label: 'Live',      color: 'badge-green'  },
    QUESTION_ENDED: { label: 'Paused',    color: 'badge-yellow' },
    COMPLETED:      { label: 'Completed', color: 'badge-blue'   },
  };
  return map[status] || { label: status, color: 'badge-gray' };
};

/**
 * Option labels for answer buttons
 */
export const OPTION_LABELS = ['A', 'B', 'C', 'D'];
export const OPTION_COLORS = {
  A: 'bg-blue-500',
  B: 'bg-purple-500',
  C: 'bg-orange-500',
  D: 'bg-green-600',
};

/**
 * Download a blob as a file
 */
export const downloadBlob = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};
