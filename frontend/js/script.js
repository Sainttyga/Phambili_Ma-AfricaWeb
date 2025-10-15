// script.js - Main application logic

// ========== GLOBAL FUNCTIONS ==========

// Safe header scroll handler
function handleHeaderScroll() {
  const header = document.querySelector('.header');
  if (header) {
    if (window.scrollY > 50) {
      header.classList.add('header-scrolled');
    } else {
      header.classList.remove('header-scrolled');
    }
  }
}

// Global error handler
window.addEventListener('error', function (e) {
  console.log('Error caught:', e.error);
});

// Tab Switch Function
function switchTab(tabName) {
  if (tabName !== 'login' && tabName !== 'register') return;

  // Hide all messages when switching tabs
  const loginError = document.getElementById('login-error');
  const loginSuccess = document.getElementById('login-success');
  const registerError = document.getElementById('register-error');
  const registerSuccess = document.getElementById('register-success');

  if (loginError) loginError.style.display = 'none';
  if (loginSuccess) loginSuccess.style.display = 'none';
  if (registerError) registerError.style.display = 'none';
  if (registerSuccess) registerSuccess.style.display = 'none';

  document.querySelectorAll('.auth-tab-content').forEach(content => {
    const isActive = content.id === `${tabName}-panel`;
    content.classList.toggle('active', isActive);

    if (isActive) {
      content.removeAttribute('hidden');
      content.setAttribute('aria-hidden', 'false');
    } else {
      content.setAttribute('hidden', '');
      content.setAttribute('aria-hidden', 'true');
    }
  });

  document.querySelectorAll('.auth-tab').forEach(tab => {
    const isActive = tab.getAttribute('data-tab') === tabName;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive.toString());
  });

  const tabContent = document.getElementById(tabName + '-tab');
  const tabButton = document.querySelector(`.auth-tab[data-tab="${tabName}"]`);

  if (tabContent && tabButton) {
    tabContent.classList.add('active');
    tabContent.setAttribute('aria-hidden', 'false');
    tabButton.classList.add('active');
    tabButton.setAttribute('aria-selected', 'true');

    const firstInput = tabContent.querySelector('input');
    if (firstInput) firstInput.focus();
  }
}

// Protected page initialization
function initProtectedPage() {
  if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) {
    if (typeof authManager !== 'undefined') {
      authManager.redirectToLogin();
    } else {
      window.location.href = 'login.html';
    }
    return false;
  }
  return true;
}

// Role-based page access
function initAdminPage() {
  if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) {
    if (typeof authManager !== 'undefined') {
      authManager.redirectToLogin();
    } else {
      window.location.href = 'login.html';
    }
    return false;
  }

  if (!authManager.hasRole('admin')) {
    alert('Access denied. Admin privileges required.');
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// Update navigation based on authentication
function updateNavigation() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

  // SAFETY CHECK: Only run if authManager is available
  if (typeof authManager === 'undefined') {
    console.warn('AuthManager not available for navigation update');
    return;
  }

  if (authManager.isAuthenticated()) {
    const userInfo = nav.querySelector('.nav-user-info');
    if (!userInfo) {
      const loginItem = nav.querySelector('.nav-item a[href="login.html"]');
      if (loginItem) {
        const listItem = loginItem.parentElement;
        listItem.innerHTML = `
          <div class="nav-user-info">
            <div class="nav-user-avatar">
              <i class="fas fa-user-circle"></i>
            </div>
            <div class="nav-user-details">
              <strong>${authManager.user.Full_Name || 'User'}</strong>
              <span>${authManager.user.Email || ''}</span>
            </div>
            <button class="nav-logout-btn" onclick="authManager.logout()">
              <i class="fas fa-sign-out-alt"></i>
            </button>
          </div>
        `;
      }
    }
  }
}

// Add authentication to quote form
function setupProtectedForms() {
  const quoteForm = document.getElementById('index-quoteForm');
  if (quoteForm) {
    quoteForm.addEventListener('submit', function (e) {
      if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) {
        e.preventDefault();
        if (typeof authManager !== 'undefined') {
          authManager.redirectToLogin();
        } else {
          window.location.href = 'login.html';
        }
        return;
      }

      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner"></div> Submitting...';

      const formData = new FormData(this);
      if (authManager.user && authManager.user.ID) {
        formData.append('userId', authManager.user.ID);
      }
    });
  }
}

// ========== PASSWORD VALIDATION FUNCTIONS ==========

