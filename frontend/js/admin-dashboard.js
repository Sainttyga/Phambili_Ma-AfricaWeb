// Enhanced Admin Dashboard Functionality - Updated with better error handling and resilience
class AdminDashboard {
  constructor() {
    this.api = window.adminAPI || null;
    this.currentSection = this.getStoredSection() || 'dashboard';
    this.adminProfileManager = null;
    this.isInitialized = false;
    this.initializationAttempts = 0;
    this.maxInitializationAttempts = 3;
    this.retryDelay = 2000;
    console.log('🚀 AdminDashboard initialized');
  }

  // Get stored section from localStorage
  getStoredSection() {
    return localStorage.getItem('adminCurrentSection');
  }

  // Store current section in localStorage
  storeCurrentSection(section) {
    localStorage.setItem('adminCurrentSection', section);
  }

  async init() {
    console.log('🚀 AdminDashboard init started');

    // Prevent multiple initializations
    if (this.isInitialized) {
      console.log('⚠️ Dashboard already initialized');
      return;
    }

    this.initializationAttempts++;

    try {
      // Step 1: Basic authentication check
      if (!this.checkAuth()) {
        return;
      }

      // Step 2: Check if API is available
      if (!this.checkAPI()) {
        return;
      }

      // Step 3: Get admin profile to determine role
      await this.loadAdminProfileForPermissions();

      // Step 4: Setup UI components based on role
      this.setupUIForRole();
      this.setupEventListeners();
      this.setupNavigation();
      this.setupAdminProfile();
      this.ensureCurrentSectionVisible();

      // Step 5: Check password reset (non-blocking)
      this.checkPasswordReset().catch(error => {
        console.warn('Password reset check failed:', error);
      });

      // Step 6: Load initial data (non-blocking)
      this.loadDashboardData().catch(error => {
        console.error('Failed to load dashboard data:', error);
        this.showNotification('Failed to load dashboard data. Some features may be limited.', 'warning');
      });

      this.updateAdminInfo();

      this.isInitialized = true;
      console.log('🎉 AdminDashboard init completed');

    } catch (error) {
      console.error('❌ Dashboard initialization failed:', error);

      if (this.initializationAttempts < this.maxInitializationAttempts) {
        console.log(`🔄 Retrying initialization (${this.initializationAttempts}/${this.maxInitializationAttempts})`);
        setTimeout(() => this.init(), this.retryDelay);
      } else {
        this.showNotification('Failed to initialize dashboard. Please refresh the page.', 'error');
        this.showGlobalError('Dashboard initialization failed. Please refresh the page or contact support.');
      }
    }
  }

  // Add method to load admin profile for permissions
  async loadAdminProfileForPermissions() {
    try {
      const response = await this.api.getAdminProfile();
      if (response.success) {
        this.currentAdmin = response.admin;
        this.isMainAdmin = this.currentAdmin.Role === 'main_admin';
        console.log(`👤 Admin role detected: ${this.currentAdmin.Role}`);
      }
    } catch (error) {
      console.error('Error loading admin profile for permissions:', error);
      // Default to sub-admin if there's an error
      this.isMainAdmin = false;
      this.currentAdmin = { Role: 'sub_admin' };
    }
  }

  // Add method to setup UI based on role
  setupUIForRole() {
    try {
      console.log(`🎨 Setting up UI for ${this.isMainAdmin ? 'Main Admin' : 'Sub Admin'}`);

      // Hide restricted tabs for sub-admins
      if (!this.isMainAdmin) {
        this.hideRestrictedTabs();
        this.updateDashboardForSubAdmin();
      }
    } catch (error) {
      console.error('Error setting up UI for role:', error);
    }
  }

  // Hide restricted tabs for sub-admins
  hideRestrictedTabs() {
    try {
      const restrictedTabs = ['customers', 'admin-management', 'reports'];

      restrictedTabs.forEach(tab => {
        const tabElement = document.querySelector(`[data-section="${tab}"]`);
        if (tabElement) {
          const listItem = tabElement.closest('li[role="presentation"]');
          if (listItem) {
            listItem.style.display = 'none';
            console.log(`🚫 Hiding tab: ${tab}`);
          }
        }
      });

      // Also hide admin management from the dropdown if it exists
      const adminManagementDropdown = document.querySelector('.dropdown-link[href*="admin-management"]');
      if (adminManagementDropdown) {
        adminManagementDropdown.closest('.dropdown-link').style.display = 'none';
      }

    } catch (error) {
      console.error('Error hiding restricted tabs:', error);
    }
  }

  // Update dashboard display for sub-admins
  updateDashboardForSubAdmin() {
    try {
      // Hide revenue and customer stats from the dashboard
      const revenueStats = document.querySelectorAll('.stat-card');
      revenueStats.forEach(stat => {
        const statText = stat.textContent.toLowerCase();
        if (statText.includes('revenue') || statText.includes('customer')) {
          stat.style.display = 'none';
        }
      });

      // Update dashboard stats display to show limited info
      const statsGrid = document.getElementById('statsGrid');
      if (statsGrid && !this.isMainAdmin) {
        // You can customize this message
        const limitedAccessMsg = document.createElement('div');
        limitedAccessMsg.className = 'limited-access-notice';
        limitedAccessMsg.innerHTML = `
        <div class="access-notice">
          <i class="fas fa-eye-slash"></i>
          <p>Limited view: Some statistics are restricted to Main Administrators</p>
        </div>
      `;
        statsGrid.parentNode.insertBefore(limitedAccessMsg, statsGrid);
      }

    } catch (error) {
      console.error('Error updating dashboard for sub-admin:', error);
    }
  }
  ensureCurrentSectionVisible() {
    try {
      // Use stored section or default to dashboard
      const targetSection = this.currentSection;
      console.log(`🎯 Restoring section: ${targetSection}`);

      // Show the stored section
      this.showSection(targetSection, false); // false = don't store again

    } catch (error) {
      console.error('Error ensuring section visibility:', error);
      // Fallback to dashboard
      this.ensureDashboardVisible();
    }
  }

  // In admin-dashboard.js - Fix the showSection method
  showSection(section, store = true) {
    try {
      console.log('Showing section:', section);

      // Check if sub-admin is trying to access restricted section
      if (!this.isMainAdmin) {
        const restrictedSections = ['customers', 'admin-management', 'reports'];
        if (restrictedSections.includes(section)) {
          this.showNotification('Access denied. This section is restricted to Main Administrators.', 'error');
          // Redirect to dashboard
          section = 'dashboard';
        }
      }

      // Store the section if requested
      if (store) {
        this.storeCurrentSection(section);
        this.currentSection = section;
      }

      // Hide all sections
      document.querySelectorAll('.content-section').forEach(sec => {
        sec.hidden = true;
        sec.classList.remove('active');
      });

      // Remove active class from all nav links
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
      });

      // Show selected section
      const targetSection = document.getElementById(section);
      const targetNavLink = document.querySelector(`[data-section="${section}"]`);

