// services.js - Fixed Customer Services with Proper API Handling
class CustomerServices {
    constructor() {
        this.baseURL = 'http://localhost:5000/api';
        this.services = [];
        this.filteredServices = [];
        this.currentCategory = 'all';
        this.serviceCategories = [];
        this.serviceTypes = [];

        // Bind methods
        this.init = this.init.bind(this);
        this.loadServices = this.loadServices.bind(this);
        this.loadServiceMetadata = this.loadServiceMetadata.bind(this);
        this.renderServices = this.renderServices.bind(this);
        this.filterServices = this.filterServices.bind(this);
        this.sortServices = this.sortServices.bind(this);
        this.handleBookService = this.handleBookService.bind(this);
        this.openBookingModal = this.openBookingModal.bind(this);
        this.closeBookingModal = this.closeBookingModal.bind(this);
        this.submitBooking = this.submitBooking.bind(this);
        this.debounce = this.debounce.bind(this);
        this.fetchRequest = this.fetchRequest.bind(this);

        this.init();
    }

    async init() {
        console.log('Initializing Customer Services...');
        await this.loadServiceMetadata();
        await this.loadServices();
        this.setupEventListeners();
        this.setupSearch();
        this.setupFilters();
        this.checkPendingIntendedService();
    }

    async loadServiceMetadata() {
        try {
            console.log('Loading service metadata...');

            // Since /service-categories and /service-types endpoints don't exist,
            // we'll use default values and focus on the main services endpoint
            this.serviceCategories = [
                { ID: 1, Name: 'Residential', Slug: 'residential' },
                { ID: 2, Name: 'Commercial', Slug: 'commercial' },
                { ID: 3, Name: 'Both', Slug: 'both' }
            ];

            this.serviceTypes = [
                { ID: 1, Name: 'Standard', Description: 'Basic cleaning package', Price_Multiplier: 1.0 },
                { ID: 2, Name: 'Premium', Description: 'Enhanced cleaning package', Price_Multiplier: 1.5 },
                { ID: 3, Name: 'Deep Clean', Description: 'Comprehensive deep cleaning', Price_Multiplier: 2.0 }
            ];

            console.log('Using default service metadata');

        } catch (error) {
            console.error('Error loading service metadata:', error);
        }
    }

    async fetchRequest(method, endpoint, data = null) {
        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            // Add auth headers if user is authenticated AND endpoint requires auth
            if (window.authManager && window.authManager.isAuthenticated() &&
                !endpoint.includes('/public/')) { // Don't add auth for public endpoints
                headers['Authorization'] = `Bearer ${window.authManager.token}`;
            }

            const config = {
                method: method,
                headers: headers,
                credentials: 'include' // Add this for cookies if needed
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                config.body = JSON.stringify(data);
            }

            console.log(`Making ${method} request to: ${this.baseURL}${endpoint}`);
            const response = await fetch(`${this.baseURL}${endpoint}`, config);

            if (!response.ok) {
                // Get more details about the error
                let errorDetails = '';
                try {
                    const errorResponse = await response.json();
                    errorDetails = JSON.stringify(errorResponse);
                } catch (e) {
                    errorDetails = await response.text();
                }

                throw new Error(`HTTP error! status: ${response.status}, details: ${errorDetails}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Fetch ${method} ${endpoint} failed:`, error);
            throw error;
        }
    }

