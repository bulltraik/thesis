import { supabase } from './supabaseClient';
import { initMarketplace } from './marketplace';
import { initDashboard } from './dashboard';
import { initBuyerPortal } from './buyer';
import { initAuth } from './auth';
import { initShop } from './shop';

// ── Global session state ──────────────────────────────────────
export let currentSession: Awaited<ReturnType<typeof supabase.auth.getSession>>['data']['session'] = null;

// ── Route logged-in user to correct portal by role ────────────
async function routeByRole() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (profile?.role === 'buyer') {
    switchView('view-buyer-portal');
    initBuyerPortal();
  } else {
    switchView('view-dashboard');
    initDashboard();
  }
}

// Initialize Theme
const themeToggle = document.getElementById('theme-toggle');
let isDark = localStorage.getItem('theme') === 'dark';
if (isDark) document.body.setAttribute('data-theme', 'dark');

themeToggle?.addEventListener('click', () => {
  isDark = !isDark;
  if (isDark) {
    document.body.setAttribute('data-theme', 'dark');
    localStorage.setItem('theme', 'dark');
  } else {
    document.body.removeAttribute('data-theme');
    localStorage.setItem('theme', 'light');
  }
});

// View Routing
const appContainer = document.getElementById('app');
const navHome = document.getElementById('nav-home');
const navShop = document.getElementById('nav-shop');

// Auth / Profile Nav Elements
const navLogin = document.getElementById('nav-login');
const navProfileDropdown = document.getElementById('nav-profile-dropdown');
const btnProfileToggle = document.getElementById('btn-profile-toggle');
const navDropDashboard = document.getElementById('nav-drop-dashboard');
const navDropSettings = document.getElementById('nav-drop-settings');
const navDropLogout = document.getElementById('nav-drop-logout');

function switchView(viewId: string) {
  if (!appContainer) return;
  const template = document.getElementById(viewId) as HTMLTemplateElement;
  if (template) {
    appContainer.innerHTML = '';
    appContainer.appendChild(template.content.cloneNode(true));
  }
}

navHome?.addEventListener('click', () => {
  switchView('view-marketplace');
  initMarketplace();
});

navShop?.addEventListener('click', () => {
  switchView('view-shop');
  initShop();
});

navLogin?.addEventListener('click', () => {
  switchView('view-auth');
  initAuth();
});

// Dropdown Toggle Logic
btnProfileToggle?.addEventListener('click', (e) => {
  e.stopPropagation();
  navProfileDropdown?.classList.toggle('show');
});

// Close dropdown when clicking outside
document.addEventListener('click', (e) => {
  if (navProfileDropdown?.classList.contains('show') && !navProfileDropdown.contains(e.target as Node)) {
    navProfileDropdown.classList.remove('show');
  }
});

// Dropdown Menu Actions
navDropDashboard?.addEventListener('click', async (e) => {
  e.preventDefault();
  navProfileDropdown?.classList.remove('show');
  await routeByRole();
});

navDropSettings?.addEventListener('click', async (e) => {
  e.preventDefault();
  navProfileDropdown?.classList.remove('show');
  await routeByRole();
});

navDropLogout?.addEventListener('click', async (e) => {
  e.preventDefault();
  navProfileDropdown?.classList.remove('show');
  await supabase.auth.signOut();
});

// Init Default View
switchView('view-marketplace');
initMarketplace();

// Handle auth state changes globally
supabase.auth.onAuthStateChange(async (event, session) => {
  console.log('Auth event:', event);
  currentSession = session;
  
  if (session) {
    navLogin?.classList.add('hidden');
    navProfileDropdown?.classList.remove('hidden');
  } else {
    navLogin?.classList.remove('hidden');
    navProfileDropdown?.classList.add('hidden');
  }
  
  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
    if (document.querySelector('.auth-container')) {
      await routeByRole();
    } else if (document.querySelector('.dashboard-layout')) {
      await routeByRole();
    }
  } else if (event === 'SIGNED_OUT') {
    switchView('view-marketplace');
    initMarketplace();
  }
});

// Initial auth state check for navbar
supabase.auth.getSession().then(({ data: { session } }) => {
  currentSession = session;
  if (session) {
    navLogin?.classList.add('hidden');
    navProfileDropdown?.classList.remove('hidden');
  } else {
    navLogin?.classList.remove('hidden');
    navProfileDropdown?.classList.add('hidden');
  }
});