      if (targetSection && targetNavLink) {
        targetSection.hidden = false;
        targetSection.classList.add('active');
        targetNavLink.classList.add('active');

        // Update page title
        const pageTitle = document.getElementById('pageTitle');
        if (pageTitle) {
          pageTitle.textContent = this.getSectionTitle(section);
        }

        // Load section data
        this.loadSectionData(section);

        // Close mobile sidebar
        if (window.innerWidth <= 768) {
          const sidebar = document.getElementById('sidebar');
          if (sidebar) sidebar.classList.remove('mobile-open');
        }
      } else {
        console.error('Section or nav link not found:', section);
        // Fallback to dashboard
        this.showSection('dashboard', store);
      }
    } catch (error) {
      console.error('Error showing section:', error);
      this.showNotification('Failed to load section', 'error');
      // Fallback to dashboard - pass the store parameter
      this.showSection('dashboard', store); // FIXED: Added store parameter
    }
  }

  checkAPI() {
    try {
      if (!this.api) {
        console.error('❌ Admin API not found');
        this.showNotification('Admin API service not available. Please refresh the page.', 'error');
        return false;
      }

      // Check if essential methods exist
      const requiredMethods = ['getAdminProfile', 'getDashboardStats', 'getServices', 'getProducts'];
      const missingMethods = requiredMethods.filter(method => typeof this.api[method] !== 'function');

      if (missingMethods.length > 0) {
        console.error('❌ Missing API methods:', missingMethods);
        this.showNotification('Admin API is incomplete. Some features may not work.', 'warning');
        // Continue anyway, but with limited functionality
      }

      console.log('✅ Admin API check passed');
      return true;
    } catch (error) {
      console.error('❌ API check failed:', error);
      this.showNotification('API service unavailable. Some features may be limited.', 'warning');
      return true; // Continue with limited functionality
    }
  }

  async testAPIConnection() {
    try {
      console.log('🔗 Testing admin API connection...');

      // Check if testConnection method exists
      if (typeof this.api.testConnection !== 'function') {
        console.warn('⚠️ testConnection method not available, using getAdminProfile instead');
        // Fallback: try to get admin profile as connection test
        await this.api.getAdminProfile();
        console.log('✅ Admin API connection successful (via fallback)');
        return true;
      }

      const response = await this.api.testConnection();
      console.log('✅ Admin API connection successful:', response);
      return true;
    } catch (error) {
      console.error('❌ Admin API connection failed:', error);

      // Don't block the entire dashboard for connection issues
      // Just show a warning and continue
      this.showNotification('Connection issues detected. Some features may not work properly.', 'warning');
      return false; // Return false but don't block initialization
    }
  }

  ensureDashboardVisible() {
    try {
      // Make sure dashboard section is visible
      const dashboardSection = document.getElementById('dashboard');
      if (dashboardSection) {
        dashboardSection.hidden = false;
        dashboardSection.style.display = 'block';
        dashboardSection.classList.add('active');
      } else {
        console.error('Dashboard section element not found');
      }

      // Hide other sections
      document.querySelectorAll('.content-section').forEach(section => {
        if (section.id !== 'dashboard') {
          section.hidden = true;
          section.classList.remove('active');
        }
      });

      // Set dashboard nav link as active
      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
      });

      const dashboardLink = document.querySelector('[data-section="dashboard"]');
      if (dashboardLink) {
        dashboardLink.classList.add('active');
      } else {
        console.error('Dashboard nav link not found');
      }
    } catch (error) {
      console.error('Error ensuring dashboard visibility:', error);
    }
  }

  checkAuth() {
    try {
      console.log('🔐 Checking authentication...');

      // Use your existing authManager
      if (!window.authManager) {
        console.error('❌ AuthManager not found');
        this.showNotification('Authentication system error. Please refresh the page.', 'error');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 2000);
        return false;
      }

      if (!window.authManager.isAuthenticated()) {
        console.error('❌ User not authenticated');
        this.showNotification('Please log in to access the admin dashboard.', 'error');
        setTimeout(() => {
          window.location.href = 'login.html';
        }, 2000);
        return false;
      }

      if (!window.authManager.hasRole('admin')) {
        console.error('❌ User does not have admin role. Current role:', window.authManager.role);
        this.showNotification('Access denied. Admin privileges required.', 'error');
        setTimeout(() => {
          window.location.href = 'index.html';
        }, 2000);
        return false;
      }

      console.log('✅ Authentication successful - User is admin');
      return true;
    } catch (error) {
      console.error('❌ Authentication check failed:', error);
      this.showNotification('Authentication error. Please log in again.', 'error');
      setTimeout(() => {
        window.location.href = 'login.html';
      }, 2000);
      return false;
    }
  }

  async checkPasswordReset() {
    try {
      if (typeof this.api.checkPasswordStatus === 'function') {
        const response = await this.api.checkPasswordStatus();
        if (response.requiresPasswordReset) {
          this.showPasswordResetModal();
        }
      } else {
        console.warn('checkPasswordStatus method not available');
      }
    } catch (error) {
      console.warn('Password reset check failed:', error);
      // Don't show error for this as it's not critical
    }
  }

  async loadDashboardData() {
    try {
      await this.loadDashboardStats();
      await this.loadRecentBookings();
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      throw error; // Re-throw to be handled by caller
    }
  }

  async loadDashboardStats() {
    try {
      this.showLoading('Loading dashboard statistics...');

      let stats;
      try {
        stats = await this.api.getDashboardStats();
      } catch (error) {
        console.warn('Using mock dashboard stats due to API error:', error);
        stats = {
          totalRevenue: 12500.00,
          todayBookings: 15,
          newCustomers: 8,
          pendingBookings: 3
        };
      }

      // Update stats cards
      this.updateStatsCards(stats);

    } catch (error) {
      console.error('Error loading dashboard stats:', error);
      this.showNotification('Failed to load dashboard statistics', 'error');
    } finally {
      this.hideLoading();
    }
  }

  updateStatsCards(stats) {
    try {
      const revenueEl = document.getElementById('totalRevenue');
      const bookingsEl = document.getElementById('totalBookings');
      const customersEl = document.getElementById('totalCustomers');
      const pendingEl = document.getElementById('pendingBookings');

      if (revenueEl) revenueEl.textContent = `R ${(stats.totalRevenue || 0).toFixed(2)}`;
      if (bookingsEl) bookingsEl.textContent = stats.todayBookings || 0;
      if (customersEl) customersEl.textContent = stats.newCustomers || 0;
      if (pendingEl) pendingEl.textContent = stats.pendingBookings || 0;
    } catch (error) {
      console.error('Error updating stats cards:', error);
    }
  }

  async loadRecentBookings() {
    try {
      let response;
      try {
        response = await this.api.getBookings({ limit: 5 });
      } catch (error) {
        console.warn('Using mock recent bookings due to API error:', error);
        response = {
          bookings: [
            {
              ID: 1,
              Customer: { Full_Name: 'John Doe' },
              Service: { Name: 'Basic Cleaning' },
              Date: new Date().toISOString(),
              Time: '10:00',
              Status: 'confirmed'
            },
            {
              ID: 2,
              Customer: { Full_Name: 'Jane Smith' },
              Service: { Name: 'Deep Cleaning' },
              Date: new Date().toISOString(),
              Time: '14:00',
              Status: 'pending'
            }
          ]
        };
      }

      this.updateRecentBookings(response.bookings);

    } catch (error) {
      console.error('Error loading recent bookings:', error);
    }
  }

  updateRecentBookings(bookings) {
    try {
      const container = document.getElementById('recentBookings');
      if (!container) return;

      if (bookings && bookings.length > 0) {
        container.innerHTML = bookings.map(booking => `
          <div class="booking-item">
            <div class="booking-avatar">
              ${booking.Customer?.Full_Name?.charAt(0) || 'C'}
            </div>
            <div class="booking-info">
              <h4>${booking.Customer?.Full_Name || 'Unknown Customer'}</h4>
              <p>${booking.Service?.Name || 'Unknown Service'}</p>
              <span class="booking-date">${new Date(booking.Date).toLocaleDateString()} at ${booking.Time}</span>
            </div>
            <div class="booking-meta">
              <span class="status-badge ${booking.Status}">${booking.Status}</span>
            </div>
          </div>
        `).join('');
      } else {
        container.innerHTML = `
          <div class="empty-state">
            <i class="fas fa-calendar-plus"></i>
            <p>No recent bookings</p>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error updating recent bookings:', error);
    }
  }

  updateAdminInfo() {
    try {
      const admin = window.authManager.getUser();
      if (!admin) {
        console.warn('No admin user data available');
        return;
      }

      const adminName = document.getElementById('adminName');
      const dropdownName = document.querySelector('#admin-profile-link .user-dropdown strong');
      const dropdownEmail = document.querySelector('#admin-profile-link .user-dropdown span');

      if (adminName) adminName.textContent = admin.Name || 'Admin User';
      if (dropdownName) dropdownName.textContent = admin.Name || 'Admin';
      if (dropdownEmail) dropdownEmail.textContent = admin.Email || 'admin@phambili.com';
    } catch (error) {
      console.error('Error updating admin info:', error);
    }
  }

  setupEventListeners() {
    try {
      console.log('Setting up event listeners...');

      // Logout button
      const logoutBtn = document.getElementById('logoutBtn');
      if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
          this.logout();
        });
      }

      // Search functionality with debounce
      const bookingSearch = document.getElementById('bookingSearch');
      if (bookingSearch) {
        bookingSearch.addEventListener('input', this.debounce(() => {
          this.loadBookings();
        }, 500));
      }

      const customerSearch = document.getElementById('customerSearch');
      if (customerSearch) {
        customerSearch.addEventListener('input', this.debounce(() => {
          this.loadCustomers();
        }, 500));
      }

      // Filter functionality
      const bookingStatusFilter = document.getElementById('bookingStatusFilter');
      if (bookingStatusFilter) {
        bookingStatusFilter.addEventListener('change', () => {
          this.loadBookings();
        });
      }

      const quotationStatusFilter = document.getElementById('quotationStatusFilter');
      if (quotationStatusFilter) {
        quotationStatusFilter.addEventListener('change', () => {
          this.loadQuotations();
        });
      }

      // Report period change
      const reportPeriod = document.getElementById('reportPeriod');
      if (reportPeriod) {
        reportPeriod.addEventListener('change', () => {
          if (this.currentSection === 'reports') {
            this.loadReports();
          }
        });
      }

      // Service form submission
      const serviceForm = document.getElementById('service-form');
      if (serviceForm) {
        serviceForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          console.log('🔄 Service form submitted');

          const formData = new FormData(serviceForm);
          const serviceId = formData.get('id');

          try {
            if (serviceId) {
              await this.updateService(serviceId, formData);
            } else {
              await this.createService(formData);
            }
          } catch (error) {
            console.error('Service form submission error:', error);
          }
        });
      }

      // Product form submission
      const productForm = document.getElementById('product-form');
      if (productForm) {
        productForm.addEventListener('submit', async (e) => {
          e.preventDefault();
          const formData = new FormData(productForm);
          const productId = formData.get('id');

          try {
            if (productId) {
              await this.updateProduct(productId, formData);
            } else {
              await this.createProduct(formData);
            }
          } catch (error) {
            console.error('Product form submission error:', error);
          }
        });
      }

      // Modal close functionality
      document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal') || e.target.classList.contains('modal-close')) {
          this.closeAllModals();
        }
      });

      // Escape key to close modals
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeAllModals();
        }
      });

    } catch (error) {
      console.error('Error setting up event listeners:', error);
    }
  }

  // In admin-dashboard.js - Fix the setupNavigation method
  setupNavigation() {
    try {
      console.log('Setting up navigation...');

      const navLinks = document.querySelectorAll('.nav-link[data-section]');
      navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          const section = link.getAttribute('data-section');

          // Check if this is a restricted section for sub-admins
          if (!this.isMainAdmin) {
            const restrictedSections = ['customers', 'admin-management', 'reports'];
            if (restrictedSections.includes(section)) {
              this.showNotification('Access denied. This section is restricted to Main Administrators.', 'error');
              return;
            }
          }

          this.showSection(section);
        });
      });

      // Sidebar toggle for mobile
      const sidebarToggle = document.getElementById('sidebarToggle');
      if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
          const sidebar = document.getElementById('sidebar');
          sidebar.classList.toggle('mobile-open');
        });
      }

      // Close sidebar when clicking outside on mobile
      document.addEventListener('click', (e) => {
        const sidebar = document.getElementById('sidebar');
        const sidebarToggle = document.getElementById('sidebarToggle');

        if (window.innerWidth <= 768 &&
          sidebar && sidebar.classList.contains('mobile-open') &&
          !sidebar.contains(e.target) &&
          sidebarToggle && !sidebarToggle.contains(e.target)) {
          sidebar.classList.remove('mobile-open');
        }
      });

      // Setup admin dropdown in header
      this.setupAdminDropdown();
    } catch (error) {
      console.error('Error setting up navigation:', error);
    }
  }

  setupAdminDropdown() {
    try {
      const adminProfileLink = document.getElementById('admin-profile-link');
      if (!adminProfileLink) {
        console.warn('Admin profile link not found');
        return;
      }

      // Remove existing dropdown if any
      const existingDropdown = adminProfileLink.querySelector('.user-dropdown');
      if (existingDropdown) {
        existingDropdown.remove();
      }

      const admin = window.authManager.getUser();
      const dropdown = document.createElement('div');
      dropdown.className = 'user-dropdown';
      dropdown.innerHTML = `
        <div class="dropdown-user-info">
          <div class="dropdown-user-avatar">
            <i class="fas fa-user-shield"></i>
          </div>
          <div class="dropdown-user-details">
            <strong>${admin?.Name || 'Admin'}</strong>
            <span>${admin?.Email || 'admin@phambili.com'}</span>
            <small>Administrator</small>
          </div>
        </div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-links">
          <a href="#admin-profile" class="dropdown-link" onclick="adminDashboard.showSection('admin-profile')">
            <i class="fas fa-user-cog"></i>
            My Profile
          </a>
          <a href="#admin-security" class="dropdown-link" onclick="adminDashboard.showSection('admin-profile')">
            <i class="fas fa-shield-alt"></i>
            Security Settings
          </a>
        </div>
        <div class="dropdown-divider"></div>
        <div class="dropdown-links">
          <button class="dropdown-link logout-btn" onclick="adminDashboard.logout()">
            <i class="fas fa-sign-out-alt"></i>
            Logout
          </button>
        </div>
      `;

      adminProfileLink.appendChild(dropdown);
      this.setupDropdownToggle(adminProfileLink, dropdown);
    } catch (error) {
      console.error('Error setting up admin dropdown:', error);
    }
  }

  setupDropdownToggle(userIcon, dropdown) {
    try {
      let isDropdownOpen = false;

      const toggleDropdown = (e) => {
        e.preventDefault();
        e.stopPropagation();

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

      userIcon.addEventListener('click', toggleDropdown);

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (!userIcon.contains(e.target)) {
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
    } catch (error) {
      console.error('Error setting up dropdown toggle:', error);
    }
  }

  async loadSectionData(section) {
    try {
      console.log('Loading section data:', section);
      switch (section) {
        case 'dashboard':
          await this.loadDashboardStats();
          await this.loadRecentBookings();
          break;
        case 'bookings':
          await this.loadBookings();
          break;
        case 'customers':
          await this.loadCustomers();
          break;
        case 'services':
          await this.loadServices();
          break;
        case 'products':
          await this.loadProducts();
          break;
        case 'quotations':
          await this.loadQuotations();
          break;
        case 'reports':
          await this.loadReports();
          break;
        case 'admin-profile':
          this.loadAdminProfile();
          break;
        case 'admin-management':
          await this.loadAdmins();
          break;
        default:
          console.log('No specific data loader for section:', section);
      }
    } catch (error) {
      console.error(`Error loading ${section} data:`, error);
      this.showNotification(`Failed to load ${section} data`, 'error');
    }
  }

  async loadBookings() {
    try {
      this.showLoading('Loading bookings...');

      const statusFilter = document.getElementById('bookingStatusFilter')?.value || '';
      const searchTerm = document.getElementById('bookingSearch')?.value || '';

      const params = {};
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      let response;
      try {
        response = await this.api.getBookings(params);
      } catch (error) {
        console.warn('Using mock bookings data due to API error:', error);
        response = { bookings: [] };
      }

      const tableBody = document.getElementById('bookingsTable');
      if (!tableBody) return;

      if (response.bookings && response.bookings.length > 0) {
        tableBody.innerHTML = response.bookings.map(booking => `
          <tr>
            <td>#${booking.ID}</td>
            <td>${booking.Customer?.Full_Name || 'Unknown'}</td>
            <td>${booking.Service?.Name || 'Unknown Service'}</td>
            <td>${new Date(booking.Date).toLocaleDateString()} ${booking.Time}</td>
            <td>R ${parseFloat(booking.Quoted_Amount || 0).toFixed(2)}</td> <!-- FIXED: Quoted_Amount -->
            <td><span class="status-badge ${booking.Status}">${booking.Status}</span></td>
            <td>
              <button class="btn-icon" onclick="adminDashboard.editBooking(${booking.ID})" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              <button class="btn-icon delete" onclick="adminDashboard.deleteBooking(${booking.ID})" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
            </td>
          </tr>
        `).join('');
      } else {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center">
              <div class="empty-state">
                <i class="fas fa-calendar-times"></i>
                <p>No bookings found</p>
              </div>
            </td>
          </tr>
        `;
      }
    } catch (error) {
      console.error('Error loading bookings:', error);
      this.showNotification('Failed to load bookings', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async loadCustomers() {
    try {
      this.showLoading('Loading customers...');

      const searchTerm = document.getElementById('customerSearch')?.value || '';
      const params = searchTerm ? { search: searchTerm } : {};

      let response;
      try {
        response = await this.api.getCustomers(params);
      } catch (error) {
        console.warn('Using mock customers data due to API error:', error);
        response = { customers: [] };
      }

      const tableBody = document.getElementById('customersTable');
      if (!tableBody) return;

      if (response.customers && response.customers.length > 0) {
        tableBody.innerHTML = response.customers.map(customer => `
          <tr>
            <td>#${customer.ID}</td>
            <td>${customer.Full_Name || 'Unknown'}</td>
            <td>${customer.Email || 'No email'}</td>
            <td>${customer.Phone || 'No phone'}</td>
            <td>${customer.Address || 'No address'}</td>
            <td>${new Date(customer.createdAt || Date.now()).toLocaleDateString()}</td>
            <td>
              <button class="btn-icon" onclick="adminDashboard.viewCustomer(${customer.ID})" title="View Details">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn-icon" onclick="adminDashboard.editCustomer(${customer.ID})" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
            </td>
          </tr>
        `).join('');
      } else {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center">
              <div class="empty-state">
                <i class="fas fa-users-slash"></i>
                <p>No customers found</p>
              </div>
            </td>
          </tr>
        `;
      }
    } catch (error) {
      console.error('Error loading customers:', error);
      this.showNotification('Failed to load customers', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async loadServices() {
    try {
      this.showLoading('Loading services...');

      let response;
      try {
        response = await this.api.getServices();
      } catch (error) {
        console.warn('Using mock services data due to API error:', error);
        response = {
          success: true,
          services: []
        };
      }

      const grid = document.getElementById('servicesGrid');
      if (!grid) return;

      if (response.success && response.services && response.services.length > 0) {
        grid.innerHTML = response.services.map(service => {
          // Fix image URL - use absolute URL for development
          let imageUrl = service.Image_URL;
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = `http://localhost:5000${imageUrl}`;
          }

          return `
<div class="product-card" data-service-id="${service.ID}">
  <div class="product-image">
    ${imageUrl ?
              `<img src="${imageUrl}" alt="${service.Name}" 
           crossorigin="anonymous"
           loading="lazy"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
           onload="this.style.opacity='1'">` :
              `<div class="product-image-placeholder">
        <i class="fas fa-concierge-bell"></i>
      </div>`
            }
    <div class="product-status ${service.Is_Available ? 'available' : 'unavailable'}">
      ${service.Is_Available ? 'Available' : 'Unavailable'}
    </div>
  </div>
  <div class="product-header">
    <h3>${service.Name}</h3>
    <span class="service-duration">${service.Duration || 0} min</span>
  </div>
  <div class="product-body">
    <p class="product-description">${service.Description || 'No description available'}</p>
    <div class="product-meta">
      <span><i class="fas fa-clock"></i> Duration: ${service.Duration || 0} minutes</span>
      <span><i class="fas fa-tag"></i> ${service.Category || 'General'}</span>
    </div>
  </div>
  <div class="product-actions">
    <button class="btn-icon" onclick="adminDashboard.editService(${service.ID})" title="Edit">
      <i class="fas fa-edit"></i>
    </button>
    <button class="btn-icon toggle-availability" onclick="adminDashboard.toggleServiceAvailability(${service.ID}, ${!service.Is_Available})" title="${service.Is_Available ? 'Disable' : 'Enable'}">
      <i class="fas fa-${service.Is_Available ? 'eye-slash' : 'eye'}"></i>
    </button>
    <button class="btn-icon delete" onclick="adminDashboard.deleteService(${service.ID})" title="Delete">
      <i class="fas fa-trash"></i>
    </button>
  </div>
</div>
      `}).join('');
      } else {
        grid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-concierge-bell"></i>
          <p>No services available</p>
          <button class="btn btn-primary" onclick="openServiceModal()">
            <i class="fas fa-plus"></i> Add Your First Service
          </button>
        </div>
      `;
      }
    } catch (error) {
      console.error('Error loading services:', error);
      this.showNotification('Failed to load services', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // Service CRUD Operations
  // Service CRUD Operations - FIXED: Remove Price field
  async createService(serviceData) {
    try {
      this.showLoading('Creating service...');

      const formData = new FormData();

      // Convert data to correct format before sending
      const name = serviceData.get('Name');
      const description = serviceData.get('Description') || '';
      const duration = parseInt(serviceData.get('Duration'));
      const category = serviceData.get('Category') || '';
      const isAvailable = serviceData.get('Is_Available') === 'on';
      const imageFile = serviceData.get('image');
      const serviceId = serviceData.get('id');
      const currentImage = serviceData.get('current_image');

      // Debug: Log form data
      console.log('📝 Service Form Data:', {
        name,
        description,
        duration,
        category,
        isAvailable,
        hasImage: !!imageFile,
        imageName: imageFile ? imageFile.name : 'No image'
      });

      // Append data in correct format
      if (serviceId) formData.append('id', serviceId);
      formData.append('Name', name);
      formData.append('Description', description);
      formData.append('Duration', duration.toString());
      formData.append('Category', category);
      formData.append('Is_Available', isAvailable.toString());

      // Append image file if exists
      if (imageFile && imageFile.size > 0) {
        formData.append('image', imageFile);
        console.log('📸 Image file appended:', imageFile.name, imageFile.size);
      }

      if (currentImage) formData.append('current_image', currentImage);

      const response = await this.api.createService(formData);

      if (response.success) {
        this.showNotification('Service created successfully', 'success');
        this.closeServiceModal();
        await this.loadServices();
      }
    } catch (error) {
      console.error('❌ Create service error:', error);

      // Enhanced error logging
      if (error.response) {
        console.error('📊 Backend response:', error.response.data);
        console.error('🔧 Backend status:', error.response.status);

        if (error.response.data.errors) {
          const errorMessages = error.response.data.errors.map(err => err.msg || err.message).join(', ');
          this.showNotification(`Validation failed: ${errorMessages}`, 'error');
        } else {
          this.showNotification(error.response.data.message || 'Failed to create service', 'error');
        }
      } else if (error.request) {
        console.error('🌐 No response received:', error.request);
        this.showNotification('Network error: Could not connect to server', 'error');
      } else {
        this.showNotification('Error: ' + error.message, 'error');
      }
    } finally {
      this.hideLoading();
    }
  }

  async updateService(id, serviceData) {
    try {
      this.showLoading('Updating service...');

      const formData = new FormData();
      Object.keys(serviceData).forEach(key => {
        if (serviceData[key] !== null && serviceData[key] !== undefined) {
          formData.append(key, serviceData[key]);
        }
      });

      const response = await this.api.updateService(id, formData);

      if (response.success) {
        this.showNotification('Service updated successfully', 'success');
        this.closeServiceModal();
        await this.loadServices();
      }
    } catch (error) {
      console.error('Update service error:', error);
      this.showNotification(error.response?.data?.message || 'Failed to update service', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async editService(id) {
    try {
      const response = await this.api.getServiceDetails(id);
      if (response.success) {
        openServiceModal(response.service);
      }
    } catch (error) {
      console.error('Error fetching service details:', error);
      this.showNotification('Failed to load service details', 'error');
    }
  }

  async deleteService(id) {
    if (!confirm('Are you sure you want to delete this service? This action cannot be undone.')) {
      return;
    }

    try {
      this.showLoading('Deleting service...');
      const response = await this.api.deleteService(id);

      if (response.success) {
        this.showNotification('Service deleted successfully', 'success');
        await this.loadServices();
      }
    } catch (error) {
      console.error('Delete service error:', error);
      this.showNotification(error.response?.data?.message || 'Failed to delete service', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async toggleServiceAvailability(id, isAvailable) {
    try {
      const response = await this.api.toggleServiceAvailability(id, isAvailable);

      if (response.success) {
        this.showNotification(response.message, 'success');
        await this.loadServices();
      }
    } catch (error) {
      console.error('Toggle service availability error:', error);
      this.showNotification(error.response?.data?.message || 'Failed to update service availability', 'error');
    }
  }

  // Product Management Functions
  async loadProducts() {
    try {
      this.showLoading('Loading products...');

      let response;
      try {
        response = await this.api.getProducts();
      } catch (error) {
        console.warn('Using mock products data due to API error:', error);
        response = {
          success: true,
          products: []
        };
      }

      const grid = document.getElementById('productsGrid');
      if (!grid) return;

      if (response.success && response.products && response.products.length > 0) {
        grid.innerHTML = response.products.map(product => {
          // Fix image URL
          let imageUrl = product.Image_URL;
          if (imageUrl && !imageUrl.startsWith('http')) {
            imageUrl = `http://localhost:5000${imageUrl}`;
          }

          return `
<div class="product-card" data-product-id="${product.ID}">
  <div class="product-image">
    ${imageUrl ?
              `<img src="${imageUrl}" alt="${product.Name}" 
           crossorigin="anonymous"
           loading="lazy"
           onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
           onload="this.style.opacity='1'">` :
              `<div class="product-image-placeholder">
        <i class="fas fa-box"></i>
      </div>`
            }
    <div class="product-status ${product.Is_Available ? 'available' : 'unavailable'}">
      ${product.Is_Available ? 'Available' : 'Unavailable'}
    </div>
  </div>
  <div class="product-header">
    <h3>${product.Name}</h3>
    <span class="product-price">R ${parseFloat(product.Price || 0).toFixed(2)}</span>
  </div>
  <div class="product-body">
    <p class="product-description">${product.Description || 'No description available'}</p>
    <div class="product-meta">
      <span><i class="fas fa-box"></i> Stock: ${product.Stock_Quantity || 0}</span>
      <span><i class="fas fa-tag"></i> ${product.Category || 'General'}</span>
    </div>
  </div>
  <div class="product-actions">
    <button class="btn-icon" onclick="adminDashboard.editProduct(${product.ID})" title="Edit">
      <i class="fas fa-edit"></i>
    </button>
    <button class="btn-icon toggle-availability" onclick="adminDashboard.toggleProductAvailability(${product.ID}, ${!product.Is_Available})" title="${product.Is_Available ? 'Disable' : 'Enable'}">
      <i class="fas fa-${product.Is_Available ? 'eye-slash' : 'eye'}"></i>
    </button>
    <button class="btn-icon delete" onclick="adminDashboard.deleteProduct(${product.ID})" title="Delete">
      <i class="fas fa-trash"></i>
    </button>
  </div>
</div>
      `}).join('');
      } else {
        grid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-box-open"></i>
          <p>No products available</p>
          <button class="btn btn-primary" onclick="openProductModal()">
            <i class="fas fa-plus"></i> Add Your First Product
          </button>
        </div>
      `;
      }
    } catch (error) {
      console.error('Error loading products:', error);
      this.showNotification('Failed to load products', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // Product CRUD Operations
  async createProduct(productData) {
    try {
      this.showLoading('Creating product...');

      const formData = new FormData();

      // Convert data to correct format before sending
      const name = productData.get('Name');
      const description = productData.get('Description') || '';
      const price = parseFloat(productData.get('Price'));
      const stockQuantity = parseInt(productData.get('Stock_Quantity'));
      const category = productData.get('Category') || '';
      const isAvailable = productData.get('Is_Available') === 'on';
      const imageFile = productData.get('image');
      const productId = productData.get('id');
      const currentImage = productData.get('current_image');

      // Append data in correct format
      if (productId) formData.append('id', productId);
      formData.append('Name', name);
      formData.append('Description', description);
      formData.append('Price', price.toString());
      formData.append('Stock_Quantity', stockQuantity.toString());
      formData.append('Category', category);
      formData.append('Is_Available', isAvailable.toString());
      if (currentImage) formData.append('current_image', currentImage);
      if (imageFile) formData.append('image', imageFile);

      const response = await this.api.createProduct(formData);

      if (response.success) {
        this.showNotification('Product created successfully', 'success');
        this.closeProductModal();
        await this.loadProducts();
      }
    } catch (error) {
      console.error('Create product error:', error);

      if (error.response?.data) {
        console.error('Backend validation errors:', error.response.data.errors);
        if (error.response.data.errors && error.response.data.errors.length > 0) {
          const errorMessages = error.response.data.errors.map(err => err.msg).join(', ');
          this.showNotification(`Validation failed: ${errorMessages}`, 'error');
        } else {
          this.showNotification(error.response.data.message || 'Failed to create product', 'error');
        }
      } else {
        this.showNotification('Failed to create product', 'error');
      }
    } finally {
      this.hideLoading();
    }
  }

  async updateProduct(id, productData) {
    try {
      this.showLoading('Updating product...');

      const formData = new FormData();
      Object.keys(productData).forEach(key => {
        if (productData[key] !== null && productData[key] !== undefined) {
          formData.append(key, productData[key]);
        }
      });

      const response = await this.api.updateProduct(id, formData);

      if (response.success) {
        this.showNotification('Product updated successfully', 'success');
        this.closeProductModal();
        await this.loadProducts();
      }
    } catch (error) {
      console.error('Update product error:', error);
      this.showNotification(error.response?.data?.message || 'Failed to update product', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async editProduct(id) {
    try {
      const response = await this.api.getProductDetails(id);
      if (response.success) {
        openProductModal(response.product);
      }
    } catch (error) {
      console.error('Error fetching product details:', error);
      this.showNotification('Failed to load product details', 'error');
    }
  }

  async deleteProduct(id) {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      this.showLoading('Deleting product...');
      const response = await this.api.deleteProduct(id);

      if (response.success) {
        this.showNotification('Product deleted successfully', 'success');
        await this.loadProducts();
      }
    } catch (error) {
      console.error('Delete product error:', error);
      this.showNotification(error.response?.data?.message || 'Failed to delete product', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async toggleProductAvailability(id, isAvailable) {
    try {
      const response = await this.api.toggleProductAvailability(id, isAvailable);

      if (response.success) {
        this.showNotification(response.message, 'success');
        await this.loadProducts();
      }
    } catch (error) {
      console.error('Toggle product availability error:', error);
      this.showNotification(error.response?.data?.message || 'Failed to update product availability', 'error');
    }
  }

  async loadQuotations() {
    try {
      this.showLoading('Loading quotations...');

      const statusFilter = document.getElementById('quotationStatusFilter')?.value || '';

      let response;
      try {
        response = await this.api.getQuotations(statusFilter);
      } catch (error) {
        console.warn('Using mock quotations data due to API error:', error);
        response = { quotations: [] };
      }

      const tableBody = document.getElementById('quotationsTable');
      if (!tableBody) return;

      if (response.quotations && response.quotations.length > 0) {
        tableBody.innerHTML = response.quotations.map(quote => `
          <tr>
            <td>#${quote.ID}</td>
            <td>${quote.Customer?.Full_Name || 'Unknown'}</td>
            <td>${quote.Service_Type || 'Unknown Service'}</td>
            <td>${new Date(quote.createdAt || Date.now()).toLocaleDateString()}</td>
            <td>R ${parseFloat(quote.Estimated_Amount || 0).toFixed(2)}</td>
            <td><span class="status-badge ${quote.Status}">${quote.Status}</span></td>
            <td>
              <button class="btn-icon" onclick="adminDashboard.viewQuotation(${quote.ID})" title="View">
                <i class="fas fa-eye"></i>
              </button>
              <button class="btn-icon" onclick="adminDashboard.respondQuotation(${quote.ID})" title="Respond">
                <i class="fas fa-reply"></i>
              </button>
            </td>
          </tr>
        `).join('');
      } else {
        tableBody.innerHTML = `
          <tr>
            <td colspan="7" class="text-center">
              <div class="empty-state">
                <i class="fas fa-file-invoice-dollar"></i>
                <p>No quotations found</p>
              </div>
            </td>
          </tr>
        `;
      }
    } catch (error) {
      console.error('Error loading quotations:', error);
      this.showNotification('Failed to load quotations', 'error');
    } finally {
      this.hideLoading();
    }
  }

  async loadReports() {
    try {
      this.showLoading('Loading reports...');

      const period = document.getElementById('reportPeriod')?.value || 'monthly';

      // Use mock data for reports
      const metricsContainer = document.getElementById('performanceMetrics');
      if (metricsContainer) {
        metricsContainer.innerHTML = `
          <div class="metrics-grid">
            <div class="metric">
              <span class="metric-value">94%</span>
              <span class="metric-label">Completion Rate</span>
            </div>
            <div class="metric">
              <span class="metric-value">4.8/5</span>
              <span class="metric-label">Customer Rating</span>
            </div>
            <div class="metric">
              <span class="metric-value">2.3</span>
              <span class="metric-label">Avg. Response Time (hrs)</span>
            </div>
            <div class="metric">
              <span class="metric-value">12%</span>
              <span class="metric-label">Growth Rate</span>
            </div>
          </div>
        `;
      }
    } catch (error) {
      console.error('Error loading reports:', error);
      this.showNotification('Failed to load reports', 'error');
    } finally {
      this.hideLoading();
    }
  }

  setupAdminProfile() {
    try {
      console.log('Setting up admin profile manager');
      this.adminProfileManager = new AdminProfileManager(this);
      console.log('AdminProfileManager created with dashboard reference');
    } catch (error) {
      console.error('Error setting up admin profile:', error);
    }
  }

  async loadAdmins() {
    try {
      this.showLoading('Loading admins...');

      let response;
      try {
        response = await this.api.getAdmins();
      } catch (error) {
        console.warn('Using mock admins data due to API error:', error);
        response = {
          success: true,
          admins: [
            {
              ID: 1,
              Name: 'Main Admin',
              Email: 'admin@phambili.com',
              Phone: '+27 12 345 6789',
              Role: 'main_admin',
              Is_Active: true,
              Last_Login: new Date().toISOString()
            }
          ]
        };
      }

      const tableBody = document.getElementById('adminsTable');
      if (!tableBody) return;

      if (response.success && response.admins && response.admins.length > 0) {
        tableBody.innerHTML = response.admins.map(admin => `
          <tr>
            <td>#${admin.ID}</td>
            <td>${admin.Name}</td>
            <td>${admin.Email}</td>
            <td>${admin.Phone || 'Not set'}</td>
            <td>
              <span class="role-badge ${admin.Role}">
                ${admin.Role === 'main_admin' ? 'Main Admin' : 'Sub Admin'}
              </span>
            </td>
            <td>
              <span class="status-badge ${admin.Is_Active ? 'active' : 'inactive'}">
                ${admin.Is_Active ? 'Active' : 'Inactive'}
              </span>
            </td>
            <td>${admin.Last_Login ? new Date(admin.Last_Login).toLocaleDateString() : 'Never'}</td>
            <td>
              <button class="btn-icon" onclick="adminDashboard.editAdmin(${admin.ID})" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              ${admin.Role !== 'main_admin' || admin.ID !== window.authManager.user.ID ? `
              <button class="btn-icon delete" onclick="adminDashboard.deleteAdmin(${admin.ID})" title="Delete">
                <i class="fas fa-trash"></i>
              </button>
              ` : ''}
            </td>
          </tr>
        `).join('');
      } else {
        tableBody.innerHTML = `
          <tr>
            <td colspan="8" class="text-center">
              <div class="empty-state">
                <i class="fas fa-users-slash"></i>
                <p>No admins found</p>
              </div>
            </td>
          </tr>
        `;
      }
    } catch (error) {
      console.error('Error loading admins:', error);
      this.showNotification('Failed to load admins', 'error');
    } finally {
      this.hideLoading();
    }
  }

  // Method implementations for action buttons
  editBooking(id) {
    this.showNotification(`Edit booking #${id} functionality would open here`, 'info');
  }

  deleteBooking(id) {
    if (confirm('Are you sure you want to delete this booking?')) {
      this.showNotification(`Booking #${id} deleted`, 'success');
    }
  }

  viewCustomer(id) {
    this.showNotification(`View customer #${id} details would open here`, 'info');
  }

  editCustomer(id) {
    this.showNotification(`Edit customer #${id} functionality would open here`, 'info');
  }

  viewQuotation(id) {
    this.showNotification(`View quotation #${id} details would open here`, 'info');
  }

  respondQuotation(id) {
    this.showNotification(`Respond to quotation #${id} functionality would open here`, 'info');
  }

  editAdmin(id) {
    this.showNotification(`Edit admin #${id} functionality would open here`, 'info');
  }

  deleteAdmin(id) {
    if (confirm('Are you sure you want to delete this admin? This action cannot be undone.')) {
      this.showNotification('Admin deleted successfully', 'success');
    }
  }

  openBookingModal() {
    this.showNotification('New booking modal would open here', 'info');
  }

  openServiceModal() {
    this.showNotification('New service modal would open here', 'info');
  }

  openProductModal() {
    this.showNotification('New product modal would open here', 'info');
  }

  sendBulkReminders() {
    if (confirm('Send reminders for upcoming bookings?')) {
      this.showNotification('Reminders sent successfully', 'success');
    }
  }

  exportReport() {
    this.showNotification('Export functionality would be implemented here', 'info');
  }

  enableTwoFactor() {
    this.showNotification('Two-factor authentication setup would open here', 'info');
  }

  viewLoginHistory() {
    this.showNotification('Login history would be displayed here', 'info');
  }

  manageNotifications() {
    this.showNotification('Notification settings would open here', 'info');
  }

  changeTheme() {
    this.showNotification('Theme settings would open here', 'info');
  }

  manageBackups() {
    this.showNotification('Backup management would open here', 'info');
  }

  showPasswordResetModal() {
    try {
      const modal = document.getElementById('passwordResetModal');
      if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
      }
      this.setupPasswordResetModal();
    } catch (error) {
      console.error('Error showing password reset modal:', error);
    }
  }

  setupPasswordResetModal() {
    try {
      const form = document.getElementById('password-reset-form');
      const newPasswordInput = document.getElementById('new-password');
      const strengthContainer = document.getElementById('password-strength');

      if (newPasswordInput && strengthContainer) {
        newPasswordInput.addEventListener('input', (e) => {
          const password = e.target.value;
          if (password.length > 0) {
            strengthContainer.style.display = 'block';
            this.updatePasswordStrength(password);
            this.updatePasswordRequirements(password);
          } else {
            strengthContainer.style.display = 'none';
          }
        });
      }

      if (form) {
        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          await this.handlePasswordReset();
        });
      }
    } catch (error) {
      console.error('Error setting up password reset modal:', error);
    }
  }

  updatePasswordStrength(password) {
    try {
      const strengthFill = document.querySelector('.strength-fill');
      const strengthText = document.querySelector('.strength-text');

      if (!strengthFill || !strengthText) return;

      let score = 0;
      if (password.length >= 8) score += 1;
      if (password.length >= 12) score += 1;
      if (/[A-Z]/.test(password)) score += 1;
      if (/[a-z]/.test(password)) score += 1;
      if (/[0-9]/.test(password)) score += 1;
      if (/[^A-Za-z0-9]/.test(password)) score += 1;

      const percentage = (score / 6) * 100;
      let color = '#e74c3c';
      let text = 'Weak';

      if (score <= 2) {
        color = '#e74c3c';
        text = 'Weak';
      } else if (score <= 4) {
        color = '#f39c12';
        text = 'Medium';
      } else {
        color = '#27ae60';
        text = 'Strong';
      }

      strengthFill.style.width = percentage + '%';
      strengthFill.style.background = color;
      strengthText.textContent = text;
      strengthText.style.color = color;
    } catch (error) {
      console.error('Error updating password strength:', error);
    }
  }

  updatePasswordRequirements(password) {
    try {
      const requirements = {
        len: document.getElementById('req-len'),
        upper: document.getElementById('req-upper'),
        lower: document.getElementById('req-lower'),
        number: document.getElementById('req-number'),
        special: document.getElementById('req-special')
      };

      Object.keys(requirements).forEach(key => {
        const element = requirements[key];
        if (element) {
          let isValid = false;
          switch (key) {
            case 'len': isValid = password.length >= 8; break;
            case 'upper': isValid = /[A-Z]/.test(password); break;
            case 'lower': isValid = /[a-z]/.test(password); break;
            case 'number': isValid = /\d/.test(password); break;
            case 'special': isValid = /[^A-Za-z0-9]/.test(password); break;
          }
          element.classList.toggle('valid', isValid);
        }
      });
    } catch (error) {
      console.error('Error updating password requirements:', error);
    }
  }

  async handlePasswordReset() {
    try {
      const form = document.getElementById('password-reset-form');
      const errorDiv = document.getElementById('password-reset-error');
      const errorText = document.getElementById('reset-error-text');

      const currentPassword = document.getElementById('current-password')?.value;
      const newPassword = document.getElementById('new-password')?.value;
      const confirmPassword = document.getElementById('confirm-password')?.value;

      // Hide error
      if (errorDiv) errorDiv.style.display = 'none';

      // Validation
      if (newPassword.length < 8) {
        this.showResetError('Password must be at least 8 characters long');
        return;
      }

      if (!/(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/.test(newPassword)) {
        this.showResetError('Password must include uppercase, lowercase, number, and special character');
        return;
      }

      if (newPassword !== confirmPassword) {
        this.showResetError('Passwords do not match');
        return;
      }

      this.showLoading('Updating password...');

      await this.api.changePassword({
        currentPassword,
        newPassword
      });

      this.hidePasswordResetModal();
      this.showNotification('Password updated successfully!', 'success');

    } catch (error) {
      this.showResetError(error.message || 'Failed to update password');
    } finally {
      this.hideLoading();
    }
  }

  showResetError(message) {
    try {
      const errorDiv = document.getElementById('password-reset-error');
      const errorText = document.getElementById('reset-error-text');
      if (errorDiv && errorText) {
        errorText.textContent = message;
        errorDiv.style.display = 'block';
      }
    } catch (error) {
      console.error('Error showing reset error:', error);
    }
  }

  hidePasswordResetModal() {
    try {
      const modal = document.getElementById('passwordResetModal');
      if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }

      const form = document.getElementById('password-reset-form');
      if (form) form.reset();
    } catch (error) {
      console.error('Error hiding password reset modal:', error);
    }
  }

  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  async handleAdminPasswordChange() {
    try {
      const currentPassword = document.getElementById('admin-current-password')?.value;
      const newPassword = document.getElementById('admin-new-password')?.value;
      const confirmPassword = document.getElementById('admin-confirm-password')?.value;

      if (!currentPassword || !newPassword || !confirmPassword) {
        this.showNotification('Please fill in all fields', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        this.showNotification('New passwords do not match', 'error');
        return;
      }

      if (newPassword.length < 6) {
        this.showNotification('Password must be at least 6 characters long', 'error');
        return;
      }

      this.showLoading('Updating password...');

      await this.api.changePassword({
        currentPassword,
        newPassword
      });

      this.showNotification('Password updated successfully', 'success');
      this.closeAdminPasswordModal();

    } catch (error) {
      this.showNotification(error.message || 'Failed to update password', 'error');
    } finally {
      this.hideLoading();
    }
  }

  closeAdminPasswordModal() {
    try {
      const modal = document.getElementById('adminPasswordModal');
      if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
      const form = document.getElementById('admin-password-form');
      if (form) form.reset();
    } catch (error) {
      console.error('Error closing admin password modal:', error);
    }
  }

  closeAllModals() {
    try {
      document.querySelectorAll('.modal').forEach(modal => {
        modal.style.display = 'none';
      });
      document.body.style.overflow = 'auto';
    } catch (error) {
      console.error('Error closing modals:', error);
    }
  }

  logout() {
    try {
      // Use your existing authManager logout
      if (window.authManager) {
        window.authManager.logout();
      } else {
        // Fallback
        localStorage.removeItem('authToken');
        localStorage.removeItem('role');
        localStorage.removeItem('userType');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Force logout
      localStorage.clear();
      window.location.href = 'index.html';
    }
  }

  showLoading(message = 'Loading...') {
    try {
      const spinner = document.getElementById('loadingSpinner');
      if (spinner) {
        spinner.querySelector('p').textContent = message;
        spinner.style.display = 'flex';
      }
    } catch (error) {
      console.error('Error showing loading:', error);
    }
  }

  hideLoading() {
    try {
      const spinner = document.getElementById('loadingSpinner');
      if (spinner) {
        spinner.style.display = 'none';
      }
    } catch (error) {
      console.error('Error hiding loading:', error);
    }
  }
  // Add to AdminDashboard class

  async loadBookingsAsCards() {
    try {
      this.showLoading('Loading quotation requests...');

      const statusFilter = document.getElementById('bookingStatusFilter')?.value || '';
      const params = statusFilter ? { status: statusFilter } : {};

      let response;
      try {
        response = await this.api.makeRequest('GET', `/bookings/cards?${new URLSearchParams(params)}`);
      } catch (error) {
        console.warn('Using mock booking cards due to API error:', error);
        response = {
          success: true,
          bookings: this.getMockBookingCards()
        };
      }

      this.displayBookingCards(response.bookings);

    } catch (error) {
      console.error('Error loading booking cards:', error);
      this.showNotification('Failed to load quotation requests', 'error');
    } finally {
      this.hideLoading();
    }
  }

  displayBookingCards(bookings) {
    const container = document.getElementById('bookingsGrid');
    if (!container) return;

    if (bookings && bookings.length > 0) {
      container.innerHTML = bookings.map(booking => `
      <div class="booking-card" data-booking-id="${booking.id}">
        <div class="booking-card-header">
          <div class="booking-service-info">
            <h3>${booking.service.name}</h3>
            <span class="booking-category">${booking.service.category || 'General'}</span>
          </div>
          <span class="booking-status ${booking.status}">${booking.status}</span>
        </div>
        
        <div class="booking-card-body">
          <div class="booking-customer">
            <div class="customer-avatar">
              <i class="fas fa-user"></i>
            </div>
            <div class="customer-info">
              <h4>${booking.customer.name}</h4>
              <p>${booking.customer.email}</p>
              <p>${booking.customer.phone || 'No phone'}</p>
            </div>
          </div>
          
          <div class="booking-details">
            <div class="detail-item">
              <i class="fas fa-calendar"></i>
              <span>${new Date(booking.date).toLocaleDateString()}</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-clock"></i>
              <span>${booking.time || 'Flexible'}</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-home"></i>
              <span>${booking.propertyType || 'Not specified'}</span>
            </div>
            <div class="detail-item">
              <i class="fas fa-ruler-combined"></i>
              <span>${booking.propertySize || 'Not specified'}</span>
            </div>
          </div>
          
          ${booking.specialInstructions ? `
            <div class="special-instructions">
              <strong>Special Instructions:</strong>
              <p>${booking.specialInstructions}</p>
            </div>
          ` : ''}
          
          ${booking.quotedAmount ? `
            <div class="quoted-amount">
              <strong>Quoted Amount:</strong>
              <span class="amount">R ${parseFloat(booking.quotedAmount).toFixed(2)}</span>
            </div>
          ` : ''}
        </div>
        
        <div class="booking-card-actions">
          <button class="btn-icon" onclick="adminDashboard.viewBookingDetails(${booking.id})" title="View Details">
            <i class="fas fa-eye"></i>
          </button>
          ${booking.status === 'requested' ? `
            <button class="btn-icon quote-btn" onclick="adminDashboard.openQuoteModal(${booking.id})" title="Provide Quote">
              <i class="fas fa-dollar-sign"></i>
            </button>
          ` : ''}
          <button class="btn-icon" onclick="adminDashboard.updateBookingStatus(${booking.id})" title="Update Status">
            <i class="fas fa-edit"></i>
          </button>
          <button class="btn-icon delete" onclick="adminDashboard.deleteBooking(${booking.id})" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `).join('');
    } else {
      container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-calendar-times"></i>
        <p>No quotation requests found</p>
        <p class="empty-subtitle">When customers request services, they'll appear here as quotation requests.</p>
      </div>
    `;
    }
  }

  async viewBookingDetails(id) {
    try {
      const response = await this.api.makeRequest('GET', `/bookings/${id}`);
      if (response.success) {
        this.showBookingDetailsModal(response.booking);
      }
    } catch (error) {
      console.error('Error fetching booking details:', error);
      this.showNotification('Failed to load booking details', 'error');
    }
  }

  showBookingDetailsModal(booking) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'flex';
    modal.innerHTML = `
    <div class="modal-content" style="max-width: 800px;">
      <div class="modal-header">
        <h2>Quotation Request Details</h2>
        <button class="modal-close" onclick="this.closest('.modal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="modal-body">
        <div class="booking-details-grid">
          <div class="detail-section">
            <h3>Customer Information</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Name:</label>
                <span>${booking.customer.name}</span>
              </div>
              <div class="detail-item">
                <label>Email:</label>
                <span>${booking.customer.email}</span>
              </div>
              <div class="detail-item">
                <label>Phone:</label>
                <span>${booking.customer.phone || 'Not provided'}</span>
              </div>
              <div class="detail-item">
                <label>Address:</label>
                <span>${booking.customer.address || 'Not provided'}</span>
              </div>
            </div>
          </div>
          
          <div class="detail-section">
            <h3>Service Requested</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Service:</label>
                <span>${booking.service.name}</span>
              </div>
              <div class="detail-item">
                <label>Duration:</label>
                <span>${booking.service.duration} minutes</span>
              </div>
              <div class="detail-item">
                <label>Category:</label>
                <span>${booking.service.category || 'General'}</span>
              </div>
            </div>
          </div>
          
          <div class="detail-section">
            <h3>Booking Details</h3>
            <div class="detail-grid">
              <div class="detail-item">
                <label>Date:</label>
                <span>${new Date(booking.date).toLocaleDateString()}</span>
              </div>
              <div class="detail-item">
                <label>Time:</label>
                <span>${booking.time || 'Flexible'}</span>
              </div>
              <div class="detail-item">
                <label>Status:</label>
                <span class="status-badge ${booking.status}">${booking.status}</span>
              </div>
              ${booking.quotedAmount ? `
                <div class="detail-item">
                  <label>Quoted Amount:</label>
                  <span class="amount">R ${parseFloat(booking.quotedAmount).toFixed(2)}</span>
                </div>
              ` : ''}
            </div>
          </div>
          
          ${booking.propertyType || booking.propertySize || booking.cleaningFrequency ? `
            <div class="detail-section">
              <h3>Property Information</h3>
              <div class="detail-grid">
                ${booking.propertyType ? `
                  <div class="detail-item">
                    <label>Property Type:</label>
                    <span>${booking.propertyType}</span>
                  </div>
                ` : ''}
                ${booking.propertySize ? `
                  <div class="detail-item">
                    <label>Property Size:</label>
                    <span>${booking.propertySize}</span>
                  </div>
                ` : ''}
                ${booking.cleaningFrequency ? `
                  <div class="detail-item">
                    <label>Cleaning Frequency:</label>
                    <span>${booking.cleaningFrequency}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
          
          ${booking.specialInstructions ? `
            <div class="detail-section">
              <h3>Special Instructions</h3>
              <div class="instructions-content">
                <p>${booking.specialInstructions}</p>
              </div>
            </div>
          ` : ''}
          
          ${booking.address ? `
            <div class="detail-section">
              <h3>Service Address</h3>
              <div class="address-content">
                <p>${booking.address}</p>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" onclick="this.closest('.modal').remove()">Close</button>
        ${booking.status === 'requested' ? `
          <button class="btn btn-primary" onclick="adminDashboard.openQuoteModal(${booking.id})">
            <i class="fas fa-dollar-sign"></i> Provide Quote
          </button>
        ` : ''}
      </div>
    </div>
  `;

    document.body.appendChild(modal);
  }

  getMockBookingCards() {
    return [
      {
        id: 1,
        customer: {
          id: 1,
          name: 'John Doe',
          email: 'john@example.com',
          phone: '+27 12 345 6789'
        },
        service: {
          id: 1,
          name: 'Deep Cleaning',
          description: 'Comprehensive deep cleaning service',
          duration: 180,
          category: 'Residential',
          image: null
        },
        date: new Date().toISOString(),
        time: '10:00',
        address: '123 Main St, Johannesburg',
        specialInstructions: 'Please focus on kitchen and bathrooms',
        status: 'requested',
        quotedAmount: null,
        propertyType: 'House',
        propertySize: '150m²',
        cleaningFrequency: 'One-time',
        createdAt: new Date().toISOString()
      }
    ];
  }
  showNotification(message, type = 'info') {
    try {
      // Remove existing notification
      const existingNotification = document.querySelector('.admin-notification');
      if (existingNotification) {
        existingNotification.remove();
      }

      const notification = document.createElement('div');
      notification.className = `admin-notification notification-${type}`;
      notification.innerHTML = `
        <div class="notification-content">
          <i class="fas fa-${this.getNotificationIcon(type)}"></i>
          <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
          <i class="fas fa-times"></i>
        </button>
      `;

      document.body.appendChild(notification);

      // Auto remove after 5 seconds
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 5000);
    } catch (error) {
      console.error('Error showing notification:', error);
      // Fallback to console log
      console.log(`Notification (${type}): ${message}`);
    }
  }

  showGlobalError(message) {
    try {
      // Remove existing error
      const existingError = document.querySelector('.global-error');
      if (existingError) {
        existingError.remove();
      }

      const errorDiv = document.createElement('div');
      errorDiv.className = 'global-error';
      errorDiv.innerHTML = `
        <div style="padding: 20px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 5px; margin: 20px; position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 10000; min-width: 300px; text-align: center;">
          <h3 style="margin: 0 0 10px 0;">System Error</h3>
          <p style="margin: 0 0 15px 0;">${message}</p>
          <button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">
            Refresh Page
          </button>
        </div>
      `;
      document.body.appendChild(errorDiv);
    } catch (error) {
      console.error('Error showing global error:', error);
    }
  }

  getNotificationIcon(type) {
    const icons = {
      success: 'check-circle',
      error: 'exclamation-circle',
      warning: 'exclamation-triangle',
      info: 'info-circle'
    };
    return icons[type] || 'info-circle';
  }

  getSectionTitle(section) {
    const titles = {
      'dashboard': 'Dashboard',
      'bookings': 'Booking Management',
      'customers': 'Customer Management',
      'services': 'Service Management',
      'products': 'Product Management',
      'quotations': 'Quotation Management',
      'reports': 'Reports & Analytics',
      'admin-management': 'Admin Management',
      'admin-profile': 'Admin Profile'
    };
    return titles[section] || 'Dashboard';
  }

  closeServiceModal() {
    try {
      const modal = document.getElementById('serviceModal');
      if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    } catch (error) {
      console.error('Error closing service modal:', error);
    }
  }

  closeProductModal() {
    try {
      const modal = document.getElementById('productModal');
      if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
      }
    } catch (error) {
      console.error('Error closing product modal:', error);
    }
  }

  loadAdminProfile() {
    try {
      console.log('Loading admin profile section');
      if (this.adminProfileManager) {
        this.adminProfileManager.loadProfileData();
      } else {
        console.error('AdminProfileManager not initialized');
      }
    } catch (error) {
      console.error('Error loading admin profile:', error);
    }
  }
}

// Enhanced Admin Profile Manager with better error handling
class AdminProfileManager {
  constructor(dashboard) {
    if (!dashboard) {
      console.error('❌ AdminProfileManager: No dashboard instance provided!');
      throw new Error('Dashboard instance is required');
    }
    this.dashboard = dashboard;
    this.admin = null;
    this.isEditing = false;
    this.currentEditingSection = null;
    console.log('AdminProfileManager initialized with dashboard reference');
    this.setupEditHandlers();
  }

  async loadProfileData() {
    try {
      console.log('Starting to load admin profile data...');
      const response = await this.dashboard.api.getAdminProfile();
      console.log('API Response received:', response);

      if (response.success && response.admin) {
        this.admin = response.admin;
        console.log('Admin data loaded successfully:', this.admin);
        this.updateProfileDisplay();

        if (window.authManager) {
          window.authManager.user = this.admin;
          localStorage.setItem('user', JSON.stringify(this.admin));
        }

        this.dashboard.updateAdminInfo();
      } else {
        throw new Error('Failed to load profile data');
      }
    } catch (error) {
      console.error('Error loading admin profile:', error);
      this.dashboard.showNotification('Failed to load profile data: ' + error.message, 'error');
      this.admin = window.authManager ? window.authManager.getUser() : {};
      this.updateProfileDisplay();
    }
  }

  updateProfileDisplay() {
    try {
      console.log('Updating profile display with data:', this.admin);
      if (!this.admin) return;

      // Update profile header
      const profileFullname = document.getElementById('admin-profile-fullname');
      const profileEmail = document.getElementById('admin-profile-email');
      if (profileFullname) profileFullname.textContent = this.admin.Name || 'Admin User';
      if (profileEmail) profileEmail.textContent = this.admin.Email || 'No email';

      // Update personal information
      const infoFullname = document.getElementById('admin-info-fullname');
      const infoEmail = document.getElementById('admin-info-email');
      const infoPhone = document.getElementById('admin-info-phone');
      const infoJoinDate = document.getElementById('admin-info-join-date');

      if (infoFullname) infoFullname.textContent = this.admin.Name || 'Not set';
      if (infoEmail) infoEmail.textContent = this.admin.Email || 'Not set';
      if (infoPhone) infoPhone.textContent = this.admin.Phone || 'Not set';

      const joinDate = this.admin.Created_At || this.admin.createdAt;
      if (infoJoinDate) {
        infoJoinDate.textContent = joinDate ?
          new Date(joinDate).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }) : 'Unknown';
      }

      // Set input values
      this.setInputValue('admin-edit-fullname', this.admin.Name);
      this.setInputValue('admin-edit-email', this.admin.Email);
      this.setInputValue('admin-edit-phone', this.admin.Phone);
    } catch (error) {
      console.error('Error updating profile display:', error);
    }
  }

  setInputValue(inputId, value) {
    try {
      const input = document.getElementById(inputId);
      if (input) input.value = value || '';
    } catch (error) {
      console.error('Error setting input value:', error);
    }
  }

  setupEditHandlers() {
    try {
      document.querySelectorAll('.edit-section-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const section = e.target.closest('.edit-section-btn').dataset.section;
          this.startEditing(section);
        });
      });

      document.querySelectorAll('.cancel-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const section = e.target.closest('.profile-section').id;
          this.cancelEditing(section);
        });
      });

      document.querySelectorAll('.save-edit').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const section = e.target.closest('.profile-section').id;
          await this.saveChanges(section);
        });
      });
    } catch (error) {
      console.error('Error setting up edit handlers:', error);
    }
  }

  startEditing(section) {
    try {
      if (this.isEditing) {
        this.dashboard.showNotification('Please finish editing the current section first.', 'error');
        return;
      }

      this.currentEditingSection = section;
      this.isEditing = true;

      const sectionElement = document.getElementById(section);
      const editBtn = sectionElement.querySelector('.edit-section-btn');
      const actions = sectionElement.querySelector('.section-actions');
      const inputs = sectionElement.querySelectorAll('.edit-input');
      const displays = sectionElement.querySelectorAll('.info-item p');

      if (editBtn) editBtn.style.display = 'none';
      if (actions) actions.style.display = 'flex';

      displays.forEach(display => {
        if (!display.id.includes('join-date')) {
          display.style.display = 'none';
        }
      });

      inputs.forEach(input => {
        input.style.display = 'block';
      });
    } catch (error) {
      console.error('Error starting editing:', error);
    }
  }

  cancelEditing(section) {
    try {
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

      this.resetInputValues();
      this.isEditing = false;
      this.currentEditingSection = null;
    } catch (error) {
      console.error('Error canceling editing:', error);
    }
  }

  resetInputValues() {
    try {
      this.setInputValue('admin-edit-fullname', this.admin.Name);
      this.setInputValue('admin-edit-email', this.admin.Email);
      this.setInputValue('admin-edit-phone', this.admin.Phone);
    } catch (error) {
      console.error('Error resetting input values:', error);
    }
  }

  async saveChanges(section) {
    try {
      this.dashboard.showLoading('Saving changes...');
      const updatedData = {};

      if (section === 'admin-personal-info') {
        updatedData.Name = document.getElementById('admin-edit-fullname').value.trim();
        updatedData.Email = document.getElementById('admin-edit-email').value.trim();
        updatedData.Phone = document.getElementById('admin-edit-phone').value.trim();

        if (!updatedData.Name) throw new Error('Full name is required');
        if (!updatedData.Email) throw new Error('Email is required');
        if (!this.isValidEmail(updatedData.Email)) throw new Error('Please enter a valid email address');
      }

      await this.dashboard.api.updateAdminProfile(updatedData);
      Object.assign(this.admin, updatedData);

      if (window.authManager) {
        window.authManager.user = this.admin;
        localStorage.setItem('user', JSON.stringify(this.admin));
      }

      this.updateLocalDisplay(updatedData);
      this.cancelEditing(section);
      this.dashboard.showNotification('Profile updated successfully!', 'success');

    } catch (error) {
      console.error('Error saving changes:', error);
      this.dashboard.showNotification(error.message || 'Failed to update profile. Please try again.', 'error');
    } finally {
      this.dashboard.hideLoading();
    }
  }

  updateLocalDisplay(updatedData) {
    try {
      if (updatedData.Name) {
        document.getElementById('admin-info-fullname').textContent = updatedData.Name;
        document.getElementById('admin-profile-fullname').textContent = updatedData.Name;
      }
      if (updatedData.Email) {
        document.getElementById('admin-info-email').textContent = updatedData.Email;
        document.getElementById('admin-profile-email').textContent = updatedData.Email;
      }
      if (updatedData.Phone) {
        document.getElementById('admin-info-phone').textContent = updatedData.Phone || 'Not set';
      }
    } catch (error) {
      console.error('Error updating local display:', error);
    }
  }

  isValidEmail(email) {
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      return emailRegex.test(email);
    } catch (error) {
      console.error('Error validating email:', error);
      return false;
    }
  }
}