    async loadServiceDetails(serviceId) {
        try {
            const response = await fetch(`${this.baseURL}/public/services/${serviceId}`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.success && data.service) {
                return data.service;
            } else {
                throw new Error('Invalid response format');
            }
        } catch (error) {
            console.error('Error loading service details:', error);
            throw error;
        }
    }
    async loadServices() {
        try {
            this.showLoading('Loading services...');
            console.log('Loading ALL services from public endpoint...');

            // Use the public endpoint that shows ALL services
            const response = await fetch(`${this.baseURL}/services/public/services`);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.success && Array.isArray(data.services)) {
                this.services = this.processServiceData(data.services);
                console.log(`✅ Successfully loaded ${this.services.length} services (including unavailable)`);

                // DEBUG: Log service availability
                const availableCount = this.services.filter(s => s.Is_Available).length;
                const unavailableCount = this.services.filter(s => !s.Is_Available).length;
                console.log(`📊 Services: ${availableCount} available, ${unavailableCount} unavailable`);

                // DEBUG: Log each service's availability
                this.services.forEach(service => {
                    console.log(`🔍 Service: ${service.Name} - Available: ${service.Is_Available}`);
                });

                if (this.services.length === 0) {
                    this.showInfo('No services available at the moment');
                }
            } else {
                throw new Error('Invalid response format from services API');
            }

        } catch (error) {
            console.error('❌ Error loading services:', error);
            this.showError('Failed to load services. Please try again later.');
            this.showDatabaseError();
        } finally {
            this.filteredServices = [...this.services];
            this.renderServices();
            this.updateCategoryFilters();
            this.hideLoading();
        }
    }

    processServiceData(services) {
        return services.map(service => ({
            ID: service.ID || service.id,
            Name: service.Name || service.service_name,
            Description: service.Description || service.description,
            Duration: service.Duration || service.duration || 60,
            Category: service.Category || service.category,
            Is_Available: service.Is_Available !== undefined ? service.Is_Available :
                (service.is_available !== undefined ? service.is_available : true),
            Image_URL: service.Image_URL || service.image_url,
            Created_At: service.Created_At || service.created_at,
            Updated_At: service.Updated_At || service.updated_at
        })).filter(service => service.Name && service.Duration);
    }

    parseFeatures(features) {
        if (!features) return [];
        if (Array.isArray(features)) return features;
        if (typeof features === 'string') {
            try {
                return JSON.parse(features);
            } catch (e) {
                return features.split(',').map(f => f.trim()).filter(f => f.length > 0);
            }
        }
        return [];
    }

    parseRequirements(requirements) {
        if (!requirements) return [];
        if (Array.isArray(requirements)) return requirements;
        if (typeof requirements === 'string') {
            try {
                return JSON.parse(requirements);
            } catch (e) {
                return requirements.split(',').map(r => r.trim()).filter(r => r.length > 0);
            }
        }
        return [];
    }

    showDatabaseError() {
        const grid = document.querySelector('.services-grid');
        if (grid) {
            grid.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-database" style="font-size: 4rem; color: #dc3545; margin-bottom: 1rem;"></i>
                    <h3>Database Connection Error</h3>
                    <p>Unable to load services from the database. Please check your internet connection and try again.</p>
                    <div style="display: flex; gap: 1rem; justify-content: center; margin-top: 1.5rem;">
                        <button class="service-cta-btn" onclick="window.customerServices.loadServices()" 
                                style="background: #007bff; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer;">
                            <i class="fas fa-refresh"></i> Retry Loading
                        </button>
                        <button class="service-cta-btn" onclick="window.location.reload()" 
                                style="background: #6c757d; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 6px; cursor: pointer;">
                            <i class="fas fa-sync"></i> Refresh Page
                        </button>
                    </div>
                </div>
            `;
        }
    }

    setupEventListeners() {
        const popupClose = document.querySelector('.popup-close');
        if (popupClose) {
            popupClose.addEventListener('click', () => this.closeBookingModal());
        }

        const popupOverlay = document.querySelector('.popup-overlay');
        if (popupOverlay) {
            popupOverlay.addEventListener('click', () => this.closeBookingModal());
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeBookingModal();
        });
    }

    renderServices() {
        const grid = document.querySelector('.services-grid');
        if (!grid) {
            console.error('Services grid element not found');
            return;
        }

        if (this.filteredServices.length === 0) {
            grid.innerHTML = this.getEmptyStateHTML();
            return;
        }

        grid.innerHTML = this.filteredServices.map(service => this.createServiceCardHTML(service)).join('');
        this.attachServiceButtonListeners();
        this.updateResultsCount();
    }

    createServiceCardHTML(service) {
        const isAvailable = service.Is_Available;
        const category = this.getCategoryName(service.Category);
        const badgeType = isAvailable ? null : 'unavailable';

        return `
    <div class="service-card ${!isAvailable ? 'unavailable-service' : ''}" data-service-id="${service.ID}" data-category="${service.Category}">
      ${badgeType ? `<div class="service-badge ${badgeType}">${this.getBadgeText(badgeType)}</div>` : ''}
      
      <div class="service-image-container">
        ${service.Image_URL ? `
          <img src="${this.getImageUrl(service.Image_URL)}" alt="${service.Name}" 
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        ` : ''}
        <div class="service-image-placeholder" style="${service.Image_URL ? 'display: none;' : ''}">
          <i class="fas ${this.getServiceIcon(service.Name)}"></i>
        </div>
      </div>
      
      <!-- Description below the image -->
      <div class="service-description-container">
        <p class="service-description">${this.escapeHtml(service.Description)}</p>
      </div>
      
      <div class="service-content">
        <h3>${this.escapeHtml(service.Name)}</h3>
        
        <div class="service-meta">
          <span class="service-category">${this.escapeHtml(category)}</span>
          <span class="service-status ${isAvailable ? 'available' : 'unavailable'}">
            <i class="fas ${isAvailable ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            ${isAvailable ? 'Available' : 'Currently Unavailable'}
          </span>
        </div>
        
        <div class="service-footer">
          <div class="duration-container">
            <span class="service-duration">
              <i class="fas fa-clock"></i> ${service.Duration || 60} minutes
            </span>
          </div>
          <button class="service-cta-btn ${!isAvailable ? 'disabled' : ''}" 
                  data-service-id="${service.ID}"
                  ${!isAvailable ? 'disabled' : ''}>
            ${isAvailable ? 'Request Quote' : 'Service Unavailable'}
          </button>
        </div>
        
        ${!isAvailable ? `
          <div class="unavailable-notice">
            <i class="fas fa-info-circle"></i>
            <small>This service is temporarily unavailable. Please check back later.</small>
          </div>
        ` : ''}
      </div>
    </div>
  `;
    }

    getImageUrl(imageUrl) {
        if (!imageUrl) return '';
        if (imageUrl.startsWith('http') || imageUrl.startsWith('./') || imageUrl.startsWith('../')) {
            return imageUrl;
        }
        return `http://localhost:5000${imageUrl}`;
    }

    getServiceIcon(serviceName) {
        const icons = {
            'Standard & Deep Cleaning': 'fa-broom',
            'Office Cleaning': 'fa-building',
            'Window Cleaning': 'fa-window-restore',
            'Carpet Cleaning': 'fa-rug',
            'Upholstery Cleaning': 'fa-couch',
            'Pest Control': 'fa-bug',
            'Commercial Deep Clean': 'fa-warehouse',
            'Move In/Out Cleaning': 'fa-truck-moving'
        };
        return icons[serviceName] || 'fa-concierge-bell';
    }

    getServiceBadgeType(service) {
        if (!service.Is_Available) return 'unavailable';
        if (service.Price > 500) return 'premium';
        if (service.Popularity > 80) return 'popular';
        if (service.Price < 300) return 'special';
        return null;
    }

    getBadgeText(badgeType) {
        const badges = {
            'popular': 'Popular',
            'premium': 'Premium',
            'unavailable': 'Unavailable',
            'special': 'Special Offer'
        };
        return badges[badgeType] || '';
    }

    getCategoryName(categorySlug) {
        const category = this.serviceCategories.find(cat => cat.Slug === categorySlug);
        return category ? category.Name : this.formatCategoryName(categorySlug);
    }

    formatCategoryName(category) {
        return category ? category.charAt(0).toUpperCase() + category.slice(1) : 'General';
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    attachServiceButtonListeners() {
        // Use event delegation for better performance and reliability
        const grid = document.querySelector('.services-grid');
        if (!grid) return;

        // Remove any existing event listeners to prevent duplicates
        grid.removeEventListener('click', this.handleGridClick);

        // Add event delegation
        grid.addEventListener('click', this.handleGridClick.bind(this));
    }

    handleGridClick(event) {
        const target = event.target;

        // Check if the click was on a service CTA button or its child elements
        const ctaButton = target.closest('.service-cta-btn');
        if (ctaButton && !ctaButton.classList.contains('disabled')) {
            event.preventDefault();
            event.stopPropagation();

            const serviceId = ctaButton.getAttribute('data-service-id');
            if (serviceId) {
                this.handleBookService(serviceId);
            }
            return;
        }

        // Check if the click was on a service card (but not on a button)
        const serviceCard = target.closest('.service-card');
        if (serviceCard && !target.closest('.service-cta-btn')) {
            const serviceId = serviceCard.getAttribute('data-service-id');
            if (serviceId) {
                this.showServiceDetails(serviceId);
            }
        }
    }

    showServiceDetails(serviceId) {
        const service = this.services.find(s => s.ID == serviceId);
        if (!service) {
            this.showError('Service details not found.');
            return;
        }

        // For now, just open the booking modal since we don't have a separate details page
        this.openBookingModal(service);
    }
    handleBookService(serviceId) {
        const service = this.services.find(s => s.ID == serviceId);
        if (!service) {
            this.showError('Service not found. Please try again.');
            return;

        }

        // CHECK AUTHENTICATION - Only required for booking/quote requests
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            // Store intended service and redirect to login
            localStorage.setItem('intendedService', serviceId);
            localStorage.setItem('intendedServiceData', JSON.stringify(service));
            localStorage.setItem('returnUrl', window.location.href);

            this.showInfo('Please login or register to request a quotation');

            // Redirect to login after a short delay
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        // User is authenticated - open booking modal
        this.openBookingModal(service);
    }
    openBookingModal(service) {
        const popup = document.getElementById('service-popup');
        if (!popup) {
            this.showError('Booking system unavailable. Please contact support.');
            return;
        }

        // Populate service details - FIXED VERSION
        const leftTitle = document.getElementById('popup-service-title');
        const rightTitle = document.getElementById('popup-service-title-main');
        const description = document.getElementById('popup-service-description');
        const duration = document.getElementById('popup-service-duration');

        if (leftTitle) leftTitle.textContent = service.Name;
        if (rightTitle) rightTitle.textContent = `Request Quotation - ${service.Name}`;
        if (description) description.textContent = service.Description;
        if (duration) duration.textContent = `${service.Duration} minutes`;

        // Set service image
        const popupImage = document.getElementById('popup-service-image');
        const imagePlaceholder = document.getElementById('image-placeholder');

        if (popupImage && service.Image_URL) {
            popupImage.src = this.getImageUrl(service.Image_URL);
            popupImage.alt = service.Name;
            popupImage.style.display = 'block';

            // Hide placeholder if image loads
            if (imagePlaceholder) imagePlaceholder.style.display = 'none';
        } else {
            if (popupImage) popupImage.style.display = 'none';
            if (imagePlaceholder) {
                imagePlaceholder.style.display = 'flex';
                // Update placeholder icon based on service
                const icon = imagePlaceholder.querySelector('i');
                if (icon) {
                    icon.className = `fas ${this.getServiceIcon(service.Name)}`;
                }
            }
        }

        // Populate service options based on default service types
        this.populateServiceOptions(service);

        // Show the popup
        popup.classList.add('active');
        popup.removeAttribute('aria-hidden');
        document.body.style.overflow = 'hidden';

        // Setup the booking form
        this.setupBookingForm(service);
    }


    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const existingNotification = document.querySelector('.customer-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `customer-notification notification-${type}`;
        notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;

        document.body.appendChild(notification);

        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    }
    populateServiceOptions(service) {
        const serviceTypeSelect = document.getElementById('service-type');
        if (!serviceTypeSelect) return;

        // Clear existing options
        serviceTypeSelect.innerHTML = '<option value="" disabled selected>Select service type</option>';

        // Add service types without prices
        this.serviceTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.ID;
            option.textContent = `${type.Name} - Custom Quote`;
            option.setAttribute('data-description', type.Description);
            serviceTypeSelect.appendChild(option);
        });
    }



    calculateServicePrice(basePrice, serviceTypeId) {
        const serviceType = this.serviceTypes.find(type => type.ID == serviceTypeId);
        const multiplier = serviceType?.Price_Multiplier || 1.0;
        return basePrice * multiplier;
    }

    // Update the setupBookingForm method to include date validation
    setupBookingForm(service) {
        const form = document.getElementById('service-booking-form');
        if (!form) return;

        form.reset();

        // Set minimum date to today and add date validation
        const dateInput = document.getElementById('booking-date');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;

            // Set default date based on current time
            const now = new Date();
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTimeTotal = currentHour * 60 + currentMinutes;
            const cutoffTimeTotal = 12 * 60;

            let defaultDate = new Date();

            // If after 12 PM, default to tomorrow
            if (currentTimeTotal >= cutoffTimeTotal) {
                defaultDate.setDate(defaultDate.getDate() + 1);
            }

            dateInput.value = defaultDate.toISOString().split('T')[0];

            // Setup enhanced date validation with hints
            this.setupDateValidation();

            // Setup time selection
            this.setupTimeSelection();
        }

        // Prefill user data if available
        this.prefillUserData();

        // Handle form submission with enhanced validation
        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.submitBooking(service, new FormData(form));
        };
    }
    // Enhanced error message display for form
    showFormError(message, type = 'error', targetElement = null) {
        // Remove existing error messages
        this.hideFormErrors();

        const errorMessage = document.createElement('div');
        errorMessage.className = `form-error-message ${type === 'warning' ? 'warning' : ''}`;
        errorMessage.innerHTML = `
        <i class="fas ${type === 'warning' ? 'fa-exclamation-triangle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;

        if (targetElement) {
            // Add error to specific form group
            const formGroup = targetElement.closest('.form-group');
            if (formGroup) {
                formGroup.classList.add(type === 'warning' ? 'has-warning' : 'has-error');
                formGroup.appendChild(errorMessage);
            }
        } else {
            // Add general error at the top of the form
            const form = document.getElementById('service-booking-form');
            if (form) {
                form.insertBefore(errorMessage, form.firstChild);
            }
        }

        // Scroll to error message if it's not visible
        setTimeout(() => {
            errorMessage.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        }, 100);
    }
    hideFormErrors() {
        // Remove all error messages
        document.querySelectorAll('.form-error-message').forEach(error => error.remove());

        // Remove error classes from form groups
        document.querySelectorAll('.form-group.has-error, .form-group.has-warning').forEach(group => {
            group.classList.remove('has-error', 'has-warning');
        });
    }
    // Enhanced time validation with error messages
    validateTimeSelection(selectedDate, selectedTime) {
        const now = new Date();
        const today = new Date(now.toDateString());
        const selected = new Date(selectedDate);

        if (selected.getTime() === today.getTime()) {
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTimeTotal = currentHour * 60 + currentMinutes;

            if (selectedTime) {
                const [selectedHours, selectedMinutes] = selectedTime.split(':').map(Number);
                const selectedTimeTotal = selectedHours * 60 + selectedMinutes;

                // Check if selected time has passed
                if (selectedTimeTotal <= currentTimeTotal) {
                    return {
                        valid: false,
                        message: 'Selected time has already passed. Please choose a future time.',
                        type: 'error'
                    };
                }

                // Check if it's after 12 PM for same-day bookings
                if (currentTimeTotal >= 720) { // 12:00 PM
                    return {
                        valid: false,
                        message: 'Same-day bookings after 12:00 PM are not allowed. Please select tomorrow.',
                        type: 'error'
                    };
                }

                // Warning for booking close to cutoff time
                const timeUntilCutoff = 720 - currentTimeTotal; // Minutes until 12 PM
                if (timeUntilCutoff <= 60) { // Less than 1 hour until cutoff
                    return {
                        valid: true,
                        message: `Hurry! Same-day bookings close in ${timeUntilCutoff} minutes.`,
                        type: 'warning'
                    };
                }
            }
        }

        return { valid: true };
    }
    // Update the setupTimeSelection method to remove auto-correction
    setupTimeSelection() {
        const timeSelect = document.getElementById('booking-time');
        if (!timeSelect) return;

        // Set default time to 09:00 AM
        timeSelect.value = '09:00';

        // If it's today and after specific times, adjust available times
        const dateInput = document.getElementById('booking-date');
        if (dateInput) {
            const updateTimeAvailability = () => {
                const selectedDate = new Date(dateInput.value);
                const today = new Date();
                const isToday = selectedDate.toDateString() === today.toDateString();

                // Clear previous errors
                this.hideFormErrors();

                if (isToday) {
                    const currentHour = today.getHours();
                    const currentMinutes = today.getMinutes();
                    const currentTimeTotal = currentHour * 60 + currentMinutes;

                    // Check if it's after 12 PM for same-day bookings
                    if (currentTimeTotal >= 720) {
                        // After 12 PM - disable time selection and show error
                        timeSelect.value = '';
                        timeSelect.disabled = true;
                        this.showFormError('Same-day bookings after 12:00 PM are not allowed. Please select another date.', 'error', timeSelect);
                        return; // Stop further processing
                    }

                    // Disable past times for today (only if before 12 PM)
                    for (let option of timeSelect.options) {
                        if (option.value) {
                            const [hours, minutes] = option.value.split(':').map(Number);
                            const optionTimeTotal = hours * 60 + minutes;

                            if (optionTimeTotal <= currentTimeTotal) {
                                option.disabled = true;
                                option.textContent = option.textContent.replace(' (Passed)', '') + ' (Passed)';
                                option.classList.add('error');
                            } else {
                                option.disabled = false;
                                option.textContent = option.textContent.replace(' (Passed)', '');
                                option.classList.remove('error');
                            }
                        }
                    }

                    // If current time is after 17:00 (5 PM), disable all times for today
                    if (currentTimeTotal >= 1020) { // 17:00 = 1020 minutes
                        timeSelect.value = '';
                        timeSelect.disabled = true;
                        this.showFormError('No more available times for today. Please select another date.', 'error', timeSelect);
                    } else {
                        timeSelect.disabled = false;

                        // Set to next available time slot
                        const availableOptions = Array.from(timeSelect.options)
                            .filter(opt => !opt.disabled && opt.value)
                            .map(opt => opt.value);

                        if (availableOptions.length > 0) {
                            timeSelect.value = availableOptions[0];
                        }
                    }

                    // Show warning if close to cutoff time
                    const timeUntilCutoff = 720 - currentTimeTotal;
                    if (timeUntilCutoff <= 120) { // 2 hours or less
                        this.showFormError(
                            `Same-day bookings close in ${Math.ceil(timeUntilCutoff / 60)} hours. Complete your booking soon!`,
                            'warning',
                            dateInput
                        );
                    }
                } else {
                    // For future dates, enable all times
                    for (let option of timeSelect.options) {
                        option.disabled = false;
                        option.textContent = option.textContent.replace(' (Passed)', '');
                        option.classList.remove('error');
                    }
                    timeSelect.disabled = false;
                }
            };

            // Update time availability when date changes
            dateInput.addEventListener('change', updateTimeAvailability);

            // Also validate when time selection changes
            timeSelect.addEventListener('change', () => {
                const selectedDate = dateInput.value;
                const selectedTime = timeSelect.value;
                const validation = this.validateTimeSelection(selectedDate, selectedTime);

                if (!validation.valid) {
                    this.showFormError(validation.message, validation.type, timeSelect);
                } else if (validation.message) {
                    this.showFormError(validation.message, validation.type, timeSelect);
                } else {
                    this.hideFormErrors();
                }
            });

            // Initial update
            setTimeout(updateTimeAvailability, 100);
        }
    }

    // Helper methods for time messages - UPDATED VERSION
    showTimeMessage(message, type = 'warning') {
        this.hideTimeMessage(); // Remove existing message first

        const timeSelect = document.getElementById('booking-time');
        if (!timeSelect) return;

        const timeMessage = document.createElement('div');
        timeMessage.className = `time-message ${type}`;
        timeMessage.innerHTML = `
        <i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-clock'}"></i>
        <span>${message}</span>
    `;

        timeSelect.parentNode.appendChild(timeMessage);
    }

    hideTimeMessage() {
        const existingMessage = document.querySelector('.time-message');
        if (existingMessage) {
            existingMessage.remove();
        }
    }
    // Add this missing method to your class
    validateBookingDate(selectedDate) {
        const now = new Date();
        const today = new Date(now.toDateString());
        const selected = new Date(selectedDate);

        // Check if selected date is today
        if (selected.getTime() === today.getTime()) {
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTimeTotal = currentHour * 60 + currentMinutes;
            const cutoffTimeTotal = 12 * 60; // 12:00 PM in minutes

            if (currentTimeTotal >= cutoffTimeTotal) {
                return {
                    valid: false,
                    message: 'Same-day bookings must be made before 12:00 PM. Please select tomorrow or a future date.'
                };
            }
        }

        // Check for past dates
        if (selected < today) {
            return {
                valid: false,
                message: 'Cannot book for past dates. Please select today or a future date.'
            };
        }

        return { valid: true };
    }

    // Enhanced validation that includes both time cutoff and duplicate prevention
    validateBookingDateTime(selectedDate, selectedTime = null) {
        const now = new Date();
        const today = new Date(now.toDateString());
        const selected = new Date(selectedDate);

        // Check for past dates
        if (selected < today) {
            return {
                valid: false,
                message: 'Cannot book for past dates. Please select today or a future date.'
            };
        }

        // Check if selected date is today
        if (selected.getTime() === today.getTime()) {
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTimeTotal = currentHour * 60 + currentMinutes;
            const cutoffTimeTotal = 12 * 60; // 12:00 PM in minutes

            // Check 12 PM cutoff
            if (currentTimeTotal >= cutoffTimeTotal) {
                return {
                    valid: false,
                    message: 'Same-day bookings must be made before 12:00 PM. Please select tomorrow or a future date.'
                };
            }

            // If time is provided, check if it's in the past
            if (selectedTime) {
                const [selectedHours, selectedMinutes] = selectedTime.split(':').map(Number);
                const selectedTimeTotal = selectedHours * 60 + selectedMinutes;

                if (selectedTimeTotal <= currentTimeTotal) {
                    return {
                        valid: false,
                        message: 'Selected time has already passed. Please choose a future time.'
                    };
                }
            }
        }

        return { valid: true };
    }

    // Enhanced availability check that prevents duplicate bookings
    async checkBookingAvailabilityWithDuplicates(serviceId, date, customerId) {
        try {
            const user = window.authManager.getUser();
            if (!user) return { available: false, message: 'Not authenticated' };

            // First check the standard availability
            const response = await this.fetchRequest('GET',
                `/bookings/check-availability?Customer_ID=${customerId}&Service_ID=${serviceId}&Date=${date}`
            );

            if (!response.available) {
                return response;
            }

            // Additional client-side duplicate check for today
            const today = new Date().toISOString().split('T')[0];
            const selectedDate = new Date(date).toISOString().split('T')[0];

            if (selectedDate === today) {
                // Check if user already has a booking for this service today
                const existingBookings = await this.getCustomerBookingsForToday(customerId);
                const hasDuplicate = existingBookings.some(booking =>
                    booking.Service_ID == serviceId &&
                    booking.Status !== 'cancelled' &&
                    booking.Status !== 'rejected'
                );

                if (hasDuplicate) {
                    return {
                        available: false,
                        message: 'You already have an active booking for this service today. Please choose a different service or wait until tomorrow.'
                    };
                }
            }

            return response;
        } catch (error) {
            console.error('Enhanced availability check failed:', error);
            return { available: false, message: 'Availability check failed. Please try again.' };
        }
    }

    // Method to get customer's bookings for today
    async getCustomerBookingsForToday(customerId) {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await this.fetchRequest('GET',
                `/bookings/customer/${customerId}?date=${today}`
            );

            if (response.success) {
                return response.bookings || [];
            }
            return [];
        } catch (error) {
            console.error('Error fetching today\'s bookings:', error);
            return [];
        }
    }

    // Replace the current setupDateValidation method with this version
    setupDateValidation() {
        const dateInput = document.getElementById('booking-date');
        const dateHint = document.getElementById('date-hint');
        const hintText = document.getElementById('date-hint-text');
        const timeSelect = document.getElementById('booking-time');

        if (!dateInput || !dateHint) return;

        dateInput.addEventListener('change', (e) => {
            const now = new Date();
            const selected = new Date(e.target.value);
            const today = new Date(now.toDateString());
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTimeTotal = currentHour * 60 + currentMinutes;

            // Reset styles and hint
            dateInput.classList.remove('date-input-warning', 'date-input-error');
            dateHint.style.display = 'none';
            this.hideFormErrors();

            if (selected.getTime() === today.getTime()) {
                // Check if it's after 12 PM
                if (currentTimeTotal >= 720) { // 12:00 PM = 720 minutes
                    // After 12 PM - show error but DON'T auto-correct
                    dateInput.classList.add('date-input-error');
                    dateHint.classList.add('error');
                    hintText.textContent = 'Same-day bookings after 12:00 PM are not allowed. Please select tomorrow or a future date.';
                    dateHint.style.display = 'flex';

                    // Show form error - this is what the user needs to see
                    this.showFormError('Same-day bookings after 12:00 PM are not allowed. Please select tomorrow or a future date.', 'error', dateInput);

                    // DON'T auto-correct - let the user see the error and choose themselves
                    // Just disable time selection for this invalid date
                    if (timeSelect) {
                        timeSelect.disabled = true;
                        timeSelect.value = '';
                    }
                } else {
                    // Before 12 PM - show warning but allow selection
                    const hoursLeft = 12 - currentHour;
                    const minutesLeft = 60 - currentMinutes;
                    dateInput.classList.add('date-input-warning');
                    dateHint.classList.add('warning');
                    hintText.textContent = `Same-day booking available. Must be booked within ${hoursLeft}h ${minutesLeft}m.`;
                    dateHint.style.display = 'flex';

                    // Update time availability
                    if (timeSelect) {
                        setTimeout(() => this.setupTimeSelection(), 100);
                    }
                }
            } else if (selected < today) {
                // Past date - show error but DON'T auto-correct
                dateInput.classList.add('date-input-error');
                dateHint.classList.add('error');
                hintText.textContent = 'Cannot book for past dates. Please select today or a future date.';
                dateHint.style.display = 'flex';

                // Show form error
                this.showFormError('Cannot book for past dates. Please select today or a future date.', 'error', dateInput);

                // DON'T auto-correct - let user see the error
                if (timeSelect) {
                    timeSelect.disabled = true;
                    timeSelect.value = '';
                }
            } else {
                // Future date - valid selection
                if (timeSelect) {
                    timeSelect.disabled = false;
                    setTimeout(() => this.setupTimeSelection(), 100);
                }
            }
        });

        // Trigger validation on page load
        setTimeout(() => {
            dateInput.dispatchEvent(new Event('change'));
        }, 100);
    }

    async checkBookingAvailability(serviceId, date) {
        try {
            const user = window.authManager.getUser();
            if (!user) return { available: false, message: 'Not authenticated' };

            const response = await this.fetchRequest('GET',
                `/bookings/check-availability?Customer_ID=${user.ID}&Service_ID=${serviceId}&Date=${date}`
            );

            return response;
        } catch (error) {
            console.error('Availability check failed:', error);
            return { available: false, message: 'Check failed' };
        }
    }
    handleBookService(serviceId) {
        const service = this.services.find(s => s.ID == serviceId);
        if (!service) {
            this.showError('Service not found. Please try again.');
            return;
        }

        // Allow viewing service details without authentication
        // Only require authentication when actually booking
        this.openBookingModal(service);
    }
    checkPendingIntendedBooking() {
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            return;
        }

        const intendedService = localStorage.getItem('intendedService');
        const intendedServiceData = localStorage.getItem('intendedServiceData');
        const intendedBookingData = localStorage.getItem('intendedBookingData');

        if (intendedService && intendedServiceData && intendedBookingData) {
            console.log('Found pending intended booking for authenticated user');

            setTimeout(() => {
                try {
                    const service = JSON.parse(intendedServiceData);
                    const bookingData = JSON.parse(intendedBookingData);

                    if (service) {
                        this.openBookingModal(service);

                        // Pre-fill the form with stored data
                        this.prefillBookingForm(bookingData);
                    }
                } catch (error) {
                    console.error('Error parsing intended booking data:', error);
                }
            }, 1000);
        }
    }

    // Add prefill method
    prefillBookingForm(bookingData) {
        if (!bookingData) return;

        const form = document.getElementById('service-booking-form');
        if (!form) return;

        // Pre-fill form fields
        if (bookingData.date) {
            const dateInput = document.getElementById('booking-date');
            if (dateInput) dateInput.value = bookingData.date;
        }

        if (bookingData.time) {
            const timeInput = document.getElementById('booking-time');
            if (timeInput) timeInput.value = bookingData.time;
        }

        if (bookingData.address) {
            const addressFields = ['address-street', 'address-city', 'address-state', 'address-postal-code'];
            addressFields.forEach(field => {
                const input = document.getElementById(field);
                if (input && bookingData.address[field.replace('address-', '')]) {
                    input.value = bookingData.address[field.replace('address-', '')];
                }
            });
        }

        if (bookingData.instructions) {
            const instructionsInput = document.getElementById('special-requests');
            if (instructionsInput) instructionsInput.value = bookingData.instructions;
        }

        if (bookingData.propertyType) {
            const propertyTypeInput = document.getElementById('property-type');
            if (propertyTypeInput) propertyTypeInput.value = bookingData.propertyType;
        }

        if (bookingData.cleaningFrequency) {
            const frequencyInput = document.getElementById('cleaning-frequency');
            if (frequencyInput) frequencyInput.value = bookingData.cleaningFrequency;
        }
    }

    // Update the submitBooking method to include better date validation
    async submitBooking(service, formData) {
        try {
            // Clear previous errors
            this.hideFormErrors();

            // Get form values
            const selectedDate = formData.get('booking-date');
            const selectedTime = formData.get('booking-time');

            // Validate date and time before proceeding
            const dateTimeValidation = this.validateBookingDateTime(selectedDate, selectedTime);

            if (!dateTimeValidation.valid) {
                this.showFormError(dateTimeValidation.message, 'error', document.getElementById('booking-date'));

                // Scroll to the error
                setTimeout(() => {
                    document.getElementById('booking-date').scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }, 100);
                return;
            }

            // Additional time validation
            const timeValidation = this.validateTimeSelection(selectedDate, selectedTime);
            if (!timeValidation.valid) {
                this.showFormError(timeValidation.message, timeValidation.type, document.getElementById('booking-time'));

                // Scroll to the error
                setTimeout(() => {
                    document.getElementById('booking-time').scrollIntoView({
                        behavior: 'smooth',
                        block: 'center'
                    });
                }, 100);
                return;
            }

            // Check authentication before submitting
            if (!window.authManager || !window.authManager.isAuthenticated()) {
                this.showFormError('Please log in to request a quotation.', 'error');

                // Store intended booking data and redirect to login
                localStorage.setItem('intendedService', service.ID);
                localStorage.setItem('intendedServiceData', JSON.stringify(service));
                localStorage.setItem('intendedBookingData', JSON.stringify({
                    date: selectedDate,
                    time: selectedTime,
                    address: {
                        street: formData.get('address-street'),
                        city: formData.get('address-city'),
                        state: formData.get('address-state'),
                        postalCode: formData.get('address-postal-code')
                    },
                    instructions: formData.get('special-requests'),
                    propertyType: formData.get('property-type'),
                    cleaningFrequency: formData.get('cleaning-frequency')
                }));

                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
                return;
            }

            this.showLoading('Processing your quotation request...');

            const user = window.authManager.getUser();
            if (!user || !user.ID) {
                throw new Error('User information not found. Please log in again.');
            }

            // Enhanced availability check that includes duplicate prevention
            const availability = await this.checkBookingAvailabilityWithDuplicates(service.ID, selectedDate, user.ID);

            if (!availability.available) {
                this.showFormError(availability.message, 'error', document.getElementById('booking-date'));
                this.hideLoading();
                return;
            }

            // Prepare quotation request data
            const bookingData = {
                Service_ID: service.ID,
                Customer_ID: user.ID,
                Date: selectedDate,
                Time: selectedTime || '09:00',
                Address_Street: formData.get('address-street') || '',
                Address_City: formData.get('address-city') || '',
                Address_State: formData.get('address-state') || '',
                Address_Postal_Code: formData.get('address-postal-code') || '',
                Special_Instructions: formData.get('special-requests') || '',
                Duration: service.Duration,
                Status: 'requested',
                Property_Type: formData.get('property-type'),
                Cleaning_Frequency: formData.get('cleaning-frequency')
            };

            console.log('📤 Submitting quotation request:', bookingData);

            // Submit to database
            const response = await this.fetchRequest('POST', '/bookings', bookingData);

            if (response && (response.success || response.booking)) {
                this.showSuccess('Quotation request submitted successfully! We will contact you within 24 hours.');
                this.closeBookingModal();

                // Clear any intended booking data
                localStorage.removeItem('intendedService');
                localStorage.removeItem('intendedServiceData');
                localStorage.removeItem('intendedBookingData');
            } else {
                throw new Error('Failed to submit quotation request');
            }

        } catch (error) {
            console.error('❌ Quotation request submission error:', error);

            // Handle specific error cases
            if (error.message.includes('already have a booking')) {
                this.showFormError('You already have a booking for this service today. Please choose a different service or date.', 'error', document.getElementById('booking-date'));
            } else if (error.message.includes('500')) {
                this.showFormError('Server error. Please check if the backend server is running and try again.', 'error');
            } else if (error.message.includes('401')) {
                this.showFormError('Authentication failed. Please log in again.', 'error');
                localStorage.setItem('intendedService', service.ID);
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            } else if (error.message.includes('404')) {
                this.showFormError('Booking endpoint not found. Please contact support.', 'error');
            } else {
                this.showFormError(error.message || 'Failed to submit quotation request. Please try again.', 'error');
            }
        } finally {
            this.hideLoading();
        }
    }

    prefillUserData() {
        if (!window.authManager || !window.authManager.isAuthenticated()) return;

        const user = window.authManager.getUser();
        if (!user) return;

        // Prefill basic user information
        const fields = {
            'customer-name': user.Full_Name,
            'customer-email': user.Email,
            'customer-phone': user.Phone
        };

        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field && value) {
                field.value = value;
            }
        });

        // NEW: Prefill address fields by parsing the combined address
        if (user.Address) {
            const parsedAddress = this.parseAddress(user.Address);

            const addressFields = {
                'address-street': parsedAddress.street,
                'address-city': parsedAddress.city,
                'address-state': parsedAddress.state,
                'address-postal-code': parsedAddress.zip
            };

            Object.entries(addressFields).forEach(([fieldId, value]) => {
                const field = document.getElementById(fieldId);
                if (field && value) {
                    field.value = value;
                }
            });
        }
    }
    parseAddress(addressString) {
        if (!addressString || addressString === 'Not set') {
            return { street: '', city: '', state: '', zip: '' };
        }

        try {
            // Split by commas and trim each part
            const parts = addressString.split(',').map(part => part.trim());

            // Handle different address formats
            if (parts.length >= 4) {
                return {
                    street: parts[0],
                    city: parts[1],
                    state: parts[2],
                    zip: parts[3]
                };
            } else if (parts.length === 3) {
                return {
                    street: parts[0],
                    city: parts[1],
                    state: parts[2],
                    zip: ''
                };
            } else if (parts.length === 2) {
                return {
                    street: parts[0],
                    city: parts[1],
                    state: '',
                    zip: ''
                };
            } else {
                return {
                    street: addressString,
                    city: '',
                    state: '',
                    zip: ''
                };
            }
        } catch (error) {
            console.error('Error parsing address:', error);
            return { street: addressString, city: '', state: '', zip: '' };
        }
    }
    closeBookingModal() {
        const popup = document.getElementById('service-popup');
        if (popup) {
            popup.classList.remove('active');
            // FIXED: Don't set aria-hidden when closing
            popup.removeAttribute('aria-hidden');
            document.body.style.overflow = 'auto';
        }
    }

    setupSearch() {
        const searchInput = document.getElementById('serviceSearch');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce(() => {
                this.filterServices();
            }, 300));
        }
    }

    setupFilters() {
        const categoryFilter = document.getElementById('categoryFilter');
        const availabilityFilter = document.getElementById('availabilityFilter');
        const sortSelect = document.getElementById('sortSelect');

        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                this.currentCategory = categoryFilter.value;
                this.filterServices();
            });
        }

        if (availabilityFilter) {
            availabilityFilter.addEventListener('change', () => {
                this.filterServices();
            });
        }

        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.sortServices(sortSelect.value);
            });
        }
    }

    filterServices() {
        const searchInput = document.getElementById('serviceSearch');
        const categoryFilter = document.getElementById('categoryFilter');
        const availabilityFilter = document.getElementById('availabilityFilter');

        const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
        const category = categoryFilter ? categoryFilter.value : 'all';
        const availability = availabilityFilter ? availabilityFilter.value : 'all';

        this.filteredServices = this.services.filter(service => {
            const matchesSearch = service.Name.toLowerCase().includes(searchTerm) ||
                (service.Description && service.Description.toLowerCase().includes(searchTerm));

            const matchesCategory = category === 'all' ||
                service.Category === category ||
                (category === 'both' && service.Category === 'both');

            const matchesAvailability = availability === 'all' ||
                (availability === 'available' && service.Is_Available) ||
                (availability === 'unavailable' && !service.Is_Available);

            return matchesSearch && matchesCategory && matchesAvailability;
        });

        this.renderServices();
        this.updateResultsCount();
    }

    sortServices(sortBy) {
        switch (sortBy) {
            case 'price-low':
                this.filteredServices.sort((a, b) => (a.Price || 0) - (b.Price || 0));
                break;
            case 'price-high':
                this.filteredServices.sort((a, b) => (b.Price || 0) - (a.Price || 0));
                break;
            case 'name':
                this.filteredServices.sort((a, b) => a.Name.localeCompare(b.Name));
                break;
            case 'duration':
                this.filteredServices.sort((a, b) => (a.Duration || 0) - (b.Duration || 0));
                break;
            default:
                this.filteredServices.sort((a, b) => (a.ID || 0) - (b.ID || 0));
                break;
        }
        this.renderServices();
    }

    updateCategoryFilters() {
        const categoryFilter = document.getElementById('categoryFilter');
        if (!categoryFilter) return;

        const categories = [...new Set(this.services.map(service => service.Category).filter(Boolean))];
        const currentValue = categoryFilter.value;

        categoryFilter.innerHTML = `
            <option value="all">All Categories</option>
            ${categories.map(category => `
                <option value="${category}">${this.getCategoryLabel(category)}</option>
            `).join('')}
        `;

        if (categories.includes(currentValue)) {
            categoryFilter.value = currentValue;
        }
    }

    getCategoryLabel(category) {
        const categories = {
            'residential': 'Residential',
            'commercial': 'Commercial',
            'both': 'Residential & Commercial',
            'general': 'General'
        };
        return categories[category] || this.formatCategoryName(category);
    }

    updateResultsCount() {
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            const totalCount = this.services.length;
            const filteredCount = this.filteredServices.length;

            if (totalCount === 0) {
                resultsCount.textContent = 'No services available';
            } else if (filteredCount === totalCount) {
                resultsCount.textContent = `Showing all ${totalCount} services`;
            } else {
                resultsCount.textContent = `Showing ${filteredCount} of ${totalCount} services`;
            }
        }
    }

    clearFilters() {
        const searchInput = document.getElementById('serviceSearch');
        const categoryFilter = document.getElementById('categoryFilter');
        const availabilityFilter = document.getElementById('availabilityFilter');
        const sortSelect = document.getElementById('sortSelect');

        if (searchInput) searchInput.value = '';
        if (categoryFilter) categoryFilter.value = 'all';
        if (availabilityFilter) availabilityFilter.value = 'all';
        if (sortSelect) sortSelect.value = 'default';

        this.currentCategory = 'all';
        this.filteredServices = [...this.services];
        this.renderServices();
        this.updateResultsCount();
    }

    getEmptyStateHTML() {
        if (this.services.length === 0) {
            return `
                <div class="empty-state">
                    <i class="fas fa-concierge-bell"></i>
                    <h3>No Services Available</h3>
                    <p>We don't have any services available at the moment. Please check back later or contact us for more information.</p>
                    <button class="service-cta-btn" onclick="window.location.href='contact.html'">
                        Contact Us
                    </button>
                </div>
            `;
        } else {
            return `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No Services Found</h3>
                    <p>We couldn't find any services matching your criteria. Try adjusting your filters or search terms.</p>
                    <button class="service-cta-btn" onclick="window.customerServices.clearFilters()">
                        Show All Services
                    </button>
                </div>
            `;
        }
    }

    checkPendingIntendedService() {
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            return;
        }

        const intendedService = localStorage.getItem('intendedService');
        const intendedServiceData = localStorage.getItem('intendedServiceData');

        if (intendedService && intendedServiceData) {
            console.log('Found pending intended service for authenticated user');

            setTimeout(() => {
                try {
                    const service = JSON.parse(intendedServiceData);
                    if (service) {
                        this.openBookingModal(service);
                        localStorage.removeItem('intendedService');
                        localStorage.removeItem('intendedServiceData');
                        localStorage.removeItem('returnUrl');
                    }
                } catch (error) {
                    console.error('Error parsing intended service data:', error);
                }
            }, 1000);
        }
    }

    showLoading(message = 'Loading services...') {
        const grid = document.querySelector('.services-grid');
        if (grid) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #666;">
                    <div class="loading-spinner"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    hideLoading() {
        // Loading state is handled in renderServices
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        const existingNotification = document.querySelector('.customer-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `customer-notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : type === 'success' ? 'fa-check-circle' : 'fa-info-circle'}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
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
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing CustomerServices...');
    window.customerServices = new CustomerServices();
});

