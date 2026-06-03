import { supabase } from './supabaseClient';
import type { Profile, CartItem, Order } from './types';

// ── Cart item count badge ─────────────────────────────────────
export async function refreshCartBadge(userId: string) {
  const badge = document.getElementById('cart-badge');
  const navBadge = document.getElementById('nav-cart-badge');
  
  if (!badge && !navBadge) return;

  const { count } = await supabase
    .from('cart_items')
    .select('id', { count: 'exact', head: true })
    .eq('buyer_id', userId);

  const countStr = count && count > 0 ? (count > 99 ? '99+' : String(count)) : '';

  if (badge) {
    if (countStr) {
      badge.textContent = countStr;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (navBadge) {
    if (countStr) {
      navBadge.textContent = countStr;
      navBadge.classList.remove('hidden');
    } else {
      navBadge.classList.add('hidden');
    }
  }
}

// ── Buyer portal entry ────────────────────────────────────────
export async function initBuyerPortal() {
  const container = document.getElementById('buyer-main');
  if (!container) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;
  const userId = session.user.id;

  document.getElementById('btn-buyer-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  await refreshCartBadge(userId);

  document.querySelectorAll('#view-buyer-portal .tab-btn, .sidebar .tab-btn').forEach(btn => {
    if (btn.id === 'btn-buyer-logout') return;
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget as HTMLButtonElement;
      target.classList.add('active');
      const tab = target.dataset.tab;
      if (tab === 'buyer-profile') loadBuyerProfile(container, userId);
      if (tab === 'buyer-cart')    loadBuyerCart(container, userId);
      if (tab === 'buyer-orders')  loadBuyerOrders(container, userId);
    });
  });

  await loadBuyerProfile(container, userId);
}

// ── My Profile ────────────────────────────────────────────────
async function loadBuyerProfile(container: HTMLElement, userId: string) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
  const profile = data as Profile | null;
  const descLen  = (profile?.description || '').length;
  const logoUrl  = (profile as any)?.logo_url || '';

  container.innerHTML = `
    <div class="glass profile-form-card">
      <div class="profile-form-header">
        <div class="profile-form-icon"><i data-lucide="user-circle"></i></div>
        <div>
          <h2>My Profile</h2>
          <p class="text-muted text-sm">Update your personal information.</p>
        </div>
      </div>
      <form id="buyer-profile-form" class="form">

        <!-- Profile Picture Upload -->
        <div class="form-group">
          <label>Profile Picture</label>
          <div class="logo-upload-area" id="buyer-logo-upload-area">
            <div class="logo-upload-preview" id="buyer-logo-upload-preview">
              ${logoUrl
                ? `<img id="buyer-logo-preview-thumb" src="${logoUrl}" alt="Profile picture" class="logo-thumb" />`
                : `<div id="buyer-logo-preview-thumb" class="logo-thumb-placeholder"><i data-lucide="image-plus"></i></div>`
              }
            </div>
            <div class="logo-upload-info">
              <p class="logo-upload-title">Upload a profile picture</p>
              <p class="text-muted text-sm">PNG, JPG or WEBP · Max 2 MB</p>
              <label for="buyer-logo-file" class="btn btn-ghost logo-upload-btn">
                <i data-lucide="upload"></i> Choose File
              </label>
              <input type="file" id="buyer-logo-file" accept="image/png,image/jpeg,image/webp" style="display:none;" />
            </div>
          </div>
          <input type="hidden" id="buyer-logo-url" value="${logoUrl}" />
          <p id="buyer-logo-status" class="text-sm text-muted" style="margin-top:0.4rem;"></p>
        </div>

        <div class="form-group">
          <label for="buyer-name">Display Name</label>
          <div class="input-with-icon">
            <i data-lucide="user"></i>
            <input type="text" id="buyer-name" placeholder="Your name"
              value="${profile?.business_name || ''}" maxlength="80" />
          </div>
        </div>
        <div class="form-group">
          <label for="buyer-address">Address</label>
          <div class="input-with-icon">
            <i data-lucide="map-pin"></i>
            <input type="text" id="buyer-address" placeholder="Street, City, Province / ZIP"
              value="${profile?.address || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label for="buyer-email">Contact Email</label>
          <div class="input-with-icon">
            <i data-lucide="mail"></i>
            <input type="email" id="buyer-email" placeholder="you@example.com"
              value="${profile?.contact_email || ''}" />
          </div>
        </div>
        <div class="form-group">
          <label for="buyer-about">About Me</label>
          <textarea id="buyer-about" placeholder="Tell sellers a bit about yourself…"
            rows="3" maxlength="300">${profile?.description || ''}</textarea>
          <p class="char-count text-sm text-muted"><span id="buyer-desc-count">${descLen}</span> / 300</p>
        </div>
        <div class="profile-form-actions">
          <button type="submit" class="btn btn-primary btn-lg" id="buyer-profile-save-btn">
            <i data-lucide="save"></i> Save Profile
          </button>
          <p id="buyer-profile-status" class="text-sm" style="display:none;"></p>
        </div>
      </form>
    </div>
  `;
  if ((window as any).lucide) (window as any).lucide.createIcons();

  // ── Profile picture upload ─────────────────────────────────
  const logoFileInput = document.getElementById('buyer-logo-file')    as HTMLInputElement;
  const logoUrlHidden = document.getElementById('buyer-logo-url')     as HTMLInputElement;
  const logoStatus    = document.getElementById('buyer-logo-status')  as HTMLElement;

  logoFileInput?.addEventListener('change', async () => {
    const file = logoFileInput.files?.[0];
    if (!file) return;

    const ALLOWED = ['image/png', 'image/jpeg', 'image/webp'];
    if (!ALLOWED.includes(file.type)) {
      logoStatus.textContent = 'Only PNG, JPG or WEBP files are allowed.';
      logoStatus.style.color = 'var(--danger-color)';
      logoFileInput.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      logoStatus.textContent = 'File is too large. Max size is 2 MB.';
      logoStatus.style.color = 'var(--danger-color)';
      logoFileInput.value = '';
      return;
    }

    logoStatus.textContent = 'Uploading…';
    logoStatus.style.color = 'var(--text-muted)';

    const ext      = file.name.split('.').pop();
    const filePath = `${userId}/logo.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('logos')
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      logoStatus.textContent = 'Upload failed: ' + uploadError.message;
      logoStatus.style.color = 'var(--danger-color)';
      return;
    }

    const { data: urlData } = supabase.storage.from('logos').getPublicUrl(filePath);
    const publicUrl = urlData.publicUrl;

    logoUrlHidden.value = publicUrl;

    const thumb = document.getElementById('buyer-logo-preview-thumb') as HTMLElement;
    if (thumb) {
      thumb.outerHTML = `<img id="buyer-logo-preview-thumb" src="${publicUrl}" alt="Profile picture" class="logo-thumb" />`;
    }

    logoStatus.textContent = '✓ Picture uploaded successfully.';
    logoStatus.style.color = 'var(--primary-color)';
  });

  const aboutTA   = document.getElementById('buyer-about') as HTMLTextAreaElement;
  const descCount = document.getElementById('buyer-desc-count') as HTMLElement;
  aboutTA?.addEventListener('input', () => { descCount.textContent = String(aboutTA.value.length); });

  document.getElementById('buyer-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn  = document.getElementById('buyer-profile-save-btn') as HTMLButtonElement;
    const statusEl = document.getElementById('buyer-profile-status')   as HTMLElement;

    const business_name = (document.getElementById('buyer-name')    as HTMLInputElement).value.trim();
    const address       = (document.getElementById('buyer-address')  as HTMLInputElement).value.trim();
    const contact_email = (document.getElementById('buyer-email')    as HTMLInputElement).value.trim();
    const description   = aboutTA.value.trim();
    const logo_url      = logoUrlHidden.value.trim();

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-lucide="loader"></i> Saving…';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    const { error } = await supabase.from('profiles').upsert(
      { id: userId, business_name, address, contact_email, description, logo_url },
      { onConflict: 'id' }
    );

    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i data-lucide="save"></i> Save Profile';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    statusEl.style.display = 'inline';
    if (error) {
      statusEl.textContent = '✗ ' + error.message;
      statusEl.style.color = 'var(--danger-color)';
    } else {
      statusEl.textContent = '✓ Profile saved!';
      statusEl.style.color = 'var(--primary-color)';
      setTimeout(() => { statusEl.style.display = 'none'; }, 3000);
    }
  });
}

// ── My Cart ───────────────────────────────────────────────────
async function loadBuyerCart(container: HTMLElement, userId: string) {
  container.innerHTML = `
    <div class="prod-page-header glass">
      <div class="prod-page-header-info">
        <div class="prod-page-icon"><i data-lucide="shopping-basket"></i></div>
        <div>
          <h2>My Cart</h2>
          <p class="text-muted text-sm">Items you saved for later. Buy them when ready.</p>
        </div>
      </div>
    </div>
    <div class="glass" style="padding:1.5rem;border-radius:var(--radius-lg);">
      <div id="cart-items-list">
        <div class="skeleton" style="height:80px;border-radius:var(--radius-md);margin-bottom:.75rem;"></div>
        <div class="skeleton" style="height:80px;border-radius:var(--radius-md);"></div>
      </div>
    </div>
  `;
  if ((window as any).lucide) (window as any).lucide.createIcons();
  await renderCartItems(userId, container);
}

async function renderCartItems(userId: string, container: HTMLElement) {
  const listEl = document.getElementById('cart-items-list');
  if (!listEl) return;

  const { data, error } = await supabase
    .from('cart_items')
    .select(`
      *,
      products (
        id, name, description, price, stock, image_url, profile_id,
        profiles!products_profile_id_fkey (business_name)
      )
    `)
    .eq('buyer_id', userId)
    .order('added_at', { ascending: false });

  if (error) {
    listEl.innerHTML = `<p class="text-danger" style="padding:1rem;">Failed to load cart: ${error.message}</p>`;
    return;
  }

  const items = (data || []) as CartItem[];

  if (items.length === 0) {
    listEl.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon"><i data-lucide="shopping-basket"></i></div>
        <h3>Cart is empty</h3>
        <p class="text-muted text-sm">Browse products and add items to your cart.</p>
      </div>`;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  // Compute subtotal
  const subtotal = items.reduce((sum, item) => {
    return sum + (Number(item.products?.price ?? 0) * item.quantity);
  }, 0);

  listEl.innerHTML = `
    <div class="cart-list">
      ${items.map(item => {
        const p       = item.products!;
        const price   = Number(p.price).toLocaleString('en-PH', { minimumFractionDigits: 2 });
        const lineTotal = (Number(p.price) * item.quantity).toLocaleString('en-PH', { minimumFractionDigits: 2 });
        const seller  = (p as any).profiles?.business_name || 'Unknown Seller';
        const inStock = (p.stock ?? 0) > 0;
        return `
          <div class="cart-item" data-cart-id="${item.id}" data-product-id="${p.id}">
            <div class="cart-item-thumb">
              ${p.image_url
                ? `<img src="${p.image_url}" alt="${p.name}" />`
                : `<div class="cart-thumb-placeholder"><i data-lucide="image-off"></i></div>`}
            </div>
            <div class="cart-item-info">
              <p class="cart-item-name">${p.name}</p>
              <p class="text-sm text-muted">${seller}</p>
              <p class="cart-item-price text-sm">₱${price} / item</p>
              ${!inStock ? '<span class="prod-stock-badge out-of-stock" style="margin-top:0.25rem;">Out of stock</span>' : ''}
            </div>
            <div class="cart-item-qty">
              <button class="btn btn-icon btn-sm cart-qty-dec" data-id="${item.id}" data-qty="${item.quantity}">
                <i data-lucide="minus"></i>
              </button>
              <span class="cart-qty-val">${item.quantity}</span>
              <button class="btn btn-icon btn-sm cart-qty-inc" data-id="${item.id}" data-qty="${item.quantity}" data-max="${p.stock}">
                <i data-lucide="plus"></i>
              </button>
            </div>
            <div class="cart-item-total">
              <p class="cart-item-line-total">₱${lineTotal}</p>
              <button class="btn btn-ghost btn-sm text-danger cart-item-remove" data-id="${item.id}" title="Remove">
                <i data-lucide="trash-2"></i>
              </button>
            </div>
          </div>`;
      }).join('')}
    </div>
    <div class="cart-summary">
      <div class="cart-summary-row">
        <span class="text-muted">Subtotal (${items.length} item${items.length > 1 ? 's' : ''})</span>
        <span class="cart-subtotal">₱${subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
      </div>
      <button class="btn btn-primary btn-lg w-full" id="btn-checkout-cart">
        <i data-lucide="shopping-bag"></i> Place Orders (${items.length})
      </button>
      <p id="checkout-status" class="text-sm text-center" style="display:none;margin-top:.5rem;"></p>
    </div>
  `;
  if ((window as any).lucide) (window as any).lucide.createIcons();

  // Decrease qty
  listEl.querySelectorAll('.cart-qty-dec').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id  = (btn as HTMLElement).dataset.id!;
      const qty = parseInt((btn as HTMLElement).dataset.qty!) || 1;
      if (qty <= 1) {
        await supabase.from('cart_items').delete().eq('id', id);
      } else {
        await supabase.from('cart_items').update({ quantity: qty - 1 }).eq('id', id);
      }
      await renderCartItems(userId, container);
      await refreshCartBadge(userId);
    });
  });

  // Increase qty
  listEl.querySelectorAll('.cart-qty-inc').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id  = (btn as HTMLElement).dataset.id!;
      const qty = parseInt((btn as HTMLElement).dataset.qty!) || 1;
      const max = parseInt((btn as HTMLElement).dataset.max!) || 99;
      if (qty >= max) return;
      await supabase.from('cart_items').update({ quantity: qty + 1 }).eq('id', id);
      await renderCartItems(userId, container);
    });
  });

  // Remove item
  listEl.querySelectorAll('.cart-item-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      await supabase.from('cart_items').delete().eq('id', id);
      await renderCartItems(userId, container);
      await refreshCartBadge(userId);
    });
  });

  // Checkout all cart items
  document.getElementById('btn-checkout-cart')?.addEventListener('click', async () => {
    const checkoutBtn = document.getElementById('btn-checkout-cart') as HTMLButtonElement;
    const statusEl    = document.getElementById('checkout-status') as HTMLElement;
    checkoutBtn.disabled = true;
    checkoutBtn.innerHTML = '<i data-lucide="loader"></i> Placing orders…';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    let allOk = true;
    for (const item of items) {
      const p = item.products!;
      if (!p || (p.stock ?? 0) < item.quantity) continue;

      const { error: orderErr } = await supabase.from('orders').insert([{
        buyer_id:   userId,
        product_id: p.id,
        seller_id:  (p as any).profile_id,
        quantity:   item.quantity,
        unit_price: Number(p.price),
        status:     'pending',
      }]);

      if (orderErr) { allOk = false; continue; }

      // Send message to seller
      const total = (item.quantity * Number(p.price)).toLocaleString('en-PH', { minimumFractionDigits: 2 });
      const { data: { session } } = await supabase.auth.getSession();
      const buyerEmail = session?.user.email ?? 'A buyer';
      await supabase.from('messages').insert([{
        sender_id:    userId,
        recipient_id: (p as any).profile_id,
        product_id:   p.id,
        body: `🛒 New order from ${buyerEmail}!\n\nProduct: ${p.name}\nQty: ${item.quantity}\nTotal: ₱${total}`,
        is_system: true,
      }]);

      // Remove from cart
      await supabase.from('cart_items').delete().eq('id', item.id);
    }

    checkoutBtn.disabled = false;
    checkoutBtn.innerHTML = '<i data-lucide="shopping-bag"></i> Place Orders';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    statusEl.style.display = 'block';
    if (allOk) {
      statusEl.textContent = '✓ All orders placed! Check My Orders for status.';
      statusEl.style.color = 'var(--primary-color)';
    } else {
      statusEl.textContent = 'Some items could not be ordered (out of stock). Others were placed successfully.';
      statusEl.style.color = 'var(--danger-color)';
    }
    await renderCartItems(userId, container);
    await refreshCartBadge(userId);
  });
}

