import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { Match } from '../lib/types';

export default function Home({ userId }: { userId: string }) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(25);
    if (error) {
      setError(error.message);
      return;
    }
    setMatches(data ?? []);
  };

  useEffect(() => {
    void load();
  }, []);

  const createMatch = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    const { data, error } = await supabase
      .from('matches')
      .insert({ name: trimmed, created_by: userId })
      .select()
      .single();
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    window.location.hash = `#/match/${data.id}`;
  };

  const joinByCode = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setBusy(true);
    setError('');
    const { data, error } = await supabase
      .from('matches')
      .select('*')
      .eq('join_code', trimmed)
      .maybeSingle();
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    if (!data) {
      setError(`No match found with code ${trimmed}.`);
      return;
    }
    window.location.hash = `#/match/${data.id}`;
  };

  return (
    <div className="stack">
      <section className="card">
        <h2>Start a match</h2>
        <div className="row">
          <input
            className="input"
            placeholder="Match name (e.g. Saturday Scramble)"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createMatch()}
          />
          <button className="btn" disabled={busy || !name.trim()} onClick={createMatch}>
            Create
          </button>
        </div>
      </section>

      <section className="card">
        <h2>Join with a code</h2>
        <div className="row">
          <input
            className="input mono"
            placeholder="6-char code"
            value={code}
            maxLength={6}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && joinByCode()}
          />
          <button className="btn btn-ghost" disabled={busy || !code.trim()} onClick={joinByCode}>
            Join
          </button>
        </div>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="card">
        <h2>Recent matches</h2>
        {matches.length === 0 ? (
          <p className="muted">No matches yet. Create one above.</p>
        ) : (
          <ul className="list">
            {matches.map((m) => (
              <li key={m.id}>
                <a className="list-item" href={`#/match/${m.id}`}>
                  <span className="list-item-title">{m.name}</span>
                  <span className="mono muted">{m.join_code}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
