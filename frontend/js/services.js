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

            // Add auth headers if user is authenticated
            if (window.authManager && window.authManager.isAuthenticated()) {
                headers['Authorization'] = `Bearer ${window.authManager.token}`;
            }

            const config = {
                method: method,
                headers: headers
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                config.body = JSON.stringify(data);
            }

            console.log(`Making ${method} request to: ${this.baseURL}${endpoint}`);
            const response = await fetch(`${this.baseURL}${endpoint}`, config);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`Fetch ${method} ${endpoint} failed:`, error);
            throw error;
        }
    }

    async loadServices() {
        try {
            this.showLoading();

            console.log('Loading services from database...');
            const data = await this.fetchRequest('GET', '/services');
            
            let servicesArray = [];
            
            // Handle different API response structures
            if (data && Array.isArray(data)) {
                servicesArray = data;
            } else if (data && data.services && Array.isArray(data.services)) {
                servicesArray = data.services;
            } else if (data && data.data && Array.isArray(data.data)) {
                servicesArray = data.data;
            } else if (data && data.success && Array.isArray(data.data)) {
                servicesArray = data.data;
            } else {
                throw new Error('Invalid response format from services API');
            }
            
            if (servicesArray.length > 0) {
                this.services = this.processServiceData(servicesArray);
                console.log(`✅ Successfully loaded ${this.services.length} services from database`);
                this.showSuccess(`Loaded ${this.services.length} services from database`);
            } else {
                throw new Error('No services found in database');
            }

        } catch (error) {
            console.error('❌ Error loading services from database:', error);
            this.showError('Failed to load services from database. Please try again later.');
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
            Price: parseFloat(service.Price || service.price || 0),
            Duration: service.Duration || service.duration || 60,
            Category: service.Category || service.category,
            Is_Available: service.Is_Available !== undefined ? service.Is_Available : 
                         (service.is_available !== undefined ? service.is_available : true),
            Image_URL: service.Image_URL || service.image_url,
            Service_Type_ID: service.Service_Type_ID || service.service_type_id,
            Service_Category_ID: service.Service_Category_ID || service.service_category_id,
            Features: this.parseFeatures(service.Features || service.features),
            Requirements: this.parseRequirements(service.Requirements || service.requirements),
            Created_At: service.Created_At || service.created_at,
            Updated_At: service.Updated_At || service.updated_at
        })).filter(service => service.Name && service.Price);
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
        const features = service.Features || [];
        const badgeType = this.getServiceBadgeType(service);

        return `
            <div class="service-card" data-service-id="${service.ID}" data-category="${service.Category}">
                ${badgeType ? `<div class="service-badge ${badgeType}">${this.getBadgeText(badgeType)}</div>` : ''}
                
                <div class="service-image-container">
                    <div class="service-image-placeholder">
                        <i class="fas ${this.getServiceIcon(service.Name)}"></i>
                    </div>
                    ${service.Image_URL ? `
                        <img src="${this.getImageUrl(service.Image_URL)}" alt="${service.Name}" 
                             onerror="this.style.display='none'">
                    ` : ''}
                </div>
                
                <div class="service-content">
                    <h3>${this.escapeHtml(service.Name)}</h3>
                    <p>${this.escapeHtml(service.Description)}</p>
                    
                    ${features.length > 0 ? `
                        <div class="service-features">
                            ${features.slice(0, 3).map(feature => `
                                <span class="feature-tag">
                                    <i class="fas fa-check"></i>${this.escapeHtml(feature)}
                                </span>
                            `).join('')}
                            ${features.length > 3 ? `<span class="feature-tag">+${features.length - 3} more</span>` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="service-meta">
                        <span class="service-category">${this.escapeHtml(category)}</span>
                        <span class="service-status ${isAvailable ? 'available' : 'unavailable'}">
                            <i class="fas ${isAvailable ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                            ${isAvailable ? 'Available' : 'Unavailable'}
                        </span>
                    </div>
                    
                    <div class="service-footer">
                        <div class="price-container">
                            <span class="service-price">R ${service.Price.toFixed(2)}</span>
                            <span class="price-note">${service.Duration || 60} min service</span>
                        </div>
                        <button class="service-cta-btn ${!isAvailable ? 'disabled' : ''}" 
                                data-service-id="${service.ID}"
                                ${!isAvailable ? 'disabled' : ''}>
                            ${isAvailable ? 'Book Now' : 'Unavailable'}
                        </button>
                    </div>
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
        const bookButtons = document.querySelectorAll('.service-cta-btn:not(.disabled)');
        bookButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const serviceId = button.getAttribute('data-service-id');
                this.handleBookService(serviceId);
            });
        });

        const serviceCards = document.querySelectorAll('.service-card');
        serviceCards.forEach(card => {
            card.addEventListener('click', (e) => {
                if (!e.target.classList.contains('service-cta-btn')) {
                    const serviceId = card.getAttribute('data-service-id');
                    this.showServiceDetails(serviceId);
                }
            });
        });
    }

    showServiceDetails(serviceId) {
        const service = this.services.find(s => s.ID == serviceId);
        if (!service) return;
        this.handleBookService(serviceId);
    }

    handleBookService(serviceId) {
        const service = this.services.find(s => s.ID == serviceId);
        if (!service) {
            this.showError('Service not found. Please try again.');
            return;
        }

        if (!service.Is_Available) {
            this.showError('This service is currently unavailable. Please check back later.');
            return;
        }

        // Check authentication
        if (!window.authManager || !window.authManager.isAuthenticated()) {
            localStorage.setItem('intendedService', serviceId);
            localStorage.setItem('intendedServiceData', JSON.stringify(service));
            localStorage.setItem('returnUrl', window.location.href);
            window.location.href = 'login.html';
            return;
        }

        this.openBookingModal(service);
    }

    openBookingModal(service) {
        const popup = document.getElementById('service-popup');
        if (!popup) {
            this.showError('Booking system unavailable. Please contact support.');
            return;
        }

        // Populate service details from database
        document.getElementById('popup-service-title').textContent = service.Name;
        document.getElementById('popup-service-price').textContent = `R ${service.Price.toFixed(2)}`;
        document.getElementById('popup-service-description').textContent = service.Description;
        document.getElementById('popup-service-duration').textContent = `${service.Duration} minutes`;

        // Set service image
        const popupImage = document.getElementById('popup-service-image');
        if (popupImage) {
            if (service.Image_URL) {
                popupImage.src = this.getImageUrl(service.Image_URL);
                popupImage.alt = service.Name;
                popupImage.style.display = 'block';
                // Hide placeholder if image loads
                const placeholder = document.querySelector('.popup-image-placeholder');
                if (placeholder) placeholder.style.display = 'none';
            } else {
                popupImage.style.display = 'none';
                const placeholder = document.querySelector('.popup-image-placeholder') || document.createElement('div');
                placeholder.className = 'popup-image-placeholder';
                placeholder.innerHTML = `<i class="fas ${this.getServiceIcon(service.Name)}"></i>`;
                if (!popupImage.nextElementSibling) {
                    popupImage.parentNode.appendChild(placeholder);
                }
                placeholder.style.display = 'flex';
            }
        }

        // Populate service options based on default service types
        this.populateServiceOptions(service);

        // Show the popup - FIXED: Remove aria-hidden to fix accessibility issue
        popup.classList.add('active');
        popup.removeAttribute('aria-hidden');
        document.body.style.overflow = 'hidden';

        // Setup the booking form
        this.setupBookingForm(service);
    }

    populateServiceOptions(service) {
        const serviceTypeSelect = document.getElementById('service-type');
        if (!serviceTypeSelect) return;

        // Clear existing options
        serviceTypeSelect.innerHTML = '<option value="" disabled selected>Select service type</option>';

        // Add service types from default types
        this.serviceTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.ID;
            const calculatedPrice = this.calculateServicePrice(service.Price, type.ID);
            option.textContent = `${type.Name} - R ${calculatedPrice.toFixed(2)}`;
            option.setAttribute('data-price', calculatedPrice);
            serviceTypeSelect.appendChild(option);
        });

        // Update price when service type changes
        serviceTypeSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            const price = selectedOption.getAttribute('data-price');
            if (price) {
                document.getElementById('popup-service-price').textContent = `R ${parseFloat(price).toFixed(2)}`;
            }
        });
    }

    calculateServicePrice(basePrice, serviceTypeId) {
        const serviceType = this.serviceTypes.find(type => type.ID == serviceTypeId);
        const multiplier = serviceType?.Price_Multiplier || 1.0;
        return basePrice * multiplier;
    }

    setupBookingForm(service) {
        const form = document.getElementById('service-booking-form');
        if (!form) return;

        form.reset();

        // Set minimum date to today
        const dateInput = document.getElementById('booking-date');
        if (dateInput) {
            const today = new Date().toISOString().split('T')[0];
            dateInput.min = today;
            
            // Set default date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            dateInput.value = tomorrow.toISOString().split('T')[0];
        }

        // Prefill user data if available
        this.prefillUserData();

        // Handle form submission
        form.onsubmit = async (e) => {
            e.preventDefault();
            await this.submitBooking(service, new FormData(form));
        };
    }

    async submitBooking(service, formData) {
        try {
            this.showLoading('Processing your booking...');

            if (!window.authManager || !window.authManager.isAuthenticated()) {
                throw new Error('Please log in to book a service.');
            }

            const user = window.authManager.getUser();
            if (!user || !user.ID) {
                throw new Error('User information not found. Please log in again.');
            }

            const serviceTypeId = formData.get('service-type');
            if (!serviceTypeId) {
                throw new Error('Please select a service type.');
            }

            const selectedServiceType = this.serviceTypes.find(type => type.ID == serviceTypeId);
            const finalPrice = this.calculateServicePrice(service.Price, parseInt(serviceTypeId));

            // Prepare booking data for database
            const bookingData = {
                Service_ID: service.ID,
                Customer_ID: user.ID,
                Service_Type_ID: serviceTypeId,
                Date: formData.get('booking-date'),
                Time: formData.get('booking-time') || '09:00',
                Address: formData.get('customer-address') || user.Address || '',
                Special_Instructions: formData.get('special-requests') || '',
                Total_Amount: finalPrice,
                Duration: service.Duration,
                Status: 'pending',
                Property_Type: formData.get('property-type'),
                Property_Size: formData.get('property-size'),
                Cleaning_Frequency: formData.get('cleaning-frequency')
            };

            console.log('Submitting booking to database:', bookingData);

            // Submit to database
            const response = await this.fetchRequest('POST', '/bookings', bookingData);

            if (response && (response.success || response.id || response.booking_id)) {
                this.showSuccess('Booking submitted successfully! We will contact you to confirm your appointment.');
                this.closeBookingModal();
            } else {
                throw new Error('Failed to submit booking to database');
            }

        } catch (error) {
            console.error('Booking submission error:', error);
            this.showError(error.message || 'Failed to submit booking. Please try again.');
        } finally {
            this.hideLoading();
        }
    }

    prefillUserData() {
        if (!window.authManager || !window.authManager.isAuthenticated()) return;

        const user = window.authManager.getUser();
        if (!user) return;

        const fields = {
            'customer-name': user.Full_Name,
            'customer-email': user.Email,
            'customer-phone': user.Phone,
            'customer-address': user.Address
        };

        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = document.getElementById(fieldId);
            if (field && value) {
                field.value = value;
            }
        });
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