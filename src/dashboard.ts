import { supabase } from './supabaseClient';
import type { Profile, Product, SellerAd, Order } from './types';

export async function initDashboard() {
  const container = document.getElementById('dashboard-main');
  if (!container) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { console.warn("Dashboard accessed without session."); return; }

  const userId = session.user.id;

  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  await refreshNotifBadge(userId);
  await refreshOrdersBadge(userId);

  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.id === 'btn-logout') return;
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      const target = e.currentTarget as HTMLButtonElement;
      target.classList.add('active');
      const tab = target.dataset.tab;

      if (tab === 'profile')        loadProfileView(container, userId);
      if (tab === 'products')       loadProductsView(container, userId);
      if (tab === 'orders')         loadSellerOrdersView(container, userId);
      if (tab === 'ads')            loadAdsView(container, userId);
      if (tab === 'notifications')  loadNotificationsView(container, userId);
    });
  });

  await loadProfileView(container, userId);
}


async function loadProfileView(container: HTMLElement, userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single();
  if (error && error.code !== 'PGRST116') console.error('Error loading profile:', error);

  const profile = data as Profile | null;
  const isSeller = (profile?.role ?? 'buyer') === 'seller';
  const descLength = (profile?.description || '').length;
  const logoUrl = profile?.logo_url || '';
  const businessName = profile?.business_name || '';

  // ── Brand name section — sellers only ─────────────────────
  const brandSection = isSeller ? `
    <div class="brand-name-section glass">
      <div class="brand-name-header">
        <div class="brand-name-icon"><i data-lucide="badge-check"></i></div>
        <div>
          <p class="brand-name-label">Brand / Business Name</p>
          <p class="text-muted text-sm">This is the public name shown on your shop and all your listings.</p>
        </div>
      </div>

      <div class="brand-name-display" id="brand-display-wrap">
        <span class="brand-name-current" id="brand-current-name">
          ${businessName || '<span class="text-muted">No name set yet</span>'}
        </span>
        <button type="button" class="btn btn-ghost btn-sm brand-edit-btn" id="btn-edit-brand">
          <i data-lucide="pencil"></i> Rename
        </button>
      </div>

      <div class="brand-name-edit hidden" id="brand-edit-wrap">
        <div class="input-with-icon brand-name-input-wrap">
          <i data-lucide="store"></i>
          <input type="text" id="brand-name-input"
            value="${businessName}"
            placeholder="e.g. Green Leaf Organics"
            maxlength="80"
            autocomplete="off" />
        </div>
        <div class="brand-name-actions">
          <button type="button" class="btn btn-primary btn-sm" id="btn-save-brand">
            <i data-lucide="check"></i> Save Name
          </button>
          <button type="button" class="btn btn-ghost btn-sm" id="btn-cancel-brand">
            Cancel
          </button>
        </div>
        <p id="brand-save-status" class="text-sm" style="display:none; margin-top:0.5rem;"></p>
      </div>
    </div>
  ` : '';

  container.innerHTML = `
    ${brandSection}

    <!-- Live Preview Card -->
    <div class="profile-preview-card glass" id="profile-preview">
      <div class="profile-preview-inner">
        <div class="profile-preview-logo-wrap">
          ${logoUrl
            ? `<img id="preview-logo-img" src="${logoUrl}" alt="Logo" class="profile-preview-logo" />`
            : `<div id="preview-logo-placeholder" class="profile-preview-logo-placeholder">
                <i data-lucide="image"></i>
               </div>`
          }
        </div>
        <div class="profile-preview-info">
          <p class="profile-preview-label">Live Preview</p>
          <h3 id="preview-name" class="profile-preview-name">${businessName || 'Your Business Name'}</h3>
          <p id="preview-email" class="profile-preview-email text-muted text-sm">${profile?.contact_email || ''}</p>
        </div>
      </div>
    </div>

    <!-- Edit Form Card -->
    <div class="glass profile-form-card">
      <div class="profile-form-header">
        <div class="profile-form-icon"><i data-lucide="user-circle"></i></div>
        <div>
          <h2>My Profile</h2>
          <p class="text-muted text-sm">This information is shown publicly on your shop page.</p>
        </div>
      </div>

      <form id="profile-form" class="form">

        <!-- Logo Upload -->
        <div class="form-group">
          <label>Shop Logo</label>
          <div class="logo-upload-area" id="logo-upload-area">
            <div class="logo-upload-preview" id="logo-upload-preview">
              ${logoUrl
                ? `<img id="logo-preview-thumb" src="${logoUrl}" alt="Logo preview" class="logo-thumb" />`
                : `<div id="logo-preview-thumb" class="logo-thumb-placeholder"><i data-lucide="image-plus"></i></div>`
              }
            </div>
            <div class="logo-upload-info">
              <p class="logo-upload-title">Upload your logo</p>
              <p class="text-muted text-sm">PNG, JPG or WEBP · Max 2 MB</p>
              <label for="prof-logo-file" class="btn btn-ghost logo-upload-btn">
                <i data-lucide="upload"></i> Choose File
              </label>
              <input type="file" id="prof-logo-file" accept="image/png,image/jpeg,image/webp" style="display:none;" />
            </div>
          </div>
          <input type="hidden" id="prof-logo" value="${logoUrl}" />
          <p id="logo-upload-status" class="text-sm text-muted" style="margin-top:0.4rem;"></p>
        </div>

        <!-- Business / Shop Name — only shown for buyers or as fallback -->
        ${!isSeller ? `
        <div class="form-group">
          <label for="prof-name">Display Name</label>
          <div class="input-with-icon">
            <i data-lucide="user"></i>
            <input type="text" id="prof-name" placeholder="Your name"
              value="${profile?.business_name || ''}" maxlength="80" />
          </div>
        </div>
        ` : `<input type="hidden" id="prof-name" value="${businessName}" />`}

        <!-- Shop Description -->
        <div class="form-group">
          <label for="prof-desc">${isSeller ? 'Shop Description' : 'About Me'}</label>
          <textarea id="prof-desc" placeholder="${isSeller ? 'Tell customers what your shop is about, what you sell, and what makes you unique…' : 'Tell sellers a bit about yourself…'}" rows="4" maxlength="300">${profile?.description || ''}</textarea>
          <p class="char-count text-sm text-muted"><span id="desc-count">${descLength}</span> / 300</p>
        </div>

        <!-- Contact Email -->
        <div class="form-group">
          <label for="prof-email">Contact Email</label>
          <div class="input-with-icon">
            <i data-lucide="mail"></i>
            <input type="email" id="prof-email" placeholder="you@example.com"
              value="${profile?.contact_email || ''}" />
          </div>
        </div>

        <div class="profile-form-actions">
          <button type="submit" class="btn btn-primary btn-lg" id="profile-save-btn">
            <i data-lucide="save"></i> Save Profile
          </button>
          <p id="profile-save-status" class="text-sm" style="display:none;"></p>
        </div>
      </form>
    </div>
  `;

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // ── Brand name rename (sellers only) ──────────────────────
  if (isSeller) {
    const brandInput     = document.getElementById('brand-name-input')  as HTMLInputElement;
    const brandCurrent   = document.getElementById('brand-current-name') as HTMLElement;
    const brandDisplayWrap = document.getElementById('brand-display-wrap') as HTMLElement;
    const brandEditWrap  = document.getElementById('brand-edit-wrap')   as HTMLElement;
    const brandStatus    = document.getElementById('brand-save-status') as HTMLElement;
    const previewName    = document.getElementById('preview-name')      as HTMLElement;
    const profNameHidden = document.getElementById('prof-name')         as HTMLInputElement;

    // Open edit mode
    document.getElementById('btn-edit-brand')?.addEventListener('click', () => {
      brandDisplayWrap.classList.add('hidden');
      brandEditWrap.classList.remove('hidden');
      brandInput.focus();
      brandInput.select();
    });

    // Cancel edit
    document.getElementById('btn-cancel-brand')?.addEventListener('click', () => {
      brandInput.value = profNameHidden.value;
      brandEditWrap.classList.add('hidden');
      brandDisplayWrap.classList.remove('hidden');
      brandStatus.style.display = 'none';
    });

    // Live preview while typing
    brandInput.addEventListener('input', () => {
      previewName.textContent = brandInput.value.trim() || 'Your Business Name';
    });

    // Save brand name
    document.getElementById('btn-save-brand')?.addEventListener('click', async () => {
      const newName = brandInput.value.trim();
      const saveBtn = document.getElementById('btn-save-brand') as HTMLButtonElement;

      if (!newName) {
        brandStatus.textContent = 'Brand name cannot be empty.';
        brandStatus.style.color = 'var(--danger-color)';
        brandStatus.style.display = 'block';
        return;
      }

      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i data-lucide="loader"></i> Saving…';
      if ((window as any).lucide) (window as any).lucide.createIcons();

      const { error: saveError } = await supabase
        .from('profiles')
        .update({ business_name: newName })
        .eq('id', userId);

      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i data-lucide="check"></i> Save Name';
      if ((window as any).lucide) (window as any).lucide.createIcons();

      if (saveError) {
        brandStatus.textContent = '✗ ' + saveError.message;
        brandStatus.style.color = 'var(--danger-color)';
        brandStatus.style.display = 'block';
      } else {
        // Update display
        profNameHidden.value = newName;
        brandCurrent.textContent = newName;
        previewName.textContent  = newName;

        brandEditWrap.classList.add('hidden');
        brandDisplayWrap.classList.remove('hidden');
        brandStatus.style.display = 'none';
      }
    });

    // Allow Enter key to save
    brandInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        (document.getElementById('btn-save-brand') as HTMLButtonElement)?.click();
      }
      if (e.key === 'Escape') {
        (document.getElementById('btn-cancel-brand') as HTMLButtonElement)?.click();
      }
    });
  }

  // ── Live preview: name (buyer path) ───────────────────────
  if (!isSeller) {
    const nameInput   = document.getElementById('prof-name')    as HTMLInputElement;
    const previewName = document.getElementById('preview-name') as HTMLElement;
    nameInput?.addEventListener('input', () => {
      previewName.textContent = nameInput.value.trim() || 'Your Name';
    });
  }

  // ── Live preview: email ────────────────────────────────────
  const emailInput  = document.getElementById('prof-email')   as HTMLInputElement;
  const previewEmail = document.getElementById('preview-email') as HTMLElement;
  emailInput?.addEventListener('input', () => {
    previewEmail.textContent = emailInput.value.trim();
  });

  // ── Description character count ────────────────────────────
  const descTextarea = document.getElementById('prof-desc')  as HTMLTextAreaElement;
  const descCount    = document.getElementById('desc-count') as HTMLElement;
  descTextarea?.addEventListener('input', () => {
    descCount.textContent = String(descTextarea.value.length);
  });

  // ── Logo file upload ───────────────────────────────────────
  const logoFileInput   = document.getElementById('prof-logo-file')   as HTMLInputElement;
  const logoHidden      = document.getElementById('prof-logo')        as HTMLInputElement;
  const logoStatus      = document.getElementById('logo-upload-status') as HTMLElement;
  const previewLogoWrap = document.querySelector('.profile-preview-logo-wrap') as HTMLElement;

  logoFileInput?.addEventListener('change', async () => {
    const file = logoFileInput.files?.[0];
    if (!file) return;

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

    logoHidden.value = publicUrl;

    const logoPreviewThumb = document.getElementById('logo-preview-thumb') as HTMLElement;
    if (logoPreviewThumb) {
      logoPreviewThumb.outerHTML = `<img id="logo-preview-thumb" src="${publicUrl}" alt="Logo preview" class="logo-thumb" />`;
    }
    previewLogoWrap.innerHTML = `<img id="preview-logo-img" src="${publicUrl}" alt="Logo" class="profile-preview-logo" />`;

    logoStatus.textContent = 'Logo uploaded successfully.';
    logoStatus.style.color = 'var(--primary-color)';
  });

  // ── Save profile form ──────────────────────────────────────
  document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const saveBtn    = document.getElementById('profile-save-btn')    as HTMLButtonElement;
    const saveStatus = document.getElementById('profile-save-status') as HTMLElement;

    const business_name  = (document.getElementById('prof-name')  as HTMLInputElement).value.trim();
    const description    = descTextarea.value.trim();
    const logo_url       = logoHidden.value.trim();
    const contact_email  = emailInput.value.trim();

    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i data-lucide="loader"></i> Saving…';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    const { error: saveError } = await supabase.from('profiles').upsert({
      id: userId,
      business_name,
      description,
      logo_url,
      contact_email,
    });

    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i data-lucide="save"></i> Save Profile';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    saveStatus.style.display = 'inline';
    if (saveError) {
      saveStatus.textContent = '✗ ' + saveError.message;
      saveStatus.style.color = 'var(--danger-color)';
    } else {
      saveStatus.textContent = '✓ Profile saved successfully!';
      saveStatus.style.color = 'var(--primary-color)';
      setTimeout(() => { saveStatus.style.display = 'none'; }, 3000);
    }
  });
}

