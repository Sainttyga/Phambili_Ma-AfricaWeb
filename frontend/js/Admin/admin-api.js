// Enhanced Admin API Service with Proper Rate Limiting Handling
class AdminAPIService {
    constructor() {
        this.baseURL = 'http://localhost:5000/api';
        
        // Enhanced rate limiting properties
        this.rateLimitState = {
            remaining: 10,
            limit: 10,
            resetTime: 0,
            windowMs: 60000,
            lastRequest: 0
        };
        
        // Queue management
        this.requestQueue = [];
        this.activeRequests = 0;
        this.maxConcurrent = 2;
        this.minRequestInterval = 1000; // 1 second between requests
        this.isPaused = false;
        
        // Retry configuration
        this.retryConfig = {
            maxRetries: 3,
            baseDelay: 1000,
            maxDelay: 30000
        };
        
        // Cache for fallback data
        this.cache = new Map();
        this.cacheTimeout = 30000;
        this.longCacheTimeout = 120000;

        // Performance metrics
        this.metrics = {
            totalRequests: 0,
            failedRequests: 0,
            cachedResponses: 0,
            rateLimitedRequests: 0
        };

        // Upload tracking to prevent duplicates
        this.pendingUploads = new Map();

        console.log('🔄 AdminAPIService initialized with enhanced rate limiting');
    }

    // ==================== ENHANCED RATE LIMIT DETECTION ====================

    parseRateLimitHeaders(headers) {
        try {
            // Parse various rate limit header formats
            const rateLimitHeaders = {
                remaining: headers['x-ratelimit-remaining'] || 
                           headers['ratelimit-remaining'] ||
                           headers['x-rate-limit-remaining'],
                limit: headers['x-ratelimit-limit'] ||
                       headers['ratelimit-limit'] ||
                       headers['x-rate-limit-limit'],
                reset: headers['x-ratelimit-reset'] ||
                       headers['ratelimit-reset'] ||
                       headers['x-rate-limit-reset'] ||
                       headers['retry-after']
            };

            if (rateLimitHeaders.remaining !== undefined) {
                this.rateLimitState.remaining = parseInt(rateLimitHeaders.remaining);
            }

            if (rateLimitHeaders.limit !== undefined) {
                this.rateLimitState.limit = parseInt(rateLimitHeaders.limit);
            }

            if (rateLimitHeaders.reset) {
                const resetValue = parseInt(rateLimitHeaders.reset);
                // Handle both timestamp and seconds-until-reset formats
                if (resetValue > 1000000000) { // Likely a timestamp
                    this.rateLimitState.resetTime = resetValue * 1000; // Convert to ms if in seconds
                } else { // Seconds until reset
                    this.rateLimitState.resetTime = Date.now() + (resetValue * 1000);
                }
            }

            console.log(`📊 Rate Limit: ${this.rateLimitState.remaining}/${this.rateLimitState.limit}, Resets: ${new Date(this.rateLimitState.resetTime).toLocaleTimeString()}`);
            
        } catch (error) {
            console.warn('Failed to parse rate limit headers:', error);
        }
    }

    calculateRetryDelay(error, retryCount) {
        if (error.response?.status === 429) {
            const retryAfter = error.response.headers['retry-after'];
            if (retryAfter) {
                return parseInt(retryAfter) * 1000; // Use server-suggested delay
            }
            
            // Exponential backoff with jitter
            const exponentialDelay = this.retryConfig.baseDelay * Math.pow(2, retryCount);
            const jitter = Math.random() * 1000;
            return Math.min(exponentialDelay + jitter, this.retryConfig.maxDelay);
        }
        
        // For other errors, use exponential backoff
        return this.retryConfig.baseDelay * Math.pow(2, retryCount);
    }

    shouldThrottle() {
        const now = Date.now();
        
        // Check if we've exceeded rate limit
        if (this.rateLimitState.remaining <= 0) {
            if (now < this.rateLimitState.resetTime) {
                const waitTime = this.rateLimitState.resetTime - now;
                console.log(`⏳ Rate limit exceeded. Waiting ${Math.round(waitTime/1000)}s`);
                return waitTime;
            } else {
                // Reset period passed, reset counter
                this.rateLimitState.remaining = Math.floor(this.rateLimitState.limit / 2);
                this.rateLimitState.resetTime = now + this.rateLimitState.windowMs;
            }
        }
        
        // Enforce minimum interval between requests
        const timeSinceLast = now - this.rateLimitState.lastRequest;
        if (timeSinceLast < this.minRequestInterval) {
            return this.minRequestInterval - timeSinceLast;
        }
        
        return 0;
    }

