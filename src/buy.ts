import { supabase } from './supabaseClient';
import type { Product } from './types';

// ── Buy Modal ─────────────────────────────────────────────────
// Single global modal instance reused for every Buy Now click.

let modalEl: HTMLElement | null = null;

function getOrCreateModal(): HTMLElement {
  if (modalEl && document.body.contains(modalEl)) return modalEl;

  const div = document.createElement('div');
  div.id = 'buy-modal-overlay';
  div.className = 'buy-modal-overlay hidden';
  div.innerHTML = `
    <div class="buy-modal glass" role="dialog" aria-modal="true" aria-labelledby="buy-modal-title">
      <button class="btn btn-icon buy-modal-close" id="buy-modal-close" aria-label="Close">
        <i data-lucide="x"></i>
      </button>

      <!-- Product summary -->
      <div class="buy-modal-product" id="buy-modal-product"></div>

      <!-- Order form -->
      <form id="buy-order-form" novalidate>
        <div class="buy-modal-row">
          <div class="form-group" style="flex:1;">
            <label for="buy-quantity">Quantity <span class="field-required">*</span></label>
            <div class="input-with-icon">
              <i data-lucide="hash"></i>
              <input type="number" id="buy-quantity" min="1" value="1" />
            </div>
            <p class="field-error" id="err-buy-qty"></p>
          </div>
          <div class="buy-modal-total-wrap">
            <p class="buy-modal-total-label text-muted text-sm">Total</p>
            <p class="buy-modal-total" id="buy-modal-total">₱0.00</p>
          </div>
        </div>

        <div class="form-group">
          <label for="buy-note">Note to Seller <span class="text-muted text-sm">(optional)</span></label>
          <textarea id="buy-note" placeholder="Any special instructions or delivery notes…" rows="2" maxlength="300"></textarea>
        </div>

        <p class="field-error" id="err-buy-global" style="margin-bottom:0.5rem;"></p>

        <div class="buy-modal-actions">
          <button type="button" class="btn btn-ghost" id="buy-cancel-btn">Cancel</button>
          <button type="submit" class="btn btn-primary btn-lg" id="buy-submit-btn">
            <i data-lucide="shopping-cart"></i> Place Order
          </button>
        </div>
      </form>
    </div>
  `;
  document.body.appendChild(div);
  modalEl = div;
  return div;
}

function closeModal() {
  if (!modalEl) return;
  modalEl.classList.add('hidden');
  document.body.style.overflow = '';
}

