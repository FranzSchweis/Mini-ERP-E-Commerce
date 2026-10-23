import { FormEvent, useState } from 'react';
import { Account, login } from '../../lib/api';

type Props = { onAuthenticated: (account: Account) => void; theme: 'light' | 'dark'; onToggleTheme: () => void };

export default function LoginPage({ onAuthenticated, theme, onToggleTheme }: Props) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const account = await login(username.trim(), password);
      onAuthenticated(account);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in. Check that the backend is running.');
    } finally {
      setBusy(false);
    }
  }

  return <main className="login-screen">
    <div className="login-background login-glow-one"/><div className="login-background login-glow-two"/>
    <header className="login-topbar"><div className="brand-lockup"><span className="brand-mark">DS</span><span>Del <i>&amp;</i> Ship</span></div><button className="theme-toggle" type="button" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>{theme === 'light' ? '◐' : '☼'}<span>{theme === 'light' ? 'Dark mode' : 'Light mode'}</span></button></header>
    <section className="login-layout">
      <div className="login-intro"><span className="eyebrow">FULFILLMENT OPERATIONS</span><h1>Every shipment,<br/><em>in motion.</em></h1><p>One clear workspace to prepare, dispatch, and track deliveries through to the doorstep.</p><div className="login-proof"><span className="proof-dot"/><span>Shipment operations · Live workspace</span></div></div>
      <form className="login-card" onSubmit={submit}>
        <div className="login-card-heading"><span className="login-icon">↗</span><span className="eyebrow">WELCOME BACK</span><h2>Sign in to continue</h2><p>Use your Del &amp; Ship account to open the operations workspace.</p></div>
        {error && <div className="login-error" role="alert">{error}</div>}
        <label className="field-label">Username<input autoComplete="username" autoFocus required value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your username" /></label>
        <label className="field-label">Password<input autoComplete="current-password" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Your password" /></label>
        <button className="button-primary login-submit" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}<span aria-hidden="true">→</span></button>
        <p className="login-footnote">Need an account? Ask your administrator to create one for you.</p>
      </form>
    </section>
    <footer className="login-footer"><span>DEL &amp; SHIP</span><span>Secure local operations portal</span></footer>
  </main>;
}
