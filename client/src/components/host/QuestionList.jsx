const QuestionList = ({ questions, selectedIdx, onSelect, onAdd, onDelete, onDuplicate, onReorder }) => {

  const moveUp = (idx) => {
    if (idx === 0) return;
    const newQ = [...questions];
    [newQ[idx - 1], newQ[idx]] = [newQ[idx], newQ[idx - 1]];
    onReorder(newQ);
  };

  const moveDown = (idx) => {
    if (idx === questions.length - 1) return;
    const newQ = [...questions];
    [newQ[idx], newQ[idx + 1]] = [newQ[idx + 1], newQ[idx]];
    onReorder(newQ);
  };

  return (
    <div className="space-y-1">
      {questions.map((q, idx) => (
        <div
          key={q.id}
          className={`group rounded-lg border cursor-pointer transition-all
            ${selectedIdx === idx
              ? 'border-primary-300 bg-primary-50'
              : 'border-transparent hover:border-border hover:bg-slate-50'}`}
        >
          <div
            className="flex items-start gap-2 p-2.5"
            onClick={() => onSelect(idx)}
          >
            <span className={`flex-shrink-0 w-6 h-6 rounded text-xs font-bold flex items-center justify-center
              ${selectedIdx === idx ? 'bg-primary-600 text-white' : 'bg-slate-200 text-muted'}`}>
              {idx + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-navy truncate leading-tight">
                {q.question_text || 'Untitled question'}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {q.correct_answer} · {q.duration_seconds}s · {q.points}pt
              </p>
            </div>
          </div>

          {/* Row actions — shown on hover */}
          <div className={`hidden group-hover:flex items-center gap-1 px-2 pb-2`}>
            <button
              title="Move up"
              disabled={idx === 0}
              onClick={() => moveUp(idx)}
              className="text-muted hover:text-navy disabled:opacity-30 text-xs p-1"
            >▲</button>
            <button
              title="Move down"
              disabled={idx === questions.length - 1}
              onClick={() => moveDown(idx)}
              className="text-muted hover:text-navy disabled:opacity-30 text-xs p-1"
            >▼</button>
            <button
              title="Duplicate"
              onClick={() => onDuplicate(q.id)}
              className="text-muted hover:text-primary-600 text-xs p-1"
            >⧉</button>
            <button
              title="Delete"
              onClick={() => onDelete(q.id)}
              className="text-muted hover:text-danger text-xs p-1 ml-auto"
            >✕</button>
          </div>
        </div>
      ))}

      <button
        id="btn-add-question-sidebar"
        onClick={onAdd}
        className="w-full mt-2 py-2 border-2 border-dashed border-border rounded-lg
                   text-xs font-medium text-muted hover:border-primary-400 hover:text-primary-600
                   transition-colors"
      >
        + Add Question
      </button>
    </div>
  );
};

export default QuestionList;