// ── Open the buy modal for a specific product ─────────────────
export function openBuyModal(product: Product) {
  const overlay = getOrCreateModal();
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const price    = Number(product.price);
  const seller   = product.profiles?.business_name || 'Unknown Seller';
  const logoUrl  = product.profiles?.logo_url;
  const fmtPrice = price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${seller}" class="buy-modal-seller-logo" />`
    : `<div class="buy-modal-seller-logo buy-modal-seller-logo-placeholder">${seller.charAt(0).toUpperCase()}</div>`;

  const imgHtml = product.image_url
    ? `<img src="${product.image_url}" alt="${product.name}" class="buy-modal-img" />`
    : `<div class="buy-modal-img buy-modal-img-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>`;

  // Render product summary
  const productEl = document.getElementById('buy-modal-product');
  if (productEl) {
    productEl.innerHTML = `
      ${imgHtml}
      <div class="buy-modal-product-info">
        <div class="buy-modal-seller-row">
          ${logoHtml}
          <span class="text-sm text-muted">${seller}</span>
        </div>
        <h3 id="buy-modal-title" class="buy-modal-product-name">${product.name}</h3>
        <p class="buy-modal-unit-price">₱${fmtPrice} <span class="text-muted text-sm">/ item</span></p>
        <p class="text-sm text-muted">Stock: ${product.stock}</p>
      </div>
    `;
  }

  // Reset form
  const qtyInput    = document.getElementById('buy-quantity')   as HTMLInputElement;
  const noteInput   = document.getElementById('buy-note')       as HTMLTextAreaElement;
  const totalEl     = document.getElementById('buy-modal-total') as HTMLElement;
  const errQty      = document.getElementById('err-buy-qty')    as HTMLElement;
  const errGlobal   = document.getElementById('err-buy-global') as HTMLElement;

  qtyInput.value  = '1';
  qtyInput.max    = String(product.stock);
  noteInput.value = '';
  totalEl.textContent = `₱${fmtPrice}`;
  errQty.style.display    = 'none';
  errGlobal.style.display = 'none';

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // Live total update
  const updateTotal = () => {
    const qty   = Math.max(1, parseInt(qtyInput.value) || 1);
    const total = qty * price;
    totalEl.textContent = `₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  qtyInput.removeEventListener('input', updateTotal);
  qtyInput.addEventListener('input', updateTotal);

  // Close buttons
  document.getElementById('buy-modal-close')?.addEventListener('click', closeModal);
  document.getElementById('buy-cancel-btn')?.addEventListener('click', closeModal);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

  // ── Form submit ──────────────────────────────────────────────
  const form = document.getElementById('buy-order-form') as HTMLFormElement;
  // Remove previous listener by cloning
  const newForm = form.cloneNode(true) as HTMLFormElement;
  form.replaceWith(newForm);

  // Re-wire quantity listener after clone
  const freshQty = document.getElementById('buy-quantity') as HTMLInputElement;
  freshQty.addEventListener('input', updateTotal);

  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const qty       = parseInt(freshQty.value);
    const note      = (document.getElementById('buy-note') as HTMLTextAreaElement).value.trim();
    const submitBtn = document.getElementById('buy-submit-btn') as HTMLButtonElement;
    const errQ      = document.getElementById('err-buy-qty')    as HTMLElement;
    const errG      = document.getElementById('err-buy-global') as HTMLElement;

    errQ.style.display = 'none';
    errG.style.display = 'none';

    // Validate
    if (!qty || qty < 1) {
      errQ.textContent = 'Quantity must be at least 1.';
      errQ.style.display = 'block';
      return;
    }
    if (qty > product.stock) {
      errQ.textContent = `Only ${product.stock} in stock.`;
      errQ.style.display = 'block';
      return;
    }

    // Check session
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      errG.textContent = 'You must be logged in to place an order.';
      errG.style.color = 'var(--danger-color)';
      errG.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader"></i> Placing order…';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    // Insert order
    const { error: orderError } = await supabase.from('orders').insert([{
      buyer_id:   session.user.id,
      product_id: product.id,
      seller_id:  product.profile_id,
      quantity:   qty,
      unit_price: price,
      note:       note || null,
      status:     'pending',
    }]);

    if (orderError) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i data-lucide="shopping-cart"></i> Place Order';
      if ((window as any).lucide) (window as any).lucide.createIcons();
      errG.textContent = 'Order failed: ' + orderError.message;
      errG.style.color = 'var(--danger-color)';
      errG.style.display = 'block';
      return;
    }

    // Decrement stock on the product
    await supabase
      .from('products')
      .update({ stock: product.stock - qty })
      .eq('id', product.id);

    // Show success state
    const modal = document.querySelector('.buy-modal') as HTMLElement;
    if (modal) {
      modal.innerHTML = `
        <div class="buy-success">
          <div class="buy-success-icon"><i data-lucide="check-circle"></i></div>
          <h3>Order Placed!</h3>
          <p class="text-muted">Your order for <strong>${product.name}</strong> has been sent to the seller.</p>
          <p class="text-muted text-sm" style="margin-top:0.5rem;">The seller will confirm and contact you shortly.</p>
          <button class="btn btn-primary" id="buy-success-close" style="margin-top:1.5rem;">Done</button>
        </div>
      `;
      if ((window as any).lucide) (window as any).lucide.createIcons();
      document.getElementById('buy-success-close')?.addEventListener('click', closeModal);
    }
  });
}

// ── Helper exported for use in renderProducts ─────────────────
// Returns true if the user is currently logged in (checks session synchronously via localStorage key)
export async function isLoggedIn(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  return !!session;
}
