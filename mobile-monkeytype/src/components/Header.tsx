import { BarChart3, Info, Keyboard, Settings, Sparkles } from "lucide-react";
import { Brand } from "./Brand";

interface HeaderProps {
  hidden?: boolean;
  onHome: () => void;
  onHistory: () => void;
  onAbout: () => void;
  onSettings: () => void;
}

function HeaderButton({ label, children, onClick }: React.PropsWithChildren<{ label: string; onClick: () => void }>) {
  return (
    <button className="header-button" type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function Header({ hidden = false, onHome, onHistory, onAbout, onSettings }: HeaderProps) {
  return (
    <header className="site-header chrome-fade" aria-hidden={hidden || undefined} inert={hidden ? true : undefined}>
      <button className="brand-button" type="button" onClick={onHome}>
        <Brand />
      </button>
      <nav className="main-nav" aria-label="Main navigation">
        <HeaderButton label="New typing test" onClick={onHome}><Keyboard /></HeaderButton>
        <HeaderButton label="Your progress" onClick={onHistory}><BarChart3 /></HeaderButton>
        <HeaderButton label="About this test" onClick={onAbout}><Info /></HeaderButton>
        <HeaderButton label="Test settings" onClick={onSettings}><Settings /></HeaderButton>
      </nav>
      <nav className="account-nav" aria-label="Keyboard status">
        <span className="native-badge" title="Native autocorrect is enabled"><Sparkles /><span>native</span></span>
      </nav>
    </header>
  );
}