    // ==================== IMPROVED QUEUE MANAGEMENT ====================

    async enqueueRequest(requestFn, requestId, useCache = false) {
        return new Promise((resolve, reject) => {
            // Check cache first
            if (useCache) {
                const cached = this.getFromCache(requestId);
                if (cached) {
                    this.metrics.cachedResponses++;
                    resolve(cached);
                    return;
                }
            }

            this.requestQueue.push({
                requestFn,
                requestId,
                resolve,
                reject,
                timestamp: Date.now(),
                retries: 0
            });

            console.log(`📨 Queued request: ${requestId} (Queue size: ${this.requestQueue.length})`);
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isPaused || 
            this.activeRequests >= this.maxConcurrent || 
            this.requestQueue.length === 0) {
            return;
        }

        const throttleDelay = this.shouldThrottle();
        if (throttleDelay > 0) {
            console.log(`⏸️ Throttling requests for ${Math.round(throttleDelay)}ms`);
            this.isPaused = true;
            setTimeout(() => {
                this.isPaused = false;
                this.processQueue();
            }, throttleDelay + 100);
            return;
        }

        this.activeRequests++;
        const request = this.requestQueue.shift();

        // Remove stale requests (older than 30 seconds)
        if (Date.now() - request.timestamp > 30000) {
            console.log('🗑️ Removing stale request from queue');
            request.reject(new Error('Request timeout - took too long to process'));
            this.activeRequests--;
            this.processQueue();
            return;
        }

        try {
            console.log(`🔄 Processing request: ${request.requestId}`);
            const result = await request.requestFn();
            
            // Cache successful responses
            if (request.requestId) {
                this.setCache(request.requestId, result);
            }
            
            request.resolve(result);
        } catch (error) {
            if (error.response?.status === 429 && request.retries < this.retryConfig.maxRetries) {
                // Re-queue with backoff
                request.retries++;
                const retryDelay = this.calculateRetryDelay(error, request.retries);
                
                console.log(`🔄 Rate limited. Requeuing in ${Math.round(retryDelay/1000)}s (Attempt ${request.retries})`);
                
                setTimeout(() => {
                    this.requestQueue.unshift(request);
                    this.activeRequests--;
                    this.processQueue();
                }, retryDelay);
                
                return;
            }
            
            request.reject(error);
        } finally {
            if (!this.isPaused) {
                this.activeRequests--;
                this.rateLimitState.lastRequest = Date.now();
                setTimeout(() => this.processQueue(), 100);
            }
        }
    }

    // ==================== ENHANCED REQUEST EXECUTION ====================

    async executeRequest(method, endpoint, data = null, retry = true) {
        this.metrics.totalRequests++;

        try {
            console.log(`🔄 Making ${method} request to: ${endpoint}`);

            const config = {
                method,
                url: `${this.baseURL}${endpoint}`,
                headers: this.getAuthHeaders(),
                timeout: 30000,
                validateStatus: function (status) {
                    return status < 500; // Don't reject for 4xx errors
                }
            };

            if (data) {
                if (data instanceof FormData) {
                    delete config.headers['Content-Type'];
                    config.data = data;
                    config.timeout = 60000;
                } else {
                    config.data = data;
                }
            }

            const response = await axios(config);

            // Update rate limit info from headers
            this.parseRateLimitHeaders(response.headers);

            if (response.status >= 400) {
                throw this.createErrorFromResponse(response);
            }

            console.log(`✅ ${method} ${endpoint} successful`);
            return response.data;
        } catch (error) {
            this.metrics.failedRequests++;
            throw error;
        }
    }

    // ==================== ENHANCED API METHODS ====================

    async makeRequest(method, endpoint, data = null, retry = true, useCache = false, isAdminRoute = true) {
        const fullEndpoint = isAdminRoute ? `/admin${endpoint}` : endpoint;
        const requestId = `${method}:${fullEndpoint}:${data ? JSON.stringify(data) : ''}`;
        
        const requestFn = async () => {
            return this.executeRequest(method, fullEndpoint, data, retry);
        };

        return this.enqueueRequest(requestFn, requestId, useCache && method === 'GET');
    }

    async getBookings(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest('GET', `/bookings?${queryString}`, null, true, false, false);
    }

    // ==================== ENHANCED UPLOAD HANDLING ====================

    async uploadGalleryMedia(formData) {
        const file = formData.get('media');
        if (!file) {
            throw new Error('No file selected for upload');
        }

        const uploadKey = `${file.name}-${file.size}-${file.lastModified}`;

        // Check if same file is already uploading
        if (this.pendingUploads.has(uploadKey)) {
            console.log('🔄 Skipping duplicate upload request');
            return this.pendingUploads.get(uploadKey);
        }

        try {
            const uploadPromise = this.makeRequest('POST', '/gallery/upload', formData, true, false, false);
            this.pendingUploads.set(uploadKey, uploadPromise);

            const result = await uploadPromise;
            return result;
        } finally {
            this.pendingUploads.delete(uploadKey);
        }
    }

    // ==================== CACHE MANAGEMENT ====================

    getFromCache(key) {
        const cached = this.cache.get(key);
        if (cached && Date.now() < cached.expiry) {
            console.log(`📦 Using cached response for: ${key.split(':')[1]}`);
            return cached.data;
        }
        if (cached) {
            this.cache.delete(key);
        }
        return null;
    }

    setCache(key, data, customTimeout = null) {
        const timeout = customTimeout || this.getCacheTimeout(key);
        this.cache.set(key, {
            data,
            expiry: Date.now() + timeout
        });

        // Limit cache size
        if (this.cache.size > 100) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
    }

    getCacheTimeout(cacheKey) {
        // Longer cache for static data
        if (cacheKey.includes('/services') || cacheKey.includes('/products')) {
            return this.longCacheTimeout;
        }
        return this.cacheTimeout;
    }

    clearCache(pattern = null) {
        if (pattern) {
            for (const key of this.cache.keys()) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                }
            }
            console.log(`🗑️ Cleared cache for: ${pattern}`);
        } else {
            this.cache.clear();
            console.log('🗑️ Cleared all cache');
        }
    }

    // ==================== ERROR HANDLING ====================

    createErrorFromResponse(response) {
        const error = new Error(response.data?.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.response = response;
        return error;
    }

    getEndpointDescription(endpoint) {
        const descriptions = {
            '/dashboard/stats': 'dashboard statistics',
            '/bookings': 'bookings data',
            '/services': 'services data',
            '/products': 'products data',
            '/customers': 'customers data',
            '/profile': 'admin profile',
            '/gallery/media': 'gallery media',
            '/gallery/upload': 'gallery upload',
            '/gallery/categories': 'gallery categories'
        };

        return descriptions[endpoint] || 'data';
    }

    // ==================== FALLBACK DATA ====================

    getMockBookings(limit = 5) {
        console.log('📋 Using mock bookings data');
        return {
            bookings: Array.from({ length: limit }, (_, i) => ({
                ID: i + 1,
                customer_name: `Customer ${i + 1}`,
                service_type: `Service ${(i % 3) + 1}`,
                status: ['pending', 'confirmed', 'completed'][i % 3],
                booking_date: new Date(Date.now() - i * 86400000).toISOString(),
                total_amount: (100 + i * 50).toFixed(2)
            })),
            total: limit,
            page: 1,
            limit: limit
        };
    }

    // ==================== AUTH METHODS ====================

    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (window.authManager && window.authManager.isAuthenticated()) {
            const token = window.authManager.token;
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            } else {
                this.handleAuthError();
            }
        }

        return headers;
    }

    handleAuthError() {
        console.error('Authentication error - redirecting to login');
        if (window.authManager) {
            window.authManager.logout();
        } else {
            window.location.href = 'login.html';
        }
    }

    // ==================== QUEUE MANAGEMENT ====================

    pauseRequests() {
        this.isPaused = true;
        console.log('⏸️ Requests paused');
    }

    resumeRequests() {
        this.isPaused = false;
        console.log('▶️ Requests resumed');
        this.processQueue();
    }

    clearQueue() {
        const pending = this.requestQueue.length;
        this.requestQueue = [];
        this.pendingUploads.clear();
        console.log(`🗑️ Cleared ${pending} pending requests`);
    }

    getQueueStatus() {
        return {
            queued: this.requestQueue.length,
            active: this.activeRequests,
            paused: this.isPaused,
            rateLimit: {
                remaining: this.rateLimitState.remaining,
                limit: this.rateLimitState.limit,
                resetTime: new Date(this.rateLimitState.resetTime).toLocaleTimeString()
            }
        };
    }

    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.cache.size,
            cacheHitRate: this.metrics.totalRequests > 0 ?
                (this.metrics.cachedResponses / this.metrics.totalRequests * 100).toFixed(1) + '%' : '0%',
            queueSize: this.requestQueue.length
        };
    }

    // ==================== GALLERY API METHODS ====================

    async getGalleryMedia(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest('GET', `/gallery/media?${queryString}`, null, true, false, false);
    }

    async deleteGalleryMedia(id) {
        return this.makeRequest('DELETE', `/gallery/media/${id}`, null, true, false, false);
    }

    async getGalleryCategories() {
        return this.makeRequest('GET', '/gallery/categories', null, true, false, false);
    }

    // ==================== PROFILE APIs ====================

    async getAdminProfile() {
        return this.makeRequest('GET', '/profile', null, true, false);
    }

    async updateAdminProfile(profileData) {
        this.clearCache('profile');
        return this.makeRequest('PUT', '/profile', profileData);
    }

    async checkPasswordStatus() {
        return this.makeRequest('GET', '/password-status', null, true, false);
    }

    async changePassword(passwordData) {
        return this.makeRequest('POST', '/reset-password', passwordData);
    }

    // ==================== DASHBOARD APIs ====================

    async getDashboardStats() {
        return this.makeRequest('GET', '/dashboard/stats', null, true, true);
    }

    async getBookingAnalytics(period = 'monthly') {
        return this.makeRequest('GET', `/dashboard/analytics?period=${period}`, null, true, true);
    }

    // ==================== SERVICE MANAGEMENT ====================

    async getServices() {
        return this.makeRequest('GET', '/services', null, true, true);
    }

    async createService(serviceData) {
        this.clearCache('services');
        return this.makeRequest('POST', '/services', serviceData);
    }

    async getServiceDetails(id) {
        return this.makeRequest('GET', `/services/${id}`, null, true, true);
    }

    async updateService(id, serviceData) {
        this.clearCache('services');
        return this.makeRequest('PUT', `/services/${id}`, serviceData);
    }

    async deleteService(id) {
        this.clearCache('services');
        return this.makeRequest('DELETE', `/services/${id}`);
    }

    async toggleServiceAvailability(id, isAvailable) {
        this.clearCache('services');
        return this.makeRequest('PATCH', `/services/${id}/availability`, { isAvailable });
    }

    // ==================== PRODUCT MANAGEMENT ====================

    async getProducts() {
        return this.makeRequest('GET', '/products', null, true, true);
    }

    async createProduct(productData) {
        this.clearCache('products');
        return this.makeRequest('POST', '/products', productData);
    }

    async getProductDetails(id) {
        return this.makeRequest('GET', `/products/${id}`, null, true, true);
    }

    async updateProduct(id, productData) {
        this.clearCache('products');
        return this.makeRequest('PUT', `/products/${id}`, productData);
    }

    async deleteProduct(id) {
        this.clearCache('products');
        return this.makeRequest('DELETE', `/products/${id}`);
    }

    async toggleProductAvailability(id, isAvailable) {
        this.clearCache('products');
        return this.makeRequest('PATCH', `/products/${id}/availability`, { isAvailable });
    }

    // ==================== BOOKING MANAGEMENT ====================

    async createBooking(bookingData) {
        this.clearCache('bookings');
        return this.makeRequest('POST', '/bookings', bookingData);
    }

    async getBookingDetails(id) {
        return this.makeRequest('GET', `/bookings/admin/${id}`, null, true, false, false);
    }

    async updateBooking(id, bookingData) {
        return this.makeRequest('PUT', `/bookings/admin/${id}`, bookingData, true, false, false);
    }

    async updateBookingStatus(id, statusData) {
        return this.makeRequest('PUT', `/bookings/admin/${id}/status`, statusData, true, false, false);
    }

    async updateBookingQuote(id, quoteData) {
        return this.makeRequest('PUT', `/bookings/admin/${id}/quote`, quoteData, true, false, false);
    }

    async deleteBooking(id) {
        this.clearCache('bookings');
        return this.makeRequest('DELETE', `/bookings/${id}`);
    }

    // ==================== CUSTOMER MANAGEMENT ====================

    async getCustomers(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest('GET', `/customers?${queryString}`, null, true, false);
    }

    async getCustomerDetails(id) {
        return this.makeRequest('GET', `/customers/${id}`, null, true, false);
    }

    async updateCustomer(id, customerData) {
        this.clearCache('customers');
        return this.makeRequest('PUT', `/customers/${id}`, customerData);
    }

    // ==================== ADMIN MANAGEMENT ====================

    async getAdmins() {
        return this.makeRequest('GET', '/admins', null, true, true);
    }

    async createAdmin(adminData) {
        this.clearCache('admins');
        return this.makeRequest('POST', '/admins', adminData);
    }

    async getAdminDetails(id) {
        return this.makeRequest('GET', `/admins/${id}`, null, true, true);
    }

    async updateAdmin(id, adminData) {
        this.clearCache('admins');
        return this.makeRequest('PUT', `/admins/${id}`, adminData);
    }

    async deleteAdmin(id) {
        this.clearCache('admins');
        return this.makeRequest('DELETE', `/admins/${id}`);
    }

    // ==================== ORDER MANAGEMENT ====================

    async getOrders() {
        return this.makeRequest('GET', '/orders', null, true, true);
    }

    // ==================== SYSTEM APIs ====================

    async getSystemHealth() {
        return this.makeRequest('GET', '/system/health', null, true, false);
    }

    // ==================== TEST CONNECTION ====================

    async testConnection() {
        return this.makeRequest('GET', '/test', null, true, false);
    }
}