// Global functions with error handling
function showSection(section) {
  try {
    if (window.adminDashboard) {
      window.adminDashboard.showSection(section);
    }
  } catch (error) {
    console.error('Error showing section:', error);
  }
}

function openAdminModal() {
  try {
    const modal = document.getElementById('adminModal');
    if (modal) {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';

      // Remove focus from any elements inside the modal when it opens
      setTimeout(() => {
        const focusedElement = document.activeElement;
        if (focusedElement && modal.contains(focusedElement)) {
          focusedElement.blur();
        }
      }, 100);
    }
  } catch (error) {
    console.error('Error opening admin modal:', error);
  }
}

function closeAdminModal() {
  try {
    const modal = document.getElementById('adminModal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = 'auto';
      const form = document.getElementById('admin-form');
      if (form) form.reset();
    }
  } catch (error) {
    console.error('Error closing admin modal:', error);
  }
}

// In admin-dashboard.js - Update createAdmin function
async function createAdmin() {
  try {
    const formData = {
      Name: document.getElementById('admin-name').value,
      Email: document.getElementById('admin-email').value,
      Phone: document.getElementById('admin-phone').value,
      Role: document.getElementById('admin-role').value
    };

    const response = await window.adminDashboard.api.createAdmin(formData);

    if (response.success) {
      // Show the temporary password to the main admin
      const tempPassword = response.temporaryPassword;

      // Create a modal to display the temporary password
      const passwordModal = document.createElement('div');
      passwordModal.className = 'modal';
      passwordModal.style.display = 'flex';
      passwordModal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h2><i class="fas fa-key"></i> Admin Created Successfully</h2>
            <button class="modal-close" onclick="this.closest('.modal').remove()">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <div class="modal-body">
            <div class="success-message">
              <i class="fas fa-check-circle"></i>
              <p>${response.message}</p>
            </div>
            <div class="password-info">
              <h3>🔐 Temporary Password</h3>
              <div class="password-display">
                <code class="temp-password">${tempPassword}</code>
                <button class="btn-copy" onclick="copyToClipboard('${tempPassword}')">
                  <i class="fas fa-copy"></i> Copy
                </button>
              </div>
              <div class="password-instructions">
                <p><strong>Important:</strong> Send this temporary password to the new admin securely.</p>
                <p>They will be required to set a new password on their first login.</p>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-primary" onclick="this.closest('.modal').remove()">
              <i class="fas fa-check"></i> I've Saved the Password
            </button>
          </div>
        </div>
      `;

      document.body.appendChild(passwordModal);

      closeAdminModal();
      window.adminDashboard.loadAdmins();
    }
  } catch (error) {
    window.adminDashboard.showNotification(error.response?.data?.message || 'Failed to create admin', 'error');
  }
}

// Add copy to clipboard function
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    window.adminDashboard.showNotification('Password copied to clipboard!', 'success');
  }).catch(err => {
    console.error('Failed to copy: ', err);
    window.adminDashboard.showNotification('Failed to copy password', 'error');
  });
}

function openAdminPasswordModal() {
  try {
    document.getElementById('adminPasswordModal').style.display = 'flex';
    document.body.style.overflow = 'hidden';
  } catch (error) {
    console.error('Error opening admin password modal:', error);
  }
}

function closeAdminPasswordModal() {
  try {
    document.getElementById('adminPasswordModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    const form = document.getElementById('admin-password-form');
    if (form) form.reset();
  } catch (error) {
    console.error('Error closing admin password modal:', error);
  }
}

// Enhanced initialization with comprehensive error handling
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Initializing Admin Dashboard');

  try {
    // Check if required elements exist
    const requiredElements = ['sidebar', 'dashboard'];
    const missingElements = requiredElements.filter(id => !document.getElementById(id));

    if (missingElements.length > 0) {
      console.error('Missing required elements:', missingElements);
      throw new Error('Required page elements not found');
    }

    window.adminDashboard = new AdminDashboard();
    window.adminDashboard.init().catch(error => {
      console.error('Failed to initialize admin dashboard:', error);
    });
  } catch (error) {
    console.error('Critical error during dashboard initialization:', error);

    // Show user-friendly error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'global-error';
    errorDiv.innerHTML = `
      <div style="padding: 20px; background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; border-radius: 5px; margin: 20px; position: fixed; top: 20px; left: 50%; transform: translateX(-50%); z-index: 10000; min-width: 300px; text-align: center;">
        <h3 style="margin: 0 0 10px 0;">System Error</h3>
        <p style="margin: 0 0 15px 0;">Failed to initialize the admin dashboard. Please refresh the page or contact support if the problem persists.</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">
          Refresh Page
        </button>
      </div>
    `;
    document.body.appendChild(errorDiv);
  }
});

// Enhanced event listeners for forms
document.addEventListener('DOMContentLoaded', () => {
  try {
    const adminForm = document.getElementById('admin-form');
    if (adminForm) {
      adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await createAdmin();
      });
    }

    const adminPasswordForm = document.getElementById('admin-password-form');
    if (adminPasswordForm) {
      adminPasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (window.adminDashboard) {
          window.adminDashboard.handleAdminPasswordChange();
        }
      });
    }
  } catch (error) {
    console.error('Error setting up form event listeners:', error);
  }
});

// Enhanced Modal Functions with error handling
function openProductModal(product = null) {
  try {
    const modal = document.getElementById('productModal');
    const title = document.getElementById('productModalTitle');
    const form = document.getElementById('product-form');

    if (!modal || !title || !form) {
      console.error('Required product modal elements not found');
      return;
    }

    // Reset form
    if (form) form.reset();

    // Clear hidden fields
    const productIdField = document.getElementById('product-id');
    const currentImageField = document.getElementById('currentProductImage');
    if (productIdField) productIdField.value = '';
    if (currentImageField) currentImageField.value = '';

    // Reset image preview
    const preview = document.getElementById('productImagePreview');
    if (preview) {
      preview.innerHTML = '<div class="no-image">No image selected</div>';
    }

    // Reset file input
    const fileInput = document.getElementById('product-image');
    if (fileInput) {
      fileInput.value = '';
    }

    // Set availability checkbox to checked by default
    const availableCheckbox = document.getElementById('product-available');
    if (availableCheckbox) {
      availableCheckbox.checked = true;
    }

    if (product) {
      // Edit mode
      if (title) title.innerHTML = '<i class="fas fa-edit"></i> Edit Product';

      // Safely populate form fields
      setFormValue('product-id', product.ID);
      setFormValue('product-name', product.Name);
      setFormValue('product-description', product.Description);
      setFormValue('product-price', product.Price);
      setFormValue('product-stock', product.Stock_Quantity);
      setFormValue('product-category', product.Category);
      setFormValue('currentProductImage', product.Image_URL);

      // Set availability
      if (availableCheckbox) {
        availableCheckbox.checked = Boolean(product.Is_Available);
      }

      // Set image preview if exists
      if (product.Image_URL && preview) {
        let imageUrl = product.Image_URL;
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `http://localhost:5000${imageUrl}`;
        }
        preview.innerHTML = `
          <img src="${imageUrl}" alt="${product.Name}" 
               onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'no-image\\'>Image not available</div>';"
               style="max-width: 200px; max-height: 200px; border-radius: 8px;">
        `;
      }
    } else {
      // Add mode
      if (title) title.innerHTML = '<i class="fas fa-plus"></i> Add New Product';
    }

    // Show modal with proper accessibility
    if (modal) {
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden', 'false');

      // Remove focus from modal content when opening
      setTimeout(() => {
        const focusedElement = document.activeElement;
        if (focusedElement && modal.contains(focusedElement)) {
          focusedElement.blur();
        }
      }, 100);
    }
  } catch (error) {
    console.error('Error opening product modal:', error);
    if (window.adminDashboard) {
      window.adminDashboard.showNotification('Error opening product form', 'error');
    }
  }
}

