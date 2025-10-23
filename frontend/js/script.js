// script.js - Enhanced with Rate Limiting Protection and Beautiful Loading

// ========== RATE LIMIT MANAGER ==========
class RateLimitManager {
  constructor() {
    this.requests = new Map();
    this.maxRequests = 10; // Maximum requests per minute
    this.windowMs = 60000; // 1 minute window
    this.retryAfter = 5000; // 5 seconds retry delay
  }

  checkLimit(key) {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Clean old entries
    for (const [timestamp] of this.requests) {
      if (timestamp < windowStart) {
        this.requests.delete(timestamp);
      }
    }

    // Count requests in current window
    const currentRequests = Array.from(this.requests.values())
      .filter(req => req.key === key && req.timestamp > windowStart)
      .length;

    if (currentRequests >= this.maxRequests) {
      return {
        allowed: false,
        retryAfter: this.retryAfter,
        message: 'Too many requests. Please try again later.'
      };
    }

    // Record this request
    this.requests.set(now, { key, timestamp: now });

    return { allowed: true };
  }

  clear() {
    this.requests.clear();
  }
}

// ========== BEAUTIFUL LOADER ==========
class BeautifulLoader {
  constructor() {
    this.loaderHTML = `
            <div id="global-loader" class="beautiful-loader">
                <div class="loader-container">
                    <div class="loader-logo">
                        <div class="bubble bubble-1"></div>
                        <div class="bubble bubble-2"></div>
                        <div class="bubble bubble-3"></div>
                        <div class="bubble bubble-4"></div>
                    </div>
                    <div class="loader-text">
                        <span class="loader-message">Cleaning things up...</span>
                        <div class="loader-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    this.init();
  }

  init() {
    if (!document.getElementById('global-loader')) {
      document.body.insertAdjacentHTML('beforeend', this.loaderHTML);
    }
    this.addStyles();
  }

  addStyles() {
    const styles = `
            .beautiful-loader {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: linear-gradient(135deg, #e6f7ff 0%, #b3e0ff 100%);
                display: none;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                font-family: 'Arial', sans-serif;
            }

            .beautiful-loader.active {
                display: flex;
                animation: fadeIn 0.3s ease;
            }

            .loader-container {
              text-align: center;
              background: rgba(255, 255, 255, 0.95);
              padding: 5rem 4rem; /* Keep padding for internal space */
              width: 20%; /* Decreased width */
              height: 300px; /* Height remains the same */
              border-radius: 20px;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
              backdrop-filter: blur(10px);
              border: 1px solid rgba(255, 255, 255, 0.2);
              margin: 0 auto; /* Centers the container */
            }


            .loader-logo {
                position: relative;
                width: 80px;
                height: 80px;
                margin: 0 auto 2rem;
            }

            .bubble {
                position: absolute;
                border-radius: 50%;
                background: #0066cc;
                animation: float 2s ease-in-out infinite;
            }

            .bubble-1 {
                width: 30px;
                height: 30px;
                top: 0;
                left: 0;
                animation-delay: 0s;
                background: #0066cc;
            }

            .bubble-2 {
                width: 25px;
                height: 25px;
                top: 10px;
                right: 0;
                animation-delay: 0.5s;
                background: #ffcc00;
            }

            .bubble-3 {
                width: 20px;
                height: 20px;
                bottom: 0;
                left: 15px;
                animation-delay: 1s;
                background: #667eea;
            }

            .bubble-4 {
                width: 15px;
                height: 15px;
                bottom: 20px;
                right: 10px;
                animation-delay: 1.5s;
                background: #764ba2;
            }

            .loader-text {
                margin-top: 1rem;
            }

            .loader-message {
                display: block;
                font-size: 1.1rem;
                color: #333;
                font-weight: 600;
                margin-bottom: 1rem;
            }

            .loader-dots {
                display: flex;
                justify-content: center;
                gap: 4px;
            }

            .loader-dots span {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                background: #0066cc;
                animation: bounce 1.4s ease-in-out infinite both;
            }

            .loader-dots span:nth-child(1) { animation-delay: -0.32s; }
            .loader-dots span:nth-child(2) { animation-delay: -0.16s; }
            .loader-dots span:nth-child(3) { animation-delay: 0s; }

            .rate-limit-notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: #ff6b6b;
                color: white;
                padding: 1rem 1.5rem;
                border-radius: 10px;
                box-shadow: 0 10px 30px rgba(255, 107, 107, 0.3);
                z-index: 10000;
                display: none;
                align-items: center;
                gap: 10px;
                max-width: 400px;
                animation: slideInRight 0.3s ease;
            }

            .rate-limit-notification.active {
                display: flex;
            }

            .rate-limit-notification i {
                font-size: 1.2rem;
            }

            .rate-limit-countdown {
                font-weight: bold;
                margin-left: 5px;
            }

            .btn-loading {
                position: relative;
                color: transparent !important;
                pointer-events: none;
            }

            .btn-loading::after {
                content: '';
                position: absolute;
                top: 50%;
                left: 50%;
                width: 20px;
                height: 20px;
                margin: -10px 0 0 -10px;
                border: 2px solid transparent;
                border-top: 2px solid #ffffff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            @keyframes float {
                0%, 100% { transform: translateY(0) scale(1); }
                50% { transform: translateY(-10px) scale(1.1); }
            }

            @keyframes bounce {
                0%, 80%, 100% {
                    transform: scale(0);
                }
                40% {
                    transform: scale(1);
                }
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes slideInRight {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }

            @keyframes shake {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }

            .fade-in {
                animation: fadeIn 0.5s ease-in;
            }

            @keyframes fadeIn {
                from { opacity: 0; transform: translateY(20px); }
                to { opacity: 1; transform: translateY(0); }
            }
        `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }

  show(message = 'Cleaning things up...') {
    const loader = document.getElementById('global-loader');
    const messageEl = loader.querySelector('.loader-message');

    if (messageEl) {
      messageEl.textContent = message;
    }

    loader.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  hide() {
    const loader = document.getElementById('global-loader');
    loader.classList.remove('active');
    document.body.style.overflow = '';

    setTimeout(() => {
      loader.style.display = 'none';
    }, 300);
  }

  setMessage(message) {
    const messageEl = document.querySelector('.loader-message');
    if (messageEl) {
      messageEl.textContent = message;
    }
  }
}

// ========== ENHANCED API CLIENT ==========
class EnhancedAPIClient {
  constructor() {
    this.baseURL = 'http://localhost:5000/api';
    this.pendingRequests = new Map();
  }

  async request(method, endpoint, data = null, options = {}) {
    const requestKey = `${method}:${endpoint}`;

    // Check rate limiting
    const limitCheck = window.rateLimitManager.checkLimit(requestKey);
    if (!limitCheck.allowed) {
      this.showRateLimitNotification(limitCheck.retryAfter);
      throw new Error(limitCheck.message);
    }

    // Show loading for non-background requests
    if (!options.background) {
      window.beautifulLoader.show(options.loadingMessage || 'Processing your request...');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 15000);

    try {
      const config = {
        method,
        url: `${this.baseURL}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        signal: controller.signal,
        timeout: options.timeout || 15000
      };

      if (data) {
        config.data = data;
      }

      const response = await axios(config);
      return response.data;

    } catch (error) {
      if (error.response?.status === 429) {
        this.showRateLimitNotification(5000);
        throw new Error('Too many requests. Please slow down.');
      }

      throw this.handleError(error);
    } finally {
      clearTimeout(timeoutId);
      if (!options.background) {
        window.beautifulLoader.hide();
      }
    }
  }

  handleError(error) {
    if (error.code === 'ECONNABORTED') {
      return new Error('Request timeout. Please check your connection.');
    }

    if (!navigator.onLine) {
      return new Error('No internet connection. Please check your network.');
    }

    if (error.response) {
      switch (error.response.status) {
        case 429:
          return new Error('Too many requests. Please try again later.');
        case 500:
          return new Error('Server error. Please try again later.');
        case 404:
          return new Error('Service not found.');
        default:
          return new Error(error.response.data?.message || 'Request failed');
      }
    }

    return error;
  }

  showRateLimitNotification(retryAfter) {
    const notification = document.createElement('div');
    notification.className = 'rate-limit-notification';
    notification.innerHTML = `
            <i class="fas fa-hourglass-half"></i>
            <div>
                <strong>Too Many Requests</strong>
                <div>Please wait <span class="rate-limit-countdown">${retryAfter / 1000}</span> seconds</div>
            </div>
        `;

    document.body.appendChild(notification);
    notification.classList.add('active');

    // Update countdown
    let seconds = retryAfter / 1000;
    const countdownEl = notification.querySelector('.rate-limit-countdown');
    const countdownInterval = setInterval(() => {
      seconds--;
      countdownEl.textContent = seconds;
      if (seconds <= 0) {
        clearInterval(countdownInterval);
        notification.classList.remove('active');
        setTimeout(() => notification.remove(), 300);
      }
    }, 1000);

    // Auto-remove after retry time
    setTimeout(() => {
      notification.classList.remove('active');
      setTimeout(() => notification.remove(), 300);
    }, retryAfter);
  }

  // Convenience methods
  async get(endpoint, options = {}) {
    return this.request('GET', endpoint, null, options);
  }

  async post(endpoint, data, options = {}) {
    return this.request('POST', endpoint, data, options);
  }

  async put(endpoint, data, options = {}) {
    return this.request('PUT', endpoint, data, options);
  }

  async delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, null, options);
  }
}

