import { supabase } from './supabaseClient';

// ── State shared across steps ──────────────────────────────────
let selectedRole: 'buyer' | 'seller' | null = null;

export function initAuth() {
  const tabLogin     = document.getElementById('tab-login');
  const tabRegister  = document.getElementById('tab-register');
  const loginForm    = document.getElementById('login-form')    as HTMLFormElement;
  const registerWrap = document.getElementById('register-form') as HTMLElement;

  if (!loginForm || !registerWrap) return;

  // Reset wizard state every time the auth view is opened
  selectedRole = null;
  showStep(1);

  // ── Tab switching ────────────────────────────────────────────
  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister?.classList.remove('active');
    loginForm.classList.replace('hidden-form', 'active-form');
    registerWrap.classList.replace('active-form', 'hidden-form');
    clearAllErrors();
  });

  tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin?.classList.remove('active');
    registerWrap.classList.replace('hidden-form', 'active-form');
    loginForm.classList.replace('active-form', 'hidden-form');
    selectedRole = null;
    showStep(1);
  });

  // ── Login ────────────────────────────────────────────────────
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = (document.getElementById('login-email')    as HTMLInputElement).value.trim();
    const password = (document.getElementById('login-password') as HTMLInputElement).value;
    const btn      = document.getElementById('login-submit-btn') as HTMLButtonElement;

    setLoading(btn, true, 'Logging in…');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(btn, false, 'Log In');

    if (error) showGlobalError('login-global-error', error.message);
    // Success handled by onAuthStateChange in app.ts
  });

  // ── Step 1: Role picker ──────────────────────────────────────
  document.getElementById('role-buyer')?.addEventListener('click', () => selectRole('buyer'));
  document.getElementById('role-seller')?.addEventListener('click', () => selectRole('seller'));

  // ── Step 2: Back button ──────────────────────────────────────
  document.getElementById('reg-back-to-1')?.addEventListener('click', () => {
    clearAllErrors();
    showStep(1);
  });

  // ── Step 2: Password toggles & strength ─────────────────────
  setupPasswordToggle('toggle-password', 'register-password');
  setupPasswordToggle('toggle-confirm',  'register-confirm');

  const passwordInput = document.getElementById('register-password') as HTMLInputElement;
  passwordInput?.addEventListener('input', () => updateStrengthMeter(passwordInput.value));

  const confirmInput = document.getElementById('register-confirm') as HTMLInputElement;
  confirmInput?.addEventListener('input', () => {
    if (confirmInput.value && confirmInput.value !== passwordInput.value) {
      showError('err-confirm', 'Passwords do not match.');
    } else {
      clearError('err-confirm');
    }
  });

  // ── Step 2: Register form submit ─────────────────────────────
  document.getElementById('register-details-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    const email    = (document.getElementById('register-email')    as HTMLInputElement).value.trim();
    const password = (document.getElementById('register-password') as HTMLInputElement).value;
    const confirm  = (document.getElementById('register-confirm')  as HTMLInputElement).value;
    const address  = (document.getElementById('register-address')  as HTMLInputElement).value.trim();
    const btn      = document.getElementById('register-submit-btn') as HTMLButtonElement;

    // Client-side validation
    let hasError = false;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('err-email', email ? 'Please enter a valid email address.' : 'Email is required.');
      hasError = true;
    }
    if (!password || password.length < 8) {
      showError('err-password', password ? 'Password must be at least 8 characters.' : 'Password is required.');
      hasError = true;
    }
    if (!confirm) {
      showError('err-confirm', 'Please confirm your password.');
      hasError = true;
    } else if (password !== confirm) {
      showError('err-confirm', 'Passwords do not match.');
      hasError = true;
    }
    if (!address) {
      showError('err-address', 'Address is required.');
      hasError = true;
    }
    if (hasError) return;

    setLoading(btn, true, 'Creating account…');

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          address,
          role: selectedRole ?? 'buyer',
        },
      },
    });

    if (signUpError) {
      setLoading(btn, false, 'Create Account');
      showGlobalError('register-global-error', signUpError.message);
      return;
    }

    // Safety-net upsert — the DB trigger handles this too, but this
    // ensures the role is saved even if the trigger fires before metadata
    // is available.
    const userId = data.user?.id;
    if (userId) {
      await supabase.from('profiles').upsert(
        { id: userId, contact_email: email, address, role: selectedRole ?? 'buyer' },
        { onConflict: 'id' }
      );
    }

    setLoading(btn, false, 'Create Account');

    // Duplicate email — Supabase returns a fake success for security
    if (data.user?.identities?.length === 0) {
      showGlobalError('register-global-error', 'An account with this email already exists.');
      return;
    }

    // Show step 3 — email confirmation screen
    const emailEl = document.getElementById('reg-confirm-email');
    if (emailEl) emailEl.textContent = email;
    showStep(3);
    if ((window as any).lucide) (window as any).lucide.createIcons();

    // If Supabase auto-confirm is ON (session returned immediately),
    // app.ts onAuthStateChange will redirect to dashboard automatically.
  });

  // ── Step 3: Resend email ─────────────────────────────────────
  document.getElementById('reg-resend-btn')?.addEventListener('click', async () => {
    const emailInput = document.getElementById('register-email') as HTMLInputElement;
    const statusEl   = document.getElementById('reg-resend-status') as HTMLElement;
    const email      = emailInput?.value.trim();
    if (!email) return;

    const resendBtn = document.getElementById('reg-resend-btn') as HTMLButtonElement;
    setLoading(resendBtn, true, 'Sending…');

    const { error } = await supabase.auth.resend({ type: 'signup', email });

    setLoading(resendBtn, false, 'Resend email');
    statusEl.style.display = 'block';
    if (error) {
      statusEl.textContent = error.message;
      statusEl.style.color = 'var(--danger-color)';
    } else {
      statusEl.textContent = '✓ Email resent! Check your inbox.';
      statusEl.style.color = 'var(--primary-color)';
    }
  });

  // ── Step 3: Back to login ────────────────────────────────────
  document.getElementById('reg-go-login-btn')?.addEventListener('click', () => {
    tabLogin?.click();
  });
}

