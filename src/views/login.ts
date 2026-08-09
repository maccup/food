import { layout } from './layout';

export function loginPage(error?: string) {
  return layout(
    'Logowanie',
    `
    <div class="view view-main">
      <div class="page" data-name="login">
        <div class="page-content" style="display: flex; flex-direction: column; justify-content: center; min-height: 100vh; padding: 24px;">
          <div style="position: absolute; top: 16px; right: 16px;">
            <button class="theme-toggle" onclick="toggleTheme()">🌙</button>
          </div>
          <div style="text-align: center; margin-bottom: 32px;">
            <div style="width: 72px; height: 72px; background: var(--color-primary); border-radius: 18px; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; box-shadow: 0 4px 14px rgba(22, 163, 74, .4); font-size: 34px;">🍽️</div>
            <h1 class="sheet-title" style="margin: 0 0 8px;">Food</h1>
            <p style="font: var(--text-body); color: var(--color-neutral-500); margin: 0;">Podaj hasło, żeby wejść</p>
          </div>

          ${
            error
              ? `<div class="form-section" style="background: #FEF2F2; border: 1px solid #FECACA; margin-bottom: 16px;">
              <p style="margin: 0; color: #DC2626; font: var(--text-body); text-align: center;">${error}</p>
            </div>`
              : ''
          }

          <form method="POST" action="/login">
            <div class="form-section">
              <div class="form-field">
                <label class="form-label">Hasło</label>
                <input type="password" name="password" placeholder="Hasło" required autofocus class="form-input">
              </div>
            </div>
            <div style="padding: 8px 0;">
              <button type="submit" class="btn btn-primary" style="width: 100%;">Wejdź</button>
            </div>
          </form>
        </div>
      </div>
    </div>

    <script>
      var app = new Framework7({
        el: '#app',
        name: 'Food',
        theme: 'ios',
        clicks: { externalLinks: 'a[href]' }
      });
    </script>
  `
  );
}
