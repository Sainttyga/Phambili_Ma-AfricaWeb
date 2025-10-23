// Enhanced Admin API Service with Request Throttling and Caching
class AdminAPIService {
    constructor() {
        this.baseURL = 'http://localhost:5000/api/admin';
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000;
        
        // Request throttling properties
        this.requestQueue = [];
        this.maxConcurrentRequests = 3;
        this.activeRequests = 0;
        this.requestDelay = 300; // Minimum delay between requests
        this.isPaused = false;
        
        // Cache properties
        this.cache = new Map();
        this.cacheTimeout = 30000; // 30 seconds cache for most data
        this.longCacheTimeout = 120000; // 2 minutes for static data
        
        // Rate limit tracking
        this.lastRequestTime = 0;
        this.rateLimitRemaining = 60;
        this.rateLimitResetTime = 0;
        
        // Performance metrics
        this.metrics = {
            totalRequests: 0,
            failedRequests: 0,
            cachedResponses: 0
        };
        
        console.log('🔄 AdminAPIService initialized with throttling and caching');
    }

    // ==================== REQUEST QUEUE MANAGEMENT ====================

    async enqueueRequest(method, endpoint, data = null, retry = true, useCache = false) {
        return new Promise((resolve, reject) => {
            // Check cache first for GET requests
            if (method === 'GET' && useCache) {
                const cacheKey = this.getCacheKey(method, endpoint, data);
                const cached = this.getFromCache(cacheKey);
                if (cached) {
                    this.metrics.cachedResponses++;
                    resolve(cached);
                    return;
                }
            }

            this.requestQueue.push({
                method,
                endpoint,
                data,
                retry,
                useCache,
                resolve,
                reject,
                timestamp: Date.now()
            });
            this.processQueue();
        });
    }

    async processQueue() {
        if (this.isPaused || 
            this.activeRequests >= this.maxConcurrentRequests || 
            this.requestQueue.length === 0) {
            return;
        }

        const now = Date.now();

        // Check rate limiting
        if (this.rateLimitRemaining <= 1 && now < this.rateLimitResetTime) {
            const waitTime = this.rateLimitResetTime - now;
            console.log(`⏳ Rate limit nearly exhausted. Waiting ${waitTime}ms`);
            setTimeout(() => this.processQueue(), waitTime + 1000);
            return;
        }

        // Ensure minimum delay between requests
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.requestDelay) {
            setTimeout(() => this.processQueue(), this.requestDelay - timeSinceLastRequest);
            return;
        }

        this.activeRequests++;
        const request = this.requestQueue.shift();

        // Remove stale requests (older than 30 seconds)
        if (now - request.timestamp > 30000) {
            console.log('🗑️ Removing stale request from queue');
            request.reject(new Error('Request timeout - took too long to process'));
            this.activeRequests--;
            this.processQueue();
            return;
        }