// ── Step navigation ────────────────────────────────────────────

function showStep(step: 1 | 2 | 3) {
  const s1 = document.getElementById('reg-step-1');
  const s2 = document.getElementById('reg-step-2');
  const s3 = document.getElementById('reg-step-3');
  if (s1) s1.style.display = step === 1 ? 'block' : 'none';
  if (s2) s2.style.display = step === 2 ? 'block' : 'none';
  if (s3) s3.style.display = step === 3 ? 'block' : 'none';
}

function selectRole(role: 'buyer' | 'seller') {
  selectedRole = role;

  // Highlight selected card
  document.querySelectorAll('.role-card').forEach(c => c.classList.remove('selected'));
  document.getElementById(`role-${role}`)?.classList.add('selected');

  // Update the role label on step 2
  const label = document.getElementById('reg-role-label');
  if (label) {
    label.textContent = role === 'seller'
      ? 'Registering as a Seller'
      : 'Registering as a Buyer';
  }

  // Brief delay so the user sees the selection, then advance
  setTimeout(() => {
    showStep(2);
    if ((window as any).lucide) (window as any).lucide.createIcons();
  }, 180);
}

// ── Helpers ────────────────────────────────────────────────────

function setupPasswordToggle(btnId: string, inputId: string) {
  const btn   = document.getElementById(btnId);
  const input = document.getElementById(inputId) as HTMLInputElement;
  if (!btn || !input) return;
  btn.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    const icon = btn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', show ? 'eye-off' : 'eye');
      if ((window as any).lucide) (window as any).lucide.createIcons();
    }
  });
}

function updateStrengthMeter(password: string) {
  const fill  = document.getElementById('strength-fill');
  const label = document.getElementById('strength-label');
  if (!fill || !label) return;

  let score = 0;
  if (password.length >= 8)           score++;
  if (password.length >= 12)          score++;
  if (/[A-Z]/.test(password))         score++;
  if (/[0-9]/.test(password))         score++;
  if (/[^A-Za-z0-9]/.test(password))  score++;

  const levels = [
    { label: '',       color: 'transparent', width: '0%'   },
    { label: 'Weak',   color: '#ef4444',     width: '25%'  },
    { label: 'Fair',   color: '#f97316',     width: '50%'  },
    { label: 'Good',   color: '#eab308',     width: '75%'  },
    { label: 'Strong', color: '#22c55e',     width: '100%' },
  ];
  const level = levels[Math.min(score, 4)];
  fill.style.width           = level.width;
  fill.style.backgroundColor = level.color;
  label.textContent          = level.label;
  label.style.color          = level.color;
}

function showError(id: string, message: string) {
  const el = document.getElementById(id);
  if (el) { el.textContent = message; el.style.display = 'block'; }
}

function clearError(id: string) {
  const el = document.getElementById(id);
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

function clearAllErrors() {
  ['err-role', 'err-email', 'err-password', 'err-confirm',
   'err-address', 'register-global-error', 'login-global-error']
    .forEach(clearError);
}

function showGlobalError(id: string, message: string) {
  const el = document.getElementById(id);
  if (el) {
    el.textContent   = message;
    el.style.display = 'block';
    el.style.color   = 'var(--danger-color)';
  }
}

function setLoading(btn: HTMLButtonElement | null, loading: boolean, label: string) {
  if (!btn) return;
  btn.disabled    = loading;
  btn.textContent = label;
}