// ========== GLOBAL INITIALIZATION ==========
window.rateLimitManager = new RateLimitManager();
window.beautifulLoader = new BeautifulLoader();
window.apiClient = new EnhancedAPIClient();

// ========== GLOBAL VARIABLES ==========
let cartItems = [];

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
  console.log('Global error caught:', e.error);

  if (e.error?.message?.includes('rate') || e.error?.message?.includes('too many')) {
    return;
  }

  if (window.beautifulLoader) {
    window.beautifulLoader.setMessage('Something went wrong...');
    setTimeout(() => window.beautifulLoader.hide(), 2000);
  }
});

// Tab Switch Function
function switchTab(tabName) {
  if (tabName !== 'login' && tabName !== 'register') return;

  window.beautifulLoader.show('Loading...');

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

  setTimeout(() => {
    window.beautifulLoader.hide();
  }, 300);
}

// Protected page initialization
function initProtectedPage() {
  window.beautifulLoader.show('Checking authentication...');

  if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) {
    window.beautifulLoader.hide();
    if (typeof authManager !== 'undefined') {
      authManager.redirectToLogin();
    } else {
      window.location.href = 'login.html';
    }
    return false;
  }

  window.beautifulLoader.hide();
  return true;
}

// Role-based page access
function initAdminPage() {
  window.beautifulLoader.show('Verifying admin access...');

  if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) {
    window.beautifulLoader.hide();
    if (typeof authManager !== 'undefined') {
      authManager.redirectToLogin();
    } else {
      window.location.href = 'login.html';
    }
    return false;
  }

  if (!authManager.hasRole('admin')) {
    window.beautifulLoader.hide();
    alert('Access denied. Admin privileges required.');
    window.location.href = 'index.html';
    return false;
  }

  window.beautifulLoader.hide();
  return true;
}

