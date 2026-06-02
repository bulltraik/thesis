import { supabase } from './supabaseClient';
import type { Product } from './types';
import { openBuyModal } from './buy';
import { addToCart } from './buyer';

let allProducts: Product[] = [];

export async function initShop() {
  const container = document.getElementById('shop-grid');
  if (!container) return;
  
  // Show skeleton loader
  container.innerHTML = Array(6).fill(0).map(() => `
    <div class="card skeleton">
      <div class="card-img-wrap"></div>
      <div class="card-body">
        <div class="skeleton" style="height:20px; width:80%; margin-bottom:10px"></div>
        <div class="skeleton" style="height:20px; width:40%;"></div>
      </div>
    </div>
  `).join('');

  // Fetch all products
  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      profiles!products_profile_id_fkey(business_name, logo_url)
    `)
    .gt('stock', 0)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Shop fetch error:', JSON.stringify(error));
    container.innerHTML = `<p class="text-danger" style="grid-column:1/-1; padding:2rem;">Failed to load products: ${error.message}</p>`;
    return;
  }

  allProducts = (data || []) as Product[];
  
  // Check if there's a search query in the URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialQuery = urlParams.get('search') || '';
  const searchInput = document.getElementById('shop-search-input') as HTMLInputElement;
  if (searchInput && initialQuery) {
    searchInput.value = initialQuery;
  }

  applyFilters();

  // Setup Event Listeners for Filters
  document.getElementById('shop-search-input')?.addEventListener('input', applyFilters);
  document.getElementById('btn-apply-filters')?.addEventListener('click', applyFilters);
  document.getElementById('btn-clear-filters')?.addEventListener('click', clearFilters);
}

function applyFilters() {
  const container = document.getElementById('shop-grid');
  if (!container) return;

  const searchInput = (document.getElementById('shop-search-input') as HTMLInputElement)?.value.toLowerCase() || '';
  const minPrice = parseFloat((document.getElementById('filter-min-price') as HTMLInputElement)?.value) || 0;
  const maxPriceInput = (document.getElementById('filter-max-price') as HTMLInputElement)?.value;
  const maxPrice = maxPriceInput ? parseFloat(maxPriceInput) : Infinity;
  const sortBy = (document.getElementById('filter-sort') as HTMLSelectElement)?.value || 'newest';

  let filtered = allProducts.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchInput) || 
                          (p.profiles?.business_name?.toLowerCase().includes(searchInput) || false);
    const matchesPrice = p.price >= minPrice && p.price <= maxPrice;
    return matchesSearch && matchesPrice;
  });

  // Sort
  if (sortBy === 'price_asc') {
    filtered.sort((a, b) => a.price - b.price);
  } else if (sortBy === 'price_desc') {
    filtered.sort((a, b) => b.price - a.price);
  } else {
    // newest
    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  renderProducts(container, filtered);
}

function clearFilters() {
  (document.getElementById('shop-search-input') as HTMLInputElement).value = '';
  (document.getElementById('filter-min-price') as HTMLInputElement).value = '';
  (document.getElementById('filter-max-price') as HTMLInputElement).value = '';
  (document.getElementById('filter-sort') as HTMLSelectElement).value = 'newest';
  
  // Remove URL params if any
  const url = new URL(window.location.href);
  url.searchParams.delete('search');
  window.history.replaceState({}, '', url);

  applyFilters();
}

function renderProducts(container: HTMLElement, products: Product[]) {
  if (!products || products.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:4rem 1rem; color:var(--text-muted);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 1rem; display:block; opacity:0.4;">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <p style="font-weight:600; margin-bottom:0.25rem;">No products found</p>
        <p style="font-size:0.875rem;">Try adjusting your filters or search term.</p>
      </div>`;
    return;
  }

  supabase.auth.getSession().then(async ({ data: { session } }) => {
    const loggedIn = !!session;
    let isSeller   = false;

    if (session) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single();
      isSeller = profile?.role === 'seller';
    }

    container.innerHTML = products.map(product => {
      const price   = Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const desc    = product.description ? product.description.substring(0, 80) + (product.description.length > 80 ? '…' : '') : '';
      const seller  = product.profiles?.business_name || 'Unknown Seller';
      const logoUrl = product.profiles?.logo_url;
      const inStock = (product.stock ?? 0) > 0;

      const imgHtml = product.image_url
        ? `<img src="${product.image_url}" alt="${product.name}" class="card-img" loading="lazy" />`
        : `<div class="card-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;

      const sellerLogoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${seller}" class="product-card-seller-logo" />`
        : `<div class="product-card-seller-logo product-card-seller-logo-placeholder">${seller.charAt(0).toUpperCase()}</div>`;

      let buyHtml: string;
      if (isSeller) {
        buyHtml = `<div class="btn-seller-badge">
          <i data-lucide="store"></i> Seller account
        </div>`;
      } else if (!inStock) {
        buyHtml = `<button class="btn btn-buy-disabled w-full" disabled>Out of Stock</button>`;
      } else if (loggedIn) {
        buyHtml = `
          <div class="product-card-btns">
            <button class="btn btn-primary btn-buy" data-product-id="${product.id}">
              <i data-lucide="shopping-cart"></i> Buy Now
            </button>
            <button class="btn btn-ghost btn-add-to-cart" data-product-id="${product.id}" title="Add to Cart">
              <i data-lucide="bookmark-plus"></i>
            </button>
          </div>`;
      } else {
        buyHtml = `<button class="btn btn-ghost btn-buy-guest w-full" data-product-id="${product.id}">
          <i data-lucide="log-in"></i> Sign in to Buy
        </button>`;
      }

      return `
        <div class="card glass product-card" data-product-id="${product.id}">
          <div class="card-img-wrap">
            ${imgHtml}
            <span class="product-card-stock-badge ${inStock ? 'in-stock' : 'out-of-stock'}">
              ${inStock ? `${product.stock} in stock` : 'Out of stock'}
            </span>
          </div>
          <div class="card-body">
            <div class="product-card-seller-row">
              ${sellerLogoHtml}
              <span class="product-card-seller-name text-sm text-muted">${seller}</span>
            </div>
            <h3 class="card-title">${product.name}</h3>
            ${desc ? `<p class="text-sm text-muted product-card-desc">${desc}</p>` : ''}
            <p class="card-price">₱${price}</p>
            ${buyHtml}
          </div>
        </div>`;
    }).join('');

    if ((window as any).lucide) (window as any).lucide.createIcons();

    container.querySelectorAll('.btn-buy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = (e.currentTarget as HTMLElement).dataset.productId;
        const product = products.find(p => p.id === productId);
        if (product) openBuyModal(product);
      });
    });

    container.querySelectorAll('.btn-add-to-cart').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const productId = (e.currentTarget as HTMLElement).dataset.productId;
        if (!productId) return;
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const b = e.currentTarget as HTMLButtonElement;
        b.disabled = true;
        const result = await addToCart(productId, session.user.id);
        b.disabled = false;
        if (result !== 'error') {
          b.innerHTML = '<i data-lucide="check"></i>';
          if ((window as any).lucide) (window as any).lucide.createIcons();
          setTimeout(() => {
            b.innerHTML = '<i data-lucide="bookmark-plus"></i>';
            if ((window as any).lucide) (window as any).lucide.createIcons();
          }, 1500);
        }
      });
    });

    container.querySelectorAll('.btn-buy-guest').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('nav-login')?.click();
      });
    });
  });
}
