import { BarChart3, Info, Keyboard, LogIn, LogOut, Settings, Sparkles, UserRound } from "lucide-react";
import type { AuthState } from "../auth/useAuth";
import { Brand } from "./Brand";

interface HeaderProps {
  hidden?: boolean;
  onHome: () => void;
  onHistory: () => void;
  onAbout: () => void;
  onSettings: () => void;
  auth: AuthState;
}

function HeaderButton({ label, children, onClick }: React.PropsWithChildren<{ label: string; onClick: () => void }>) {
  return (
    <button className="header-button" type="button" aria-label={label} title={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function Header({ hidden = false, onHome, onHistory, onAbout, onSettings, auth }: HeaderProps) {
  const accountLabel = auth.user?.email?.split("@")[0] || "account";
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
        {auth.user ? (
          <button className="auth-button signed-in" type="button" onClick={() => void auth.signOut()} title={`Sign out of ${accountLabel}`}>
            <UserRound /><span>{accountLabel}</span><LogOut />
          </button>
        ) : (
          <button className="auth-button" type="button" onClick={() => void auth.signInWithGoogle()} disabled={auth.loading} title="Sign in with Google">
            <LogIn /><span>{auth.loading ? "loading" : "sign in"}</span>
          </button>
        )}
      </nav>
    </header>
  );
}
