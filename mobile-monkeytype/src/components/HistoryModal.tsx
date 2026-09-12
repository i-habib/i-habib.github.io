import { Trash2 } from "lucide-react";
import type { RunResult } from "../types";
import { Modal } from "./Modal";

interface HistoryModalProps {
  open: boolean;
  history: RunResult[];
  onClear: () => void;
  onClose: () => void;
}

export function HistoryModal({ open, history, onClear, onClose }: HistoryModalProps) {
  return (
    <Modal open={open} title="recent results" label="saved on this device" onClose={onClose} className="history-modal">
      {history.length ? (
        <div className="history-list">
          {history.map((run) => (
            <article className="history-run" key={run.id}>
              <div><strong>{run.wpm}</strong><span>wpm</span></div>
              <div><strong>{run.accuracy}%</strong><span>accuracy</span></div>
              <div><strong>{run.fixes}</strong><span>fixes</span></div>
              <div><strong>{run.device}</strong><span>{new Date(run.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></div>
            </article>
          ))}
        </div>
      ) : (
        <div className="history-empty"><span>—</span><p>finish a test and your results will show up here.</p></div>
      )}
      {history.length > 0 && <button className="clear-history" type="button" onClick={onClear}><Trash2 /> clear history</button>}
    </Modal>
  );
}