async function loadProductsView(container: HTMLElement, userId: string) {
  container.innerHTML = `
    <!-- Header bar -->
    <div class="prod-page-header glass">
      <div class="prod-page-header-info">
        <div class="prod-page-icon"><i data-lucide="package"></i></div>
        <div>
          <h2>My Products</h2>
          <p class="text-muted text-sm">Manage the products listed in your shop.</p>
        </div>
      </div>
      <button class="btn btn-primary" id="btn-open-add-product">
        <i data-lucide="plus"></i> Add Product
      </button>
    </div>

    <!-- Add Product Modal Overlay -->
    <div class="modal-overlay hidden" id="add-product-modal">
      <div class="modal-card glass">
        <div class="modal-header">
          <h3>Add New Product</h3>
          <button class="btn btn-icon" id="btn-close-modal" aria-label="Close">
            <i data-lucide="x"></i>
          </button>
        </div>

        <form id="add-product-form" class="form">
          <div class="form-group">
            <label for="prod-name">Product Name <span class="field-required">*</span></label>
            <input type="text" id="prod-name" placeholder="e.g. Handmade Ceramic Mug" maxlength="100" required />
          </div>

          <div class="form-group">
            <label for="prod-desc">Description <span class="field-required">*</span></label>
            <textarea id="prod-desc" placeholder="Describe your product — materials, size, features…" rows="3" maxlength="500" required></textarea>
          </div>

          <div class="prod-form-row">
            <div class="form-group">
              <label for="prod-price">Price (₱) <span class="field-required">*</span></label>
              <div class="input-with-icon">
                <i data-lucide="philippine-peso"></i>
                <input type="number" id="prod-price" placeholder="0.00" step="0.01" min="0" required />
              </div>
            </div>
            <div class="form-group">
              <label for="prod-stock">Stock <span class="field-required">*</span></label>
              <div class="input-with-icon">
                <i data-lucide="boxes"></i>
                <input type="number" id="prod-stock" placeholder="1" min="0" value="1" required />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Product Image <span class="text-muted text-sm">(optional)</span></label>
            <div class="prod-img-upload-area" id="prod-img-upload-area">
              <div class="prod-img-preview" id="prod-img-preview">
                <div class="prod-img-placeholder" id="prod-img-placeholder">
                  <i data-lucide="image-plus"></i>
                  <span>Click or drag to upload</span>
                </div>
              </div>
              <label for="prod-image-file" class="btn btn-ghost prod-img-upload-btn">
                <i data-lucide="upload"></i> Choose Image
              </label>
              <input type="file" id="prod-image-file" accept="image/png,image/jpeg,image/webp" style="display:none;" />
            </div>
            <p class="text-muted text-sm" style="margin-top:0.35rem;">PNG, JPG or WEBP · Max 5 MB</p>
            <p id="prod-img-status" class="text-sm" style="margin-top:0.25rem;"></p>
            <!-- Hidden fields carry the resolved URL and storage path -->
            <input type="hidden" id="prod-image-url" />
            <input type="hidden" id="prod-image-path" />
          </div>

          <p id="prod-form-error" class="field-error" style="margin-bottom:0.75rem;"></p>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="btn-cancel-product">Cancel</button>
            <button type="submit" class="btn btn-primary" id="prod-submit-btn">
              <i data-lucide="plus-circle"></i> Add Product
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Products List -->
    <div class="glass prod-list-card">
      <div id="products-list-container">
        <div class="prod-loading">
          <div class="skeleton" style="height:80px; border-radius:var(--radius-md); margin-bottom:0.75rem;"></div>
          <div class="skeleton" style="height:80px; border-radius:var(--radius-md); margin-bottom:0.75rem;"></div>
          <div class="skeleton" style="height:80px; border-radius:var(--radius-md);"></div>
        </div>
      </div>
    </div>
  `;

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // ── Modal open / close ─────────────────────────────────────
  const modal    = document.getElementById('add-product-modal') as HTMLElement;
  const openBtn  = document.getElementById('btn-open-add-product') as HTMLButtonElement;
  const closeBtn = document.getElementById('btn-close-modal') as HTMLButtonElement;
  const cancelBtn = document.getElementById('btn-cancel-product') as HTMLButtonElement;

  const openModal = () => {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    (document.getElementById('prod-name') as HTMLInputElement)?.focus();
  };
  const closeModal = () => {
    modal.classList.add('hidden');
    document.body.style.overflow = '';
    (document.getElementById('add-product-form') as HTMLFormElement)?.reset();
    // Reset image preview
    const placeholder = document.getElementById('prod-img-placeholder');
    const preview = document.getElementById('prod-img-preview');
    if (preview && placeholder) {
      preview.innerHTML = '';
      preview.appendChild(placeholder);
      placeholder.innerHTML = '<i data-lucide="image-plus"></i><span>Click or drag to upload</span>';
    }
    const statusEl = document.getElementById('prod-img-status');
    if (statusEl) statusEl.textContent = '';
    const urlHidden = document.getElementById('prod-image-url') as HTMLInputElement;
    const pathHidden = document.getElementById('prod-image-path') as HTMLInputElement;
    if (urlHidden) urlHidden.value = '';
    if (pathHidden) pathHidden.value = '';
    const errEl = document.getElementById('prod-form-error');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    if ((window as any).lucide) (window as any).lucide.createIcons();
  };

  openBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);
  cancelBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // ── Product image file upload ──────────────────────────────
  const imgFileInput  = document.getElementById('prod-image-file')  as HTMLInputElement;
  const imgUrlHidden  = document.getElementById('prod-image-url')   as HTMLInputElement;
  const imgPathHidden = document.getElementById('prod-image-path')  as HTMLInputElement;
  const imgStatus     = document.getElementById('prod-img-status')  as HTMLElement;
  const imgPreview    = document.getElementById('prod-img-preview') as HTMLElement;
  const imgUploadArea = document.getElementById('prod-img-upload-area') as HTMLElement;

  // Drag-and-drop support
  imgUploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    imgUploadArea.classList.add('drag-over');
  });
  imgUploadArea?.addEventListener('dragleave', () => {
    imgUploadArea.classList.remove('drag-over');
  });
  imgUploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    imgUploadArea.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleProductImageUpload(file, userId, imgPreview, imgUrlHidden, imgPathHidden, imgStatus);
  });

  imgFileInput?.addEventListener('change', () => {
    const file = imgFileInput.files?.[0];
    if (file) handleProductImageUpload(file, userId, imgPreview, imgUrlHidden, imgPathHidden, imgStatus);
  });

  // ── Add product form submit ────────────────────────────────
  document.getElementById('add-product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name      = (document.getElementById('prod-name')  as HTMLInputElement).value.trim();
    const desc      = (document.getElementById('prod-desc')  as HTMLTextAreaElement).value.trim();
    const price     = parseFloat((document.getElementById('prod-price') as HTMLInputElement).value);
    const stock     = parseInt((document.getElementById('prod-stock')   as HTMLInputElement).value);
    const image_url  = imgUrlHidden.value.trim();
    const image_path = imgPathHidden.value.trim();
    const errEl     = document.getElementById('prod-form-error') as HTMLElement;
    const submitBtn = document.getElementById('prod-submit-btn') as HTMLButtonElement;

    errEl.style.display = 'none';

    if (!name || !desc || isNaN(price) || isNaN(stock)) {
      errEl.textContent = 'Please fill in all required fields.';
      errEl.style.display = 'block';
      return;
    }
    if (price < 0) {
      errEl.textContent = 'Price cannot be negative.';
      errEl.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader"></i> Adding…';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    const { error } = await supabase.from('products').insert([{
      profile_id: userId,
      name,
      description: desc,
      price,
      stock,
      image_url:  image_url  || null,
      image_path: image_path || null,
    }]);

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="plus-circle"></i> Add Product';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    if (error) {
      errEl.textContent = 'Error: ' + error.message;
      errEl.style.display = 'block';
    } else {
      closeModal();
      await renderProductsList(userId, container);
    }
  });

  // ── Load the list ──────────────────────────────────────────
  await renderProductsList(userId, container);
}

