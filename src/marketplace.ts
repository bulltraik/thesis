import { supabase } from './supabaseClient';
import type { Product, SellerAd } from './types';
import { openBuyModal } from './buy';
import { addToCart, refreshCartBadge } from './buyer';

let carouselInterval: any = null;

export async function initMarketplace() {
  // Setup Hero CTAs
  const btnShop = document.getElementById('btn-hero-shop');
  const btnSell = document.getElementById('btn-hero-sell');
  const featuredSection = document.getElementById('featured-section');
  const navDashboard = document.getElementById('nav-dashboard');

  btnShop?.addEventListener('click', () => {
    featuredSection?.scrollIntoView({ behavior: 'smooth' });
  });

  btnSell?.addEventListener('click', () => {
    navDashboard?.click();
  });

  const searchInput = document.getElementById('search-input') as HTMLInputElement;
  searchInput?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const navShop = document.getElementById('nav-shop');
      if (navShop) {
        // Set search query in URL without reloading
        const url = new URL(window.location.href);
        url.searchParams.set('search', searchInput.value);
        window.history.pushState({}, '', url);
        navShop.click();
      }
    }
  });

  const container = document.getElementById('marketplace-grid');
  if (!container) return;
  
  initHeroAds();
  
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

  const { data, error } = await supabase
    .from('products')
    .select(`
      *,
      profiles!products_profile_id_fkey(business_name, logo_url)
    `)
    .gt('stock', 0)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Marketplace fetch error:', JSON.stringify(error));
    container.innerHTML = `<p class="text-danger" style="grid-column:1/-1; padding:2rem;">Failed to load products: ${error.message}</p>`;
    return;
  }

  if (!data || data.length === 0) {
    renderProducts(container, []);
    return;
  }

  renderProducts(container, data as Product[]);
}

