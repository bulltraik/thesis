import { supabase } from './supabaseClient';
import type { Product } from './types';

// ── Module state ──────────────────────────────────────────────
let overlayEl:   HTMLElement | null = null;
let currentProduct: Product | null  = null;

// ── Build the modal once, keep it forever ─────────────────────
function ensureModal(): HTMLElement {
  if (overlayEl && document.body.contains(overlayEl)) return overlayEl;

  overlayEl = document.createElement('div');
  overlayEl.id        = 'buy-modal-overlay';
  overlayEl.className = 'buy-modal-overlay hidden';
  overlayEl.setAttribute('role', 'dialog');
  overlayEl.setAttribute('aria-modal', 'true');

  overlayEl.innerHTML = `
    <div class="buy-modal glass">

      <!-- Close button -->
      <button class="btn btn-icon buy-modal-close" id="buy-modal-close" aria-label="Close">
        <i data-lucide="x"></i>
      </button>

      <!-- ── FORM VIEW ── -->
      <div id="buy-form-view">
        <!-- Product summary (filled dynamically) -->
        <div class="buy-modal-product" id="buy-modal-product"></div>

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

      <!-- ── SUCCESS VIEW (hidden by default) ── -->
      <div id="buy-success-view" style="display:none;">
        <div class="buy-success">
          <div class="buy-success-icon"><i data-lucide="check-circle"></i></div>
          <h3>Order Placed!</h3>
          <p class="text-muted" id="buy-success-msg"></p>
          <p class="text-muted text-sm" style="margin-top:0.5rem;">
            The seller will confirm and reach out to you shortly.
          </p>
          <button class="btn btn-primary" id="buy-success-close" style="margin-top:1.5rem;">Done</button>
        </div>
      </div>

    </div>
  `;

  document.body.appendChild(overlayEl);

  // ── Wire permanent event listeners (once only) ─────────────

  // Close on overlay background click
  overlayEl.addEventListener('click', (e) => {
    if (e.target === overlayEl) closeModal();
  });

  // Close / cancel buttons
  overlayEl.querySelector('#buy-modal-close')!
    .addEventListener('click', closeModal);
  overlayEl.querySelector('#buy-cancel-btn')!
    .addEventListener('click', closeModal);
  overlayEl.querySelector('#buy-success-close')!
    .addEventListener('click', closeModal);

  // Quantity → live total
  const qtyInput = overlayEl.querySelector('#buy-quantity') as HTMLInputElement;
  qtyInput.addEventListener('input', updateTotal);

  // Form submit
  const form = overlayEl.querySelector('#buy-order-form') as HTMLFormElement;
  form.addEventListener('submit', handleSubmit);

  return overlayEl;
}

// ── Helpers ────────────────────────────────────────────────────