function validatePasswordStrength(password) {
  const errors = [];

  if (password.length < 8) {
    errors.push('At least 8 characters long');
  }

  if (password.length > 128) {
    errors.push('Maximum 128 characters allowed');
  }

  if (!/(?=.*[A-Z])/.test(password)) {
    errors.push('At least one uppercase letter (A-Z)');
  }

  if (!/(?=.*[a-z])/.test(password)) {
    errors.push('At least one lowercase letter (a-z)');
  }

  if (!/(?=.*\d)/.test(password)) {
    errors.push('At least one number (0-9)');
  }

  if (!/(?=.*[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?])/.test(password)) {
    errors.push('At least one special character (!@#$%^&* etc.)');
  }

  if (/\s/.test(password)) {
    errors.push('No spaces allowed');
  }

  const weakPatterns = [
    /^12345678/,
    /^password/,
    /^qwertyui/,
    /^abcdefgh/,
    /^admin123/
  ];

  for (const pattern of weakPatterns) {
    if (pattern.test(password)) {
      errors.push('Password is too common or weak');
      break;
    }
  }

  return errors;
}

function calculatePasswordStrength(password) {
  let score = 0;

  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  const percentage = (score / 6) * 100;

  if (password.length === 0) {
    return { percentage: 0, color: '#ddd', text: '' };
  } else if (score <= 2) {
    return { percentage, color: '#e74c3c', text: 'Weak' };
  } else if (score <= 4) {
    return { percentage, color: '#f39c12', text: 'Medium' };
  } else {
    return { percentage, color: '#27ae60', text: 'Strong' };
  }
}

function checkRequirement(requirement, password) {
  switch (requirement) {
    case 'length':
      return password.length >= 8;
    case 'uppercase':
      return /[A-Z]/.test(password);
    case 'lowercase':
      return /[a-z]/.test(password);
    case 'number':
      return /\d/.test(password);
    case 'special':
      return /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);
    case 'spaces':
      return !/\s/.test(password);
    default:
      return false;
  }
}

function updatePasswordRequirements(password) {
  const requirements = {
    length: document.getElementById('req-length'),
    uppercase: document.getElementById('req-uppercase'),
    lowercase: document.getElementById('req-lowercase'),
    number: document.getElementById('req-number'),
    special: document.getElementById('req-special'),
    spaces: document.getElementById('req-spaces')
  };

  Object.keys(requirements).forEach(key => {
    const element = requirements[key];
    if (element) {
      const isValid = checkRequirement(key, password);

      if (isValid && !element.classList.contains('valid')) {
        element.classList.add('valid');
        element.classList.remove('invalid');
        element.style.animation = 'requirementValid 0.3s ease';
      } else if (!isValid && !element.classList.contains('invalid')) {
        element.classList.add('invalid');
        element.classList.remove('valid');
        element.style.animation = 'requirementInvalid 0.3s ease';
      }

      setTimeout(() => {
        element.style.animation = '';
      }, 300);
    }
  });
}

function updatePasswordStrength(password) {
  const strengthContainer = document.getElementById('password-strength');
  if (!strengthContainer) return;

  const strengthFill = strengthContainer.querySelector('.strength-fill');
  const strengthText = strengthContainer.querySelector('.strength-text');

  if (password.length === 0) {
    strengthFill.style.width = '0%';
    strengthFill.style.background = '#e9ecef';
    strengthText.textContent = '';
    return;
  }

  let score = 0;
  const requirements = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
    !/\s/.test(password),
    password.length >= 12
  ];

  requirements.forEach(req => {
    if (req) score++;
  });

  const percentage = Math.min((score / requirements.length) * 100, 100);

  let color, text;

  if (score <= 3) {
    color = '#e74c3c';
    text = 'Weak';
  } else if (score <= 5) {
    color = '#f39c12';
    text = 'Fair';
  } else if (score <= 6) {
    color = '#3498db';
    text = 'Good';
  } else {
    color = '#27ae60';
    text = 'Strong';
  }

  strengthFill.style.transition = 'all 0.5s ease';
  strengthFill.style.width = percentage + '%';
  strengthFill.style.background = color;
  strengthText.textContent = text;
  strengthText.style.color = color;
}

