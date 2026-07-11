export default function SignIn({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="center">
      <div className="signin-card">
        <div className="signin-logo">🍺⛳</div>
        <h1>Beer-Scramble</h1>
        <p className="muted">
          Live scramble scoring. One card, played 1&nbsp;→&nbsp;18, beers included.
        </p>
        <button className="btn btn-google" onClick={onSignIn}>
          Sign in with Google
        </button>
        <p className="fine-print muted">
          You stay signed in on this device — no PINs, no passwords.
        </p>
      </div>
    </div>
  );
}
