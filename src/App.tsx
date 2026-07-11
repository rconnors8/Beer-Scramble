import { useEffect, useState } from 'react';
import { useAuth } from './lib/useAuth';
import SignIn from './views/SignIn';
import Home from './views/Home';
import Match from './views/Match';

function useHashRoute(): string {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

export default function App() {
  const { session, loading, signInWithGoogle, signOut } = useAuth();
  const hash = useHashRoute();

  if (loading) {
    return <div className="center muted">Loading…</div>;
  }

  if (!session) {
    return <SignIn onSignIn={signInWithGoogle} />;
  }

  const matchMatch = hash.match(/^#\/match\/([\w-]+)/);

  return (
    <div className="app">
      <header className="topbar">
        <a href="#/" className="brand">🍺⛳ Beer-Scramble</a>
        <button className="link" onClick={signOut}>Sign out</button>
      </header>
      <main className="content">
        {matchMatch ? (
          <Match matchId={matchMatch[1]} userId={session.user.id} />
        ) : (
          <Home userId={session.user.id} />
        )}
      </main>
    </div>
  );
}
