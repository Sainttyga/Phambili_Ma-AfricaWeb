// Enhanced Admin API Service with Proper Rate Limiting Handling
class AdminAPIService {
    constructor() {
        this.baseURL = 'http://localhost:5000/api';
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000;

        // Request throttling properties
        this.requestQueue = [];
        this.maxConcurrentRequests = 2; // Reduced from 3
        this.activeRequests = 0;
        this.requestDelay = 1000; // Increased from 300ms
        this.isPaused = false;

        // Cache properties
        this.cache = new Map();
        this.cacheTimeout = 30000;
        this.longCacheTimeout = 120000;

        // Enhanced Rate limit tracking
        this.lastRequestTime = 0;
        this.rateLimitRemaining = 10; // Conservative default
        this.rateLimitResetTime = 0;
        this.rateLimitWindow = 60000; // 1 minute window

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

    // ==================== ENHANCED RATE LIMIT MANAGEMENT ====================

    updateRateLimitInfo(headers) {
        try {
            // Handle various rate limit header formats
            const remaining = headers['x-ratelimit-remaining'] || 
                             headers['ratelimit-remaining'] ||
                             headers['x-rate-limit-remaining'];
            
            const reset = headers['x-ratelimit-reset'] || 
                          headers['ratelimit-reset'] ||
                          headers['x-rate-limit-reset'] ||
                          headers['retry-after'];

            if (remaining !== undefined && remaining !== null) {
                this.rateLimitRemaining = parseInt(remaining);
                console.log(`📊 Rate limit remaining: ${this.rateLimitRemaining}`);
            }
            
            if (reset) {
                // Handle both timestamp (ms) and seconds formats
                if (reset.length > 10) {
                    // Assume timestamp in milliseconds
                    this.rateLimitResetTime = parseInt(reset);
                } else {
                    // Assume seconds until reset
                    this.rateLimitResetTime = Date.now() + (parseInt(reset) * 1000);
                }
                console.log(`🕒 Rate limit resets at: ${new Date(this.rateLimitResetTime).toLocaleTimeString()}`);
            }

            // Fallback: conservative decrement if no headers
            if (this.rateLimitRemaining > 0 && !remaining) {
                this.rateLimitRemaining--;
            }

        } catch (error) {
            console.warn('Error updating rate limit info:', error);
            // Conservative fallback
            if (this.rateLimitRemaining > 0) {
                this.rateLimitRemaining--;
            }
        }
    }

    shouldThrottleRequest() {
        const now = Date.now();
        
        // Check if we've hit the rate limit
        if (this.rateLimitRemaining <= 0) {
            if (now < this.rateLimitResetTime) {
                const waitTime = this.rateLimitResetTime - now;
                console.log(`⏳ Rate limit exhausted. Waiting ${Math.round(waitTime/1000)}s`);
                return waitTime;
            } else {
                // Reset period passed, reset counter conservatively
                this.rateLimitRemaining = 5;
                this.rateLimitResetTime = now + this.rateLimitWindow;
            }
        }

        // Check minimum delay between requests
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.requestDelay) {
            return this.requestDelay - timeSinceLastRequest;
        }

        return 0; // No throttling needed
    }

    // ==================== ENHANCED REQUEST QUEUE MANAGEMENT ====================

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
                timestamp: Date.now(),
                id: Math.random().toString(36).substr(2, 9) // Unique ID for tracking
            });
            
            console.log(`📨 Queued request: ${method} ${endpoint} (Queue size: ${this.requestQueue.length})`);
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

        // Check if we should throttle this request
        const throttleTime = this.shouldThrottleRequest();
        if (throttleTime > 0) {
            console.log(`⏸️ Throttling requests for ${Math.round(throttleTime)}ms`);
            this.isPaused = true;
            setTimeout(() => {
                this.isPaused = false;
                this.processQueue();
            }, throttleTime + 100); // Small buffer
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
            console.log(`🔄 Processing: ${request.method} ${request.endpoint}`);
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
            setTimeout(() => this.processQueue(), 100);
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
                timeout: 30000, // Increased timeout
                validateStatus: function (status) {
                    return status < 500; // Don't reject for 4xx errors
                }
            };

            if (data) {
                if (data instanceof FormData) {
                    delete config.headers['Content-Type'];
                    config.data = data;
                    // Add timeout for uploads
                    config.timeout = 60000;
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

    // ==================== ENHANCED ERROR HANDLING ====================

    async handleRequestError(error, method, endpoint, data, retry) {
        console.error(`❌ API ${method} ${endpoint} failed:`, error);

        // Update rate limit info from error response
        if (error.response?.headers) {
            this.updateRateLimitInfo(error.response.headers);
        }

        // Enhanced rate limiting handling
        if (error.response?.status === 429) {
            this.metrics.rateLimitedRequests++;
            
            const retryAfter = error.response.headers['retry-after'];
            let delay = this.retryDelay;
            
            // Use server-suggested delay if available
            if (retryAfter) {
                delay = parseInt(retryAfter) * 1000; // Convert to milliseconds
                console.log(`⏳ Server suggested retry after: ${retryAfter} seconds`);
            } else {
                // Exponential backoff with jitter
                delay = this.retryDelay * Math.pow(2, this.retryCount) + Math.random() * 1000;
            }
            
            if (retry && this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`⏳ Rate limited. Retrying in ${Math.round(delay/1000)}s... (Attempt ${this.retryCount}/${this.maxRetries})`);

                // Pause the queue during retry delay
                this.isPaused = true;
                await new Promise(resolve => setTimeout(resolve, delay));
                this.isPaused = false;
                
                return this.executeRequest(method, endpoint, data, false);
            } else {
                const resetTime = this.rateLimitResetTime ? 
                    new Date(this.rateLimitResetTime).toLocaleTimeString() : 'soon';
                throw new Error(`Too many requests. Rate limit resets at ${resetTime}. Please try again later.`);
            }
        }

        // Create proper error message
        let errorMessage = `Error fetching ${this.getEndpointDescription(endpoint)}`;

        if (error.response?.status === 500) {
            errorMessage = `Server error while fetching ${this.getEndpointDescription(endpoint)}`;
        } else if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
        } else if (error.message) {
            errorMessage = error.message;
        }

        const enhancedError = new Error(errorMessage);
        enhancedError.status = error.response?.status;
        enhancedError.originalError = error;

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
        throw enhancedError;
    }

    // ==================== ENHANCED UPLOAD HANDLING ====================

    async uploadGalleryMedia(formData) {
        // Create a unique key for this upload to prevent duplicates
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

    async makeRequest(method, endpoint, data = null, retry = true, useCache = false, isAdminRoute = true) {
        // For gallery routes, don't use /api/admin prefix
        const fullEndpoint = isAdminRoute ? `/admin${endpoint}` : endpoint;
        return this.enqueueRequest(method, fullEndpoint, data, retry, useCache);
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
            rateLimitRemaining: this.rateLimitRemaining,
            rateLimitResetTime: this.rateLimitResetTime
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

// Initialize API service
window.adminAPI = new AdminAPIService();
console.log('✅ AdminAPI service initialized with enhanced rate limiting');

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminAPIService;
}