// Update navigation based on authentication
function updateNavigation() {
  const nav = document.getElementById('main-nav');
  if (!nav) return;

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
                        <button class="nav-logout-btn" onclick="enhancedLogout()">
                            <i class="fas fa-sign-out-alt"></i>
                        </button>
                    </div>
                `;
      }
    }
  }
}

// Enhanced logout with loading
async function enhancedLogout() {
  window.beautifulLoader.show('Signing out...');

  try {
    if (typeof authManager !== 'undefined') {
      await authManager.logout();
    } else {
      localStorage.removeItem('authToken');
      localStorage.removeItem('role');
      localStorage.removeItem('userType');
      localStorage.removeItem('user');
    }

    setTimeout(() => {
      window.beautifulLoader.hide();
      window.location.href = 'index.html';
    }, 1000);
  } catch (error) {
    window.beautifulLoader.hide();
    console.error('Logout error:', error);
    window.location.href = 'index.html';
  }
}

// Add authentication to quote form
function setupProtectedForms() {
  const quoteForm = document.getElementById('index-quoteForm');
  if (quoteForm) {
    quoteForm.addEventListener('submit', async function (e) {
      if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) {
        e.preventDefault();
        window.beautifulLoader.show('Redirecting to login...');

        setTimeout(() => {
          if (typeof authManager !== 'undefined') {
            authManager.redirectToLogin();
          } else {
            window.location.href = 'login.html';
          }
        }, 500);
        return;
      }

      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');

      const formData = new FormData(this);
      if (authManager.user && authManager.user.ID) {
        formData.append('userId', authManager.user.ID);
      }

      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
      }, 3000);
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

    errorBox.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
      errorBox.style.animation = '';
    }, 500);
  }
}

// ========== CART FUNCTIONS ==========
function updateCartDisplay() {
  const cartItemsContainer = document.querySelector('.cart-items');
  const cartTotal = document.querySelector('.cart-total');
  const cartBadge = document.querySelector('.cart-badge');

  if (!cartItemsContainer) return;

  cartItemsContainer.innerHTML = '';

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
        window.beautifulLoader.show('Redirecting to login...');
        setTimeout(() => {
          if (typeof authManager !== 'undefined') {
            authManager.redirectToLogin();
          } else {
            window.location.href = 'login.html';
          }
        }, 500);
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
  if (typeof authManager === 'undefined' || !authManager.isAuthenticated()) {
    const cartSidebar = document.getElementById('cart-sidebar');
    if (cartSidebar && !cartSidebar.classList.contains('active')) {
      toggleCart();
    }
    return;
  }

  window.beautifulLoader.show('Adding to cart...');

  setTimeout(() => {
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
    window.beautifulLoader.hide();

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
  }, 500);
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

// ========== FIRST LOGIN MODAL FUNCTIONS ==========
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

    const errorDiv = document.getElementById('first-login-error');
    if (errorDiv) {
      errorDiv.style.display = 'none';
    }

    const form = document.getElementById('first-login-form');
    if (form) {
      form.reset();
      emailInput.value = email;
    }

    setupFirstLoginForm();
  }
}

function setupFirstLoginForm() {
  const form = document.getElementById('first-login-form');
  const errorDiv = document.getElementById('first-login-error');
  const errorText = document.getElementById('first-login-error-text');

  if (!form) return;

  const newForm = form.cloneNode(true);
  form.parentNode.replaceChild(newForm, form);

  newForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    if (errorDiv) errorDiv.style.display = 'none';

    const formData = {
      Email: document.getElementById('first-login-email').value,
      TemporaryPassword: document.getElementById('temporary-password').value,
      NewPassword: document.getElementById('new-admin-password').value
    };

    const confirmPassword = document.getElementById('confirm-admin-password').value;

    if (formData.NewPassword !== confirmPassword) {
      showFirstLoginError('Passwords do not match');
      return;
    }

    if (formData.NewPassword.length < 8) {
      showFirstLoginError('Password must be at least 8 characters long');
      return;
    }

    try {
      window.beautifulLoader.show('Setting up your account...');

      const response = await window.apiClient.post('/admin/first-login', formData, {
        loadingMessage: 'Finalizing your account...'
      });

      if (response.success && response.token) {
        if (typeof authManager !== 'undefined') {
          authManager.login(
            response.token,
            response.role,
            response.user,
            'admin'
          );

          closeFirstLoginModal();
          window.beautifulLoader.show('Welcome! Redirecting...');
          setTimeout(() => {
            window.location.href = 'admin-dashboard.html';
          }, 1500);
        }
      }
    } catch (error) {
      window.beautifulLoader.hide();
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
    errorDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// ========== HELPER FUNCTIONS ==========
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

// ========== MAIN DOM CONTENT LOADED ==========
document.addEventListener('DOMContentLoaded', function () {
  // Show initial loading
  window.beautifulLoader.show('Loading Phambili Services...');

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
            background-color: #0066cc;
            color: white;
            border: none;
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            cursor: pointer;
            font-weight: 500;
            transition: background-color 0.2s;
        }
        
        .btn-primary:hover {
            background-color: #0055aa;
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

      // Check rate limiting
      const limitCheck = window.rateLimitManager.checkLimit('register');
      if (!limitCheck.allowed) {
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${limitCheck.message}`;
        }
        return;
      }

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
        submitBtn.classList.add('btn-loading');

        window.beautifulLoader.show('Creating your account...');

        await window.apiClient.post('/auth/register', {
          Full_Name,
          Email,
          Password
        }, {
          loadingMessage: 'Setting up your account...'
        });

        const successBox = document.getElementById('register-success');
        if (successBox) {
          successBox.style.display = 'block';
          successBox.innerHTML = `<i class="fas fa-check-circle"></i> Registration successful! Redirecting to login...`;
        }

        localStorage.setItem('activeTab', 'login');
        this.reset();

        window.beautifulLoader.show('Account created! Redirecting...');

        setTimeout(() => {
          window.beautifulLoader.hide();
          switchTab('login');
        }, 2000);

      } catch (error) {
        window.beautifulLoader.hide();
        console.log("Register error:", error.response?.data);
        const errorMessage = error.response?.data?.message || 'Registration failed. Please try again.';
        const errorBox = document.getElementById('register-error');
        if (errorBox) {
          errorBox.style.display = 'block';
          errorBox.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${errorMessage}`;
        }

        const submitBtn = this.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Login Form Handler
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const submitBtn = this.querySelector('button[type="submit"]');
      const originalText = submitBtn.innerHTML;

      // Check rate limiting first
      const limitCheck = window.rateLimitManager.checkLimit('login');
      if (!limitCheck.allowed) {
        showLoginError(limitCheck.message);
        return;
      }

      submitBtn.disabled = true;
      submitBtn.classList.add('btn-loading');

      const loginError = document.getElementById('login-error');
      const loginSuccess = document.getElementById('login-success');
      if (loginError) loginError.style.display = 'none';
      if (loginSuccess) loginSuccess.style.display = 'none';

      const Email = document.getElementById('auth-login-email')?.value.trim();
      const Password = document.getElementById('auth-login-password')?.value;

      if (!Email || !Password) {
        showLoginError('Please enter both email and password.');
        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
        return;
      }

      try {
        window.beautifulLoader.show('Signing you in...');

        const response = await window.apiClient.post('/auth/login', {
          Email: Email,
          Password: Password
        }, {
          loadingMessage: 'Authenticating...'
        });

        console.log('Login response:', response);

        await waitForAuthManager();

        if (typeof authManager === 'undefined') {
          throw new Error('Authentication system not available. Please refresh the page.');
        }

        if (response.requiresPasswordReset) {
          window.beautifulLoader.hide();
          showFirstLoginModal(Email);
          submitBtn.disabled = false;
          submitBtn.classList.remove('btn-loading');
          submitBtn.innerHTML = originalText;
          return;
        }

        if (response.token) {
          const userType = response.role === 'admin' ? 'admin' : 'customer';

          authManager.login(
            response.token,
            response.role,
            response.user,
            userType
          );

          if (loginSuccess) {
            loginSuccess.style.display = 'block';
            loginSuccess.innerHTML = `<i class="fas fa-check-circle"></i> Login successful! Redirecting...`;
          }

          window.beautifulLoader.show('Welcome back! Redirecting...');

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
          throw new Error('Login failed. No token received.');
        }

      } catch (error) {
        window.beautifulLoader.hide();
        console.error('Login error:', error);
        const errorMessage = error.response?.data?.message ||
          error.message ||
          'Login failed. Please check your credentials.';
        showLoginError(errorMessage);

        submitBtn.disabled = false;
        submitBtn.classList.remove('btn-loading');
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // First login modal event listeners
  document.addEventListener('click', function (e) {
    const modal = document.getElementById('firstLoginModal');
    if (modal && e.target === modal) {
      closeFirstLoginModal();
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      const modal = document.getElementById('firstLoginModal');
      if (modal && modal.style.display === 'flex') {
        closeFirstLoginModal();
      }
    }
  });

  // Tab Switching
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
      window.beautifulLoader.show('Connecting social account...');
      setTimeout(() => {
        window.beautifulLoader.hide();
        alert('Social login functionality would be implemented here');
      }, 1000);
    });
  });

  // Forgot password link
  document.querySelector('.auth-forgot')?.addEventListener('click', function (e) {
    e.preventDefault();
    window.beautifulLoader.show('Loading password reset...');
    setTimeout(() => {
      window.beautifulLoader.hide();
      alert('Password reset functionality would be implemented here');
    }, 1000);
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

    // Hide loader when everything is ready
    setTimeout(() => {
      window.beautifulLoader.hide();
      document.body.classList.add('fade-in');
    }, 500);
  }, 1000);

  // ========== NAVIGATION AND CART FUNCTIONALITY ==========
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mainNav = document.getElementById('main-nav');
  const closeNavBtn = document.getElementById('close-nav-btn');
  const cartBtn = document.getElementById('cart-btn');
  const cartSidebar = document.getElementById('cart-sidebar');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const menuOverlay = document.getElementById('menu-overlay');

  // Event Listeners
  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', () => {
      window.beautifulLoader.show('Opening menu...');
      setTimeout(() => {
        window.beautifulLoader.hide();
        openNav();
      }, 300);
    });
  }

  if (closeNavBtn) closeNavBtn.addEventListener('click', closeNav);

  if (cartBtn) {
    cartBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      window.beautifulLoader.show('Loading cart...');
      setTimeout(() => {
        window.beautifulLoader.hide();
        toggleCart();
      }, 300);
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
      window.beautifulLoader.show('Loading products...');
      setTimeout(() => {
        window.location.href = 'products.html';
      }, 500);
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

// ========== NETWORK AND PAGE TRANSITION HANDLING ==========
window.addEventListener('beforeunload', function () {
  window.beautifulLoader.show('Loading...');
});

window.addEventListener('online', function () {
  console.log('Connection restored');
  window.rateLimitManager.clear();
});

window.addEventListener('offline', function () {
  window.beautifulLoader.show('Connection lost...');
  setTimeout(() => {
    if (!navigator.onLine) {
      window.beautifulLoader.hide();
    }
  }, 2000);
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function (event) {
  console.error('Unhandled promise rejection:', event.reason);
  if (window.beautifulLoader) {
    window.beautifulLoader.setMessage('Something went wrong...');
    setTimeout(() => window.beautifulLoader.hide(), 2000);
  }
});