function renderProducts(container: HTMLElement, products: Product[]) {
  if (!products || products.length === 0) {
    container.innerHTML = `
      <div style="grid-column:1/-1; text-align:center; padding:4rem 1rem; color:var(--text-muted);">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin:0 auto 1rem; display:block; opacity:0.4;">
          <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
        </svg>
        <p style="font-weight:600; margin-bottom:0.25rem;">No products available</p>
        <p style="font-size:0.875rem;">Check back soon — sellers are adding new items.</p>
      </div>`;
    return;
  }

  // Fetch session + role in parallel then render
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
      const price    = Number(product.price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const desc     = product.description ? product.description.substring(0, 80) + (product.description.length > 80 ? '…' : '') : '';
      const seller   = product.profiles?.business_name || 'Unknown Seller';
      const logoUrl  = product.profiles?.logo_url;
      const inStock  = (product.stock ?? 0) > 0;

      const imgHtml = product.image_url
        ? `<img src="${product.image_url}" alt="${product.name}" class="card-img" loading="lazy" />`
        : `<div class="card-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;

      const sellerLogoHtml = logoUrl
        ? `<img src="${logoUrl}" alt="${seller}" class="product-card-seller-logo" />`
        : `<div class="product-card-seller-logo product-card-seller-logo-placeholder">${seller.charAt(0).toUpperCase()}</div>`;

      let buyHtml: string;
      if (isSeller) {
        // Sellers cannot buy — show an informational badge instead
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
              <i data-lucide="shopping-basket"></i>
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

    // Wire Buy Now buttons (buyers only)
    container.querySelectorAll('.btn-buy').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const productId = (e.currentTarget as HTMLElement).dataset.productId;
        const product = products.find(p => p.id === productId);
        if (product) openBuyModal(product);
      });
    });

    // Wire Add to Cart buttons
    container.querySelectorAll('.btn-add-to-cart').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const b = e.currentTarget as HTMLButtonElement;
        const productId = b.dataset.productId;
        if (!productId) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          document.getElementById('nav-login')?.click();
          return;
        }

        b.disabled = true;
        b.innerHTML = '<i data-lucide="loader" class="spin"></i>';
        if ((window as any).lucide) (window as any).lucide.createIcons();

        const result = await addToCart(productId, session.user.id);
        b.disabled = false;

        if (result === 'added' || result === 'updated') {
          await refreshCartBadge(session.user.id);
          b.classList.add('btn-success-temporary');
          b.innerHTML = '<i data-lucide="check"></i>';
          if ((window as any).lucide) (window as any).lucide.createIcons();
          setTimeout(() => {
            b.classList.remove('btn-success-temporary');
            b.innerHTML = '<i data-lucide="shopping-basket"></i>';
            if ((window as any).lucide) (window as any).lucide.createIcons();
          }, 1500);
        } else {
          b.innerHTML = '<i data-lucide="x-circle" class="text-danger"></i>';
          if ((window as any).lucide) (window as any).lucide.createIcons();
          setTimeout(() => {
            b.innerHTML = '<i data-lucide="shopping-basket"></i>';
            if ((window as any).lucide) (window as any).lucide.createIcons();
          }, 1500);
        }
      });
    });

    // Wire "Sign in to buy" buttons
    container.querySelectorAll('.btn-buy-guest').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('nav-login')?.click();
      });
    });
  });
}

async function initHeroAds() {
  const container = document.getElementById('hero-ads-container');
  if (!container) return;

  if (carouselInterval) clearInterval(carouselInterval);

  // Fetch active ads with seller profile info
  const { data: ads, error } = await supabase
    .from('seller_ads')
    .select(`
      *,
      profiles!seller_ads_profile_id_fkey(business_name, logo_url)
    `)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error fetching ads:', error);
    renderEmptyAdsState(container);
    return;
  }

  if (!ads || ads.length === 0) {
    renderEmptyAdsState(container);
    return;
  }

  // Resolve products for each ad
  const allProductIds = ads.flatMap((ad: any) => ad.product_ids || []);
  let productsMap: Record<string, Product> = {};

  if (allProductIds.length > 0) {
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', allProductIds);

    if (products) {
      productsMap = Object.fromEntries(products.map((p: Product) => [p.id, p]));
    }
  }

  // Attach resolved products to each ad
  const resolvedAds: SellerAd[] = ads.map((ad: any) => ({
    ...ad,
    products: (ad.product_ids || [])
      .map((pid: string) => productsMap[pid])
      .filter(Boolean),
  }));

  let currentIndex = 0;

  const renderSlide = (index: number) => {
    const ad = resolvedAds[index];
    const seller = ad.profiles;
    const featuredProducts = ad.products || [];

    // Build product thumbnails (max 3)
    const productThumbs = featuredProducts.slice(0, 3).map(p => {
      const thumbImg = p.image_url
        ? `<img src="${p.image_url}" alt="${p.name}" />`
        : `<div class="ad-product-thumb-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="24" height="24"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;
      const price = Number(p.price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return `
        <div class="ad-product-thumb">
          ${thumbImg}
          <span class="ad-product-name">${p.name}</span>
          <span class="ad-product-price">₱${price}</span>
        </div>`;
    }).join('');

    container.innerHTML = `
      <div class="hero-ad-card">
        <div class="hero-ad-header">
          ${seller?.logo_url ? `<img src="${seller.logo_url}" alt="Logo" class="hero-ad-logo" />` : `<div class="hero-ad-logo-placeholder"><i data-lucide="store"></i></div>`}
          <div>
            <h3 class="hero-ad-seller">${seller?.business_name || 'Featured Seller'}</h3>
            <span class="hero-ad-badge">Sponsored</span>
          </div>
        </div>
        <h2 class="hero-ad-title">${ad.title}</h2>
        <p class="hero-ad-desc">${ad.description ? ad.description.substring(0, 120) + (ad.description.length > 120 ? '...' : '') : ''}</p>
        ${ad.image_url ? `<img src="${ad.image_url}" alt="${ad.title}" class="hero-ad-banner" />` : ''}
        ${featuredProducts.length > 0 ? `
          <div class="hero-ad-products">
            <p class="hero-ad-products-label">Featured Products</p>
            <div class="hero-ad-products-grid">${productThumbs}</div>
          </div>
        ` : ''}
        ${resolvedAds.length > 1 ? `
          <div class="hero-ad-dots">
            ${resolvedAds.map((_, i) => `<span class="hero-ad-dot ${i === index ? 'active' : ''}"></span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;

    // Re-init lucide icons for dynamically added elements
    if ((window as any).lucide) {
      (window as any).lucide.createIcons();
    }
  };

  renderSlide(currentIndex);

  if (resolvedAds.length > 1) {
    carouselInterval = setInterval(() => {
      currentIndex = (currentIndex + 1) % resolvedAds.length;
      renderSlide(currentIndex);
    }, 5000);
  }
}

function renderEmptyAdsState(container: HTMLElement) {
  container.innerHTML = `
    <div class="hero-ads-empty">
      <div class="hero-ads-empty-icon">
        <i data-lucide="megaphone"></i>
      </div>
      <h3>Ad Space Available</h3>
      <p>No seller ads yet. Be the first to advertise your products here!</p>
    </div>
  `;

  if ((window as any).lucide) {
    (window as any).lucide.createIcons();
  }
}
