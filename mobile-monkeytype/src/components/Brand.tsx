import { Keyboard } from "lucide-react";

export function Brand() {
  return (
    <span className="brand" aria-label="thumbtype home">
      <span className="brand-mark" aria-hidden="true">
        <Keyboard size={25} strokeWidth={2.4} />
        <span className="brand-eyes">••</span>
      </span>
      <span className="brand-copy">
        <small>monkey see</small>
        <strong>thumbtype</strong>
      </span>
    </span>
  );
}