function updateTotal() {
  if (!currentProduct || !overlayEl) return;
  const qtyInput = overlayEl.querySelector('#buy-quantity') as HTMLInputElement;
  const totalEl  = overlayEl.querySelector('#buy-modal-total') as HTMLElement;
  const qty      = Math.max(1, parseInt(qtyInput.value) || 1);
  totalEl.textContent = `₱${(qty * Number(currentProduct.price)).toLocaleString('en-PH', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;
}

function showError(id: string, msg: string) {
  const el = overlayEl?.querySelector(`#${id}`) as HTMLElement | null;
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function clearErrors() {
  ['err-buy-qty', 'err-buy-global'].forEach(id => {
    const el = overlayEl?.querySelector(`#${id}`) as HTMLElement | null;
    if (el) { el.textContent = ''; el.style.display = 'none'; }
  });
}

function showView(view: 'form' | 'success') {
  const formView    = overlayEl?.querySelector('#buy-form-view')    as HTMLElement;
  const successView = overlayEl?.querySelector('#buy-success-view') as HTMLElement;
  if (formView)    formView.style.display    = view === 'form'    ? 'block' : 'none';
  if (successView) successView.style.display = view === 'success' ? 'block' : 'none';
}

function closeModal() {
  if (!overlayEl) return;
  overlayEl.classList.add('hidden');
  document.body.style.overflow = '';
  // Reset to form view for next open
  showView('form');
  clearErrors();
}

async function handleSubmit(e: Event) {
  e.preventDefault();
  if (!currentProduct || !overlayEl) return;

  clearErrors();

  const qtyInput  = overlayEl.querySelector('#buy-quantity')  as HTMLInputElement;
  const noteInput = overlayEl.querySelector('#buy-note')       as HTMLTextAreaElement;
  const submitBtn = overlayEl.querySelector('#buy-submit-btn') as HTMLButtonElement;
  const qty       = parseInt(qtyInput.value) || 0;
  const note      = noteInput.value.trim();

  // ── Validate ──────────────────────────────────────────────
  if (qty < 1) {
    showError('err-buy-qty', 'Quantity must be at least 1.');
    return;
  }

  // Fetch fresh stock from DB to avoid race conditions
  const { data: freshProduct, error: fetchErr } = await supabase
    .from('products')
    .select('stock, profile_id')
    .eq('id', currentProduct.id)
    .single();

  if (fetchErr || !freshProduct) {
    showError('err-buy-global', 'Could not verify stock. Please try again.');
    return;
  }

  if (qty > freshProduct.stock) {
    showError('err-buy-qty', `Only ${freshProduct.stock} left in stock.`);
    qtyInput.max   = String(freshProduct.stock);
    qtyInput.value = String(Math.min(qty, freshProduct.stock));
    updateTotal();
    return;
  }

  // ── Auth check ────────────────────────────────────────────
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    showError('err-buy-global', 'You must be logged in to place an order.');
    return;
  }

  // ── Prevent buyer buying their own product ────────────────
  if (session.user.id === freshProduct.profile_id) {
    showError('err-buy-global', 'You cannot buy your own product.');
    return;
  }

  // ── Loading state ─────────────────────────────────────────
  submitBtn.disabled     = true;
  submitBtn.innerHTML    = '<i data-lucide="loader"></i> Placing order…';
  if ((window as any).lucide) (window as any).lucide.createIcons();

  // ── Insert order ──────────────────────────────────────────
  const { error: orderErr } = await supabase.from('orders').insert([{
    buyer_id:   session.user.id,
    product_id: currentProduct.id,
    seller_id:  freshProduct.profile_id,
    quantity:   qty,
    unit_price: Number(currentProduct.price),
    note:       note || null,
    status:     'pending',
  }]);

  if (orderErr) {
    submitBtn.disabled  = false;
    submitBtn.innerHTML = '<i data-lucide="shopping-cart"></i> Place Order';
    if ((window as any).lucide) (window as any).lucide.createIcons();
    showError('err-buy-global', 'Order failed: ' + orderErr.message);
    return;
  }

  // ── Decrement stock (use DB value to avoid races) ─────────
  const { error: stockErr } = await supabase
    .from('products')
    .update({ stock: freshProduct.stock - qty })
    .eq('id', currentProduct.id)
    .eq('stock', freshProduct.stock); // optimistic lock

  if (stockErr) {
    // Stock changed between check and update — still record the order but warn
    console.warn('Stock update race:', stockErr.message);
  }

  // ── Send system message to seller ────────────────────────
  const buyerName = session.user.email ?? 'A buyer';
  const total     = (qty * Number(currentProduct.price))
    .toLocaleString('en-PH', { minimumFractionDigits: 2 });

  await supabase.from('messages').insert([{
    sender_id:    session.user.id,
    recipient_id: freshProduct.profile_id,
    product_id:   currentProduct.id,
    body: `🛒 New order from ${buyerName}!\n\nProduct: ${currentProduct.name}\nQty: ${qty}\nTotal: ₱${total}${note ? `\nNote: ${note}` : ''}`,
    is_system:    true,
  }]);

  // ── Success view ──────────────────────────────────────────
  submitBtn.disabled  = false;
  submitBtn.innerHTML = '<i data-lucide="shopping-cart"></i> Place Order';

  const msgEl = overlayEl?.querySelector('#buy-success-msg') as HTMLElement;
  if (msgEl) {
    msgEl.innerHTML = `Your order for <strong>${currentProduct.name}</strong> (×${qty}) has been sent to the seller.`;
  }
  showView('success');
  if ((window as any).lucide) (window as any).lucide.createIcons();

  // Update local product stock so card reflects new count without reload
  currentProduct = { ...currentProduct, stock: freshProduct.stock - qty };
}

// ── Public API ─────────────────────────────────────────────────
export function openBuyModal(product: Product) {
  currentProduct = product;
  const overlay  = ensureModal();

  // Reset to form view
  showView('form');
  clearErrors();

  const price    = Number(product.price);
  const seller   = product.profiles?.business_name || 'Unknown Seller';
  const logoUrl  = product.profiles?.logo_url;
  const fmtPrice = price.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Fill product summary
  const productEl = overlay.querySelector('#buy-modal-product') as HTMLElement;
  const imgHtml = product.image_url
    ? `<img src="${product.image_url}" alt="${product.name}" class="buy-modal-img" />`
    : `<div class="buy-modal-img buy-modal-img-placeholder">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
           <rect x="3" y="3" width="18" height="18" rx="2"/>
           <circle cx="8.5" cy="8.5" r="1.5"/>
           <polyline points="21 15 16 10 5 21"/>
         </svg>
       </div>`;
  const logoHtml = logoUrl
    ? `<img src="${logoUrl}" alt="${seller}" class="buy-modal-seller-logo" />`
    : `<div class="buy-modal-seller-logo buy-modal-seller-logo-placeholder">${seller.charAt(0).toUpperCase()}</div>`;

  productEl.innerHTML = `
    ${imgHtml}
    <div class="buy-modal-product-info">
      <div class="buy-modal-seller-row">
        ${logoHtml}
        <span class="text-sm text-muted">${seller}</span>
      </div>
      <h3 id="buy-modal-title" class="buy-modal-product-name">${product.name}</h3>
      <p class="buy-modal-unit-price">₱${fmtPrice} <span class="text-muted text-sm">/ item</span></p>
      <p class="text-sm text-muted">${product.stock} available</p>
    </div>
  `;

  // Reset quantity and total
  const qtyInput = overlay.querySelector('#buy-quantity') as HTMLInputElement;
  qtyInput.value = '1';
  qtyInput.max   = String(product.stock);
  const totalEl  = overlay.querySelector('#buy-modal-total') as HTMLElement;
  totalEl.textContent = `₱${fmtPrice}`;

  // Reset note
  (overlay.querySelector('#buy-note') as HTMLTextAreaElement).value = '';

  // Show modal
  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  if ((window as any).lucide) (window as any).lucide.createIcons();
  qtyInput.focus();
}