        try {
            const result = await this.executeRequest(
                request.method, 
                request.endpoint, 
                request.data, 
                request.retry
            );
            
            // Cache successful GET responses
            if (request.method === 'GET' && request.useCache && result) {
                const cacheKey = this.getCacheKey(request.method, request.endpoint, request.data);
                this.setCache(cacheKey, result);
            }
            
            request.resolve(result);
        } catch (error) {
            request.reject(error);
        } finally {
            this.activeRequests--;
            this.lastRequestTime = Date.now();
            // Process next request with a small delay
            setTimeout(() => this.processQueue(), 50);
        }
    }

    async executeRequest(method, endpoint, data = null, retry = true) {
        this.metrics.totalRequests++;
        
        try {
            console.log(`🔄 Making ${method} request to: ${endpoint}`);

            const config = {
                method,
                url: `${this.baseURL}${endpoint}`,
                headers: this.getAuthHeaders(),
                timeout: 15000,
                validateStatus: function (status) {
                    return status < 500; // Don't reject for 4xx errors
                }
            };

            if (data) {
                if (data instanceof FormData) {
                    delete config.headers['Content-Type'];
                    config.data = data;
                } else {
                    config.data = data;
                }
            }

            const response = await axios(config);
            
            // Update rate limit info from headers
            this.updateRateLimitInfo(response.headers);
            
            if (response.status >= 400) {
                throw this.createErrorFromResponse(response);
            }
            
            console.log(`✅ ${method} ${endpoint} successful`);
            this.retryCount = 0;
            return response.data;
        } catch (error) {
            this.metrics.failedRequests++;
            return this.handleRequestError(error, method, endpoint, data, retry);
        }
    }

    createErrorFromResponse(response) {
        const error = new Error(response.data?.message || `HTTP ${response.status}`);
        error.status = response.status;
        error.response = response;
        return error;
    }

    updateRateLimitInfo(headers) {
        if (headers['x-ratelimit-remaining']) {
            this.rateLimitRemaining = parseInt(headers['x-ratelimit-remaining']);
        }
        if (headers['x-ratelimit-reset']) {
            this.rateLimitResetTime = parseInt(headers['x-ratelimit-reset']) * 1000;
        }
        
        // Fallback: decrement if no headers
        if (this.rateLimitRemaining > 0) {
            this.rateLimitRemaining--;
        }
    }

    // ==================== CACHE MANAGEMENT ====================

    getCacheKey(method, endpoint, data) {
        const dataString = data ? JSON.stringify(data) : '';
        return `${method}:${endpoint}:${dataString}`;
    }

    getFromCache(cacheKey) {
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() < cached.expiry) {
            console.log(`📦 Using cached response for: ${cacheKey.split(':')[1]}`);
            return cached.data;
        }
        if (cached) {
            this.cache.delete(cacheKey);
        }
        return null;
    }

    setCache(cacheKey, data, customTimeout = null) {
        const timeout = customTimeout || this.getCacheTimeout(cacheKey);
        this.cache.set(cacheKey, {
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

    // ==================== ENHANCED REQUEST HANDLING ====================

    async makeRequest(method, endpoint, data = null, retry = true, useCache = false) {
        return this.enqueueRequest(method, endpoint, data, retry, useCache);
    }

    async handleRequestError(error, method, endpoint, data, retry) {
        console.error(`❌ API ${method} ${endpoint} failed:`, error);

        // Update rate limit info from error response
        if (error.response?.headers) {
            this.updateRateLimitInfo(error.response.headers);
        }

        // Handle rate limiting (429)
        if (error.response?.status === 429) {
            if (retry && this.retryCount < this.maxRetries) {
                this.retryCount++;
                const delay = this.retryDelay * Math.pow(2, this.retryCount - 1); // Exponential backoff
                console.log(`⏳ Rate limited. Retrying in ${delay}ms... (Attempt ${this.retryCount}/${this.maxRetries})`);

                await new Promise(resolve => setTimeout(resolve, delay));
                return this.executeRequest(method, endpoint, data, false);
            } else {
                throw new Error('Too many requests. Please try again later.');
            }
        }

        if (error.response?.status === 401) {
            console.error('Authentication failed');
            this.handleAuthError();
            throw new Error('Authentication failed. Please log in again.');
        }

        if (error.response?.status === 403) {
            throw new Error('Access denied. Admin privileges required.');
        }

        // Network errors - retry with backoff
        if (!error.response && retry && this.retryCount < this.maxRetries) {
            this.retryCount++;
            const delay = this.retryDelay * this.retryCount;
            console.log(`🌐 Network error. Retrying in ${delay}ms... (Attempt ${this.retryCount}/${this.maxRetries})`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.executeRequest(method, endpoint, data, false);
        }

        this.retryCount = 0;

        if (error.response?.data?.message) {
            throw new Error(error.response.data.message);
        }

        throw error;
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
        console.log(`🗑️ Cleared ${pending} pending requests`);
    }

    getQueueStatus() {
        return {
            queued: this.requestQueue.length,
            active: this.activeRequests,
            paused: this.isPaused,
            rateLimitRemaining: this.rateLimitRemaining
        };
    }

    getMetrics() {
        return {
            ...this.metrics,
            cacheSize: this.cache.size,
            cacheHitRate: this.metrics.totalRequests > 0 ? 
                (this.metrics.cachedResponses / this.metrics.totalRequests * 100).toFixed(1) + '%' : '0%'
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

    // ==================== API METHODS WITH OPTIMIZED CACHING ====================

    async testConnection() {
        return this.makeRequest('GET', '/test', null, true, false);
    }

    // Profile APIs - no caching
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

    // Dashboard APIs - cache for 30 seconds
    async getDashboardStats() {
        return this.makeRequest('GET', '/dashboard/stats', null, true, true);
    }

    async getBookingAnalytics(period = 'monthly') {
        return this.makeRequest('GET', `/dashboard/analytics?period=${period}`, null, true, true);
    }

    // Service Management - cache for 2 minutes
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

    // Product Management - cache for 2 minutes
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

    // Booking Management - no cache (frequently changing)
    async getBookings(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest('GET', `/bookings?${queryString}`, null, true, false);
    }

    async createBooking(bookingData) {
        this.clearCache('bookings');
        return this.makeRequest('POST', '/bookings', bookingData);
    }

    async updateBooking(id, bookingData) {
        this.clearCache('bookings');
        return this.makeRequest('PUT', `/bookings/${id}`, bookingData);
    }

    async deleteBooking(id) {
        this.clearCache('bookings');
        return this.makeRequest('DELETE', `/bookings/${id}`);
    }

    // Customer Management - no cache
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

    // Admin Management - cache for 2 minutes
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

    // Quotation Management - no cache
    async getQuotations(status = '') {
        const params = status ? { status } : {};
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest('GET', `/quotations?${queryString}`, null, true, false);
    }

    async getQuotationDetails(id) {
        return this.makeRequest('GET', `/quotations/${id}`, null, true, false);
    }

    async respondToQuotation(id, responseData) {
        this.clearCache('quotations');
        return this.makeRequest('POST', `/quotations/${id}/respond`, responseData);
    }

    // Order Management - cache for 30 seconds
    async getOrders() {
        return this.makeRequest('GET', '/orders', null, true, true);
    }

    // Report APIs - cache for 1 minute
    async getBookingSummary(startDate = '', endDate = '') {
        const params = {};
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
        const queryString = new URLSearchParams(params).toString();
        return this.makeRequest('GET', `/reports/booking-summary?${queryString}`, null, true, true);
    }

    async getRevenueReport(period = 'monthly') {
        return this.makeRequest('GET', `/reports/revenue?period=${period}`, null, true, true);
    }

    // System APIs - no cache
    async getSystemHealth() {
        return this.makeRequest('GET', '/system/health', null, true, false);
    }
}

// Initialize API service
window.adminAPI = new AdminAPIService();
console.log('✅ AdminAPI service initialized with throttling and caching');