async function handleProductImageUpload(
  file: File,
  userId: string,
  previewEl: HTMLElement,
  urlHidden: HTMLInputElement,
  pathHidden: HTMLInputElement,
  statusEl: HTMLElement
) {
  const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
  const ALLOWED  = ['image/png', 'image/jpeg', 'image/webp'];

  if (!ALLOWED.includes(file.type)) {
    statusEl.textContent = 'Only PNG, JPG or WEBP files are allowed.';
    statusEl.style.color = 'var(--danger-color)';
    return;
  }
  if (file.size > MAX_SIZE) {
    statusEl.textContent = 'File is too large. Max size is 5 MB.';
    statusEl.style.color = 'var(--danger-color)';
    return;
  }

  // Show local preview immediately
  const objectUrl = URL.createObjectURL(file);
  previewEl.innerHTML = `<img src="${objectUrl}" alt="Preview" class="prod-img-thumb" />`;

  statusEl.textContent = 'Uploading…';
  statusEl.style.color = 'var(--text-muted)';

  const ext      = file.name.split('.').pop();
  const filePath = `${userId}/${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('product-images')
    .upload(filePath, file, { upsert: false, contentType: file.type });

  if (uploadError) {
    statusEl.textContent = 'Upload failed: ' + uploadError.message;
    statusEl.style.color = 'var(--danger-color)';
    previewEl.innerHTML = `
      <div class="prod-img-placeholder" id="prod-img-placeholder">
        <i data-lucide="image-plus"></i><span>Click or drag to upload</span>
      </div>`;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  const { data: urlData } = supabase.storage
    .from('product-images')
    .getPublicUrl(filePath);

  urlHidden.value  = urlData.publicUrl;
  pathHidden.value = filePath;

  statusEl.textContent = '✓ Image ready';
  statusEl.style.color = 'var(--primary-color)';
}

async function renderProductsList(userId: string, container: HTMLElement) {
  const listContainer = document.getElementById('products-list-container');
  if (!listContainer) return;

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    listContainer.innerHTML = '<p class="text-danger" style="padding:1rem;">Failed to load products.</p>';
    return;
  }

  const products = (data || []) as Product[];

  if (products.length === 0) {
    listContainer.innerHTML = `
      <div class="prod-empty-state">
        <div class="prod-empty-icon"><i data-lucide="package-open"></i></div>
        <h3>No products yet</h3>
        <p class="text-muted text-sm">Click "Add Product" to list your first item.</p>
      </div>
    `;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  listContainer.innerHTML = `
    <div class="prod-list-meta text-sm text-muted">
      ${products.length} product${products.length !== 1 ? 's' : ''} listed
    </div>
    <div class="prod-list">
      ${products.map(p => `
        <div class="prod-list-item" data-id="${p.id}">
          <div class="prod-list-thumb">
            ${p.image_url
              ? `<img src="${p.image_url}" alt="${p.name}" class="prod-thumb-img" />`
              : `<div class="prod-thumb-placeholder"><i data-lucide="image-off"></i></div>`
            }
          </div>
          <div class="prod-list-info">
            <p class="prod-list-name">${p.name}</p>
            <p class="prod-list-desc text-muted text-sm">${p.description ? p.description.substring(0, 80) + (p.description.length > 80 ? '…' : '') : ''}</p>
            <div class="prod-list-meta-row">
              <span class="prod-list-price">₱${Number(p.price).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              <span class="prod-stock-badge ${p.stock > 0 ? 'in-stock' : 'out-of-stock'}">
                <i data-lucide="${p.stock > 0 ? 'check-circle' : 'x-circle'}"></i>
                ${p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}
              </span>
            </div>
          </div>
          <div class="prod-list-actions">
            <button class="btn btn-ghost btn-sm btn-add-stock" data-id="${p.id}" data-name="${p.name}" data-stock="${p.stock}" title="Add stock">
              <i data-lucide="plus-circle"></i> Stock
            </button>
            <button class="btn btn-ghost btn-sm btn-edit-product" data-id="${p.id}" title="Edit product">
              <i data-lucide="pencil"></i> Edit
            </button>
            <button class="btn btn-ghost btn-sm text-danger btn-delete-product" data-id="${p.id}" title="Delete product">
              <i data-lucide="trash-2"></i> Delete
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // ── Add Stock listeners ────────────────────────────────────
  listContainer.querySelectorAll('.btn-add-stock').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const id     = target.dataset.id!;
      const name   = target.dataset.name!;
      const stock  = parseInt(target.dataset.stock!) || 0;
      openAddStockModal(id, name, stock, userId, container);
    });
  });

  // Edit listeners
  listContainer.querySelectorAll('.btn-edit-product').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const productId = target.dataset.id;
      if (!productId) return;
      
      const product = products.find(p => p.id === productId);
      if (!product) return;
      
      openEditProductModal(product, userId, container);
    });
  });

  // Delete listeners
  listContainer.querySelectorAll('.btn-delete-product').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const productId = target.dataset.id;
      if (!productId) return;

      if (confirm('Delete this product? This cannot be undone.')) {
        const { error } = await supabase.from('products').delete().eq('id', productId);
        if (error) alert('Error deleting: ' + error.message);
        else await renderProductsList(userId, container);
      }
    });
  });
}

// ── Edit Product Modal ─────────────────────────────────────
async function openEditProductModal(product: Product, userId: string, container: HTMLElement) {
  // Create a temporary edit modal overlay
  const editModalHtml = `
    <div class="modal-overlay" id="edit-product-modal">
      <div class="modal-card glass">
        <div class="modal-header">
          <h3>Edit Product</h3>
          <button class="btn btn-icon" id="btn-close-edit-modal" aria-label="Close">
            <i data-lucide="x"></i>
          </button>
        </div>

        <form id="edit-product-form" class="form">
          <input type="hidden" id="edit-prod-id" value="${product.id}" />

          <div class="form-group">
            <label for="edit-prod-name">Product Name <span class="field-required">*</span></label>
            <input type="text" id="edit-prod-name" value="${product.name}" placeholder="e.g. Handmade Ceramic Mug" maxlength="100" required />
          </div>

          <div class="form-group">
            <label for="edit-prod-desc">Description <span class="field-required">*</span></label>
            <textarea id="edit-prod-desc" placeholder="Describe your product…" rows="3" maxlength="500" required>${product.description || ''}</textarea>
          </div>

          <div class="prod-form-row">
            <div class="form-group">
              <label for="edit-prod-price">Price (₱) <span class="field-required">*</span></label>
              <div class="input-with-icon">
                <i data-lucide="philippine-peso"></i>
                <input type="number" id="edit-prod-price" value="${product.price}" step="0.01" min="0" required />
              </div>
            </div>
            <div class="form-group">
              <label for="edit-prod-stock">Stock <span class="field-required">*</span></label>
              <div class="input-with-icon">
                <i data-lucide="boxes"></i>
                <input type="number" id="edit-prod-stock" value="${product.stock}" min="0" required />
              </div>
            </div>
          </div>

          <div class="form-group">
            <label>Product Image <span class="text-muted text-sm">(optional)</span></label>
            <div class="prod-img-upload-area" id="edit-prod-img-upload-area">
              <div class="prod-img-preview" id="edit-prod-img-preview">
                ${product.image_url
                  ? `<img src="${product.image_url}" alt="Preview" class="prod-img-thumb" id="edit-prod-img-thumb" />`
                  : `<div class="prod-img-placeholder" id="edit-prod-img-placeholder">
                       <i data-lucide="image-plus"></i>
                       <span>Click or drag to upload</span>
                     </div>`
                }
              </div>
              <label for="edit-prod-image-file" class="btn btn-ghost prod-img-upload-btn">
                <i data-lucide="upload"></i> ${product.image_url ? 'Change Image' : 'Choose Image'}
              </label>
              <input type="file" id="edit-prod-image-file" accept="image/png,image/jpeg,image/webp" style="display:none;" />
            </div>
            <p class="text-muted text-sm" style="margin-top:0.35rem;">PNG, JPG or WEBP · Max 5 MB</p>
            <p id="edit-prod-img-status" class="text-sm" style="margin-top:0.25rem;"></p>
            <input type="hidden" id="edit-prod-image-url" value="${product.image_url || ''}" />
            <input type="hidden" id="edit-prod-image-path" value="${(product as any).image_path || ''}" />
          </div>

          <p id="edit-prod-form-error" class="field-error" style="margin-bottom:0.75rem;"></p>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" id="btn-cancel-edit-product">Cancel</button>
            <button type="submit" class="btn btn-primary" id="edit-prod-submit-btn">
              <i data-lucide="save"></i> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Inject modal into DOM
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = editModalHtml;
  const editModal = tempDiv.firstElementChild as HTMLElement;
  document.body.appendChild(editModal);

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // Show modal
  editModal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // ── Close handlers ─────────────────────────────────────────
  const closeEditModal = () => {
    editModal.classList.add('hidden');
    document.body.style.overflow = '';
    setTimeout(() => editModal.remove(), 200);
  };

  editModal.querySelector('#btn-close-edit-modal')?.addEventListener('click', closeEditModal);
  editModal.querySelector('#btn-cancel-edit-product')?.addEventListener('click', closeEditModal);
  editModal.addEventListener('click', (e) => {
    if (e.target === editModal) closeEditModal();
  });

  // ── Image upload handler ───────────────────────────────────
  const editImgFileInput  = editModal.querySelector('#edit-prod-image-file')  as HTMLInputElement;
  const editImgUrlHidden  = editModal.querySelector('#edit-prod-image-url')   as HTMLInputElement;
  const editImgPathHidden = editModal.querySelector('#edit-prod-image-path')  as HTMLInputElement;
  const editImgStatus     = editModal.querySelector('#edit-prod-img-status')  as HTMLElement;
  const editImgPreview    = editModal.querySelector('#edit-prod-img-preview') as HTMLElement;
  const editImgUploadArea = editModal.querySelector('#edit-prod-img-upload-area') as HTMLElement;

  // Drag-and-drop
  editImgUploadArea?.addEventListener('dragover', (e) => {
    e.preventDefault();
    editImgUploadArea.classList.add('drag-over');
  });
  editImgUploadArea?.addEventListener('dragleave', () => {
    editImgUploadArea.classList.remove('drag-over');
  });
  editImgUploadArea?.addEventListener('drop', (e) => {
    e.preventDefault();
    editImgUploadArea.classList.remove('drag-over');
    const file = e.dataTransfer?.files?.[0];
    if (file) handleProductImageUpload(file, userId, editImgPreview, editImgUrlHidden, editImgPathHidden, editImgStatus);
  });

  editImgFileInput?.addEventListener('change', () => {
    const file = editImgFileInput.files?.[0];
    if (file) handleProductImageUpload(file, userId, editImgPreview, editImgUrlHidden, editImgPathHidden, editImgStatus);
  });

  // ── Form submit ────────────────────────────────────────────
  editModal.querySelector('#edit-product-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id        = (editModal.querySelector('#edit-prod-id')    as HTMLInputElement).value;
    const name      = (editModal.querySelector('#edit-prod-name')  as HTMLInputElement).value.trim();
    const desc      = (editModal.querySelector('#edit-prod-desc')  as HTMLTextAreaElement).value.trim();
    const price     = parseFloat((editModal.querySelector('#edit-prod-price') as HTMLInputElement).value);
    const stock     = parseInt((editModal.querySelector('#edit-prod-stock')   as HTMLInputElement).value);
    const image_url  = editImgUrlHidden.value.trim();
    const image_path = editImgPathHidden.value.trim();
    const errEl     = editModal.querySelector('#edit-prod-form-error') as HTMLElement;
    const submitBtn = editModal.querySelector('#edit-prod-submit-btn') as HTMLButtonElement;

    errEl.style.display = 'none';

    if (!name || !desc || isNaN(price) || isNaN(stock)) {
      errEl.textContent = 'Please fill in all required fields.';
      errEl.style.display = 'block';
      return;
    }
    if (price < 0) {
      errEl.textContent = 'Price cannot be negative.';
      errEl.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader"></i> Saving…';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    const { error } = await supabase
      .from('products')
      .update({
        name,
        description: desc,
        price,
        stock,
        image_url:  image_url  || null,
        image_path: image_path || null,
      })
      .eq('id', id);

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="save"></i> Save Changes';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    if (error) {
      errEl.textContent = 'Error: ' + error.message;
      errEl.style.display = 'block';
    } else {
      closeEditModal();
      await renderProductsList(userId, container);
    }
  });
}


// ── Add Stock Modal ────────────────────────────────────────────
function openAddStockModal(productId: string, productName: string, currentStock: number, userId: string, container: HTMLElement) {
  // Remove any existing instance
  document.getElementById('add-stock-modal')?.remove();

  const div = document.createElement('div');
  div.innerHTML = `
    <div class="modal-overlay" id="add-stock-modal">
      <div class="modal-card glass" style="max-width:380px;">
        <div class="modal-header">
          <h3><i data-lucide="plus-circle" style="display:inline;width:18px;height:18px;vertical-align:-3px;margin-right:6px;"></i> Add Stock</h3>
          <button class="btn btn-icon" id="btn-close-stock-modal" aria-label="Close">
            <i data-lucide="x"></i>
          </button>
        </div>
        <div style="padding:0.5rem 0 1rem;">
          <p class="text-muted text-sm" style="margin-bottom:1.25rem;">
            <strong>${productName}</strong> — currently <strong>${currentStock}</strong> in stock.
          </p>
          <div class="form-group">
            <label for="add-stock-qty">Quantity to Add <span class="field-required">*</span></label>
            <div class="input-with-icon">
              <i data-lucide="boxes"></i>
              <input type="number" id="add-stock-qty" min="1" value="1" />
            </div>
            <p class="text-muted text-sm" style="margin-top:0.35rem;">
              New total will be <strong id="add-stock-preview">${currentStock + 1}</strong>
            </p>
          </div>
          <p id="add-stock-error" class="field-error" style="margin-bottom:0.5rem;"></p>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" id="btn-cancel-stock">Cancel</button>
          <button type="button" class="btn btn-primary" id="btn-confirm-stock">
            <i data-lucide="plus-circle"></i> Add Stock
          </button>
        </div>
      </div>
    </div>
  `;
  const modal = div.firstElementChild as HTMLElement;
  document.body.appendChild(modal);
  if ((window as any).lucide) (window as any).lucide.createIcons();
  document.body.style.overflow = 'hidden';

  const qtyInput   = modal.querySelector('#add-stock-qty')      as HTMLInputElement;
  const preview    = modal.querySelector('#add-stock-preview')  as HTMLElement;
  const errEl      = modal.querySelector('#add-stock-error')    as HTMLElement;
  const confirmBtn = modal.querySelector('#btn-confirm-stock')  as HTMLButtonElement;

  qtyInput.focus();
  qtyInput.select();

  // Live preview of new total
  qtyInput.addEventListener('input', () => {
    const qty = parseInt(qtyInput.value) || 0;
    preview.textContent = String(currentStock + Math.max(0, qty));
  });

  const closeModal = () => {
    modal.remove();
    document.body.style.overflow = '';
  };

  modal.querySelector('#btn-close-stock-modal')?.addEventListener('click', closeModal);
  modal.querySelector('#btn-cancel-stock')?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

  // Confirm
  confirmBtn.addEventListener('click', async () => {
    const qty = parseInt(qtyInput.value) || 0;
    errEl.style.display = 'none';

    if (qty < 1) {
      errEl.textContent = 'Enter at least 1.';
      errEl.style.display = 'block';
      return;
    }

    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i data-lucide="loader"></i> Updating…';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    const { error } = await supabase
      .from('products')
      .update({ stock: currentStock + qty })
      .eq('id', productId);

    confirmBtn.disabled = false;
    confirmBtn.innerHTML = '<i data-lucide="plus-circle"></i> Add Stock';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    if (error) {
      errEl.textContent = 'Update failed: ' + error.message;
      errEl.style.display = 'block';
    } else {
      closeModal();
      await renderProductsList(userId, container);
    }
  });
}

// =============================================
// SELLER PRODUCT ORDERS VIEW
// =============================================

async function refreshOrdersBadge(userId: string) {
  const badge = document.getElementById('orders-badge');
  if (!badge) return;
  const { count } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .eq('status', 'pending');
  if (count && count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function loadSellerOrdersView(container: HTMLElement, userId: string) {
  container.innerHTML = `
    <div class="prod-page-header glass">
      <div class="prod-page-header-info">
        <div class="prod-page-icon" style="background:linear-gradient(135deg,#f59e0b,#d97706);">
          <i data-lucide="clipboard-list"></i>
        </div>
        <div>
          <h2>Product Orders</h2>
          <p class="text-muted text-sm">Review, confirm and schedule delivery for buyer orders.</p>
        </div>
      </div>
    </div>
    <div class="glass" style="padding:1.5rem; border-radius:var(--radius-lg);">
      <div id="seller-orders-list">
        <div class="skeleton" style="height:90px;border-radius:var(--radius-md);margin-bottom:.75rem;"></div>
        <div class="skeleton" style="height:90px;border-radius:var(--radius-md);margin-bottom:.75rem;"></div>
        <div class="skeleton" style="height:90px;border-radius:var(--radius-md);"></div>
      </div>
    </div>
  `;
  if ((window as any).lucide) (window as any).lucide.createIcons();
  await renderSellerOrders(userId, container);
}

async function renderSellerOrders(userId: string, container: HTMLElement) {
  const listEl = document.getElementById('seller-orders-list');
  if (!listEl) return;

  const { data, error } = await supabase
    .from('orders')
    .select(`
      *,
      products!product_id (id, name, image_url, price, stock),
      seller_profile:profiles!seller_id ( business_name ),
      buyer_profile:profiles!buyer_id ( business_name, contact_email )
    `)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false });

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
        <p class="text-muted text-sm">Orders from buyers will appear here.</p>
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
    const buyerName = o.buyer_profile?.business_name || o.buyer_profile?.contact_email || 'A buyer';
    const total     = Number(o.total_price).toLocaleString('en-PH', { minimumFractionDigits: 2 });
    const date      = new Date(o.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const color     = statusColors[o.status] || '#64748b';
    const canAct    = o.status === 'pending' || o.status === 'confirmed' || o.status === 'shipped';

    return `
      <div class="seller-order-item" data-order-id="${o.id}">
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
          <p class="text-sm text-muted">
            <strong>${buyerName}</strong> · ${o.quantity} unit${o.quantity > 1 ? 's' : ''} · ₱${total}
          </p>
          ${o.note ? `<p class="text-sm text-muted" style="font-style:italic;">"${o.note}"</p>` : ''}
          ${o.delivery_date ? `<p class="text-sm" style="color:var(--emerald-500);">📅 Delivery: ${new Date(o.delivery_date).toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })}</p>` : ''}
          <p class="text-sm text-muted">Ordered ${date}</p>
        </div>
        ${canAct ? `
        <div class="seller-order-actions">
          ${o.status === 'pending' ? `
            <button class="btn btn-primary btn-sm btn-confirm-order" data-id="${o.id}">
              <i data-lucide="check"></i> Confirm
            </button>` : ''}
          ${o.status === 'confirmed' ? `
            <div class="seller-order-delivery-wrap">
              <input type="date" class="delivery-date-input" data-id="${o.id}"
                value="${o.delivery_date || ''}"
                min="${new Date().toISOString().split('T')[0]}"
                placeholder="Set delivery date" />
              <button class="btn btn-primary btn-sm btn-set-delivery" data-id="${o.id}">
                <i data-lucide="calendar"></i> Set Date & Ship
              </button>
            </div>` : ''}
          ${o.status === 'shipped' ? `
            <button class="btn btn-primary btn-sm btn-mark-delivered" data-id="${o.id}" style="background:var(--emerald-500);">
              <i data-lucide="check-check"></i> Mark Delivered
            </button>` : ''}
          <button class="btn btn-ghost btn-sm text-danger btn-cancel-order" data-id="${o.id}">
            <i data-lucide="x"></i> Cancel
          </button>
        </div>` : ''}
      </div>`;
  }).join('');

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // ── Confirm order ─────────────────────────────────────────
  listEl.querySelectorAll('.btn-confirm-order').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      const order = orders.find(o => o.id === id);
      if (!order) return;

      const product = order.products;
      if (!product) {
        alert("Product info missing.");
        return;
      }

      // Check current stock from DB to be safe and avoid races
      const { data: freshProd } = await supabase.from('products').select('stock').eq('id', product.id).single();
      const currentStock = freshProd?.stock ?? 0;

      if (currentStock < order.quantity) {
        alert(`Insufficient stock! Current: ${currentStock}, Requested: ${order.quantity}.\nYou might want to cancel this order.`);
        return;
      }

      // Deduct stock
      const { error: stockErr } = await supabase
        .from('products')
        .update({ stock: currentStock - order.quantity })
        .eq('id', product.id);

      if (stockErr) {
        alert("Failed to update stock: " + stockErr.message);
        return;
      }

      await supabase.from('orders').update({ status: 'confirmed' }).eq('id', id);
      await renderSellerOrders(userId, container);
      await refreshOrdersBadge(userId);
    });
  });

  // ── Set delivery date and ship ─────────────────────────────
  listEl.querySelectorAll('.btn-set-delivery').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id        = (btn as HTMLElement).dataset.id!;
      const dateInput = listEl.querySelector(`.delivery-date-input[data-id="${id}"]`) as HTMLInputElement;
      const dateVal   = dateInput?.value;
      if (!dateVal) {
        alert('Please pick a delivery date first.');
        return;
      }
      await supabase.from('orders').update({ status: 'shipped', delivery_date: dateVal }).eq('id', id);
      await renderSellerOrders(userId, container);
    });
  });

  // ── Mark delivered ────────────────────────────────────────
  listEl.querySelectorAll('.btn-mark-delivered').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      await supabase.from('orders').update({ status: 'delivered' }).eq('id', id);
      await renderSellerOrders(userId, container);
    });
  });

  // ── Cancel order ──────────────────────────────────────────
  listEl.querySelectorAll('.btn-cancel-order').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = (btn as HTMLElement).dataset.id!;
      const order = orders.find(o => o.id === id);
      if (!order) return;

      if (!confirm('Cancel this order? The buyer will be notified.')) return;

      // If the order was confirmed/shipped/delivered, we should probably restore the stock
      // since we deducted it during confirmation.
      if (['confirmed', 'shipped', 'delivered'].includes(order.status)) {
        const product = order.products;
        if (product) {
          const { data: freshProd } = await supabase.from('products').select('stock').eq('id', product.id).single();
          const currentStock = freshProd?.stock ?? 0;
          await supabase.from('products').update({ stock: currentStock + order.quantity }).eq('id', product.id);
        }
      }

      await supabase.from('orders').update({ status: 'cancelled' }).eq('id', id);
      await renderSellerOrders(userId, container);
      await refreshOrdersBadge(userId);
    });
  });
}

