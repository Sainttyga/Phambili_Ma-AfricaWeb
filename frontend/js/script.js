// ========== GLOBAL RATE LIMIT MANAGER ==========
class RateLimitManager {
  constructor() {
    this.requests = new Map();
    this.maxRequests = 15; // Increased from 10
    this.windowMs = 60000; // 1 minute window
    this.retryAfter = 3000; // Reduced from 5000
    this.globalRequestCount = 0;
    this.lastGlobalRequest = 0;
    this.globalDelay = 300; // Base delay between requests
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
    this.globalRequestCount++;
    this.lastGlobalRequest = now;

    return { allowed: true };
  }

  // Enhanced: Wait before making requests to avoid hitting server limits
  async waitForGlobalRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastGlobalRequest;

    if (timeSinceLastRequest < this.globalDelay) {
      const waitTime = this.globalDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastGlobalRequest = Date.now();
  }

  clear() {
    this.requests.clear();
    this.globalRequestCount = 0;
  }

  getStats() {
    return {
      totalRequests: this.globalRequestCount,
      activeRequests: this.requests.size,
      lastRequest: this.lastGlobalRequest
    };
  }
}

// ========== ENHANCED API CLIENT WITH RATE LIMIT COORDINATION ==========
class EnhancedAPIClient {
  constructor() {
    this.baseURL = 'http://localhost:5000/api';
    this.pendingRequests = new Map();
    this.requestQueue = [];
    this.maxConcurrentRequests = 2;
    this.activeRequests = 0;
    this.isPaused = false;
  }

  async request(method, endpoint, data = null, options = {}) {
    // Wait for global rate limit
    await window.rateLimitManager.waitForGlobalRateLimit();

    const requestKey = `${method}:${endpoint}:${JSON.stringify(data)}`;

    // Check client-side rate limiting
    const limitCheck = window.rateLimitManager.checkLimit(requestKey);
    if (!limitCheck.allowed) {
      this.showRateLimitNotification(limitCheck.retryAfter);
      throw new Error(limitCheck.message);
    }

    // Queue the request if we're at max concurrent requests
    if (this.activeRequests >= this.maxConcurrentRequests && !options.urgent) {
      return new Promise((resolve, reject) => {
        this.requestQueue.push({
          method,
          endpoint,
          data,
          options,
          resolve,
          reject
        });
        this.processQueue();
      });
    }

    return this.executeRequest(method, endpoint, data, options);
  }

  async processQueue() {
    if (this.isPaused ||
      this.activeRequests >= this.maxConcurrentRequests ||
      this.requestQueue.length === 0) {
      return;
    }

    this.activeRequests++;
    const request = this.requestQueue.shift();

    try {
      const result = await this.executeRequest(
        request.method,
        request.endpoint,
        request.data,
        request.options
      );
      request.resolve(result);
    } catch (error) {
      request.reject(error);
    } finally {
      this.activeRequests--;
      // Process next request with a small delay
      setTimeout(() => this.processQueue(), 50);
    }
  }

  async executeRequest(method, endpoint, data = null, options = {}) {
    // Show loading for non-background requests
    if (!options.background) {
      window.beautifulLoader.show(options.loadingMessage || 'Processing your request...');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 20000);

    try {
      const config = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        },
        signal: controller.signal
      };

