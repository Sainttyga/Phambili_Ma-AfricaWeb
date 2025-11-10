// auth-manager.js - Complete fixed version
class AuthManager {
    constructor() {
        this.token = localStorage.getItem('authToken');
        this.role = localStorage.getItem('role') || 'customer';
        this.userType = localStorage.getItem('userType') || 'customer';
        this.user = this.parseUserData();
        this.basePath = this.detectBasePath();
        this.init();
    }

    // Detect the correct base path for assets and links
    detectBasePath() {
        const currentPath = window.location.pathname;
        if (currentPath.includes('/frontend/')) {
            return '';
        } else if (currentPath !== '/') {
            return '.';
        }
        return '.';
    }

    // Properly parse user data from localStorage with better error handling
    parseUserData() {
        try {
            const userData = localStorage.getItem('user');
            if (userData && userData !== '{}' && userData !== 'undefined') {
                const parsed = JSON.parse(userData);

                // Validate based on user type
                if (this.userType === 'admin') {
                    // Admin validation
                    if (parsed && (parsed.ID || parsed.Email || parsed.Name)) {
                        return parsed;
                    }
                } else {
                    // Customer validation
                    if (parsed && (parsed.ID || parsed.Email || parsed.Full_Name)) {
                        return parsed;
                    }
                }
            }
            return this.getDefaultUserObject();
        } catch (error) {
            console.error('Error parsing user data:', error);
            return this.getDefaultUserObject();
        }
    }


    // Safe default user object
    getDefaultUserObject() {
        if (this.userType === 'admin') {
            return {
                ID: null,
                Name: 'Admin',
                Email: '',
                Phone: ''
            };
        } else {
            return {
                ID: null,
                Full_Name: 'User',
                Email: '',
                Phone: '',
                Address: ''
            };
        }
    }

    init() {
        this.updateUI();
        this.setupProtectedLinks();

        // Debug log to help troubleshoot
        console.log('AuthManager initialized:', {
            isAuthenticated: this.isAuthenticated(),
            role: this.role,
            user: this.user
        });
    }

    // Check if user is authenticated
    isAuthenticated() {
        return !!this.token && this.token !== 'undefined' && this.token !== 'null';
    }

    // Check if user has specific role
    hasRole(requiredRole) {
        return this.role === requiredRole;
    }

    // Login user with better data validation
    // In auth-manager.js - Update the login method
    login(token, role, userData, userType = 'customer') {
        if (!token) {
            console.error('No token provided for login');
            return false;
        }

        this.token = token;
        this.role = role;
        this.userType = userType;

        // Enhanced user data validation and merging
        const defaultUser = this.getDefaultUserObject();

        if (userData && typeof userData === 'object') {
            // Clean and merge user data
            this.user = {
                ...defaultUser,
                ...userData
            };

            // Ensure critical fields exist
            if (userType === 'admin') {
                this.user.Name = userData.Name || userData.Full_Name || 'Admin';
            } else {
                this.user.Full_Name = userData.Full_Name || 'User';
            }
            this.user.Email = userData.Email || '';
        } else {
            this.user = defaultUser;
        }

        // Store in localStorage
        localStorage.setItem('authToken', token);
        localStorage.setItem('role', this.role);
        localStorage.setItem('userType', this.userType);
        localStorage.setItem('user', JSON.stringify(this.user));

        this.updateUI();
        this.setupProtectedLinks();

        // Update cart display after login (only for customers)
        if (typeof updateCartDisplay === 'function' && this.userType === 'customer') {
            updateCartDisplay();
        }

        console.log('User logged in successfully:', {
            role: this.role,
            userType: this.userType,
            user: this.user
        });

        return true;
    }
    // Logout user
    logout() {
        this.token = null;
        this.role = 'customer';
        this.userType = 'customer';
        this.user = this.getDefaultUserObject();

        localStorage.removeItem('authToken');
        localStorage.removeItem('role');
        localStorage.removeItem('userType');
        localStorage.removeItem('user');

        this.updateUI();
        this.setupProtectedLinks();

        // Update cart display after logout
        if (typeof updateCartDisplay === 'function') {
            updateCartDisplay();
        }

        this.showLogoutNotification();
    }