function setupPasswordRequirements() {
  const passwordInput = document.getElementById('auth-register-password');
  const requirementsBox = document.getElementById('password-requirements');
  const strengthContainer = document.getElementById('password-strength');

  if (passwordInput && requirementsBox && strengthContainer) {
    let isRequirementsVisible = false;
    let hideTimeout = null;

    const showRequirements = () => {
      if (hideTimeout) {
        clearTimeout(hideTimeout);
        hideTimeout = null;
      }

      if (!isRequirementsVisible) {
        requirementsBox.style.display = 'block';
        strengthContainer.style.display = 'block';

        setTimeout(() => {
          requirementsBox.style.opacity = '1';
          requirementsBox.style.transform = 'translateY(0)';
          strengthContainer.style.opacity = '1';
          strengthContainer.style.transform = 'translateY(0)';
        }, 10);

        isRequirementsVisible = true;
      }
    };

    const hideRequirements = () => {
      if (isRequirementsVisible && passwordInput.value.length === 0) {
        requirementsBox.style.opacity = '0';
        requirementsBox.style.transform = 'translateY(-10px)';
        strengthContainer.style.opacity = '0';
        strengthContainer.style.transform = 'translateY(-10px)';

        hideTimeout = setTimeout(() => {
          requirementsBox.style.display = 'none';
          strengthContainer.style.display = 'none';
          isRequirementsVisible = false;
        }, 300);
      }
    };

    passwordInput.addEventListener('focus', showRequirements);
    passwordInput.addEventListener('click', showRequirements);

    document.addEventListener('click', (e) => {
      if (!passwordInput.contains(e.target) && !requirementsBox.contains(e.target)) {
        hideRequirements();
      }
    });

    passwordInput.addEventListener('blur', () => {
      if (passwordInput.value.length === 0) {
        hideRequirements();
      }
    });

    let inputTimeout;
    passwordInput.addEventListener('input', function () {
      const password = this.value;

      if (inputTimeout) {
        clearTimeout(inputTimeout);
      }

      inputTimeout = setTimeout(() => {
        updatePasswordRequirements(password);
        updatePasswordStrength(password);

        if (password.length > 0 && !isRequirementsVisible) {
          showRequirements();
        }
      }, 150);
    });

    setTimeout(() => {
      if (passwordInput.value.length > 0 && !isRequirementsVisible) {
        showRequirements();
        updatePasswordRequirements(passwordInput.value);
        updatePasswordStrength(passwordInput.value);
      }
    }, 100);

    passwordInput.addEventListener('change', function () {
      if (this.value.length > 0) {
        showRequirements();
        updatePasswordRequirements(this.value);
        updatePasswordStrength(this.value);
      }
    });
  }
}

function setupPasswordStrengthIndicator() {
  const passwordInput = document.getElementById('auth-register-password');
  const strengthIndicator = document.getElementById('password-strength');

  if (passwordInput && strengthIndicator) {
    passwordInput.addEventListener('input', function () {
      const password = this.value;
      const strength = calculatePasswordStrength(password);

      strengthIndicator.innerHTML = `
        <div class="strength-bar">
          <div class="strength-fill" style="width: ${strength.percentage}%; background: ${strength.color}"></div>
        </div>
        <span class="strength-text" style="color: ${strength.color}">${strength.text}</span>
      `;
    });
  }
}