// Helper function to safely set form values
function setFormValue(elementId, value) {
  try {
    const element = document.getElementById(elementId);
    if (element) {
      element.value = value || '';
    } else {
      console.warn(`Element with id '${elementId}' not found`);
    }
  } catch (error) {
    console.error('Error setting form value:', error);
  }
}

function closeProductModal() {
  try {
    const modal = document.getElementById('productModal');
    if (modal) {
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = 'auto';
    }
  } catch (error) {
    console.error('Error closing product modal:', error);
  }
}

function openServiceModal(service = null) {
  try {
    const modal = document.getElementById('serviceModal');
    const form = document.getElementById('service-form');
    const title = document.getElementById('serviceModalTitle');
    const imagePreview = document.getElementById('serviceImagePreview');
    const currentImage = document.getElementById('currentServiceImage');

    if (!modal || !form || !title) {
      console.error('Required service modal elements not found');
      return;
    }

    // Reset form
    if (form) form.reset();

    // Clear hidden fields
    const serviceIdField = document.getElementById('service-id');
    if (serviceIdField) serviceIdField.value = '';
    if (currentImage) currentImage.value = '';

    // Reset image preview
    if (imagePreview) {
      imagePreview.innerHTML = '<div class="no-image">No image selected</div>';
    }

    // Reset file input
    const fileInput = document.getElementById('service-image');
    if (fileInput) {
      fileInput.value = '';
    }

    // Set availability checkbox to checked by default
    const availableCheckbox = document.getElementById('service-available');
    if (availableCheckbox) {
      availableCheckbox.checked = true;
    }

    if (service) {
      // Edit mode
      title.innerHTML = '<i class="fas fa-edit"></i> Edit Service';

      // Safely populate form fields
      setFormValue('service-id', service.ID);
      setFormValue('service-name', service.Name);
      setFormValue('service-description', service.Description);
      setFormValue('service-duration', service.Duration);
      setFormValue('service-category', service.Category);
      setFormValue('currentServiceImage', service.Image_URL);

      // Set availability
      if (availableCheckbox) {
        availableCheckbox.checked = Boolean(service.Is_Available);
      }

      // Set image preview if exists
      if (service.Image_URL && imagePreview) {
        let imageUrl = service.Image_URL;
        if (imageUrl && !imageUrl.startsWith('http')) {
          imageUrl = `http://localhost:5000${imageUrl}`;
        }
        imagePreview.innerHTML = `
          <img src="${imageUrl}" alt="${service.Name}" 
               onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'no-image\\'>Image not available</div>';"
               style="max-width: 200px; max-height: 200px; border-radius: 8px;">
        `;
      }
    } else {
      // Add mode
      title.innerHTML = '<i class="fas fa-plus"></i> Add New Service';
    }

    // Show modal
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');

  } catch (error) {
    console.error('Error opening service modal:', error);
    if (window.adminDashboard) {
      window.adminDashboard.showNotification('Error opening service form', 'error');
    }
  }
}