    showLogoutNotification() {
        // Create notification overlay
        const notification = document.createElement('div');
        notification.className = 'logout-notification-overlay';
        notification.innerHTML = `
        <div class="logout-notification">
            <div class="notification-icon">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12L11 14L15 10M21 12C21 16.9706 16.9706 21 12 21C7.02944 21 3 16.9706 3 12C3 7.02944 7.02944 3 12 3C16.9706 3 21 7.02944 21 12Z" 
                          stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
            </div>
            <h3 class="notification-title">Successfully Logged Out</h3>
            <p class="notification-message">You have been securely logged out of your account.</p>
            <button class="notification-confirm-btn" onclick="this.closest('.logout-notification-overlay').remove(); window.location.href='index.html';">
                Continue to Homepage
            </button>
        </div>
    `;

        document.body.appendChild(notification);

        // Auto redirect after 3 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
            window.location.href = 'index.html';
        }, 3000);
    }

    // Update UI based on authentication status
    updateUI() {
        const userIcon = document.getElementById('user-profile-link');
        const userIconImg = document.getElementById('user-icon');
        const cartBtn = document.getElementById('cart-btn');
        const adminLink = document.querySelector('.nav-link[href="admin-dashboard.html"]');
        const loginLink = document.querySelector('.nav-link[href="login.html"]');

        if (userIcon && userIconImg) {
            if (this.isAuthenticated()) {
                // User is logged in - setup dropdown menu
                userIcon.href = 'javascript:void(0);';
                userIcon.setAttribute('aria-label', 'User Profile Menu');
                userIconImg.alt = 'User Profile Menu';

                // Add user menu dropdown based on user type
                if (this.userType === 'admin') {
                    this.createAdminDropdown(userIcon);
                } else {
                    this.createCustomerDropdown(userIcon);
                }
            } else {
                // User is not logged in - setup login redirect
                userIcon.href = 'login.html';
                userIcon.setAttribute('aria-label', 'Login');
                userIconImg.alt = 'Login';

                // Remove any existing dropdown
                const existingDropdown = userIcon.querySelector('.user-dropdown');
                if (existingDropdown) {
                    existingDropdown.remove();
                }
            }
        }
        // Show/hide admin link based on role
        if (adminLink) {
            const adminListItem = adminLink.closest('.nav-item');
            if (adminListItem) {
                adminListItem.style.display = this.hasRole('admin') ? 'block' : 'none';
            }
        }

        // Show/hide login link in navigation
        if (loginLink) {
            const loginListItem = loginLink.closest('.nav-item');
            if (loginListItem) {
                loginListItem.style.display = this.isAuthenticated() ? 'none' : 'block';
            }
        }
    }

    // In auth-manager.js - Update createCustomerDropdown and createAdminDropdown
    createCustomerDropdown(userIcon) {
        // Remove existing dropdown if any
        const existingDropdown = userIcon.querySelector('.user-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }

        const userName = this.getUserDisplayName();
        const userEmail = this.getUserEmail();

        const dropdown = document.createElement('div');
        dropdown.className = 'user-dropdown';
        dropdown.innerHTML = `
        <div class="dropdown-user-info">
            <div class="dropdown-user-avatar">
                <i class="fas fa-user-circle"></i>
            </div>
            <div class="dropdown-user-details">
                <strong>${userName}</strong>
                <span>${userEmail || 'No email provided'}</span>
                <small>Customer</small>
            </div>
        </div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-links">
            <a href="profile.html" class="dropdown-link profile-link">
                <i class="fas fa-user"></i>
                My Profile
            </a>
            <a href="profile.html#booking-history" class="dropdown-link booking-history-link">
                <i class="fas fa-history"></i>
                Booking History
            </a>
        </div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-links">
            <button class="dropdown-link logout-btn">
                <i class="fas fa-sign-out-alt"></i>
                Logout
            </button>
        </div>
    `;

        this.setupDropdown(userIcon, dropdown);
    }

    // In auth-manager.js - Fix createAdminDropdown method
    createAdminDropdown(userIcon) {
        // Remove existing dropdown if any
        const existingDropdown = userIcon.querySelector('.user-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }

        const userName = this.getUserDisplayName();
        const userEmail = this.getUserEmail();

        const dropdown = document.createElement('div');
        dropdown.className = 'user-dropdown';
        dropdown.innerHTML = `
    <div class="dropdown-user-info">
        <div class="dropdown-user-avatar">
            <i class="fas fa-user-shield"></i>
        </div>
        <div class="dropdown-user-details">
            <strong>${userName}</strong>
            <span>${userEmail || 'No email provided'}</span>
            <small>Administrator</small>
        </div>
    </div>
    <div class="dropdown-divider"></div>
    <div class="dropdown-links">
        <a href="javascript:void(0)" class="dropdown-link" onclick="showSection('dashboard')">
            <i class="fas fa-tachometer-alt"></i>
            Admin Dashboard
        </a>
        <a href="javascript:void(0)" class="dropdown-link" onclick="showSection('admin-profile')">
            <i class="fas fa-user-cog"></i>
            Admin Profile
        </a>
    </div>
    <div class="dropdown-divider"></div>
    <div class="dropdown-links">
        <button class="dropdown-link logout-btn">
            <i class="fas fa-sign-out-alt"></i>
            Logout
        </button>
    </div>
`;

        this.setupDropdown(userIcon, dropdown);
    }
    // Setup user icon for authenticated users (with dropdown)
    setupAuthenticatedUserIcon(userIconLink, userIconImg) {
        // Remove href to prevent navigation and setup dropdown
        userIconLink.href = 'javascript:void(0);';
        userIconLink.setAttribute('aria-label', 'User Profile Menu');
        userIconImg.alt = 'User Profile Menu';

        // Add cursor pointer style
        userIconLink.style.cursor = 'pointer';
        userIconImg.style.cursor = 'pointer';

        // Add user menu dropdown
        this.createUserDropdown(userIconLink);
    }

    // Setup user icon for non-authenticated users (redirect to login)
    setupLoginRedirect(userIconLink, userIconImg) {
        // Reset to login state
        userIconLink.href = 'login.html';
        userIconLink.setAttribute('aria-label', 'Login');
        userIconImg.alt = 'Login';

        // Remove cursor pointer style
        userIconLink.style.cursor = '';
        userIconImg.style.cursor = '';

        // Remove any existing dropdown
        const existingDropdown = userIconLink.querySelector('.user-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }

        // Remove any custom click handlers by cloning
        const newUserIcon = userIconLink.cloneNode(true);
        userIconLink.parentNode.replaceChild(newUserIcon, userIconLink);
    }

    // Get user display name with fallbacks
    getUserDisplayName() {
        if (!this.user) return 'User';

        if (this.userType === 'admin') {
            return this.user.Name || this.user.Full_Name || 'Admin';
        } else {
            return this.user.Full_Name || 'User';
        }
    }

    // Get user email with fallbacks
    getUserEmail() {
        if (!this.user || !this.user.Email) {
            return '';
        }
        return this.user.Email;
    }

    // Create user dropdown menu for authenticated users
    createUserDropdown(userIconLink) {
        // Remove existing dropdown if any
        const existingDropdown = userIconLink.querySelector('.user-dropdown');
        if (existingDropdown) {
            existingDropdown.remove();
        }

        // If we don't have proper user data, try to fetch it
        if (!this.user || (!this.user.ID && this.user.Full_Name === 'User' && !this.user.Email)) {
            console.warn('Insufficient user data for dropdown:', this.user);

            this.fetchUserData().then(() => {
                if (this.user && this.user.Full_Name !== 'User') {
                    this.createUserDropdown(userIconLink);
                }
            }).catch(error => {
                console.error('Failed to fetch user data:', error);
            });
            return;
        }

        const userName = this.getUserDisplayName();
        const userEmail = this.getUserEmail();
        const userRole = this.role === 'admin' ? 'Administrator' : 'Customer';

        const dropdown = document.createElement('div');
        dropdown.className = 'user-dropdown';
        dropdown.innerHTML = `
            <div class="dropdown-user-info">
                <div class="dropdown-user-avatar">
                    <i class="fas fa-user-circle"></i>
                </div>
                <div class="dropdown-user-details">
                    <strong>${userName}</strong>
                    <span>${userEmail || 'No email provided'}</span>
                    <small>${userRole}</small>
                </div>
            </div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-links">
                <a href="profile.html" class="dropdown-link">
                    <i class="fas fa-user"></i>
                    My Profile
                </a>
                <a href="profile.html#booking-history" class="dropdown-link">
                    <i class="fas fa-history"></i>
                    Booking History
                </a>
                ${this.role === 'admin' ? `
                <a href="admin-dashboard.html" class="dropdown-link">
                    <i class="fas fa-cog"></i>
                    Admin Dashboard
                </a>
                ` : ''}
            </div>
            <div class="dropdown-divider"></div>
            <div class="dropdown-links">
                <button class="dropdown-link logout-btn">
                    <i class="fas fa-sign-out-alt"></i>
                    Logout
                </button>
            </div>
        `;

        // Add dropdown to user icon link
        userIconLink.appendChild(dropdown);

        // Handle logout button
        const logoutBtn = dropdown.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.logout();
            });
        }

        // Setup dropdown toggle functionality
        this.setupDropdownToggle(userIconLink, dropdown);
    }

    // In auth-manager.js - Fix the setupDropdown method
    setupDropdown(userIcon, dropdown) {
        // Add dropdown to user icon
        userIcon.appendChild(dropdown);

        // Handle dropdown links - FIXED: Prevent default and stop propagation
        const profileLinks = dropdown.querySelectorAll('.dropdown-link[href*="profile"], .dropdown-link[href*="admin-dashboard"]');
        profileLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const href = link.getAttribute('href');

                // Close dropdown first with a slight delay
                dropdown.classList.remove('show');

                // Then navigate after dropdown animation completes
                setTimeout(() => {
                    if (href) {
                        window.location.href = href;
                    }
                }, 200);
            });
        });

        // Handle logout button
        const logoutBtn = dropdown.querySelector('.logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.logout();
            });
        }

        // Setup dropdown toggle functionality
        this.setupDropdownToggle(userIcon, dropdown);
    }

    // In auth-manager.js - Update setupDropdownToggle method
    setupDropdownToggle(userIconLink, dropdown) {
        let isDropdownOpen = false;
        let clickTimer = null;

        const toggleDropdown = (e) => {
            e.preventDefault();
            e.stopPropagation();

            // Clear any pending navigation
            if (clickTimer) {
                clearTimeout(clickTimer);
                clickTimer = null;
            }

            if (isDropdownOpen) {
                dropdown.classList.remove('show');
                isDropdownOpen = false;
            } else {
                // Close any other open dropdowns
                document.querySelectorAll('.user-dropdown.show').forEach(d => {
                    d.classList.remove('show');
                });
                dropdown.classList.add('show');
                isDropdownOpen = true;
            }
        };

        // Remove any existing click listeners by cloning
        const newUserIcon = userIconLink.cloneNode(true);
        const dropdownParent = userIconLink.parentNode;

        // Preserve the dropdown
        if (userIconLink.contains(dropdown)) {
            newUserIcon.appendChild(dropdown);
        }

        dropdownParent.replaceChild(newUserIcon, userIconLink);

        // Add click event to the new user icon link
        newUserIcon.addEventListener('click', toggleDropdown);

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!newUserIcon.contains(e.target) && isDropdownOpen) {
                dropdown.classList.remove('show');
                isDropdownOpen = false;
            }
        });

        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && isDropdownOpen) {
                dropdown.classList.remove('show');
                isDropdownOpen = false;
            }
        });

        // Prevent dropdown from closing when clicking inside it
        dropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // Add method to fetch user data
    async fetchUserData() {
        if (!this.isAuthenticated()) {
            return;
        }

        try {
            const response = await axios.get('http://localhost:5000/api/customer/profile', {
                headers: this.getAuthHeaders()
            });

            if (response.data) {
                this.user = response.data;
                localStorage.setItem('user', JSON.stringify(this.user));
                this.updateUI(); // Refresh UI with new data
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }
    }

    // Setup protected links that require authentication
    // In auth-manager.js - Update setupProtectedLinks method
    setupProtectedLinks() {
        // Don't protect links on profile page itself
        if (window.location.pathname.includes('profile.html')) {
            return;
        }

        const protectedLinks = document.querySelectorAll(
            'a[href="booking.html"], a[href="profile.html"], ' +
            'a[href="booking-history.html"], ' +
            '.book-now-btn, .profile-required'
        );

        protectedLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                // Skip if it's a dropdown profile link (handled by dropdown)
                if (link.closest('.user-dropdown') || link.closest('.dropdown-links')) {
                    return;
                }

                if (!this.isAuthenticated()) {
                    e.preventDefault();
                    this.redirectToLogin();
                } else {
                    // Handle links to pages that don't exist
                    const href = link.getAttribute('href');
                    if (href && href.includes('booking-history.html')) {
                        e.preventDefault();
                        // Redirect to profile page with booking history section
                        window.location.href = 'profile.html#booking-history';
                    }
                }
            });
        });

        // Protect form submissions
        const protectedForms = document.querySelectorAll('#index-quoteForm, .booking-form');
        protectedForms.forEach(form => {
            form.addEventListener('submit', (e) => {
                if (!this.isAuthenticated()) {
                    e.preventDefault();
                    this.redirectToLogin();
                    return;
                }
            });
        });

        // Handle "Book Services" button in empty cart
        document.addEventListener('click', (e) => {
            if (e.target.closest('#book-services-btn')) {
                if (!this.isAuthenticated()) {
                    e.preventDefault();
                    this.redirectToLogin();
                } else {
                    // If logged in, redirect to services page
                    window.location.href = 'services.html';
                }
            }
        });
    }

    // Redirect to login with return URL
    redirectToLogin() {
        const currentUrl = window.location.href;
        localStorage.setItem('returnUrl', currentUrl);
        window.location.href = 'login.html';
    }

    // Get user data
    getUser() {
        return this.user;
    }

    // Get authentication headers for API calls
    getAuthHeaders() {
        return {
            'Authorization': `Bearer ${this.token}`,
            'Content-Type': 'application/json'
        };
    }

    // Verify token validity
    async verifyToken() {
        if (!this.token) return false;

        try {
            const response = await axios.get('http://localhost:5000/api/auth/verify', {
                headers: this.getAuthHeaders()
            });
            return response.data.valid;
        } catch (error) {
            console.error('Token verification failed:', error);
            this.logout();
            return false;
        }
    }

    // Debug method to check user data
    debugUserData() {
        console.log('User Data Debug:');
        console.log('Token:', this.token);
        console.log('Role:', this.role);
        console.log('User Object:', this.user);
        console.log('Display Name:', this.getUserDisplayName());
        console.log('Email:', this.getUserEmail());
        console.log('LocalStorage user:', localStorage.getItem('user'));
        console.log('Is Authenticated:', this.isAuthenticated());
    }
}

// In your login.js or auth script
async function handleLogin(email, password) {
    try {
        const response = await axios.post('http://localhost:5000/api/auth/login', {
            Email: email,
            Password: password
        });

        if (response.data.token) {
            // Check if this is an admin requiring first login
            if (response.data.role === 'admin' && response.data.requiresPasswordReset) {
                // Show first login modal instead of redirecting
                showFirstLoginModal(email);
                return;
            }

            // Normal login process
            authManager.login(
                response.data.token,
                response.data.role,
                response.data.user,
                response.data.role === 'admin' ? 'admin' : 'customer'
            );

            // Redirect based on role
            if (response.data.role === 'admin') {
                window.location.href = 'admin-dashboard.html';
            } else {
                const returnUrl = localStorage.getItem('returnUrl') || 'index.html';
                localStorage.removeItem('returnUrl');
                window.location.href = returnUrl;
            }
        }
    } catch (error) {
        console.error('Login error:', error);
        // Handle login error
    }
}


// Initialize auth manager
const authManager = new AuthManager();

window.authManager = authManager;
// Add debug method to window for testing
window.debugAuth = () => authManager.debugUserData();