// Enhanced dashboard integration
class EnhancedAdminDashboard {
    constructor() {
        this.api = new AdminAPIService();
        this.isOnline = true;
        this.retryAttempts = 0;
        this.maxRetryAttempts = 2;
    }

    async loadRecentBookings(limit = 5) {
        try {
            console.log('🔄 Loading recent bookings...');
            const bookingsData = await this.api.getBookings({ limit });
            this.retryAttempts = 0;
            this.renderBookings(bookingsData.bookings);
            return bookingsData;
            
        } catch (error) {
            console.error('❌ Failed to load bookings:', error);
            
            if (error.response?.status === 429) {
                this.handleRateLimitError(error);
            }
            
            // Use mock data as fallback
            const mockBookings = this.api.getMockBookings(limit);
            this.renderBookings(mockBookings.bookings);
            
            // Show user-friendly message
            this.showNotification(
                'Using demo data. Real data will load when rate limit resets.', 
                'warning'
            );
            
            return mockBookings;
        }
    }

    handleRateLimitError(error) {
        const retryAfter = error.response?.headers['retry-after'];
        let resetTime = 'soon';
        
        if (retryAfter) {
            const resetDate = new Date(Date.now() + (parseInt(retryAfter) * 1000));
            resetTime = resetDate.toLocaleTimeString();
        }
        
        console.warn(`⏳ Rate limit exceeded. Resets at ${resetTime}`);
        
        // Implement exponential backoff for dashboard
        if (this.retryAttempts < this.maxRetryAttempts) {
            this.retryAttempts++;
            const backoffDelay = Math.min(1000 * Math.pow(2, this.retryAttempts), 30000);
            
            setTimeout(() => {
                this.loadRecentBookings();
            }, backoffDelay);
        }
    }