// =============================================
// ADS MANAGEMENT VIEW
// =============================================
async function loadAdsView(container: HTMLElement, userId: string) {
  // Load seller's products for the checkbox selector
  const { data: myProducts } = await supabase
    .from('products')
    .select('id, name, price, image_url')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false });

  const products = (myProducts || []) as Product[];

  const productCheckboxes = products.length > 0
    ? products.map(p => `
        <label class="ad-product-checkbox">
          <input type="checkbox" name="ad-products" value="${p.id}" />
          <span class="ad-product-checkbox-content">
            ${p.image_url
              ? `<img src="${p.image_url}" alt="${p.name}" class="ad-product-checkbox-img" />`
              : `<div class="ad-product-checkbox-img ad-product-checkbox-placeholder"></div>`}
            <span>
              <strong>${p.name}</strong>
              <span class="text-muted text-sm">₱${Number(p.price).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span>
            </span>
          </span>
        </label>`)
      .join('')
    : `<p class="text-muted text-sm">No products yet. Add products first in the "My Products" tab.</p>`;

  container.innerHTML = `
    <!-- Create Ad Form -->
    <div class="glass ad-form-card">
      <div class="ad-form-header">
        <div class="ad-form-icon"><i data-lucide="megaphone"></i></div>
        <div>
          <h2>Publish an Ad</h2>
          <p class="text-muted text-sm">Active ads appear on the landing page carousel for all visitors.</p>
        </div>
      </div>

      <form id="create-ad-form" class="form" novalidate>
        <div class="form-group">
          <label for="ad-title">Ad Title <span class="field-required">*</span></label>
          <input type="text" id="ad-title" placeholder="e.g. Summer Sale — 50% Off Everything!" maxlength="100" />
          <p class="field-error" id="err-ad-title"></p>
        </div>

        <div class="form-group">
          <label for="ad-description">Description <span class="field-required">*</span></label>
          <textarea id="ad-description" placeholder="Tell customers what makes this offer special…" rows="3" maxlength="300"></textarea>
          <p class="field-error" id="err-ad-desc"></p>
        </div>

        <div class="form-group">
          <label for="ad-image">Banner Image URL <span class="text-muted text-sm">(optional)</span></label>
          <div class="input-with-icon">
            <i data-lucide="image"></i>
            <input type="url" id="ad-image" placeholder="https://…" />
          </div>
        </div>

        <div class="form-group">
          <label>Featured Products <span class="field-required">*</span></label>
          <p class="text-muted text-sm" style="margin-bottom:0.5rem;">Select at least one product to showcase in this ad.</p>
          <div class="ad-product-select-list" id="ad-product-list">
            ${productCheckboxes}
          </div>
          <p class="field-error" id="err-ad-products"></p>
        </div>

        <div class="ad-form-footer">
          <button type="submit" class="btn btn-primary btn-lg" id="ad-submit-btn"
            ${products.length === 0 ? 'disabled title="Add products first"' : ''}>
            <i data-lucide="send"></i> Publish Ad
          </button>
          <p id="ad-submit-status" class="text-sm" style="display:none;"></p>
        </div>
      </form>
    </div>

    <!-- My Ads List -->
    <div class="glass ad-list-card">
      <div class="ad-list-header">
        <div>
          <h2>My Ads</h2>
          <p class="text-muted text-sm">Active ads show on the landing page. Deactivate to hide them.</p>
        </div>
      </div>
      <div id="ads-list-container">
        <div class="ad-list-skeleton">
          <div class="skeleton" style="height:72px; border-radius:var(--radius-md); margin-bottom:0.75rem;"></div>
          <div class="skeleton" style="height:72px; border-radius:var(--radius-md);"></div>
        </div>
      </div>
    </div>
  `;

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // ── Publish ad form ────────────────────────────────────────
  document.getElementById('create-ad-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();

    // Clear errors
    ['err-ad-title', 'err-ad-desc', 'err-ad-products'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { el.textContent = ''; el.style.display = 'none'; }
    });

    const title       = (document.getElementById('ad-title')       as HTMLInputElement).value.trim();
    const description = (document.getElementById('ad-description') as HTMLTextAreaElement).value.trim();
    const image_url   = (document.getElementById('ad-image')       as HTMLInputElement).value.trim();
    const submitBtn   = document.getElementById('ad-submit-btn')   as HTMLButtonElement;
    const statusEl    = document.getElementById('ad-submit-status') as HTMLElement;

    const checkedBoxes = document.querySelectorAll('input[name="ad-products"]:checked') as NodeListOf<HTMLInputElement>;
    const product_ids  = Array.from(checkedBoxes).map(cb => cb.value);

    // Validate
    let hasError = false;
    if (!title) {
      const el = document.getElementById('err-ad-title')!;
      el.textContent = 'Ad title is required.'; el.style.display = 'block';
      hasError = true;
    }
    if (!description) {
      const el = document.getElementById('err-ad-desc')!;
      el.textContent = 'Description is required.'; el.style.display = 'block';
      hasError = true;
    }
    if (product_ids.length === 0) {
      const el = document.getElementById('err-ad-products')!;
      el.textContent = 'Select at least one product to feature.'; el.style.display = 'block';
      hasError = true;
    }
    if (hasError) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader"></i> Publishing…';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    const { error } = await supabase.from('seller_ads').insert([{
      profile_id:  userId,
      title,
      description,
      product_ids,
      image_url:   image_url || null,
      is_active:   true,
    }]);

    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i data-lucide="send"></i> Publish Ad';
    if ((window as any).lucide) (window as any).lucide.createIcons();

    statusEl.style.display = 'block';
    if (error) {
      statusEl.textContent = '✗ ' + error.message;
      statusEl.style.color = 'var(--danger-color)';
    } else {
      statusEl.textContent = '✓ Ad published! It is now live on the landing page.';
      statusEl.style.color = 'var(--primary-color)';
      // Reset form
      (document.getElementById('create-ad-form') as HTMLFormElement).reset();
      setTimeout(() => { statusEl.style.display = 'none'; }, 4000);
      // Refresh the ads list
      await renderAdsList(userId, container);
    }
  });

  // ── Load existing ads ──────────────────────────────────────
  await renderAdsList(userId, container);
}

