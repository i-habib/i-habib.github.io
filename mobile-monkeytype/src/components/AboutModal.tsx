import { ShieldCheck, Sparkles } from "lucide-react";
import { Modal } from "./Modal";

export function AboutModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} title="typing, but mobile" label="about thumbtype" onClose={onClose} className="about-modal">
      <p>
        Thumbtype keeps the typing-test layout simple and lets your phone keyboard do its normal work.
        Autocorrect, suggestions, swipe typing, and smart punctuation stay on.
      </p>
      <div className="about-feature"><Sparkles /><div><strong>detected fixes</strong><p>Browsers do not reveal every autocorrection. We count a likely fix when one native replacement moves your text closer to the passage.</p></div></div>
      <div className="about-feature"><ShieldCheck /><div><strong>private by default</strong><p>Your typed text never leaves this page. Recent result summaries are stored only in this browser.</p></div></div>
      <p className="about-credit">Inspired by the public Monkeytype site. No Monkeytype source or assets are bundled here.</p>
    </Modal>
  );
}
