// profile.js - Fixed version with working edit functionality
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
        alert('Admins should use the admin dashboard for profile management.');
        window.location.href = 'admin-dashboard.html';
        return;
    }

    async init() {
        await this.loadUserData();
        this.setupEventListeners();
        this.setupEditHandlers();
    }

    async loadUserData() {
        try {
            // Show loading state
            document.getElementById('profile-fullname').textContent = 'Loading...';
            document.getElementById('profile-email').textContent = 'Loading...';

            // Fetch fresh user data from API
            const response = await axios.get('http://localhost:5000/api/customer/profile', {
                headers: authManager.getAuthHeaders()
            });

            if (response.data) {
                this.user = response.data;

                // Update authManager with fresh data
                authManager.user = this.user;
                localStorage.setItem('user', JSON.stringify(this.user));

                this.updateProfileDisplay();
            } else {
                throw new Error('No user data received');
            }

        } catch (error) {
            console.error('Error loading user data:', error);

            // Fallback to localStorage data if API fails
            if (this.user && Object.keys(this.user).length > 0) {
                this.updateProfileDisplay();
            } else {
                this.showError('Failed to load profile data');
                this.redirectToLogin();
            }
        }
    }

    updateProfileDisplay() {
        if (!this.user) {
            console.error('No user data available');
            return;
        }

        console.log('Updating profile with user data:', this.user);

        // Update profile header
        document.getElementById('profile-fullname').textContent =
            this.user.Full_Name || 'User';
        document.getElementById('profile-email').textContent =
            this.user.Email || 'No email';
        document.getElementById('profile-role').textContent =
            authManager.role === 'admin' ? 'Administrator' : 'Customer';

        // Update personal information
        document.getElementById('info-fullname').textContent =
            this.user.Full_Name || 'Not set';
        document.getElementById('info-email').textContent =
            this.user.Email || 'Not set';
        document.getElementById('info-phone').textContent =
            this.user.Phone || 'Not set';

        // Format join date
        const joinDate = this.user.Created_At || this.user.createdAt || this.user.created_at;
        document.getElementById('info-join-date').textContent =
            joinDate ? new Date(joinDate).toLocaleDateString() : 'Unknown';

        // Update address information
        document.getElementById('info-address').textContent =
            this.user.Address || 'Not set';
        document.getElementById('info-city').textContent =
            this.user.City || 'Not set';
        document.getElementById('info-state').textContent =
            this.user.State || 'Not set';
        document.getElementById('info-zip').textContent =
            this.user.ZipCode || this.user.ZIP_Code || this.user.ZIP || 'Not set';
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

        // Hide edit button and show action buttons
        if (editBtn) editBtn.style.display = 'none';
        if (actions) actions.style.display = 'flex';

        // Show inputs and hide display texts
        const inputs = sectionElement.querySelectorAll('.edit-input');
        const displays = sectionElement.querySelectorAll('.info-item p');

        displays.forEach(display => {
            if (!display.id.includes('join-date')) { // Don't hide join date
                display.style.display = 'none';
            }
        });

        inputs.forEach(input => {
            input.style.display = 'block';
            // Set input value from corresponding display text
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

        // Show edit button and hide action buttons
        if (editBtn) editBtn.style.display = 'flex';
        if (actions) actions.style.display = 'none';

        // Hide inputs and show display texts
        displays.forEach(display => {
            display.style.display = 'block';
        });

        inputs.forEach(input => {
            input.style.display = 'none';
        });

        this.isEditing = false;
        this.currentEditingSection = null;
    }

    async saveChanges(section) {
        try {
            this.showLoading('Saving changes...');

            const sectionElement = document.getElementById(section);
            const inputs = sectionElement.querySelectorAll('.edit-input');

            // Collect updated data based on section
            const updatedData = {};

            if (section === 'personal-info') {
                updatedData.Full_Name = document.getElementById('edit-fullname').value.trim();
                updatedData.Email = document.getElementById('edit-email').value.trim();
                updatedData.Phone = document.getElementById('edit-phone').value.trim();

                // Validation
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

            // Update via API
            await this.updateUserProfile(updatedData);

            // Update local display
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
            console.log('Updating profile with data:', updatedData);

            const response = await axios.put(
                'http://localhost:5000/api/customer/profile',
                updatedData,
                {
                    headers: authManager.getAuthHeaders()
                }
            );

            if (response.data) {
                // Update local user data
                Object.assign(this.user, updatedData);
                authManager.user = this.user;
                localStorage.setItem('user', JSON.stringify(this.user));

                console.log('Profile updated successfully:', response.data);
                return response.data;
            }
        } catch (error) {
            console.error('API Error updating profile:', error);

            // More detailed error message
            const errorMessage = error.response?.data?.message ||
                error.response?.data?.error ||
                'Failed to update profile. Please try again.';

            throw new Error(errorMessage);
        }
    }

    updateLocalDisplay(section, updatedData) {
        // Update the display texts with new values
        Object.keys(updatedData).forEach(key => {
            const displayId = `info-${this.mapDbToDisplay(key)}`;
            const displayElement = document.getElementById(displayId);
            if (displayElement) {
                displayElement.textContent = updatedData[key] || 'Not set';
            }
        });

        // Also update the profile header
        if (updatedData.Full_Name) {
            document.getElementById('profile-fullname').textContent = updatedData.Full_Name;
        }
        if (updatedData.Email) {
            document.getElementById('profile-email').textContent = updatedData.Email;
        }
    }

    // Map database field names to display field names
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

    // In profile.js - update the changePassword method
    async changePassword() {
        const currentPassword = document.getElementById('current-password')?.value;
        const newPassword = document.getElementById('new-password')?.value;
        const confirmPassword = document.getElementById('confirm-password')?.value;

        // Basic validation
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

            // Use the customer route instead of auth route
            const response = await axios.put(
                'http://localhost:5000/api/customer/change-password', // CHANGED THIS
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

            // More specific error messages
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

    showComingSoon(feature) {
        this.showNotification(`${feature} feature is coming soon!`, 'info');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Remove existing notification
        const existingNotification = document.querySelector('.profile-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `profile-notification profile-notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button class="notification-close">&times;</button>
        `;

        // Add styles if not already added
        if (!document.querySelector('#profile-notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'profile-notification-styles';
            styles.textContent = `
                .profile-notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    padding: 12px 20px;
                    border-radius: 8px;
                    color: white;
                    z-index: 10000;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    max-width: 400px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    animation: slideInRight 0.3s ease;
                }
                .profile-notification-success { background: #27ae60; }
                .profile-notification-error { background: #e74c3c; }
                .profile-notification-info { background: #3498db; }
                .notification-close {
                    background: none;
                    border: none;
                    color: white;
                    font-size: 18px;
                    cursor: pointer;
                    padding: 0;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }

    showLoading(message = 'Loading...') {
        // Remove existing loading
        this.hideLoading();

        const loading = document.createElement('div');
        loading.className = 'profile-loading';
        loading.id = 'profile-loading';
        loading.innerHTML = `
            <div class="loading-spinner"></div>
            <span>${message}</span>
        `;

        // Add styles if not already added
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
                    background: rgba(255,255,255,0.8);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    gap: 15px;
                }
                .loading-spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #f3f3f3;
                    border-top: 4px solid #3498db;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
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

    redirectToLogin() {
        window.location.href = 'login.html';
    }
}

// Initialize profile manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Wait a bit for authManager to initialize
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

        // Check if admin trying to access customer profile
        if (authManager.userType === 'admin') {
            alert('Admins should use the admin dashboard for profile management.');
            window.location.href = 'admin-dashboard.html';
            return;
        }

        new ProfileManager();
    }, 100);
});