async function renderAdsList(userId: string, container: HTMLElement) {
  const listContainer = document.getElementById('ads-list-container');
  if (!listContainer) return;

  const { data, error } = await supabase
    .from('seller_ads')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    listContainer.innerHTML = `<p class="text-danger" style="padding:1rem;">Failed to load ads: ${error.message}</p>`;
    return;
  }

  const ads = (data || []) as SellerAd[];

  if (ads.length === 0) {
    listContainer.innerHTML = `
      <div class="ad-empty-state">
        <i data-lucide="megaphone-off"></i>
        <p style="font-weight:600; margin-top:0.5rem;">No ads yet</p>
        <p class="text-sm text-muted">Use the form above to publish your first ad.</p>
      </div>`;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  // Resolve product names
  const allProdIds = ads.flatMap(a => a.product_ids || []);
  let prodMap: Record<string, Product> = {};
  if (allProdIds.length > 0) {
    const { data: prods } = await supabase
      .from('products')
      .select('id, name, price, image_url')
      .in('id', allProdIds);
    if (prods) prodMap = Object.fromEntries(prods.map((p: any) => [p.id, p]));
  }

  listContainer.innerHTML = ads.map(ad => {
    const linked      = (ad.product_ids || []).map(pid => prodMap[pid]).filter(Boolean);
    const prodNames   = linked.map(p => p.name).join(', ') || 'No products linked';
    const statusClass = ad.is_active ? 'ad-status-active' : 'ad-status-inactive';
    const statusLabel = ad.is_active ? 'Live' : 'Inactive';
    const toggleLabel = ad.is_active ? 'Deactivate' : 'Activate';
    const date        = new Date(ad.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });

    // Product thumbnails (max 3)
    const thumbs = linked.slice(0, 3).map(p =>
      p.image_url
        ? `<img src="${p.image_url}" alt="${p.name}" class="ad-list-thumb" title="${p.name}" />`
        : `<div class="ad-list-thumb ad-list-thumb-placeholder">${p.name.charAt(0)}</div>`
    ).join('');

    return `
      <div class="ad-list-item" data-id="${ad.id}">
        <div class="ad-list-item-info">
          <div class="ad-list-item-header">
            <h3 class="ad-list-item-title">${ad.title}</h3>
            <span class="ad-status-badge ${statusClass}">
              <span class="ad-status-dot"></span>${statusLabel}
            </span>
          </div>
          <p class="text-sm text-muted ad-list-desc">
            ${ad.description ? ad.description.substring(0, 90) + (ad.description.length > 90 ? '…' : '') : ''}
          </p>
          <div class="ad-list-products-row">
            <div class="ad-list-thumbs">${thumbs}</div>
            <span class="text-sm text-muted">${prodNames}</span>
          </div>
          <p class="text-sm text-muted" style="margin-top:0.35rem;">Published ${date}</p>
        </div>
        <div class="ad-list-item-actions">
          <button class="btn btn-ghost btn-sm btn-toggle-ad" data-id="${ad.id}" data-active="${ad.is_active}">
            <i data-lucide="${ad.is_active ? 'pause-circle' : 'play-circle'}"></i> ${toggleLabel}
          </button>
          <button class="btn btn-ghost btn-sm text-danger btn-delete-ad" data-id="${ad.id}">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>`;
  }).join('');

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // Toggle active/inactive
  listContainer.querySelectorAll('.btn-toggle-ad').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target        = e.currentTarget as HTMLButtonElement;
      const adId          = target.dataset.id;
      const wasActive     = target.dataset.active === 'true';
      if (!adId) return;

      target.disabled = true;
      const { error } = await supabase
        .from('seller_ads')
        .update({ is_active: !wasActive })
        .eq('id', adId);
      target.disabled = false;

      if (error) {
        console.error('Toggle error:', error.message);
      } else {
        await renderAdsList(userId, container);
      }
    });
  });

  // Delete ad
  listContainer.querySelectorAll('.btn-delete-ad').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const target = e.currentTarget as HTMLButtonElement;
      const adId   = target.dataset.id;
      if (!adId) return;

      if (!confirm('Delete this ad? It will be removed from the landing page immediately.')) return;

      target.disabled = true;
      const { error } = await supabase.from('seller_ads').delete().eq('id', adId);
      target.disabled = false;

      if (error) {
        console.error('Delete error:', error.message);
      } else {
        await renderAdsList(userId, container);
      }
    });
  });
}