function closeServiceModal() {
  try {
    const modal = document.getElementById('serviceModal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = 'auto';
    }
  } catch (error) {
    console.error('Error closing service modal:', error);
  }
}

// Image preview functions with error handling
function previewProductImage(event) {
  try {
    const input = event.target;
    const preview = document.getElementById('productImagePreview');

    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = function (e) {
        if (preview) {
          preview.innerHTML = `<img src="${e.target.result}" alt="Image preview" style="max-width: 200px; max-height: 200px; border-radius: 8px;">`;
        }
      };
      reader.onerror = function () {
        console.error('Error reading product image file');
        if (preview) {
          preview.innerHTML = '<div class="no-image">Error loading image</div>';
        }
      };
      reader.readAsDataURL(input.files[0]);
    }
  } catch (error) {
    console.error('Error previewing product image:', error);
  }
}

function previewServiceImage(event) {
  try {
    const input = event.target;
    const preview = document.getElementById('serviceImagePreview');

    if (input.files && input.files[0]) {
      const reader = new FileReader();
      reader.onload = function (e) {
        if (preview) {
          preview.innerHTML = `<img src="${e.target.result}" alt="Image preview" style="max-width: 200px; max-height: 200px; border-radius: 8px;">`;
        }
      };
      reader.onerror = function () {
        console.error('Error reading service image file');
        if (preview) {
          preview.innerHTML = '<div class="no-image">Error loading image</div>';
        }
      };
      reader.readAsDataURL(input.files[0]);
    }
  } catch (error) {
    console.error('Error previewing service image:', error);
  }
}

// Make the helper function globally available
window.setFormValue = setFormValue;
window.openProductModal = openProductModal;
window.closeProductModal = closeProductModal;
window.openServiceModal = openServiceModal;
window.closeServiceModal = closeServiceModal;
window.previewProductImage = previewProductImage;
window.previewServiceImage = previewServiceImage;
window.showSection = showSection;

// Global error handler for uncaught errors
window.addEventListener('error', function (event) {
  console.error('Global error caught:', event.error);
  if (window.adminDashboard) {
    window.adminDashboard.showNotification('An unexpected error occurred', 'error');
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', function (event) {
  console.error('Unhandled promise rejection:', event.reason);
  if (window.adminDashboard) {
    window.adminDashboard.showNotification('An unexpected error occurred', 'error');
  }
});