// ── My Orders ─────────────────────────────────────────────────
async function loadBuyerOrders(container: HTMLElement, userId: string) {
  container.innerHTML = `
    <div class="prod-page-header glass">
      <div class="prod-page-header-info">
        <div class="prod-page-icon"><i data-lucide="package"></i></div>
        <div>
          <h2>My Orders</h2>
          <p class="text-muted text-sm">Track and manage your purchases.</p>
        </div>
      </div>
    </div>
    <div class="glass" style="padding:1.5rem;border-radius:var(--radius-lg);">
      <div id="buyer-orders-list">
        <div class="skeleton" style="height:90px;border-radius:var(--radius-md);margin-bottom:.75rem;"></div>
        <div class="skeleton" style="height:90px;border-radius:var(--radius-md);"></div>
      </div>
    </div>
  `;
  if ((window as any).lucide) (window as any).lucide.createIcons();

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      products!product_id (name, image_url),
      seller:profiles!seller_id ( business_name, contact_email )
    `)
    .eq('buyer_id', userId)
    .order('created_at', { ascending: false });

  const listEl = document.getElementById('buyer-orders-list');
  if (!listEl) return;

  if (error) {
    listEl.innerHTML = `<p class="text-danger" style="padding:1rem;">Failed to load orders: ${error.message}</p>`;
    return;
  }

  const orders = (data || []) as any[];

  if (orders.length === 0) {
    listEl.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon"><i data-lucide="package-open"></i></div>
        <h3>No orders yet</h3>
        <p class="text-muted text-sm">Purchase products and your orders will appear here.</p>
      </div>`;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  const statusColors: Record<string, string> = {
    pending:   '#f59e0b',
    confirmed: '#3b82f6',
    shipped:   '#8b5cf6',
    delivered: '#10b981',
    cancelled: '#ef4444',
  };

  listEl.innerHTML = orders.map(o => {
    const prodName  = o.products?.name || 'Unknown';
    const prodImg   = o.products?.image_url;
    const sellerName = o.seller?.business_name || o.seller?.contact_email || 'Unknown seller';
    const total     = Number(o.total_price).toLocaleString('en-PH', { minimumFractionDigits: 2 });
    const date      = new Date(o.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const color     = statusColors[o.status] || '#64748b';

    return `
      <div class="seller-order-item">
        <div class="seller-order-thumb">
          ${prodImg
            ? `<img src="${prodImg}" alt="${prodName}" />`
            : `<div class="seller-order-thumb-placeholder"><i data-lucide="package"></i></div>`}
        </div>
        <div class="seller-order-info">
          <div class="seller-order-header">
            <p class="seller-order-product">${prodName}</p>
            <span class="seller-order-status-badge" style="background:${color}20;color:${color};border:1px solid ${color}40;">
              ${o.status}
            </span>
          </div>
          <p class="text-sm text-muted">Seller: <strong>${sellerName}</strong></p>
          <p class="text-sm text-muted">${o.quantity} unit${o.quantity > 1 ? 's' : ''} · ₱${total}</p>
          ${o.delivery_date ? `<p class="text-sm" style="color:var(--emerald-500);">📅 Expected delivery: ${new Date(o.delivery_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>` : ''}
          <p class="text-sm text-muted">Ordered ${date}</p>
        </div>
        ${o.status === 'pending' ? `
        <div class="seller-order-actions">
          <button class="btn btn-ghost btn-sm text-danger btn-buyer-cancel" data-id="${o.id}">
            <i data-lucide="x"></i> Cancel
          </button>
        </div>` : ''}
      </div>`;
  }).join('');

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // Buyer can cancel pending orders
  listEl.querySelectorAll('.btn-buyer-cancel').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      if (!confirm('Cancel this order?')) return;
      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id);
      await loadBuyerOrders(container, userId);
    });
  });
}

// ── Add to cart (called from product cards) ───────────────────
export async function addToCart(productId: string, userId: string): Promise<'added' | 'updated' | 'error'> {
  console.log('Optimized adding to cart:', { productId, userId });
  
  // Call the atomic database function
  const { data, error } = await supabase.rpc('add_to_cart', {
    p_product_id: productId,
    p_buyer_id:   userId
  });

  if (error) {
    console.error('RPC Add to cart error:', error);
    alert('Error adding to cart: ' + error.message);
    return 'error';
  }

  if (data && data.startsWith('error:')) {
    console.error('Database function error:', data);
    alert('Database error: ' + data);
    return 'error';
  }

  console.log('Cart RPC response:', data);
  return data === 'ok' ? 'added' : 'error';
}