function showLoginError(message) {
  const errorBox = document.getElementById('login-error');
  if (errorBox) {
    errorBox.style.display = 'block';
    errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    errorBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ========== CART FUNCTIONS ==========

let cartItems = [];

function updateCartDisplay() {
  const cartItemsContainer = document.querySelector('.cart-items');
  const cartTotal = document.querySelector('.cart-total');
  const cartBadge = document.querySelector('.cart-badge');

  if (!cartItemsContainer) return;

  cartItemsContainer.innerHTML = '';

  // SAFETY CHECK: Only check authentication if authManager is available
  const isAuthenticated = typeof authManager !== 'undefined' && authManager.isAuthenticated();

  if (!isAuthenticated) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart">
        <svg viewBox="0 0 24 24" width="64" height="64" style="opacity: 0.5;">
          <path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
        <h3 style="margin: 1rem 0 0.5rem; color: #666;">Login Required</h3>
        <p style="color: #888; margin-bottom: 1.5rem;">Please log in to access your shopping cart</p>
        <button class="btn-primary" id="login-from-cart" style="width: 100%;">
          Login / Register
        </button>
      </div>
    `;

    const loginBtn = document.getElementById('login-from-cart');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => {
        closeCart();
        if (typeof authManager !== 'undefined') {
          authManager.redirectToLogin();
        } else {
          window.location.href = 'login.html';
        }
      });
    }

  } else if (cartItems.length === 0) {
    cartItemsContainer.innerHTML = `
      <div class="empty-cart">
        <svg viewBox="0 0 24 24" width="64" height="64">
          <path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
        </svg>
        <h3 style="margin: 1rem 0 0.5rem; color: #666;">It's a little empty here</h3>
        <p style="color: #888; margin-bottom: 1.5rem;">Start adding services to your cart</p>
        <button class="btn-primary" id="book-services-btn" style="width: 100%;">
          Book Services
        </button>
      </div>
    `;
  } else {
    cartItems.forEach(item => {
      const cartItem = document.createElement('div');
      cartItem.className = 'cart-item';
      cartItem.innerHTML = `
        <div class="cart-item-details">
          <div class="cart-item-name">${item.name}</div>
          <div class="cart-item-price">R${(item.price * item.quantity).toFixed(2)}</div>
        </div>
        <div class="cart-item-controls">
          <button class="cart-item-decrease" data-id="${item.id}" aria-label="Decrease quantity">-</button>
          <span class="cart-item-quantity">${item.quantity}</span>
          <button class="cart-item-increase" data-id="${item.id}" aria-label="Increase quantity">+</button>
          <button class="cart-item-remove" data-id="${item.id}" aria-label="Remove item">
            <svg viewBox="0 0 24 24" width="16" height="16">
              <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        <div class="cart-item-unit-price">R${item.price.toFixed(2)} each</div>
      `;
      cartItemsContainer.appendChild(cartItem);
    });
  }

  // Update totals only if authenticated
  if (isAuthenticated) {
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    if (cartTotal) cartTotal.textContent = `R${total.toFixed(2)}`;
    if (cartBadge) {
      cartBadge.textContent = itemCount;
      cartBadge.style.display = itemCount > 0 ? 'flex' : 'none';
    }

    const cartSubtotal = document.querySelector('.cart-subtotal span:last-child');
    if (cartSubtotal) cartSubtotal.textContent = `R${total.toFixed(2)}`;

    const cartHeader = document.querySelector('.cart-header p');
    if (cartHeader) cartHeader.textContent = `${itemCount} ${itemCount === 1 ? 'item' : 'items'}`;
  } else {
    // Reset for unauthenticated users
    if (cartTotal) cartTotal.textContent = 'R0.00';
    if (cartBadge) {
      cartBadge.textContent = '0';
      cartBadge.style.display = 'none';
    }

    const cartSubtotal = document.querySelector('.cart-subtotal span:last-child');
    if (cartSubtotal) cartSubtotal.textContent = 'R0.00';

    const cartHeader = document.querySelector('.cart-header p');
    if (cartHeader) cartHeader.textContent = '0 items';
  }
}

function addToCart(product, autoOpen = false) {
  // SAFETY CHECK: Only allow adding to cart if authenticated
  if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) {
    const cartSidebar = document.getElementById('cart-sidebar');
    if (cartSidebar && !cartSidebar.classList.contains('active')) {
      toggleCart();
    }
    return;
  }

  const existingItem = cartItems.find(item => item.id === product.id);

  if (existingItem) {
    existingItem.quantity += 1;
  } else {
    cartItems.push({
      ...product,
      quantity: 1
    });
  }

  updateCartDisplay();

  const cartSidebar = document.getElementById('cart-sidebar');
  if (autoOpen && cartSidebar && !cartSidebar.classList.contains('active')) {
    toggleCart();
  }

  const cartBtn = document.getElementById('cart-btn');
  if (cartBtn) {
    cartBtn.classList.add('animate-bounce');
    setTimeout(() => {
      cartBtn.classList.remove('animate-bounce');
    }, 1000);
  }
}

function removeFromCart(productId) {
  cartItems = cartItems.filter(item => item.id !== productId);
  updateCartDisplay();

  const cartItemsContainer = document.querySelector('.cart-items');
  if (cartItems.length === 0 && cartItemsContainer) {
    cartItemsContainer.classList.add('empty-animation');
    setTimeout(() => {
      cartItemsContainer.classList.remove('empty-animation');
    }, 500);
  }
}

function updateQuantity(productId, change) {
  const item = cartItems.find(item => item.id === productId);

  if (item) {
    item.quantity += change;

    if (item.quantity <= 0) {
      removeFromCart(productId);
    } else {
      updateCartDisplay();
    }
  }
}

// ========== NAVIGATION AND CART UI FUNCTIONS ==========

function openNav() {
  document.body.classList.add('overlay-active');
  const menuOverlay = document.getElementById('menu-overlay');
  const mainNav = document.getElementById('main-nav');
  if (menuOverlay) menuOverlay.classList.add('active');
  if (mainNav) mainNav.classList.add('active');
}

function closeNav() {
  document.body.classList.remove('overlay-active');
  const menuOverlay = document.getElementById('menu-overlay');
  const mainNav = document.getElementById('main-nav');
  if (menuOverlay) menuOverlay.classList.remove('active');
  if (mainNav) mainNav.classList.remove('active');
}

function toggleCart() {
  document.body.classList.toggle('overlay-active');
  const menuOverlay = document.getElementById('menu-overlay');
  const cartSidebar = document.getElementById('cart-sidebar');
  const mainNav = document.getElementById('main-nav');

  if (menuOverlay) menuOverlay.classList.toggle('active');
  if (cartSidebar) cartSidebar.classList.toggle('active');

  if (mainNav && mainNav.classList.contains('active')) {
    closeNav();
  }
}

function closeCart() {
  document.body.classList.remove('overlay-active');
  const menuOverlay = document.getElementById('menu-overlay');
  const cartSidebar = document.getElementById('cart-sidebar');
  if (menuOverlay) menuOverlay.classList.remove('active');
  if (cartSidebar) cartSidebar.classList.remove('active');
}

// ========== MAIN DOM CONTENT LOADED ==========
document.addEventListener('DOMContentLoaded', function () {
  // Initialize header scroll
  handleHeaderScroll();
  window.addEventListener('scroll', handleHeaderScroll);

  // Add CSS animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes requirementValid {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }
    
    @keyframes requirementInvalid {
      0% { transform: translateX(0); }
      25% { transform: translateX(-5px); }
      50% { transform: translateX(5px); }
      100% { transform: translateX(0); }
    }
    @keyframes bounce {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-5px); }
    }
    @keyframes fadeOut {
      from { opacity: 1; transform: scale(1); }
      to { opacity: 0; transform: scale(0.9); }
    }
    .animate-bounce {
      animation: bounce 0.5s;
    }
    .empty-animation {
      animation: fadeOut 0.3s ease-out;
    }
    
    .empty-cart {
      text-align: center;
      padding: 2rem 1rem;
      color: #666;
    }
    
    .empty-cart svg {
      margin-bottom: 1rem;
    }
    
    .btn-primary {
      background-color: #007bff;
      color: white;
      border: none;
      padding: 0.75rem 1.5rem;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    
    .btn-primary:hover {
      background-color: #0056b3;
    }
  `;
  document.head.appendChild(style);

  // Initialize password requirements
  setupPasswordRequirements();
  setupPasswordStrengthIndicator();

  // Registration Form Handler
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const registerError = document.getElementById('register-error');
      if (registerError) registerError.style.display = 'none';

      const Full_Name = document.getElementById('auth-fullname')?.value.trim();
      const Email = document.getElementById('auth-register-email')?.value.trim();
      const Password = document.getElementById('auth-register-password')?.value;
      const ConfirmPassword = document.getElementById('auth-confirm-password')?.value;

      // Validation
      if (!Full_Name) {
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> Full name is required.`;
        }
        return;
      }

      if (!Email) {
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> Email address is required.`;
        }
        return;
      }

      if (!Password) {
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> Password is required.`;
        }
        return;
      }

      if (!ConfirmPassword) {
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> Please confirm your password.`;
        }
        return;
      }

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(Email)) {
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> Please enter a valid email address.`;
        }
        return;
      }

      const passwordErrors = validatePasswordStrength(Password);
      if (passwordErrors.length > 0) {
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `
            <i class="fas fa-exclamation-circle"></i> 
            <strong>Password requirements:</strong>
            <ul style="margin: 5px 0; padding-left: 20px; text-align: left;">
              ${passwordErrors.map(error => `<li>${error}</li>`).join('')}
            </ul>
          `;
        }
        return;
      }

      if (Password !== ConfirmPassword) {
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> Passwords do not match.`;
        }
        return;
      }

      const nameRegex = /^[A-Za-z\s]{2,100}$/;
      if (!nameRegex.test(Full_Name)) {
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> Please enter a valid full name (letters and spaces only, 2-100 characters).`;
        }
        return;
      }

      try {
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<div class="spinner"></div> Creating Account...';

        await axios.post('http://localhost:5000/api/auth/register', {
          Full_Name,
          Email,
          Password
        });

        const successBox = document.getElementById('register-success');
        if (successBox) {
          successBox.style.display = 'block';
          successBox.innerHTML = `<i class="fas fa-check-circle"></i> Registration successful! Redirecting to login...`;
        }

        localStorage.setItem('activeTab', 'login');
        this.reset();

        setTimeout(() => {
          switchTab('login');
        }, 3000);

      } catch (error) {
        console.log("Register error:", error.response?.data);
        const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errorMessage}`;
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Create Account</span><div class="spinner"></div>';
      }
    });
  }

  // In your script.js - Update the login form handler
  // In your script.js - Improved login handler with better authManager handling
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<div class="spinner"></div> Authenticating...';

      const loginError = document.getElementById('login-error');
      const loginSuccess = document.getElementById('login-success');
      if (loginError) loginError.style.display = 'none';
      if (loginSuccess) loginSuccess.style.display = 'none';

      const Email = document.getElementById('auth-login-email')?.value.trim();
      const Password = document.getElementById('auth-login-password')?.value;

      if (!Email || !Password) {
        showLoginError('Please enter both email and password.');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
        return;
      }

      try {
        const response = await axios.post('http://localhost:5000/api/auth/login', {
          Email: Email,
          Password: Password
        });

        console.log('Login response:', response.data);

        // Enhanced authManager availability check
        await waitForAuthManager();

        if (typeof authManager === 'undefined') {
          throw new Error('Authentication system not available. Please refresh the page.');
        }

        // Handle first login for admins
        if (response.data.requiresPasswordReset) {
          showFirstLoginModal(Email);
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          return;
        }

        if (response.data.token) {
          // Determine user type based on role
          const userType = response.data.role === 'admin' ? 'admin' : 'customer';

          // Login with proper user type using authManager
          authManager.login(
            response.data.token,
            response.data.role,
            response.data.user,
            userType
          );

          // Show success message
          if (loginSuccess) {
            loginSuccess.style.display = 'block';
            loginSuccess.innerHTML = `<i class="fas fa-check-circle"></i> Login successful! Redirecting...`;
          }

          // Redirect based on user type
          setTimeout(() => {
            if (userType === 'admin') {
              window.location.href = 'admin-dashboard.html';
            } else {
              const returnUrl = localStorage.getItem('returnUrl');
              if (returnUrl) {
                localStorage.removeItem('returnUrl');
                window.location.href = returnUrl;
              } else {
                window.location.href = 'index.html';
              }
            }
          }, 1500);

        } else {
          showLoginError('Login failed. No token received.');
        }

      } catch (error) {
        console.error('Login error:', error);
        const errorMessage = error.response?.data?.message ||
          error.message ||
          'Login failed. Please check your credentials.';
        showLoginError(errorMessage);

        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
  // First Login Modal Functions
function closeFirstLoginModal() {
    const modal = document.getElementById('firstLoginModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

function showFirstLoginModal(email) {
    const modal = document.getElementById('firstLoginModal');
    const emailInput = document.getElementById('first-login-email');

    if (modal && emailInput) {
        emailInput.value = email;
        modal.style.display = 'flex';
        modal.classList.add('active');

        // Clear any previous errors
        const errorDiv = document.getElementById('first-login-error');
        if (errorDiv) {
            errorDiv.style.display = 'none';
        }

        // Reset form
        const form = document.getElementById('first-login-form');
        if (form) {
            form.reset();
            emailInput.value = email; // Keep the email set
        }

        // Setup form submission
        setupFirstLoginForm();
    }
}

function setupFirstLoginForm() {
    const form = document.getElementById('first-login-form');
    const errorDiv = document.getElementById('first-login-error');
    const errorText = document.getElementById('first-login-error-text');

    if (!form) return;

    // Remove existing event listeners
    const newForm = form.cloneNode(true);
    form.parentNode.replaceChild(newForm, form);

    newForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Hide previous errors
        if (errorDiv) errorDiv.style.display = 'none';

        const formData = {
            Email: document.getElementById('first-login-email').value,
            TemporaryPassword: document.getElementById('temporary-password').value,
            NewPassword: document.getElementById('new-admin-password').value
        };

        const confirmPassword = document.getElementById('confirm-admin-password').value;

        // Validation
        if (formData.NewPassword !== confirmPassword) {
            showFirstLoginError('Passwords do not match');
            return;
        }

        if (formData.NewPassword.length < 8) {
            showFirstLoginError('Password must be at least 8 characters long');
            return;
        }

        try {
            const response = await axios.post('http://localhost:5000/api/admin/first-login', formData);

            if (response.data.success && response.data.token) {
                // Login with new token using authManager
                if (typeof authManager !== 'undefined') {
                    authManager.login(
                        response.data.token,
                        response.data.role,
                        response.data.user,
                        'admin'
                    );

                    // Hide modal and redirect to admin dashboard
                    closeFirstLoginModal();
                    window.location.href = 'admin-dashboard.html';
                }
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message || 'Error setting up account';
            showFirstLoginError(errorMessage);
        }
    });
}

function showFirstLoginError(message) {
    const errorDiv = document.getElementById('first-login-error');
    const errorText = document.getElementById('first-login-error-text');

    if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.style.display = 'block';
        
        // Scroll to error
        errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// Close modal when clicking outside
document.addEventListener('click', function (e) {
    const modal = document.getElementById('firstLoginModal');
    if (modal && e.target === modal) {
        closeFirstLoginModal();
    }
});

// Close modal with Escape key
document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
        const modal = document.getElementById('firstLoginModal');
        if (modal && modal.style.display === 'flex') {
            closeFirstLoginModal();
        }
    }
});

  // Add this helper function to wait for authManager
  async function waitForAuthManager(maxWait = 5000) {
    const startTime = Date.now();

    while (typeof authManager === 'undefined' && (Date.now() - startTime) < maxWait) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    if (typeof authManager === 'undefined') {
      console.warn('authManager not available after waiting', maxWait, 'ms');
      return false;
    }

    return true;
  }

  // Tab Switching - MOVED OUTSIDE of login form handler
  let lastTab = localStorage.getItem('activeTab');
  if (lastTab !== 'login' && lastTab !== 'register') lastTab = 'login';
  switchTab(lastTab);

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      const tabName = this.getAttribute('data-tab');
      localStorage.setItem('activeTab', tabName);
      switchTab(tabName);
    });

    tab.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const tabName = this.getAttribute('data-tab');
        localStorage.setItem('activeTab', tabName);
        switchTab(tabName);
      }
    });
  });

  // Social login buttons
  document.querySelectorAll('.auth-social-btn').forEach(button => {
    button.addEventListener('click', function () {
      alert('Social login functionality would be implemented here');
    });
  });

  // Forgot password link
  document.querySelector('.auth-forgot')?.addEventListener('click', function (e) {
    e.preventDefault();
    alert('Password reset functionality would be implemented here');
  });

  // Initialize navigation and protected forms after authManager loads
  setTimeout(() => {
    if (typeof authManager !== 'undefined') {
      updateNavigation();
      setupProtectedForms();

      if (authManager.isAuthenticated()) {
        document.body.classList.add(`role-${authManager.role}`);
      }
    }
  }, 100);

  // ========== NAVIGATION AND CART FUNCTIONALITY ==========
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mainNav = document.getElementById('main-nav');
  const closeNavBtn = document.getElementById('close-nav-btn');
  const cartBtn = document.getElementById('cart-btn');
  const cartSidebar = document.getElementById('cart-sidebar');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const menuOverlay = document.getElementById('menu-overlay');

  // Event Listeners
  if (hamburgerBtn) hamburgerBtn.addEventListener('click', openNav);
  if (closeNavBtn) closeNavBtn.addEventListener('click', closeNav);
  if (cartBtn) {
    cartBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleCart();
    });
  }
  if (closeCartBtn) {
    closeCartBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      closeCart();
    });
  }

  if (menuOverlay) {
    menuOverlay.addEventListener('click', function () {
      closeNav();
      closeCart();
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (mainNav && mainNav.classList.contains('active')) closeNav();
      if (cartSidebar && cartSidebar.classList.contains('active')) closeCart();
    }
  });

  document.addEventListener('click', function (e) {
    // Add to cart buttons
    if (e.target.classList.contains('add-to-cart') || e.target.closest('.add-to-cart')) {
      const btn = e.target.classList.contains('add-to-cart') ? e.target : e.target.closest('.add-to-cart');
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      const price = parseFloat(btn.dataset.price);

      if (id && name && !isNaN(price)) {
        addToCart({ id, name, price }, false);
      }
    }

    // Cart item controls
    if (e.target.classList.contains('cart-item-remove') || e.target.closest('.cart-item-remove')) {
      const btn = e.target.classList.contains('cart-item-remove') ? e.target : e.target.closest('.cart-item-remove');
      removeFromCart(btn.dataset.id);
    }

    if (e.target.classList.contains('cart-item-increase') || e.target.closest('.cart-item-increase')) {
      const btn = e.target.classList.contains('cart-item-increase') ? e.target : e.target.closest('.cart-item-increase');
      updateQuantity(btn.dataset.id, 1);
    }

    if (e.target.classList.contains('cart-item-decrease') || e.target.closest('.cart-item-decrease')) {
      const btn = e.target.classList.contains('cart-item-decrease') ? e.target : e.target.closest('.cart-item-decrease');
      updateQuantity(btn.dataset.id, -1);
    }
  });

  // Initialize cart display
  updateCartDisplay();

  // ========== SERVICE BOOKING POPUP FUNCTIONALITY ==========
  const cleaningProductsBtn = document.querySelector('.service-cta-btn[data-service="cleaning-products"]');
  if (cleaningProductsBtn) {
    cleaningProductsBtn.addEventListener('click', function (e) {
      window.location.href = 'products.html';
    });
  }

  const serviceButtons = document.querySelectorAll('.service-cta-btn');
  const servicePopup = document.getElementById('service-popup');
  const popupClose = document.querySelector('.popup-close');
  const popupOverlay = document.querySelector('.popup-overlay');

  const services = {
    'deep-cleaning': {
      title: 'Standard & Deep Cleaning',
      price: 'From R350',
      description: 'Refresh your space from top to bottom with our thorough deep cleaning — perfect for hard-to-reach areas and detailed care.',
      image: '/images/deepcleaning.jpg',
      options: [
        'Standard Cleaning',
        'Deep Cleaning',
        'Move-in/Move-out Cleaning',
        'Post-Construction Cleaning'
      ]
    },
    'office-cleaning': {
      title: 'Office Cleaning',
      price: 'From R500',
      description: 'Boost your workplace productivity and professionalism with our expert office cleaning services tailored to your needs.',
      image: '/images/office.jpg',
      options: [
        'Daily Office Cleaning',
        'Weekly Office Cleaning',
        'Deep Office Cleaning',
        'Carpet Cleaning for Offices'
      ]
    }
  };

  serviceButtons.forEach(button => {
    button.addEventListener('click', function () {
      const serviceId = this.getAttribute('data-service');
      const service = services[serviceId];

      if (!service) return;

      const popupTitle = document.getElementById('popup-service-title');
      const popupPrice = document.getElementById('popup-service-price');
      const popupDescription = document.getElementById('popup-service-description');
      const popupImage = document.getElementById('popup-service-image');
      const serviceTypeSelect = document.getElementById('service-type');

      if (popupTitle) popupTitle.textContent = service.title;
      if (popupPrice) popupPrice.textContent = service.price;
      if (popupDescription) popupDescription.textContent = service.description;
      if (popupImage) {
        popupImage.src = service.image;
        popupImage.alt = service.title;
      }

      if (serviceTypeSelect) {
        serviceTypeSelect.innerHTML = '<option value="" disabled selected>Select service type</option>';
        service.options.forEach(option => {
          const opt = document.createElement('option');
          opt.value = option.toLowerCase().replace(/ /g, '-');
          opt.textContent = option;
          serviceTypeSelect.appendChild(opt);
        });
      }

      if (servicePopup) {
        servicePopup.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    });
  });

  function closePopup() {
    if (servicePopup) {
      servicePopup.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if (popupClose) popupClose.addEventListener('click', closePopup);
  if (popupOverlay) popupOverlay.addEventListener('click', closePopup);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && servicePopup && servicePopup.classList.contains('active')) {
      closePopup();
    }
  });

  const bookingForm = document.getElementById('service-booking-form');
  if (bookingForm) {
    bookingForm.addEventListener('submit', function (e) {
      e.preventDefault();
      alert('Booking request submitted! We will contact you shortly to confirm.');
      closePopup();
      this.reset();
    });
  }

  // ========== GALLERY FUNCTIONALITY ==========
  const filterButtons = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  filterButtons.forEach(button => {
    button.addEventListener('click', function () {
      filterButtons.forEach(btn => btn.classList.remove('active'));
      this.classList.add('active');

      const filterValue = this.getAttribute('data-filter');

      galleryItems.forEach(item => {
        if (filterValue === 'all' || item.getAttribute('data-category') === filterValue) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  const videoItems = document.querySelectorAll('.gallery-item video');
  videoItems.forEach(video => {
    video.addEventListener('mouseenter', function () {
      this.play();
    });

    video.addEventListener('mouseleave', function () {
      this.pause();
      this.currentTime = 0;
    });
  });

  // ========== HOME SERVICES CAROUSEL ==========
  const track = document.querySelector('.home-services-bar');
  const cards = Array.from(document.querySelectorAll('.home-service-card'));
  const prevBtn = document.querySelector('.home-carousel-prev');
  const nextBtn = document.querySelector('.home-carousel-next');
  const progressBar = document.querySelector('.home-progress-bar');

  if (track && cards.length > 0) {
    const cardCount = cards.length;
    let cardWidth = cards[0].offsetWidth + 24;
    let currentPosition = 0;
    let maxVisibleCards = Math.floor(track.parentElement.offsetWidth / cardWidth);

    function updateCarousel() {
      const maxScroll = (cardCount - maxVisibleCards) * cardWidth;

      if (currentPosition * cardWidth > maxScroll) {
        currentPosition = 0;
        track.style.transition = 'none';
        track.style.transform = `translateX(0)`;
        setTimeout(() => {
          track.style.transition = 'transform 0.6s ease';
        }, 10);
      } else if (currentPosition < 0) {
        currentPosition = Math.floor(maxScroll / cardWidth);
        track.style.transition = 'none';
        track.style.transform = `translateX(-${maxScroll}px)`;
        setTimeout(() => {
          track.style.transition = 'transform 0.6s ease';
        }, 10);
      }

      track.style.transform = `translateX(-${currentPosition * cardWidth}px)`;

      if (progressBar) {
        const maxProgress = (cardCount - maxVisibleCards);
        const progress = (currentPosition % cardCount) / maxProgress * 100;
        progressBar.style.transform = `translateX(${Math.min(100, progress)}%)`;
      }
    }

    updateCarousel();

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        currentPosition++;
        updateCarousel();
      });
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        currentPosition--;
        updateCarousel();
      });
    }

    let startX, moveX;
    track.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      track.style.transition = 'none';
    });

    track.addEventListener('touchmove', (e) => {
      moveX = e.touches[0].clientX;
      track.style.transform = `translateX(calc(-${currentPosition * cardWidth}px - ${startX - moveX}px))`;
    });

    track.addEventListener('touchend', () => {
      const diff = startX - moveX;
      if (diff > 50) {
        currentPosition++;
      } else if (diff < -50) {
        currentPosition--;
      }
      track.style.transition = 'transform 0.6s ease';
      updateCarousel();
    });

    let autoScroll = setInterval(() => {
      currentPosition++;
      updateCarousel();
    }, 5000);

    track.addEventListener('mouseenter', () => clearInterval(autoScroll));
    track.addEventListener('mouseleave', () => {
      autoScroll = setInterval(() => {
        currentPosition++;
        updateCarousel();
      }, 5000);
    });

    window.addEventListener('resize', () => {
      cardWidth = cards[0].offsetWidth + 24;
      maxVisibleCards = Math.floor(track.parentElement.offsetWidth / cardWidth);
      updateCarousel();
    });
  }
});