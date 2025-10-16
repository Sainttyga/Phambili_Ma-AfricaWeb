// Admin API Service - Updated to use Axios
class AdminAPIService {
    constructor() {
        this.baseURL = 'http://localhost:5000/api/admin';
    }

    getAuthHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };

        // Use authManager instead of localStorage directly
        if (window.authManager && window.authManager.isAuthenticated()) {
            headers['Authorization'] = `Bearer ${window.authManager.token}`;
        }

        return headers;
    }

    // ==================== AUTH & PROFILE APIs ====================

    async getAdminProfile() {
        console.log('Making API call to get admin profile...');
        try {
            const response = await axios.get(`${this.baseURL}/profile`, {
                headers: this.getAuthHeaders()
            });
            console.log('Admin profile API response:', response.data);
            return response.data;
        } catch (error) {
            console.error('Admin profile API error:', error);
            throw error;
        }
    }

    async updateAdminProfile(profileData) {
        console.log('Updating admin profile with:', profileData);
        try {
            const response = await axios.put(`${this.baseURL}/profile`, profileData, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Update admin profile error:', error);
            throw error;
        }
    }

    async checkPasswordStatus() {
        try {
            const response = await axios.get(`${this.baseURL}/password-status`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Password status check error:', error);
            throw error;
        }
    }

    async changePassword(passwordData) {
        try {
            const response = await axios.post(`${this.baseURL}/reset-password`, passwordData, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Change password error:', error);
            throw error;
        }
    }

    // ==================== DASHBOARD APIs ====================

    async getDashboardStats() {
        try {
            const response = await axios.get(`${this.baseURL}/dashboard/stats`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Dashboard stats error:', error);
            throw error;
        }
    }

    async getBookingAnalytics(period = 'monthly') {
        try {
            const response = await axios.get(`${this.baseURL}/dashboard/analytics`, {
                params: { period },
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Booking analytics error:', error);
            throw error;
        }
    }

    // ==================== BOOKINGS APIs ====================

    async getBookings(params = {}) {
        try {
            const response = await axios.get(`${this.baseURL}/bookings`, {
                params: params,
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get bookings error:', error);
            throw error;
        }
    }

    async createBooking(bookingData) {
        try {
            const response = await axios.post(`${this.baseURL}/bookings`, bookingData, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Create booking error:', error);
            throw error;
        }
    }

    async updateBooking(id, bookingData) {
        try {
            const response = await axios.put(`${this.baseURL}/bookings/${id}`, bookingData, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Update booking error:', error);
            throw error;
        }
    }

    async deleteBooking(id) {
        try {
            const response = await axios.delete(`${this.baseURL}/bookings/${id}`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Delete booking error:', error);
            throw error;
        }
    }

    // ==================== CUSTOMERS APIs ====================

    async getCustomers(params = {}) {
        try {
            const response = await axios.get(`${this.baseURL}/customers`, {
                params: params,
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get customers error:', error);
            throw error;
        }
    }

    async getCustomerDetails(id) {
        try {
            const response = await axios.get(`${this.baseURL}/customers/${id}`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get customer details error:', error);
            throw error;
        }
    }

    async updateCustomer(id, customerData) {
        try {
            const response = await axios.put(`${this.baseURL}/customers/${id}`, customerData, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Update customer error:', error);
            throw error;
        }
    }

    // ==================== SERVICES APIs ====================

    async getServices() {
        try {
            const response = await axios.get(`${this.baseURL}/services`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get services error:', error);
            throw error;
        }
    }

    async createService(serviceData) {
        try {
            const response = await axios.post(`${this.baseURL}/services`, serviceData, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Create service error:', error);
            throw error;
        }
    }
    async createService(formData) {
    try {
        console.log('🔄 Sending service creation request...');
        const response = await axios.post(`${this.baseURL}/admin/services`, formData, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'multipart/form-data'
            },
            timeout: 30000 // 30 second timeout
        });
        console.log('✅ Service creation response:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Service creation API error:', error);
        throw error;
    }
}

    async updateService(id, serviceData) {
        try {
            const response = await axios.put(`${this.baseURL}/services/${id}`, serviceData, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Update service error:', error);
            throw error;
        }
    }

    async deleteService(id) {
        try {
            const response = await axios.delete(`${this.baseURL}/services/${id}`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Delete service error:', error);
            throw error;
        }
    }

    async getServiceDetails(id) {
        try {
            const response = await axios.get(`${this.baseURL}/services/${id}`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get service details error:', error);
            throw error;
        }
    }

    // ==================== PRODUCTS APIs ====================

    async getProducts() {
        try {
            const response = await axios.get(`${this.baseURL}/products`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get products error:', error);
            throw error;
        }
    }

    async getProductDetails(id) {
        try {
            const response = await axios.get(`${this.baseURL}/products/${id}`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get product details error:', error);
            throw error;
        }
    }

    // ==================== QUOTATIONS APIs ====================

    async getQuotations(status = '') {
        try {
            const params = status ? { status } : {};
            const response = await axios.get(`${this.baseURL}/quotations`, {
                params: params,
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get quotations error:', error);
            throw error;
        }
    }

    async getQuotationDetails(id) {
        try {
            const response = await axios.get(`${this.baseURL}/quotations/${id}`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get quotation details error:', error);
            throw error;
        }
    }

    async respondToQuotation(id, responseData) {
        try {
            const response = await axios.post(`${this.baseURL}/quotations/${id}/respond`, responseData, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Respond to quotation error:', error);
            throw error;
        }
    }

    // ==================== REPORTS APIs ====================

    async getBookingSummary(startDate = '', endDate = '') {
        try {
            const params = {};
            if (startDate) params.startDate = startDate;
            if (endDate) params.endDate = endDate;

            const response = await axios.get(`${this.baseURL}/reports/booking-summary`, {
                params: params,
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get booking summary error:', error);
            throw error;
        }
    }

    async getRevenueReport(period = 'monthly') {
        try {
            const response = await axios.get(`${this.baseURL}/reports/revenue`, {
                params: { period },
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get revenue report error:', error);
            throw error;
        }
    }

    // ==================== ORDERS APIs ====================

    async getOrders() {
        try {
            const response = await axios.get(`${this.baseURL}/orders`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get orders error:', error);
            throw error;
        }
    }

    // ==================== ADMIN MANAGEMENT APIs ====================

    async createAdmin(adminData) {
        try {
            const response = await axios.post(`${this.baseURL}/admins`, adminData, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Create admin error:', error);
            throw error;
        }
    }

    async getAdmins() {
        try {
            const response = await axios.get(`${this.baseURL}/admins`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get admins error:', error);
            throw error;
        }
    }

    async getAdminDetails(id) {
        try {
            const response = await axios.get(`${this.baseURL}/admins/${id}`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get admin details error:', error);
            throw error;
        }
    }

    async updateAdmin(id, adminData) {
        try {
            const response = await axios.put(`${this.baseURL}/admins/${id}`, adminData, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Update admin error:', error);
            throw error;
        }
    }

    async deleteAdmin(id) {
        try {
            const response = await axios.delete(`${this.baseURL}/admins/${id}`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Delete admin error:', error);
            throw error;
        }
    }

    // ==================== SYSTEM APIs ====================

    async getSystemHealth() {
        try {
            const response = await axios.get(`${this.baseURL}/system/health`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get system health error:', error);
            throw error;
        }
    }

    // ==================== BULK OPERATIONS ====================

    async sendBulkReminders() {
        try {
            const response = await axios.post(`${this.baseURL}/bulk-reminders`, {}, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Send bulk reminders error:', error);
            throw error;
        }
    }

    // ==================== PRODUCT MANAGEMENT APIs ====================

    async createProduct(productData) {
        try {
            const response = await axios.post(`${this.baseURL}/products`, productData, {
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Create product error:', error);
            throw error;
        }
    }

    async getProducts() {
        try {
            const response = await axios.get(`${this.baseURL}/products`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get products error:', error);
            throw error;
        }
    }

    async updateProduct(id, productData) {
        try {
            const response = await axios.put(`${this.baseURL}/products/${id}`, productData, {
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Update product error:', error);
            throw error;
        }
    }

    async deleteProduct(id) {
        try {
            const response = await axios.delete(`${this.baseURL}/products/${id}`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Delete product error:', error);
            throw error;
        }
    }

    async toggleProductAvailability(id, isAvailable) {
        try {
            const response = await axios.patch(`${this.baseURL}/products/${id}/availability`, {
                isAvailable
            }, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Toggle product availability error:', error);
            throw error;
        }
    }

    // ==================== SERVICE MANAGEMENT APIs ====================

    async createService(serviceData) {
        try {
            const response = await axios.post(`${this.baseURL}/services`, serviceData, {
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Create service error:', error);
            throw error;
        }
    }

    async getServices() {
        try {
            const response = await axios.get(`${this.baseURL}/services`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Get services error:', error);
            throw error;
        }
    }

    async updateService(id, serviceData) {
        try {
            const response = await axios.put(`${this.baseURL}/services/${id}`, serviceData, {
                headers: {
                    ...this.getAuthHeaders(),
                    'Content-Type': 'multipart/form-data'
                }
            });
            return response.data;
        } catch (error) {
            console.error('Update service error:', error);
            throw error;
        }
    }

    async deleteService(id) {
        try {
            const response = await axios.delete(`${this.baseURL}/services/${id}`, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Delete service error:', error);
            throw error;
        }
    }

    async toggleServiceAvailability(id, isAvailable) {
        try {
            const response = await axios.patch(`${this.baseURL}/services/${id}/availability`, {
                isAvailable
            }, {
                headers: this.getAuthHeaders()
            });
            return response.data;
        } catch (error) {
            console.error('Toggle service availability error:', error);
            throw error;
        }
    }
}

// Initialize API service and make it globally available
window.adminAPI = new AdminAPIService();
console.log('AdminAPI service initialized and available as window.adminAPI');