      if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        config.body = JSON.stringify(data);
      }

      console.log(`🌐 Making ${method} request to: ${endpoint}`);

      const response = await fetch(`${this.baseURL}${endpoint}`, config);

      // Handle rate limiting from server
      if (response.status === 429) {
        const retryAfter = response.headers.get('retry-after') || 5;
        this.showRateLimitNotification(retryAfter * 1000);
        throw new Error(`Rate limited by server. Please try again in ${retryAfter} seconds.`);
      }

      // Check if response is OK
      if (!response.ok) {
        let errorMessage;
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
        } catch {
          errorMessage = `HTTP error! status: ${response.status}`;
        }

        const error = new Error(errorMessage);
        error.status = response.status;
        throw error;
      }

      // Parse response
      const responseData = await response.json();
      return responseData;

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timeout. Please check your connection and try again.');
      }

      // Don't show rate limit notification again if we already showed it
      if (error.message.includes('Rate limited')) {
        throw error;
      }

      if (error.status === 429) {
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

  // Enhanced error handling with better user feedback
  handleError(error) {
    console.log('🔧 Error details:', error);

    if (error.message?.includes('timeout')) {
      return new Error('Request timeout. Please check your connection and try again.');
    }

    if (!navigator.onLine) {
      return new Error('No internet connection. Please check your network and try again.');
    }

    if (error.status) {
      const status = error.status;

      // Use server message if available
      if (error.message && !error.message.includes('HTTP error')) {
        return error;
      }

      // Fallback to status-based messages
      switch (status) {
        case 400:
          return new Error('Invalid request. Please check your input and try again.');
        case 401:
          return new Error('Invalid email or password. Please try again.');
        case 404:
          if (error.config?.url?.includes('/auth/')) {
            return new Error('Authentication service unavailable. Please try again later.');
          }
          return new Error('Service not available. Please try again later.');
        case 429:
          return new Error('Too many attempts. Please wait a moment and try again.');
        case 500:
          return new Error('Server error. Our team has been notified. Please try again later.');
        default:
          return new Error('Something went wrong. Please try again.');
      }
    }

    // Network errors or other issues
    if (error.message) {
      return error;
    }

    return new Error('Network error. Please check your connection and try again.');
  }

  showRateLimitNotification(retryAfter) {
    // Remove existing notification
    const existingNotification = document.querySelector('.rate-limit-notification');
    if (existingNotification) {
      existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = 'rate-limit-notification';
    notification.innerHTML = `
      <i class="fas fa-hourglass-half"></i>
      <div>
        <strong>Too Many Requests</strong>
        <div>Please wait <span class="rate-limit-countdown">${Math.round(retryAfter / 1000)}</span> seconds</div>
      </div>
    `;

    document.body.appendChild(notification);
    notification.classList.add('active');

    // Update countdown
    let seconds = Math.round(retryAfter / 1000);
    const countdownEl = notification.querySelector('.rate-limit-countdown');
    const countdownInterval = setInterval(() => {
      seconds--;
      if (countdownEl) {
        countdownEl.textContent = seconds;
      }
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

  // Enhanced: Pause all requests when rate limited
  pauseRequests() {
    this.isPaused = true;
  }

  resumeRequests() {
    this.isPaused = false;
    this.processQueue();
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
        padding: 5rem 4rem;
        width: 20%;
        height: 300px;
        border-radius: 20px;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.2);
        margin: 0 auto;
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

      /* Forgot Password Modal Styles */
      .forgot-password-modal {
        max-width: 450px;
        width: 90%;
      }

      .forgot-password-modal .modal-header {
        text-align: center;
        margin-bottom: 20px;
      }

      .forgot-password-modal .modal-header h2 {
        color: #2c3e50;
        margin-bottom: 10px;
        font-size: 1.5rem;
      }

      .forgot-password-modal .modal-header p {
        color: #7f8c8d;
        font-size: 14px;
        line-height: 1.4;
      }

      .auth-footer-links {
        text-align: center;
        margin-top: 20px;
        padding-top: 20px;
        border-top: 1px solid #ecf0f1;
      }

      .auth-footer-links a {
        color: #3498db;
        text-decoration: none;
        font-weight: 500;
      }

      .auth-footer-links a:hover {
        text-decoration: underline;
      }

      .password-security-hint {
        font-size: 12px;
        color: #7f8c8d;
        margin-top: 5px;
      }

      .rate-limit-message {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        color: #856404;
        padding: 10px;
        border-radius: 5px;
        margin-bottom: 15px;
        font-size: 14px;
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

// ========== GLOBAL INITIALIZATION ==========
window.rateLimitManager = new RateLimitManager();
window.beautifulLoader = new BeautifulLoader();
window.apiClient = new EnhancedAPIClient();

// ========== GLOBAL VARIABLES ==========
let cartItems = [];

// ========== FORGOT PASSWORD FUNCTIONALITY ==========

// Show Forgot Password Modal
function showForgotPasswordModal() {
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal forgot-password-modal">
      <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
        <i class="fas fa-times"></i>
      </button>
      
      <div class="modal-header">
        <h2><i class="fas fa-key"></i> Reset Your Password</h2>
        <p>Enter your email address and we'll send you a link to reset your password.</p>
      </div>
      
      <div class="modal-body">
        <div id="forgot-password-success" class="auth-success" style="display: none">
          <i class="fas fa-check-circle"></i>
          <span id="forgot-password-success-text"></span>
        </div>
        
        <div id="forgot-password-error" class="auth-error-message" style="display: none">
          <i class="fas fa-exclamation-circle"></i>
          <span id="forgot-password-error-text"></span>
        </div>
        
        <form id="forgot-password-form">
          <div class="auth-form-group">
            <label for="forgot-password-email" class="auth-label">Email Address</label>
            <input type="email" id="forgot-password-email" class="auth-input" 
                   placeholder="your@email.com" required />
          </div>
          
          <div class="form-actions">
            <button type="submit" class="auth-btn">
              <i class="fas fa-paper-plane"></i> Send Reset Link
            </button>
          </div>
        </form>
        
        <div class="auth-footer-links">
          <p>Remember your password? <a href="#" onclick="switchToLogin()">Back to Login</a></p>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Setup form handler
  const form = document.getElementById('forgot-password-form');
  form.addEventListener('submit', handleForgotPasswordSubmit);
}

// Handle Forgot Password Submission
async function handleForgotPasswordSubmit(e) {
  e.preventDefault();

  const email = document.getElementById('forgot-password-email').value.trim();
  const submitBtn = this.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;

  // Hide previous messages
  const successEl = document.getElementById('forgot-password-success');
  const errorEl = document.getElementById('forgot-password-error');
  if (successEl) successEl.style.display = 'none';
  if (errorEl) errorEl.style.display = 'none';

  // Validation
  if (!email) {
    showForgotPasswordError('Please enter your email address.');
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    showForgotPasswordError('Please enter a valid email address.');
    return;
  }

  try {
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    window.beautifulLoader.show('Sending reset instructions...');

    const response = await window.apiClient.post('/auth/forgot-password', {
      Email: email
    });

    window.beautifulLoader.hide();

    if (response.success) {
      showForgotPasswordSuccess(response.message);

      // Clear form
      document.getElementById('forgot-password-form').reset();

      // Auto-close after 3 seconds
      setTimeout(() => {
        const modal = document.querySelector('.forgot-password-modal');
        if (modal) {
          modal.closest('.modal-overlay').remove();
        }
      }, 3000);
    }

  } catch (error) {
    window.beautifulLoader.hide();

    const errorMessage = error.response?.data?.message ||
      'Failed to send reset instructions. Please try again.';
    showForgotPasswordError(errorMessage);

  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

function showForgotPasswordError(message) {
  const errorEl = document.getElementById('forgot-password-error');
  const errorText = document.getElementById('forgot-password-error-text');

  if (errorEl && errorText) {
    errorText.textContent = message;
    errorEl.style.display = 'block';
  }
}

function showForgotPasswordSuccess(message) {
  const successEl = document.getElementById('forgot-password-success');
  const successText = document.getElementById('forgot-password-success-text');

  if (successEl && successText) {
    successText.textContent = message;
    successEl.style.display = 'block';
  }
}

function switchToLogin() {
  const modal = document.querySelector('.forgot-password-modal');
  if (modal) {
    modal.closest('.modal-overlay').remove();
  }
  // Switch to login tab if on auth page
  if (window.location.pathname.includes('login.html')) {
    switchTab('login');
  }
}

// ========== ENHANCED LOGIN ERROR HANDLING ==========
function showLoginError(message) {
  const loginError = document.getElementById('login-error');
  if (loginError) {
    loginError.style.display = 'block';

    // Check if it's a "user not found" error
    if (message.toLowerCase().includes('user not found') ||
      message.toLowerCase().includes('account not found')) {
      loginError.innerHTML = `
        <i class="fas fa-exclamation-circle"></i> ${message}
      `;
    } else if (message.toLowerCase().includes('invalid email or password')) {
      loginError.innerHTML = `
        <i class="fas fa-exclamation-circle"></i> ${message}
        <div style="margin-top: 10px; padding: 10px; background: rgba(255,255,255,0.1); border-radius: 5px;">
          <strong>Forgot your password?</strong> 
          <a href="javascript:void(0)" onclick="showForgotPasswordModal()" 
             style="color: #4CAF50; text-decoration: underline; margin-left: 5px;">
            Reset your password
          </a>
        </div>
      `;
    } else {
      // Generic error display
      loginError.innerHTML = `<i class="fas fa-exclamation-circle"></i> ${message}`;
    }

    loginError.scrollIntoView({ behavior: 'smooth', block: 'center' });

    loginError.style.animation = 'shake 0.5s ease-in-out';
    setTimeout(() => {
      loginError.style.animation = '';
    }, 500);
  }
}

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

// ========== GALLERY FUNCTIONALITY ==========
let currentGalleryItems = [];
let currentFilter = 'all';

async function loadGalleryItems() {
  try {
    console.log('🔄 Loading gallery items from API...');

    const response = await window.apiClient.get('/gallery/media', {
      background: true,
      timeout: 10000
    });

    console.log('✅ Gallery API response:', response);

    // Handle different response structures
    let mediaItems = [];
    if (response.success && response.media) {
      mediaItems = response.media;
    } else if (Array.isArray(response)) {
      // If the API returns just an array
      mediaItems = response;
    }

    if (mediaItems.length > 0) {
      currentGalleryItems = mediaItems;
      renderGalleryItems(mediaItems);
      initializeLightbox();
    } else {
      showEmptyGalleryState();
    }
  } catch (error) {
    console.error('❌ Failed to load gallery items:', error);
    showEmptyGalleryState('Failed to load gallery. Please try again later.');
  }
}

function renderGalleryItems(mediaItems) {
  const galleryGrid = document.querySelector('.gallery-grid');
  const loadingGallery = document.querySelector('.loading-gallery');

  if (!galleryGrid) {
    console.error('❌ Gallery grid not found');
    return;
  }

  // Clear loading state
  if (loadingGallery) {
    loadingGallery.style.display = 'none';
  }

  // Clear existing content
  galleryGrid.innerHTML = '';

  // Add new items - no complex calculations needed!
  mediaItems.forEach((item, index) => {
    const galleryItem = document.createElement('div');
    galleryItem.className = 'gallery-item';
    galleryItem.setAttribute('data-category', item.category);
    galleryItem.setAttribute('data-index', index);

    const categoryName = item.category.charAt(0).toUpperCase() + item.category.slice(1).replace('-', ' ');

    if (item.media_type === 'video') {
      galleryItem.innerHTML = `
        <video muted loop playsinline preload="metadata">
          <source src="${item.url}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
        <div class="video-icon">
          <i class="fas fa-play"></i>
        </div>
        <div class="overlay">
          <div class="item-title">${categoryName} Cleaning</div>
          <div class="item-desc">Professional ${item.category} service</div>
        </div>
      `;
    } else {
      galleryItem.innerHTML = `
        <img src="${item.url}" alt="${categoryName} cleaning service" loading="lazy">
        <div class="overlay">
          <div class="item-title">${categoryName} Cleaning</div>
          <div class="item-desc">Professional ${item.category} service</div>
        </div>
      `;
    }

    galleryGrid.appendChild(galleryItem);
  });

  console.log(`✅ Rendered ${mediaItems.length} gallery items in masonry layout`);

  // Initialize interactions after rendering
  initializeGalleryInteractions();
  setTimeout(initializeVideoAutoplay, 500);
}

function createGalleryItem(item, index, width, height) {
  const galleryItem = document.createElement('div');
  galleryItem.className = 'gallery-item';
  galleryItem.setAttribute('data-category', item.category);
  galleryItem.setAttribute('data-index', index);

  const categoryName = item.category.charAt(0).toUpperCase() + item.category.slice(1).replace('-', ' ');

  // Calculate row span based on aspect ratio
  const aspectRatio = width / height;
  let rowSpan = 30; // Default for square-ish images

  if (aspectRatio < 0.7) {
    rowSpan = 40; // Portrait images - span more rows
  } else if (aspectRatio > 1.5) {
    rowSpan = 25; // Landscape images - span fewer rows
  }

  galleryItem.style.gridRowEnd = `span ${rowSpan}`;

  if (item.media_type === 'video') {
    galleryItem.innerHTML = `
      <video muted loop playsinline preload="metadata">
        <source src="${item.url}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
      <div class="video-icon">
        <i class="fas fa-play"></i>
      </div>
      <div class="overlay">
        <div class="item-title">${categoryName} Cleaning</div>
        <div class="item-desc">Professional ${item.category} service</div>
      </div>
    `;
  } else {
    galleryItem.innerHTML = `
      <img src="${item.url}" alt="${categoryName} cleaning service" loading="lazy">
      <div class="overlay">
        <div class="item-title">${categoryName} Cleaning</div>
        <div class="item-desc">Professional ${item.category} service</div>
      </div>
    `;
  }

  return galleryItem;
}
function initializeVideoAutoplay() {
  const videos = document.querySelectorAll('.gallery-item video');

  videos.forEach((video, index) => {
    // Reset video and let it maintain natural dimensions
    video.currentTime = 0;
    video.muted = true;
    video.playsInline = true;
    video.style.width = '100%';
    video.style.height = 'auto';

    // Try to autoplay with a small delay between videos
    setTimeout(() => {
      video.play().catch(error => {
        console.log(`Video ${index} autoplay prevented:`, error);
        // Enhanced fallback for failed autoplay
        const videoIcon = video.nextElementSibling;
        if (videoIcon && videoIcon.classList.contains('video-icon')) {
          videoIcon.style.opacity = '1';
          videoIcon.style.background = 'rgba(0, 102, 204, 0.9)';
          videoIcon.style.color = 'white';
        }
      });
    }, index * 200);
  });
}

function initializeGalleryInteractions() {
  const filterButtons = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  console.log(`🔍 Found ${filterButtons.length} filter buttons`);
  console.log(`🔍 Found ${galleryItems.length} gallery items after rendering`);

  if (galleryItems.length === 0) {
    console.warn('❌ No gallery items found after rendering');
    return;
  }

  // Filter functionality
  filterButtons.forEach(button => {
    button.addEventListener('click', function () {
      // Remove active class from all buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));
      // Add active class to clicked button
      this.classList.add('active');

      const filterValue = this.getAttribute('data-filter');
      currentFilter = filterValue;

      filterGalleryItems(filterValue);

      // Restart video autoplay after filtering
      setTimeout(initializeVideoAutoplay, 300);
    });
  });

  // Video hover functionality
  const videoItems = document.querySelectorAll('.gallery-item video');
  videoItems.forEach(video => {
    const galleryItem = video.closest('.gallery-item');
    const videoIcon = video.nextElementSibling;

    galleryItem.addEventListener('mouseenter', function () {
      // Hide video icon on hover
      if (videoIcon && videoIcon.classList.contains('video-icon')) {
        videoIcon.style.opacity = '0';
      }

      // Try to play video
      video.play().catch(error => {
        console.log('Video play on hover failed:', error);
      });
    });

    galleryItem.addEventListener('mouseleave', function () {
      // Show video icon when not hovering
      if (videoIcon && videoIcon.classList.contains('video-icon')) {
        videoIcon.style.opacity = '1';
      }

      video.pause();
      video.currentTime = 0;
    });

    // Click to open in lightbox
    galleryItem.addEventListener('click', function () {
      const index = parseInt(this.getAttribute('data-index'));
      openLightbox(index);
    });
  });

  // Image click functionality
  const imageItems = document.querySelectorAll('.gallery-item img');
  imageItems.forEach(img => {
    const galleryItem = img.closest('.gallery-item');

    galleryItem.addEventListener('click', function () {
      const index = parseInt(this.getAttribute('data-index'));
      openLightbox(index);
    });
  });

  // Image load/error handling
  imageItems.forEach(img => {
    img.addEventListener('load', function () {
      this.style.opacity = '1';
    });

    img.addEventListener('error', function () {
      console.error('❌ Failed to load image:', this.src);
      this.style.opacity = '0.5';
      this.alt = 'Image failed to load';
      const galleryItem = this.closest('.gallery-item');
      if (galleryItem) {
        galleryItem.style.display = 'none';
      }
    });
  });
}

function filterGalleryItems(filterValue) {
  const galleryItems = document.querySelectorAll('.gallery-item');

  galleryItems.forEach(item => {
    const itemCategory = item.getAttribute('data-category');

    if (filterValue === 'all' || itemCategory === filterValue) {
      item.style.display = 'block';
      // Add fade-in animation
      setTimeout(() => {
        item.style.opacity = '1';
        item.style.transform = 'scale(1)';
      }, 50);
    } else {
      // Add fade-out animation
      item.style.opacity = '0';
      item.style.transform = 'scale(0.8)';
      setTimeout(() => {
        item.style.display = 'none';
      }, 300);
    }
  });
}

// ========== LIGHTBOX FUNCTIONALITY ==========
function initializeLightbox() {
  // Create lightbox HTML if it doesn't exist
  if (!document.getElementById('gallery-lightbox')) {
    const lightboxHTML = `
      <div class="lightbox" id="gallery-lightbox">
        <button class="lightbox-close" id="lightbox-close">
          <i class="fas fa-times"></i>
        </button>
        <div class="lightbox-nav">
          <button class="lightbox-prev" id="lightbox-prev">
            <i class="fas fa-chevron-left"></i>
          </button>
          <button class="lightbox-next" id="lightbox-next">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
        <div class="lightbox-content" id="lightbox-content">
          <!-- Content will be populated dynamically -->
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', lightboxHTML);

    // Add lightbox event listeners
    setupLightboxEvents();
  }
}

function setupLightboxEvents() {
  const lightbox = document.getElementById('gallery-lightbox');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');

  // Close lightbox
  closeBtn.addEventListener('click', closeLightbox);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });

  // Keyboard navigation
  document.addEventListener('keydown', handleLightboxKeyboard);

  // Navigation buttons
  prevBtn.addEventListener('click', showPreviousItem);
  nextBtn.addEventListener('click', showNextItem);
}

let currentLightboxIndex = 0;

function openLightbox(index) {
  currentLightboxIndex = index;
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxContent = document.getElementById('lightbox-content');

  // Get filtered items based on current filter
  const filteredItems = currentFilter === 'all'
    ? currentGalleryItems
    : currentGalleryItems.filter(item => item.category === currentFilter);

  const currentItem = filteredItems[index];

  if (currentItem.media_type === 'video') {
    lightboxContent.innerHTML = `
      <video controls autoplay muted loop playsinline>
        <source src="${currentItem.url}" type="video/mp4">
        Your browser does not support the video tag.
      </video>
    `;
  } else {
    lightboxContent.innerHTML = `
      <img src="${currentItem.url}" alt="${currentItem.category} cleaning service">
    `;
  }

  lightbox.classList.add('active');
  document.body.style.overflow = 'hidden';

  // Update navigation buttons state
  updateLightboxNavigation(filteredItems.length, index);
}

function closeLightbox() {
  const lightbox = document.getElementById('gallery-lightbox');
  const lightboxContent = document.getElementById('lightbox-content');

  // Stop video if playing
  const video = lightboxContent.querySelector('video');
  if (video) {
    video.pause();
    video.currentTime = 0;
  }

  lightbox.classList.remove('active');
  document.body.style.overflow = '';

  // Clear content after transition
  setTimeout(() => {
    lightboxContent.innerHTML = '';
  }, 300);
}

function showPreviousItem() {
  const filteredItems = currentFilter === 'all'
    ? currentGalleryItems
    : currentGalleryItems.filter(item => item.category === currentFilter);

  currentLightboxIndex = (currentLightboxIndex - 1 + filteredItems.length) % filteredItems.length;
  openLightbox(currentLightboxIndex);
}

function showNextItem() {
  const filteredItems = currentFilter === 'all'
    ? currentGalleryItems
    : currentGalleryItems.filter(item => item.category === currentFilter);

  currentLightboxIndex = (currentLightboxIndex + 1) % filteredItems.length;
  openLightbox(currentLightboxIndex);
}

function updateLightboxNavigation(totalItems, currentIndex) {
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');

  // Show/hide buttons based on item count
  if (totalItems <= 1) {
    prevBtn.style.display = 'none';
    nextBtn.style.display = 'none';
  } else {
    prevBtn.style.display = 'block';
    nextBtn.style.display = 'block';
  }
}

function handleLightboxKeyboard(e) {
  const lightbox = document.getElementById('gallery-lightbox');
  if (!lightbox.classList.contains('active')) return;

  switch (e.key) {
    case 'Escape':
      closeLightbox();
      break;
    case 'ArrowLeft':
      showPreviousItem();
      break;
    case 'ArrowRight':
      showNextItem();
      break;
  }
}

function showEmptyGalleryState(message = "We're preparing amazing content for you!") {
  const galleryGrid = document.querySelector('.gallery-grid');
  const loadingGallery = document.querySelector('.loading-gallery');

  if (loadingGallery) {
    loadingGallery.style.display = 'none';
  }

  if (galleryGrid) {
    galleryGrid.innerHTML = `
      <div class="empty-gallery-state">
        <i class="fas fa-images"></i>
        <h3>Gallery Coming Soon</h3>
        <p>${message}</p>
        <button class="btn-primary" onclick="loadGalleryItems()">
          <i class="fas fa-redo"></i> Try Again
        </button>
      </div>
    `;
  }
}

function initializeGallery() {
  const galleryGrid = document.querySelector('.gallery-grid');
  const loadingGallery = document.querySelector('.loading-gallery');

  console.log('🎨 Initializing gallery...');
  console.log('📁 Gallery grid:', galleryGrid);
  console.log('⏳ Loading gallery element:', loadingGallery);

  // If no gallery elements found at all, exit gracefully
  if (!galleryGrid && !loadingGallery) {
    console.log('ℹ️ No gallery section found on this page');
    return;
  }

  // Load gallery items from API
  loadGalleryItems();
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

  // Login Form Handler - ENHANCED WITH USER NOT FOUND HANDLING
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

        let errorMessage = error.response?.data?.message ||
          error.message ||
          'Login failed. Please check your credentials.';

        // Enhanced error handling for user not found
        if (error.response?.status === 404) {
          errorMessage = 'User not found. Please check your email or register for a new account.';
        } else if (error.response?.status === 401) {
          errorMessage = 'Invalid email or password. Please try again.';
        }

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

  // Forgot password link - UPDATED
  document.querySelector('.auth-forgot')?.addEventListener('click', function (e) {
    e.preventDefault();
    showForgotPasswordModal();
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
  console.log('🎨 Initializing gallery...');
  initializeGallery();

  function initializeServicesCarousel() {
    const track = document.querySelector('.home-services-bar');
    const cards = Array.from(document.querySelectorAll('.home-service-card'));
    const prevBtn = document.querySelector('.home-carousel-prev');
    const nextBtn = document.querySelector('.home-carousel-next');
    const progressBar = document.querySelector('.home-progress-bar');

    if (!track || cards.length === 0) {
      console.log('❌ No carousel elements found');
      return;
    }

    console.log(`🎠 Initializing carousel with ${cards.length} cards`);

    let currentPosition = 0;
    let autoScrollInterval;
    let isDragging = false;
    let startX = 0;
    let currentTranslate = 0;
    let prevTranslate = 0;

    // Get the actual card width including gap
    function getCardWidth() {
      if (cards.length === 0) return 0;
      const card = cards[0];
      const cardStyle = window.getComputedStyle(card);
      const gap = 32; // 2rem gap in pixels (matches your CSS)
      return card.offsetWidth + gap;
    }

    // Calculate how many cards can be visible at once
    function getVisibleCardsCount() {
      const container = track.parentElement;
      const cardWidth = getCardWidth();
      return Math.floor(container.offsetWidth / cardWidth);
    }

    // Calculate maximum scroll position
    function getMaxPosition() {
      const visibleCards = getVisibleCardsCount();
      return Math.max(0, cards.length - visibleCards);
    }

    // Update carousel position
    function updateCarousel() {
      const maxPosition = getMaxPosition();
      const cardWidth = getCardWidth();

      // Ensure current position is within bounds
      currentPosition = Math.max(0, Math.min(currentPosition, maxPosition));

      const translateX = -currentPosition * cardWidth;
      track.style.transform = `translateX(${translateX}px)`;

      console.log(`🔄 Carousel: position ${currentPosition}, translate ${translateX}px, max ${maxPosition}`);

      // Update progress bar
      if (progressBar) {
        const progress = maxPosition > 0 ? (currentPosition / maxPosition) * 100 : 100;
        progressBar.style.width = `${progress}%`;
      }

      // Update button states
      updateButtonStates();
    }
    function updateButtonStates() {
      const maxPosition = getMaxPosition();

      if (prevBtn) {
        prevBtn.style.opacity = currentPosition === 0 ? '0.5' : '1';
        prevBtn.disabled = currentPosition === 0;
      }

      if (nextBtn) {
        nextBtn.style.opacity = currentPosition >= maxPosition ? '0.5' : '1';
        nextBtn.disabled = currentPosition >= maxPosition;
      }
    }

    function nextSlide() {
      const maxPosition = getMaxPosition();
      if (currentPosition < maxPosition) {
        currentPosition++;
        updateCarousel();
      }
    }

    function prevSlide() {
      if (currentPosition > 0) {
        currentPosition--;
        updateCarousel();
      }
    }

    // Auto-scroll functionality
    function startAutoScroll() {
      stopAutoScroll();
      autoScrollInterval = setInterval(() => {
        const maxPosition = getMaxPosition();
        if (currentPosition < maxPosition) {
          nextSlide();
        } else {
          currentPosition = 0; // Loop back to start
          updateCarousel();
        }
      }, 2000); // Change slide every 2 seconds
    }

    function stopAutoScroll() {
      if (autoScrollInterval) {
        clearInterval(autoScrollInterval);
      }
    }

    // Drag functionality for touch devices
    function dragStart(e) {
      isDragging = true;
      stopAutoScroll();
      track.style.transition = 'none';

      if (e.type === 'touchstart') {
        startX = e.touches[0].clientX;
      } else {
        startX = e.clientX;
        e.preventDefault();
      }

      prevTranslate = currentPosition * getCardWidth();
    }

    function drag(e) {
      if (!isDragging) return;

      let currentX;
      if (e.type === 'touchmove') {
        currentX = e.touches[0].clientX;
      } else {
        currentX = e.clientX;
      }

      const diff = startX - currentX;
      currentTranslate = prevTranslate + diff;

      track.style.transform = `translateX(${-currentTranslate}px)`;
    }

    function dragEnd() {
      if (!isDragging) return;

      isDragging = false;
      track.style.transition = 'transform 0.6s ease';

      // Calculate new position based on drag
      const cardWidth = getCardWidth();
      const draggedPosition = Math.round(currentTranslate / cardWidth);
      const maxPosition = getMaxPosition();

      // Snap to nearest valid position
      currentPosition = Math.max(0, Math.min(maxPosition, draggedPosition));

      updateCarousel();
      startAutoScroll();
    }

    // Event listeners setup
    function setupEventListeners() {
      // Navigation buttons
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          stopAutoScroll();
          nextSlide();
          startAutoScroll();
        });
      }

      if (prevBtn) {
        prevBtn.addEventListener('click', () => {
          stopAutoScroll();
          prevSlide();
          startAutoScroll();
        });
      }

      // Drag events for touch devices
      track.addEventListener('touchstart', dragStart, { passive: false });
      track.addEventListener('touchmove', drag, { passive: false });
      track.addEventListener('touchend', dragEnd);

      // Mouse events for desktop dragging
      track.addEventListener('mousedown', dragStart);
      track.addEventListener('mousemove', drag);
      track.addEventListener('mouseup', dragEnd);
      track.addEventListener('mouseleave', dragEnd);

      // Auto-scroll control
      track.addEventListener('mouseenter', stopAutoScroll);
      track.addEventListener('mouseleave', startAutoScroll);

      // Keyboard navigation
      document.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          stopAutoScroll();
          prevSlide();
          startAutoScroll();
        } else if (e.key === 'ArrowRight') {
          stopAutoScroll();
          nextSlide();
          startAutoScroll();
        }
      });

      // Window resize handling
      window.addEventListener('resize', () => {
        updateCarousel();
      });
    }

    // Initialize the carousel
    function init() {
      updateCarousel();
      startAutoScroll();
      setupEventListeners();

      console.log('✅ Carousel initialized successfully');
    }

    // Start the carousel
    init();

    return {
      next: nextSlide,
      prev: prevSlide,
      stop: stopAutoScroll,
      start: startAutoScroll
    };
  }
  setTimeout(() => {
    initializeServicesCarousel();
  }, 1000);
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