import { useState, useEffect } from 'react';

const OPTION_LABELS = ['A', 'B', 'C', 'D'];
const TIMER_OPTIONS = [10, 15, 20, 30, 45, 60];

const normalizeQuestion = (q) => {
  if (!q) {
    return {
      questionText: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      correctAnswer: 'A',
      durationSeconds: 20,
      points: 10,
    };
  }
  return {
    id: q.id,
    questionText: q.questionText !== undefined ? q.questionText : (q.question_text || ''),
    optionA: q.optionA !== undefined ? q.optionA : (q.option_a || ''),
    optionB: q.optionB !== undefined ? q.optionB : (q.option_b || ''),
    optionC: q.optionC !== undefined ? q.optionC : (q.option_c || ''),
    optionD: q.optionD !== undefined ? q.optionD : (q.option_d || ''),
    correctAnswer: (q.correctAnswer || q.correct_answer || 'A').toUpperCase(),
    durationSeconds: q.durationSeconds !== undefined ? q.durationSeconds : (q.duration_seconds !== undefined ? Number(q.duration_seconds) : 20),
    points: q.points !== undefined ? Number(q.points) : 10,
  };
};

const QuestionBuilder = ({
  initialData,
  questionNumber,
  totalQuestions,
  timerOptions = TIMER_OPTIONS,
  onSave,
  onCancel,
  onDelete,
  saving,
}) => {
  const [form, setForm] = useState(() => normalizeQuestion(initialData));
  const [errors, setErrors] = useState({});
  const [customTimer, setCustomTimer] = useState(false);

  useEffect(() => {
    const normalized = normalizeQuestion(initialData);
    setForm(normalized);
    setCustomTimer(!TIMER_OPTIONS.includes(normalized.durationSeconds));
  }, [initialData]);

  const validate = () => {
    const e = {};
    if (!form.questionText.trim()) e.questionText = 'Question text is required';
    if (!form.optionA.trim()) e.optionA = 'Option A is required';
    if (!form.optionB.trim()) e.optionB = 'Option B is required';
    if (!form.optionC.trim()) e.optionC = 'Option C is required';
    if (!form.optionD.trim()) e.optionD = 'Option D is required';
    if (form.durationSeconds < 5 || form.durationSeconds > 300) e.durationSeconds = '5–300 seconds';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(form);
  };

  const optionFields = [
    { key: 'optionA', label: 'A' },
    { key: 'optionB', label: 'B' },
    { key: 'optionC', label: 'C' },
    { key: 'optionD', label: 'D' },
  ];

  return (
    <div className="card animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div>
          <p className="text-xs text-muted font-medium uppercase tracking-wider">
            Question {questionNumber}
            {totalQuestions > 0 ? ` of ${totalQuestions}` : ''}
          </p>
          <h2 className="text-lg font-semibold text-navy mt-0.5">
            {initialData?.id ? 'Edit Question' : 'New Question'}
          </h2>
        </div>
        <div className="flex gap-2">
          {onDelete && (
            <button
              id="btn-delete-question"
              type="button"
              onClick={onDelete}
              className="btn-icon text-danger hover:bg-red-50 hover:border-red-200"
              aria-label="Delete question"
            >
              🗑
            </button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Question text */}
        <div>
          <label className="label" htmlFor="q-text">Question *</label>
          <textarea
            id="q-text"
            className={`input resize-none text-base font-medium ${errors.questionText ? 'input-error' : ''}`}
            rows={3}
            placeholder="e.g. Who built the ark?"
            value={form.questionText}
            onChange={(e) => setForm({ ...form, questionText: e.target.value })}
          />
          {errors.questionText && <p className="text-danger text-xs mt-1">{errors.questionText}</p>}
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3">
          {optionFields.map(({ key, label }) => (
            <div key={key}>
              <label className="label" htmlFor={`opt-${label}`}>
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded text-xs font-bold text-white mr-1.5
                  ${form.correctAnswer === label ? 'bg-success' : 'bg-slate-400'}`}>
                  {label}
                </span>
                Option {label} {form.correctAnswer === label && '✓'}
              </label>
              <input
                id={`opt-${label}`}
                className={`input ${errors[key] ? 'input-error' : ''}`}
                placeholder={`Option ${label}…`}
                value={form[key]}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
              {errors[key] && <p className="text-danger text-xs mt-1">{errors[key]}</p>}
            </div>
          ))}
        </div>

        {/* Correct answer */}
        <div>
          <label className="label">Correct Answer *</label>
          <div className="flex gap-2">
            {OPTION_LABELS.map((opt) => (
              <button
                key={opt}
                type="button"
                id={`correct-${opt}`}
                onClick={() => setForm({ ...form, correctAnswer: opt })}
                className={`flex-1 py-2.5 rounded-lg border-2 font-bold text-sm transition-all
                  ${form.correctAnswer === opt
                    ? 'border-success bg-success text-white'
                    : 'border-border bg-white text-navy hover:border-success hover:bg-green-50'}`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* Timer + Points row */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="label">Timer</label>
            <div className="flex gap-2 flex-wrap mb-2">
              {timerOptions.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setForm({ ...form, durationSeconds: t }); setCustomTimer(false); }}
                  className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all
                    ${!customTimer && form.durationSeconds === t
                      ? 'border-primary-600 bg-primary-600 text-white'
                      : 'border-border bg-white text-navy hover:border-primary-400'}`}
                >
                  {t}s
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCustomTimer(true)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-all
                  ${customTimer
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-border bg-white text-navy hover:border-primary-400'}`}
              >
                Custom
              </button>
            </div>
            {customTimer && (
              <input
                type="number"
                min={5}
                max={300}
                className={`input w-32 ${errors.durationSeconds ? 'input-error' : ''}`}
                value={form.durationSeconds}
                onChange={(e) => setForm({ ...form, durationSeconds: parseInt(e.target.value) || 20 })}
              />
            )}
            {errors.durationSeconds && <p className="text-danger text-xs mt-1">{errors.durationSeconds}</p>}
          </div>
          <div className="w-32">
            <label className="label" htmlFor="q-points">Points</label>
            <input
              id="q-points"
              type="number"
              min={1}
              max={1000}
              className="input"
              value={form.points}
              onChange={(e) => setForm({ ...form, points: parseInt(e.target.value) || 10 })}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2 border-t border-border">
          <button type="submit" id="btn-save-question" className="btn-primary" disabled={saving}>
            {saving ? 'Saving…' : initialData?.id ? 'Save Changes' : 'Add Question'}
          </button>
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
};

export default QuestionBuilder;