    renderBookings(bookings) {
        console.log('📊 Rendering bookings:', bookings);
        
        // Update UI with bookings data
        const container = document.getElementById('recent-bookings-container');
        if (container) {
            container.innerHTML = bookings.map(booking => `
                <div class="booking-card">
                    <h4>${booking.customer_name}</h4>
                    <p>Service: ${booking.service_type}</p>
                    <p>Status: <span class="status-${booking.status}">${booking.status}</span></p>
                    <p>Amount: $${booking.total_amount}</p>
                </div>
            `).join('');
        }
    }

    showNotification(message, type = 'info') {
        console.log(`📢 ${type.toUpperCase()}: ${message}`);
        
        // Example: Show toast notification
        if (window.showToast) {
            window.showToast(message, type);
        }
    }

    // Monitor API health
    startHealthCheck() {
        setInterval(async () => {
            try {
                const status = this.api.getQueueStatus();
                console.log('🔍 API Status:', status);
                
                // If we have rate limit remaining, try to fetch fresh data
                if (status.rateLimit.remaining > 3 && !this.api.isPaused) {
                    await this.loadRecentBookings();
                }
            } catch (error) {
                console.warn('Health check failed:', error);
            }
        }, 30000);
    }
}

// Initialize enhanced dashboard
document.addEventListener('DOMContentLoaded', function() {
    window.enhancedDashboard = new EnhancedAdminDashboard();
    window.enhancedDashboard.loadRecentBookings();
    window.enhancedDashboard.startHealthCheck();
    
    // Export API for debugging
    window.apiDebug = {
        getStatus: () => window.enhancedDashboard.api.getQueueStatus(),
        pause: () => window.enhancedDashboard.api.pauseRequests(),
        resume: () => window.enhancedDashboard.api.resumeRequests(),
        clearQueue: () => window.enhancedDashboard.api.clearQueue(),
        getMetrics: () => window.enhancedDashboard.api.getMetrics()
    };
});

// Initialize API service
window.adminAPI = new AdminAPIService();
console.log('✅ AdminAPI service initialized with enhanced rate limiting');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AdminAPIService, EnhancedAdminDashboard };
}