// Handle intended service after login
if (window.authManager && window.authManager.isAuthenticated()) {
    const intendedService = localStorage.getItem('intendedService');
    if (intendedService) {
        localStorage.removeItem('intendedService');
        console.log('User logged in with intended service:', intendedService);
    }
}

// Add CSS for loading animation and additional styles
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .loading-spinner {
        border: 3px solid #f3f3f3;
        border-top: 3px solid var(--primary-color);
        border-radius: 50%;
        width: 40px;
        height: 40px;
        animation: spin 1s linear infinite;
        margin: 0 auto 1rem;
    }
    
    .service-meta {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1rem;
        font-size: 0.8rem;
    }
    
    .service-category {
        background: #e6f7ff;
        color: #1890ff;
        padding: 0.3rem 0.8rem;
        border-radius: 12px;
        font-weight: 600;
    }
    
    .service-status {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-size: 0.75rem;
        font-weight: 600;
        padding: 0.3rem 0.8rem;
        border-radius: 12px;
    }
    
    .service-status.available {
        background: #d3f9d8;
        color: #2b8a3e;
    }
    
    .service-status.unavailable {
        background: #ffe3e3;
        color: #c92a2a;
    }
    
    .service-image-placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 3rem;
    }
    
    .popup-image-placeholder {
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 4rem;
    }
    
    .empty-state {
        grid-column: 1 / -1;
        text-align: center;
        padding: 3rem;
        color: #666;
    }
    
    .empty-state i {
        font-size: 3rem;
        margin-bottom: 1rem;
        color: #ddd;
    }
    
    .empty-state h3 {
        margin-bottom: 1rem;
    }
    
    .empty-state p {
        margin-bottom: 2rem;
    }
    
    .customer-notification {
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
    
    .notification-success { 
        background: #27ae60;
        border-left: 4px solid #219653;
    }
    
    .notification-error { 
        background: #e74c3c;
        border-left: 4px solid #c0392b;
    }
    
    .notification-info { 
        background: #3498db;
        border-left: 4px solid #2980b9;
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
    
    .service-badge {
        position: absolute;
        top: 16px;
        right: 16px;
        color: white;
        padding: 0.4rem 1rem;
        border-radius: 20px;
        font-size: 0.7rem;
        font-weight: 700;
        z-index: 2;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .service-badge.popular {
        background: linear-gradient(135deg, #ef4444, #dc2626);
    }
    
    .service-badge.premium {
        background: linear-gradient(135deg, #f59e0b, #d97706);
    }
    
    .service-badge.special {
        background: linear-gradient(135deg, #8b5cf6, #7c3aed);
    }
    
    .service-badge.unavailable {
        background: linear-gradient(135deg, #6b7280, #4b5563);
    }
    
    .service-features {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin: 1rem 0;
    }
    
    .feature-tag {
        background: #f8f9fa;
        border: 1px solid #e9ecef;
        padding: 0.25rem 0.5rem;
        border-radius: 4px;
        font-size: 0.75rem;
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
    }
    
    .feature-tag i {
        color: #28a745;
        font-size: 0.7rem;
    }
`;
document.head.appendChild(style);