// =============================================
// NOTIFICATIONS VIEW
// =============================================

async function refreshNotifBadge(userId: string) {
  const badge = document.getElementById('sidebar-notif-badge');
  if (!badge) return;

  const { count } = await supabase
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);

  if (count && count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

async function loadNotificationsView(container: HTMLElement, userId: string) {
  container.innerHTML = `
    <div class="notif-page-header glass">
      <div class="notif-page-header-info">
        <div class="notif-page-icon"><i data-lucide="bell"></i></div>
        <div>
          <h2>Notifications</h2>
          <p class="text-muted text-sm">Order alerts and messages from buyers and sellers.</p>
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" id="btn-mark-all-read">
        <i data-lucide="check-check"></i> Mark all read
      </button>
    </div>

    <div class="glass notif-list-card">
      <div id="notif-list-container">
        <div class="skeleton" style="height:72px; border-radius:var(--radius-md); margin-bottom:0.75rem;"></div>
        <div class="skeleton" style="height:72px; border-radius:var(--radius-md); margin-bottom:0.75rem;"></div>
        <div class="skeleton" style="height:72px; border-radius:var(--radius-md);"></div>
      </div>
    </div>
  `;

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // Mark all read button
  document.getElementById('btn-mark-all-read')?.addEventListener('click', async () => {
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);
    await renderNotifList(userId);
    await refreshNotifBadge(userId);
  });

  await renderNotifList(userId);
}

