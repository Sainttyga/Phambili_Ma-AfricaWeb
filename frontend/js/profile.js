// profile.js - Complete updated version with modern notifications throughout
class ProfileManager {
    constructor() {
        // Check authentication first
        if (!this.checkAuthentication()) {
            return;
        }
        
        // Check if this is an admin trying to access customer profile
        if (authManager.userType === 'admin') {
            this.redirectToAdminDashboard();
            return;
        }
        
        this.user = authManager.getUser();
        this.isEditing = false;
        this.currentEditingSection = null;
        this.init();
    }

    checkAuthentication() {
        if (typeof authManager === 'undefined') {
            console.error('AuthManager not found.');
            this.redirectToLogin();
            return false;
        }
        
        if (!authManager.isAuthenticated()) {
            console.log('User not authenticated, redirecting to login');
            this.redirectToLogin();
            return false;
        }
        
        return true;
    }

    redirectToLogin() {
        // Store current URL for return after login
        localStorage.setItem('returnUrl', window.location.href);
        window.location.href = 'login.html';
    }

    redirectToAdminDashboard() {
        this.showError('Admins should use the admin dashboard for profile management.');
        setTimeout(() => {
            window.location.href = 'admin-dashboard.html';
        }, 2000);
        return;
    }

    async init() {
        await this.loadUserData();
        await this.loadBookingHistory();
        this.setupEventListeners();
        this.setupEditHandlers();
        this.setupBookingHistoryListeners();
    }

    async loadUserData() {
        try {
            this.showLoading('Loading profile...');

            const response = await axios.get('http://localhost:5000/api/customer/profile', {
                headers: authManager.getAuthHeaders()
            });

            if (response.data) {
                this.user = response.data;
                authManager.user = this.user;
                localStorage.setItem('user', JSON.stringify(this.user));
                this.updateProfileDisplay();
                this.showSuccess('Profile loaded successfully!');
            } else {
                throw new Error('No user data received');
            }

        } catch (error) {
            console.error('Error loading user data:', error);

            if (this.user && Object.keys(this.user).length > 0) {
                this.updateProfileDisplay();
                this.showInfo('Using cached profile data');
            } else {
                this.showError('Failed to load profile data');
                setTimeout(() => this.redirectToLogin(), 2000);
            }
        } finally {
            this.hideLoading();
        }
    }

    updateProfileDisplay() {
        if (!this.user) {
            console.error('No user data available');
            return;
        }

        // Update profile header
        document.getElementById('profile-fullname').textContent = this.user.Full_Name || 'User';
        document.getElementById('profile-email').textContent = this.user.Email || 'No email';
        document.getElementById('profile-role').textContent = authManager.role === 'admin' ? 'Administrator' : 'Customer';

        // Update personal information
        document.getElementById('info-fullname').textContent = this.user.Full_Name || 'Not set';
        document.getElementById('info-email').textContent = this.user.Email || 'Not set';
        document.getElementById('info-phone').textContent = this.user.Phone || 'Not set';

        // Format join date
        const joinDate = this.user.Created_At || this.user.createdAt || this.user.created_at;
        document.getElementById('info-join-date').textContent = joinDate ? new Date(joinDate).toLocaleDateString() : 'Unknown';

        // Update address information
        document.getElementById('info-address').textContent = this.user.Address || 'Not set';
        document.getElementById('info-city').textContent = this.user.City || 'Not set';
        document.getElementById('info-state').textContent = this.user.State || 'Not set';
        document.getElementById('info-zip').textContent = this.user.ZipCode || this.user.ZIP_Code || this.user.ZIP || 'Not set';
    }

