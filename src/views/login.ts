import { layout } from './layout';

export function loginPage(error?: string) {
  return layout(
    'Logowanie',
    `<div class="login-wrap">
      <div class="login-box">
        <div style="text-align:center;margin-bottom:26px">
          <div class="login-mark" aria-hidden="true">🍽️</div>
          <h1 class="sheet-title" style="margin:0 0 6px">Food</h1>
          <p style="color:var(--muted);margin:0">Podaj hasło, żeby wejść</p>
        </div>

        ${
          error
            ? `<div role="alert" style="background:rgba(220,38,38,.1);color:var(--bad);padding:11px 14px;border-radius:10px;margin-bottom:14px;text-align:center">${error}</div>`
            : ''
        }

        <form method="POST" action="/login">
          <div class="form-field">
            <label class="form-label" for="password">Hasło</label>
            <input type="password" id="password" name="password" required autofocus autocomplete="current-password">
          </div>
          <button type="submit" class="button button-fill" style="width:100%;margin-top:8px">Wejdź</button>
        </form>
      </div>
    </div>

    <style>
      .login-wrap { display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px; }
      .login-box { width: 100%; max-width: 380px; }
      .login-mark {
        width: 72px; height: 72px; margin: 0 auto 18px;
        display: flex; align-items: center; justify-content: center;
        background: var(--color-primary); border-radius: 18px; font-size: 34px;
      }
    </style>`
  );
}