async function renderNotifList(userId: string) {
  const listEl = document.getElementById('notif-list-container');
  if (!listEl) return;

  // Fetch all messages where user is recipient, newest first
  const { data, error } = await supabase
    .from('messages')
    .select(`
      id, body, is_system, is_read, created_at, product_id,
      sender_id,
      products (name, image_url)
    `)
    .eq('recipient_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    listEl.innerHTML = `<p class="text-danger" style="padding:1rem;">Failed to load notifications: ${error.message}</p>`;
    return;
  }

  // Also fetch orders placed against seller's products
  const { data: orders } = await supabase
    .from('orders')
    .select(`
      id, quantity, unit_price, total_price, status, created_at, note,
      products (name, image_url),
      buyer:buyer_id ( email )
    `)
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  const messages = (data || []) as any[];
  const myOrders = (orders || []) as any[];

  if (messages.length === 0 && myOrders.length === 0) {
    listEl.innerHTML = `
      <div class="notif-empty">
        <div class="notif-empty-icon"><i data-lucide="bell-off"></i></div>
        <h3>No notifications yet</h3>
        <p class="text-muted text-sm">You'll be notified here when buyers place orders or send messages.</p>
      </div>`;
    if ((window as any).lucide) (window as any).lucide.createIcons();
    return;
  }

  // ── Render orders received (for sellers) ─────────────────
  const orderItems = myOrders.map(o => {
    const date      = new Date(o.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const time      = new Date(o.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const total     = Number(o.total_price).toLocaleString('en-PH', { minimumFractionDigits: 2 });
    const prodName  = o.products?.name || 'Unknown product';
    const prodImg   = o.products?.image_url;
    const buyer     = (o.buyer as any)?.email || 'A buyer';
    const statusCls = {
      pending:   'notif-status-pending',
      confirmed: 'notif-status-confirmed',
      shipped:   'notif-status-shipped',
      delivered: 'notif-status-delivered',
      cancelled: 'notif-status-cancelled',
    }[o.status as string] ?? 'notif-status-pending';

    return `
      <div class="notif-item notif-item-order">
        <div class="notif-item-icon notif-icon-order">
          ${prodImg
            ? `<img src="${prodImg}" alt="${prodName}" class="notif-prod-thumb" />`
            : `<i data-lucide="shopping-bag"></i>`}
        </div>
        <div class="notif-item-body">
          <div class="notif-item-header">
            <p class="notif-item-title">
              <strong>${buyer}</strong> ordered <strong>${o.quantity}× ${prodName}</strong>
            </p>
            <span class="notif-order-status ${statusCls}">${o.status}</span>
          </div>
          <p class="notif-item-sub text-muted text-sm">
            Total: ₱${total}${o.note ? ` · "${o.note}"` : ''}
          </p>
          <p class="notif-item-time text-sm text-muted">${date} at ${time}</p>
        </div>
      </div>`;
  }).join('');

  // ── Render messages received ──────────────────────────────
  const messageItems = messages.map(m => {
    const date      = new Date(m.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
    const time      = new Date(m.created_at).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
    const prodName  = m.products?.name;
    const prodImg   = m.products?.image_url;
    const unreadCls = m.is_read ? '' : 'notif-item-unread';

    return `
      <div class="notif-item ${unreadCls}" data-msg-id="${m.id}">
        <div class="notif-item-icon notif-icon-msg">
          ${prodImg
            ? `<img src="${prodImg}" alt="${prodName}" class="notif-prod-thumb" />`
            : `<i data-lucide="${m.is_system ? 'package-check' : 'message-circle'}"></i>`}
          ${!m.is_read ? '<span class="notif-unread-dot"></span>' : ''}
        </div>
        <div class="notif-item-body">
          <div class="notif-item-header">
            <p class="notif-item-title">${m.is_system ? '🛒 Order notification' : '💬 New message'}${prodName ? ` · ${prodName}` : ''}</p>
          </div>
          <p class="notif-item-sub text-muted text-sm">${m.body.substring(0, 120)}${m.body.length > 120 ? '…' : ''}</p>
          <p class="notif-item-time text-sm text-muted">${date} at ${time}</p>
        </div>
      </div>`;
  }).join('');

  listEl.innerHTML = `
    ${myOrders.length > 0 ? `
      <div class="notif-section-label text-sm">
        <i data-lucide="shopping-bag"></i> Orders Received (${myOrders.length})
      </div>
      ${orderItems}
    ` : ''}
    ${messages.length > 0 ? `
      <div class="notif-section-label text-sm" style="margin-top:${myOrders.length > 0 ? '1.5rem' : '0'};">
        <i data-lucide="message-circle"></i> Messages (${messages.length})
      </div>
      ${messageItems}
    ` : ''}
  `;

  if ((window as any).lucide) (window as any).lucide.createIcons();

  // Mark individual message as read on click
  listEl.querySelectorAll('.notif-item[data-msg-id]').forEach(item => {
    item.addEventListener('click', async () => {
      const msgId = (item as HTMLElement).dataset.msgId;
      if (!msgId || !item.classList.contains('notif-item-unread')) return;
      item.classList.remove('notif-item-unread');
      item.querySelector('.notif-unread-dot')?.remove();
      await supabase.from('messages').update({ is_read: true }).eq('id', msgId);
      await refreshNotifBadge(userId);
    });
  });
}