    setupEventListeners() {
        // Change password modal
        const changePasswordBtn = document.querySelector('.change-password-btn');
        if (changePasswordBtn) {
            changePasswordBtn.addEventListener('click', () => {
                this.openPasswordModal();
            });
        }

        const cancelPasswordBtn = document.querySelector('.cancel-password');
        if (cancelPasswordBtn) {
            cancelPasswordBtn.addEventListener('click', () => {
                this.closePasswordModal();
            });
        }

        const modalCloseBtn = document.querySelector('.modal-close');
        if (modalCloseBtn) {
            modalCloseBtn.addEventListener('click', () => {
                this.closePasswordModal();
            });
        }

        const passwordForm = document.getElementById('change-password-form');
        if (passwordForm) {
            passwordForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.changePassword();
            });
        }

        // Close modal when clicking outside
        const passwordModal = document.getElementById('password-modal');
        if (passwordModal) {
            passwordModal.addEventListener('click', (e) => {
                if (e.target === passwordModal) {
                    this.closePasswordModal();
                }
            });
        }

        // Notification and privacy buttons
        const notificationBtn = document.querySelector('.notification-btn');
        if (notificationBtn) {
            notificationBtn.addEventListener('click', () => {
                this.showComingSoon('Notification preferences');
            });
        }

        const privacyBtn = document.querySelector('.privacy-btn');
        if (privacyBtn) {
            privacyBtn.addEventListener('click', () => {
                this.showComingSoon('Privacy settings');
            });
        }
    }

    setupEditHandlers() {
        // Edit section buttons
        document.querySelectorAll('.edit-section-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.closest('.edit-section-btn').dataset.section;
                this.startEditing(section);
            });
        });

        // Cancel edit buttons
        document.querySelectorAll('.cancel-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const section = e.target.closest('.profile-section').id;
                this.cancelEditing(section);
            });
        });

        // Save edit buttons
        document.querySelectorAll('.save-edit').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const section = e.target.closest('.profile-section').id;
                await this.saveChanges(section);
            });
        });
    }

    startEditing(section) {
        if (this.isEditing) {
            this.showError('Please finish editing the current section first.');
            return;
        }

        this.currentEditingSection = section;
        this.isEditing = true;

        const sectionElement = document.getElementById(section);
        const editBtn = sectionElement.querySelector('.edit-section-btn');
        const actions = sectionElement.querySelector('.section-actions');

        if (editBtn) editBtn.style.display = 'none';
        if (actions) actions.style.display = 'flex';

        const inputs = sectionElement.querySelectorAll('.edit-input');
        const displays = sectionElement.querySelectorAll('.info-item p');

        displays.forEach(display => {
            if (!display.id.includes('join-date')) {
                display.style.display = 'none';
            }
        });

        inputs.forEach(input => {
            input.style.display = 'block';
            const displayId = input.id.replace('edit-', 'info-');
            const displayElement = document.getElementById(displayId);
            if (displayElement) {
                input.value = displayElement.textContent !== 'Not set' ? displayElement.textContent : '';
            }
        });
    }

    cancelEditing(section) {
        const sectionElement = document.getElementById(section);
        const editBtn = sectionElement.querySelector('.edit-section-btn');
        const actions = sectionElement.querySelector('.section-actions');
        const inputs = sectionElement.querySelectorAll('.edit-input');
        const displays = sectionElement.querySelectorAll('.info-item p');

        if (editBtn) editBtn.style.display = 'flex';
        if (actions) actions.style.display = 'none';

        displays.forEach(display => {
            display.style.display = 'block';
        });

        inputs.forEach(input => {
            input.style.display = 'none';
        });

        this.isEditing = false;
        this.currentEditingSection = null;
        this.showInfo('Editing cancelled');
    }

    async saveChanges(section) {
        try {
            this.showLoading('Saving changes...');

            const updatedData = {};

            if (section === 'personal-info') {
                updatedData.Full_Name = document.getElementById('edit-fullname').value.trim();
                updatedData.Email = document.getElementById('edit-email').value.trim();
                updatedData.Phone = document.getElementById('edit-phone').value.trim();

                if (!updatedData.Full_Name) {
                    throw new Error('Full name is required');
                }
                if (!updatedData.Email) {
                    throw new Error('Email is required');
                }
                if (!this.isValidEmail(updatedData.Email)) {
                    throw new Error('Please enter a valid email address');
                }

            } else if (section === 'address-info') {
                updatedData.Address = document.getElementById('edit-address').value.trim();
                updatedData.City = document.getElementById('edit-city').value.trim();
                updatedData.State = document.getElementById('edit-state').value.trim();
                updatedData.ZIP_Code = document.getElementById('edit-zip').value.trim();
            }

            await this.updateUserProfile(updatedData);
            this.updateLocalDisplay(section, updatedData);
            this.cancelEditing(section);
            this.showSuccess('Profile updated successfully!');

        } catch (error) {
            console.error('Error saving changes:', error);
            this.showError(error.message || 'Failed to update profile. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    async updateUserProfile(updatedData) {
        try {
            const response = await axios.put(
                'http://localhost:5000/api/customer/profile',
                updatedData,
                {
                    headers: authManager.getAuthHeaders()
                }
            );

            if (response.data) {
                Object.assign(this.user, updatedData);
                authManager.user = this.user;
                localStorage.setItem('user', JSON.stringify(this.user));
                return response.data;
            }
        } catch (error) {
            const errorMessage = error.response?.data?.message ||
                error.response?.data?.error ||
                'Failed to update profile. Please try again.';
            throw new Error(errorMessage);
        }
    }

    updateLocalDisplay(section, updatedData) {
        Object.keys(updatedData).forEach(key => {
            const displayId = `info-${this.mapDbToDisplay(key)}`;
            const displayElement = document.getElementById(displayId);
            if (displayElement) {
                displayElement.textContent = updatedData[key] || 'Not set';
            }
        });

        if (updatedData.Full_Name) {
            document.getElementById('profile-fullname').textContent = updatedData.Full_Name;
        }
        if (updatedData.Email) {
            document.getElementById('profile-email').textContent = updatedData.Email;
        }
    }

    // Booking History Methods
    async loadBookingHistory() {
        try {
            this.showLoading('Loading bookings...');

            const response = await axios.get('http://localhost:5000/api/bookings', {
                headers: authManager.getAuthHeaders()
            });

            if (response.data && response.data.success) {
                const bookings = response.data.bookings || [];
                this.displayBookingHistory(bookings);
                if (bookings.length > 0) {
                    this.showSuccess(`Loaded ${bookings.length} booking(s)`);
                }
            } else {
                throw new Error('No booking data received');
            }
        } catch (error) {
            console.error('Error loading booking history:', error);
            this.displayBookingHistory([]);
            this.showError('Failed to load booking history');
        } finally {
            this.hideLoading();
        }
    }

    displayBookingHistory(bookings) {
        const bookingHistoryContainer = document.querySelector('.booking-history');
        if (!bookingHistoryContainer) return;

        if (bookings.length === 0) {
            bookingHistoryContainer.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-check empty-icon"></i>
                    <h3>No Bookings Yet</h3>
                    <p>You haven't made any bookings yet. Start by booking our cleaning services!</p>
                    <a href="services.html" class="btn-primary">
                        <i class="fas fa-calendar-plus"></i>
                        Book Services
                    </a>
                </div>
            `;
            return;
        }

        const sortedBookings = bookings.sort((a, b) => new Date(b.Date) - new Date(a.Date));
        bookingHistoryContainer.innerHTML = `
            <div class="bookings-list">
                ${sortedBookings.map(booking => this.createBookingCard(booking)).join('')}
            </div>
        `;
    }

    createBookingCard(booking) {
        const serviceName = booking.service_name || 
                           booking.Service_Name || 
                           booking.serviceName ||
                           booking.service?.Name ||
                           booking.Service?.Name ||
                           (booking.Service_ID === 12 ? 'Standard & Deep Cleaning' :
                            booking.Service_ID === 3 ? 'Window Cleaning' :
                            booking.Service_ID === 4 ? 'Carpet Cleaning' :
                            booking.Service_ID === 5 ? 'Upholstery Cleaning' :
                            booking.Service_ID === 6 ? 'Pest Control' :
                            'Cleaning Service');

        const bookingDate = new Date(booking.Date).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const bookingTime = booking.Time || '09:00';
        const totalAmount = parseFloat(booking.Total_Amount || 0).toFixed(2);
        const status = booking.Status || 'pending';
        const address = booking.Address || 'Address to be confirmed';
        const specialInstructions = booking.Special_Instructions || 'No special instructions';

        const statusClass = this.getStatusClass(status);
        const statusIcon = this.getStatusIcon(status);

        return `
            <div class="booking-card" data-booking-id="${booking.ID}">
                <div class="booking-header">
                    <div class="booking-service-info">
                        <h3 class="booking-service-name">${serviceName}</h3>
                        <span class="booking-date">
                            <i class="fas fa-calendar"></i>
                            ${bookingDate} at ${bookingTime}
                        </span>
                    </div>
                    <div class="booking-status ${statusClass}">
                        <i class="fas ${statusIcon}"></i>
                        ${this.formatStatus(status)}
                    </div>
                </div>
                
                <div class="booking-details">
                    <div class="booking-detail-item">
                        <span class="detail-label">
                            <i class="fas fa-map-marker-alt"></i>
                            Address:
                        </span>
                        <span class="detail-value">${address}</span>
                    </div>
                    
                    <div class="booking-detail-item">
                        <span class="detail-label">
                            <i class="fas fa-comment"></i>
                            Instructions:
                        </span>
                        <span class="detail-value">${specialInstructions}</span>
                    </div>
                    
                    <div class="booking-detail-item">
                        <span class="detail-label">
                            <i class="fas fa-clock"></i>
                            Duration:
                        </span>
                        <span class="detail-value">${booking.Duration || 60} minutes</span>
                    </div>
                </div>
                
                <div class="booking-footer">
                    <div class="booking-amount">
                        <strong>R ${totalAmount}</strong>
                    </div>
                    <div class="booking-actions">
                        ${status === 'pending' ? `
                            <button class="btn-outline cancel-booking-btn" data-booking-id="${booking.ID}">
                                <i class="fas fa-times"></i>
                                Cancel
                            </button>
                        ` : ''}
                        <button class="btn-outline view-booking-btn" data-booking-id="${booking.ID}">
                            <i class="fas fa-eye"></i>
                            View Details
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    getStatusClass(status) {
        const statusClasses = {
            'pending': 'status-pending',
            'confirmed': 'status-confirmed',
            'completed': 'status-completed',
            'cancelled': 'status-cancelled'
        };
        return statusClasses[status] || 'status-pending';
    }

    getStatusIcon(status) {
        const statusIcons = {
            'pending': 'fa-clock',
            'confirmed': 'fa-check-circle',
            'completed': 'fa-check-double',
            'cancelled': 'fa-times-circle'
        };
        return statusIcons[status] || 'fa-clock';
    }

    formatStatus(status) {
        const statusMap = {
            'pending': 'Pending Confirmation',
            'confirmed': 'Confirmed',
            'completed': 'Completed',
            'cancelled': 'Cancelled'
        };
        return statusMap[status] || status;
    }

    setupBookingHistoryListeners() {
        document.addEventListener('click', (e) => {
            if (e.target.closest('.cancel-booking-btn')) {
                const bookingId = e.target.closest('.cancel-booking-btn').dataset.bookingId;
                this.cancelBooking(bookingId);
            }
            
            if (e.target.closest('.view-booking-btn')) {
                const bookingId = e.target.closest('.view-booking-btn').dataset.bookingId;
                this.viewBookingDetails(bookingId);
            }
        });
    }

    async cancelBooking(bookingId) {
        const confirmed = await this.showConfirmationModal(
            'Cancel Booking',
            'Are you sure you want to cancel this booking?',
            'This action cannot be undone.',
            'Cancel Booking',
            'Keep Booking'
        );

        if (!confirmed) {
            this.showInfo('Booking cancellation cancelled');
            return;
        }

        try {
            this.showLoading('Cancelling booking...');
            
            const response = await axios.put(
                `http://localhost:5000/api/bookings/${bookingId}/cancel`,
                {},
                {
                    headers: authManager.getAuthHeaders()
                }
            );

            if (response.data.success) {
                this.showSuccess('Booking cancelled successfully!');
                await this.loadBookingHistory();
            } else {
                throw new Error(response.data.message || 'Failed to cancel booking');
            }
        } catch (error) {
            console.error('Error cancelling booking:', error);
            this.showError(error.response?.data?.message || 'Failed to cancel booking. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    viewBookingDetails(bookingId) {
        this.showInfo('Booking details feature coming soon!');
    }

    // Modern Confirmation Modal
    showConfirmationModal(title, message, description, confirmText = 'Confirm', cancelText = 'Cancel') {
        return new Promise((resolve) => {
            const existingModal = document.getElementById('confirmation-modal');
            if (existingModal) {
                existingModal.remove();
            }

            const modal = document.createElement('div');
            modal.id = 'confirmation-modal';
            modal.className = 'modal-overlay active';
            modal.innerHTML = `
                <div class="modal confirmation-modal">
                    <div class="modal-header">
                        <h3><i class="fas fa-exclamation-triangle"></i> ${title}</h3>
                    </div>
                    <div class="modal-body">
                        <div class="confirmation-content">
                            <p class="confirmation-message">${message}</p>
                            ${description ? `<p class="confirmation-description">${description}</p>` : ''}
                        </div>
                        <div class="confirmation-actions">
                            <button class="btn-secondary cancel-confirm">
                                <i class="fas fa-times"></i>
                                ${cancelText}
                            </button>
                            <button class="btn-primary confirm-action">
                                <i class="fas fa-check"></i>
                                ${confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector('.confirm-action').addEventListener('click', () => {
                modal.remove();
                resolve(true);
            });

            modal.querySelector('.cancel-confirm').addEventListener('click', () => {
                modal.remove();
                resolve(false);
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.remove();
                    resolve(false);
                }
            });

            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    modal.remove();
                    document.removeEventListener('keydown', handleEscape);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }

    // Password Management
    openPasswordModal() {
        const modal = document.getElementById('password-modal');
        if (modal) {
            modal.classList.add('active');
        }
        const form = document.getElementById('change-password-form');
        if (form) {
            form.reset();
        }
    }

    closePasswordModal() {
        const modal = document.getElementById('password-modal');
        if (modal) {
            modal.classList.remove('active');
        }
    }

    async changePassword() {
        const currentPassword = document.getElementById('current-password')?.value;
        const newPassword = document.getElementById('new-password')?.value;
        const confirmPassword = document.getElementById('confirm-password')?.value;

        if (!currentPassword || !newPassword || !confirmPassword) {
            this.showError('Please fill in all fields.');
            return;
        }

        if (newPassword !== confirmPassword) {
            this.showError('New passwords do not match.');
            return;
        }

        if (newPassword.length < 6) {
            this.showError('Password must be at least 6 characters long.');
            return;
        }

        try {
            this.showLoading('Changing password...');

            const response = await axios.put(
                'http://localhost:5000/api/customer/change-password',
                {
                    currentPassword,
                    newPassword
                },
                {
                    headers: authManager.getAuthHeaders()
                }
            );

            if (response.data.success) {
                this.closePasswordModal();
                this.showSuccess('Password changed successfully!');
            } else {
                throw new Error(response.data.message || 'Failed to change password');
            }

        } catch (error) {
            console.error('Password change error:', error);
            if (error.response?.status === 400) {
                this.showError(error.response.data.message || 'Current password is incorrect.');
            } else if (error.response?.status === 404) {
                this.showError('Password change endpoint not found. Please contact support.');
            } else {
                this.showError(error.response?.data?.message || 'Failed to change password. Please try again.');
            }
        } finally {
            this.hideLoading();
        }
    }

    // Utility Methods
    mapDbToDisplay(dbField) {
        const fieldMap = {
            'Full_Name': 'fullname',
            'Email': 'email',
            'Phone': 'phone',
            'Address': 'address',
            'City': 'city',
            'State': 'state',
            'ZIP_Code': 'zip'
        };
        return fieldMap[dbField] || dbField.toLowerCase();
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    showComingSoon(feature) {
        this.showInfo(`${feature} feature is coming soon!`);
    }

    // Modern Notification System
    showSuccess(message) {
        this.showNotification(message, 'success', 'check-circle');
    }

    showError(message) {
        this.showNotification(message, 'error', 'exclamation-circle');
    }

    showInfo(message) {
        this.showNotification(message, 'info', 'info-circle');
    }

    showWarning(message) {
        this.showNotification(message, 'warning', 'exclamation-triangle');
    }

    showNotification(message, type = 'info', icon = 'info-circle') {
        const existingNotification = document.querySelector('.profile-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `profile-notification profile-notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${icon}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close">&times;</button>
        `;

        if (!document.querySelector('#profile-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'profile-notification-styles';
            styles.textContent = `
                .profile-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 16px 20px;
                    border-radius: 8px;
                    color: white;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    max-width: 400px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    animation: slideInRight 0.3s ease;
                }
                .profile-notification-success { 
                    background: #27ae60;
                    border-left: 4px solid #219653;
                }
                .profile-notification-error { 
                    background: #e74c3c;
                    border-left: 4px solid #c0392b;
                }
                .profile-notification-info { 
                    background: #3498db;
                    border-left: 4px solid #2980b9;
                }
                .profile-notification-warning { 
                    background: #f39c12;
                    border-left: 4px solid #e67e22;
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    flex: 1;
                }
                .notification-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 4px;
                    transition: background-color 0.2s ease;
                }
                .notification-close:hover {
                    background: rgba(255,255,255,0.2);
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOutRight {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(styles);
        }

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    showLoading(message = 'Loading...') {
        this.hideLoading();

        const loading = document.createElement('div');
        loading.className = 'profile-loading';
        loading.id = 'profile-loading';
        loading.innerHTML = `
            <div class="loading-spinner"></div>
            <span>${message}</span>
        `;

        if (!document.querySelector('#profile-loading-styles')) {
            const styles = document.createElement('style');
            styles.id = 'profile-loading-styles';
            styles.textContent = `
                .profile-loading {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(255,255,255,0.9);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    gap: 15px;
                    backdrop-filter: blur(2px);
                }
                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                .profile-loading span {
                    color: #2c3e50;
                    font-weight: 600;
                    font-size: 1.1rem;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(loading);
    }

    hideLoading() {
        const loading = document.getElementById('profile-loading');
        if (loading) {
            loading.remove();
        }
    }
}

// Initialize profile manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof authManager === 'undefined') {
            console.error('AuthManager not available');
            window.location.href = 'login.html';
            return;
        }

        if (!authManager.isAuthenticated()) {
            console.log('Not authenticated, redirecting to login');
            window.location.href = 'login.html';
            return;
        }

        if (authManager.userType === 'admin') {
            const profileManager = new ProfileManager();
            profileManager.showError('Admins should use the admin dashboard for profile management.');
            setTimeout(() => {
                window.location.href = 'admin-dashboard.html';
            }, 2000);
            return;
        }

        new ProfileManager();
    }, 100);
});