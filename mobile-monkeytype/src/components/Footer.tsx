import { Code2, Info, Keyboard, Palette, ShieldCheck } from "lucide-react";

interface FooterProps {
  hidden?: boolean;
  onAbout: () => void;
}

export function Footer({ hidden = false, onAbout }: FooterProps) {
  return (
    <footer className="site-footer chrome-fade" aria-hidden={hidden || undefined} inert={hidden ? true : undefined}>
      <div className="footer-links">
        <button type="button" onClick={onAbout}><Info /> about</button>
        <a href="https://github.com/monkeytypegame/monkeytype" target="_blank" rel="noreferrer"><Code2 /> inspiration</a>
        <span><Keyboard /> mobile first</span>
        <span><ShieldCheck /> local only</span>
      </div>
      <div className="footer-meta"><span><Palette /> serika dark</span><span>v1.0.0</span></div>
    </footer>
  );
}
