// services.js - Unified Customer Services with No Code Duplication
class CustomerServices {
    constructor() {
        this.baseURL = 'http://localhost:5000/api';
        this.services = [];
        this.filteredServices = [];
        this.currentCategory = 'all';
        this.serviceCategories = [];
        this.serviceTypes = [];

        // Unified booking system
        this.bookingForms = {
            modal: 'service-booking-form',
            page: 'booking-form'
        };
        this.currentBookingType = null;
        this.currentBookingService = null;

        // Rate limiting protection
        this.lastRequestTime = 0;
        this.minRequestInterval = 1000;
        this.retryAttempts = 3;
        this.retryDelay = 2000;

        // Cache for services
        this.servicesCache = {
            data: null,
            timestamp: 0,
            ttl: 300000
        };

        // Bind methods
        this.init = this.init.bind(this);
        this.loadServices = this.loadServices.bind(this);
        this.loadServiceMetadata = this.loadServiceMetadata.bind(this);
        this.renderServices = this.renderServices.bind(this);
        this.filterServices = this.filterServices.bind(this);
        this.handleBookService = this.handleBookService.bind(this);
        this.openBookingModal = this.openBookingModal.bind(this);
        this.closeBookingModal = this.closeBookingModal.bind(this);
        this.submitBooking = this.submitBooking.bind(this);
        this.debounce = this.debounce.bind(this);
        this.fetchRequest = this.fetchRequest.bind(this);

        this.init();
    }

    // Page detection
    getCurrentPage() {
        const path = window.location.pathname;
        if (path.includes('index.html') || path === '/' || path.endsWith('/frontend/')) {
            return 'home';
        } else if (path.includes('services.html')) {
            return 'services';
        } else if (path.includes('booking.html')) {
            return 'booking';
        } else {
            return 'other';
        }
    }

    async init() {
        console.log('Initializing Customer Services...');
        const currentPage = this.getCurrentPage();

        await this.loadServiceMetadata();

        if (currentPage === 'services') {
            await this.loadServices();
            this.setupSearch();
            this.setupFilters();
        } else if (currentPage === 'home') {
            await this.loadHomeServices();
        } else if (currentPage === 'booking') {
            await this.setupBookingPage();
        } else {
            await this.loadHomeServices();
        }

        this.setupEventListeners();
        this.checkPendingIntendedService();
    }

    // UNIFIED BOOKING SYSTEM
    // ======================

    async setupBookingPage() {
        try {
            this.showBookingLoading();
            await this.loadServices();

            if (this.services && this.services.length > 0) {
                this.populateBookingServiceDropdown();
                this.setupUnifiedBookingForm('page');
                this.hideBookingLoading();
            } else {
                this.showBookingError('No services available at the moment.');
            }
        } catch (error) {
            console.error('Error setting up booking form:', error);
            this.showBookingError('Failed to load booking form. Please try again.');
        }
    }

    openBookingModal(service) {
        const popup = document.getElementById('service-popup');
        if (!popup) {
            this.showError('Booking system unavailable. Please contact support.');
            return;
        }

        this.currentBookingService = service;
        this.populateModalServiceDetails(service);
        this.setupUnifiedBookingForm('modal', service);

        popup.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    setupUnifiedBookingForm(type, service = null) {
        this.currentBookingType = type;
        const formId = this.bookingForms[type];
        const form = document.getElementById(formId);

        if (!form) {
            console.error(`Booking form not found: ${formId}`);
            return;
        }

        form.reset();
        this.setupFormValidation(formId);
        this.setupDateValidation(formId);
        this.setupRealTimeValidation(formId);
        this.prefillUserData(formId);

        form.onsubmit = (e) => {
            e.preventDefault();
            this.handleBookingSubmission(type, service);
        };

        console.log(`✅ Unified booking form setup for: ${type}`);
    }

    async handleBookingSubmission(type, service = null) {
        const formId = this.bookingForms[type];
        const form = document.getElementById(formId);

        if (!form) {
            this.showError('Booking form not found.');
            return;
        }

        // For page form, validate service selection
        if (type === 'page') {
            const serviceSelect = document.getElementById('service-type');
            if (!serviceSelect || !serviceSelect.value) {
                this.showFieldError('service-type', 'Please select a service', formId);
                return;
            }

            // Find the selected service
            const selectedServiceId = serviceSelect.value;
            service = this.services.find(s => s.ID == selectedServiceId);
            if (!service) {
                this.showFieldError('service-type', 'Invalid service selected', formId);
                return;
            }

            // CRITICAL FIX: Set the currentBookingService
            this.currentBookingService = service;
            console.log('✅ Set currentBookingService for page form:', service.Name);
        }

        // For modal forms, ensure service is set
        if (type === 'modal' && !service) {
            service = this.currentBookingService;
            if (!service) {
                this.showError('No service selected for booking');
                return;
            }
        }

        if (!service) {
            this.showError('No service selected');
            return;
        }

        // Final verification
        console.log('🎯 Final service for booking:', {
            service: service?.Name,
            serviceId: service?.ID,
            currentBookingService: this.currentBookingService?.Name
        });

        await this.processBookingSubmission(service, new FormData(form), type);
    }
    async processBookingSubmission(service, formData, formType) {
        try {
            this.showFormLoading(true, formType);

            // Clear all previous errors
            this.clearAllFieldErrors(this.bookingForms[formType]);

            const validation = this.validateBookingFormData(formData, this.bookingForms[formType]);
            if (!validation.valid) {
                this.showFormLoading(false, formType);
                return;
            }

            if (!window.authManager || !window.authManager.isAuthenticated()) {
                this.storeIntendedBooking(formData, service, formType);
                this.showRestrictionAlert(['Please login to complete your booking'], 'warning', formType);
                setTimeout(() => window.location.href = 'login.html', 3000);
                this.showFormLoading(false, formType);
                return;
            }

            const user = window.authManager.getUser();
            if (!user || !user.ID) {
                throw new Error('User information not found. Please log in again.');
            }

            const selectedDate = formData.get('booking-date');
            const availability = await this.checkBookingAvailabilityWithDuplicates(service.ID, selectedDate, user.ID);
            if (!availability.available) {
                this.showFieldError('booking-date', availability.message, this.bookingForms[formType]);
                this.showFormLoading(false, formType);
                return;
            }

            const finalValidation = this.performFinalValidation(formData, service);
            if (!finalValidation.valid) {
                if (finalValidation.targetField) {
                    this.showFieldError(finalValidation.targetField, finalValidation.message, this.bookingForms[formType]);
                }
                this.showFormLoading(false, formType);
                return;
            }

            await this.submitBooking(service, formData, formType);

        } catch (error) {
            console.error('Booking submission error:', error);
            this.handleBookingError(error, formType);
        } finally {
            this.showFormLoading(false, formType);
        }
    }

    async submitBooking(service, formData, formType) {
        const user = window.authManager.getUser();
        const selectedDate = formData.get('booking-date');
        const selectedTime = formData.get('booking-time');

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

        console.log('📤 Submitting booking:', bookingData);

        const response = await this.fetchRequest('POST', '/bookings', bookingData);

        if (response && (response.success || response.booking)) {
            this.showSuccess('Booking request submitted successfully! We will contact you within 24 hours.');

            if (formType === 'modal') {
                this.closeBookingModal();
            }

            localStorage.removeItem('intendedService');
            localStorage.removeItem('intendedServiceData');
            localStorage.removeItem('intendedBookingData');
        } else {
            throw new Error('Failed to submit booking request');
        }
    }

    // SHARED VALIDATION METHODS
    // =========================

    validateBookingFormData(formData, formId) {
        let isValid = true;

        // Clear all previous errors
        this.clearAllFieldErrors(formId);

        // Debug info
        console.log('🔍 Validating form data:', {
            formId: formId,
            currentBookingService: this.currentBookingService,
            formData: Object.fromEntries(formData)
        });

        // Define required fields based on form type
        let requiredFields = [
            { id: 'booking-date', name: 'Booking Date' },
            { id: 'booking-time', name: 'Booking Time' },
            { id: 'address-street', name: 'Street Address' },
            { id: 'address-city', name: 'City' },
            { id: 'address-state', name: 'State' },
            { id: 'address-postal-code', name: 'Postal Code' },
            { id: 'customer-name', name: 'Full Name' },
            { id: 'customer-email', name: 'Email Address' },
            { id: 'customer-phone', name: 'Phone Number' }
        ];

        // Only require service-type for page form (not modal form)
        if (formId === 'booking-form') {
            requiredFields.unshift({ id: 'service-type', name: 'Service Type' });
        }

        // Validate required fields
        requiredFields.forEach(field => {
            const value = formData.get(field.id);
            if (!value || !value.trim()) {
                console.log(`❌ Missing required field: ${field.id}`);
                this.showFieldError(field.id, `${field.name} is required`, formId);
                isValid = false;
            } else {
                console.log(`✅ Field ${field.id} has value:`, value);
            }
        });

        // For modal forms, check if service is selected
        if (formId === 'service-booking-form' && !this.currentBookingService) {
            console.log('❌ Modal form missing currentBookingService');
            this.showError('No service selected for booking');
            isValid = false;
        }

        // For page forms, double-check service selection
        if (formId === 'booking-form') {
            const serviceSelect = document.getElementById('service-type');
            if (serviceSelect && (!serviceSelect.value || serviceSelect.value === '')) {
                console.log('❌ Page form service select has no value');
                this.showFieldError('service-type', 'Please select a service', formId);
                isValid = false;
            }
        }

        // Validate date and time
        const selectedDate = formData.get('booking-date');
        const selectedTime = formData.get('booking-time');
        const dateValidation = this.validateBookingDateTime(selectedDate, selectedTime);
        if (!dateValidation.valid) {
            this.showFieldError('booking-date', dateValidation.message, formId);
            isValid = false;
        }

        // Validate email format
        const email = formData.get('customer-email');
        if (email && !this.isValidEmail(email)) {
            this.showFieldError('customer-email', 'Please enter a valid email address', formId);
            isValid = false;
        }

        // Validate postal code format
        const postalCode = formData.get('address-postal-code');
        if (postalCode && !this.isValidPostalCode(postalCode)) {
            this.showFieldError('address-postal-code', 'Please enter a valid postal code', formId);
            isValid = false;
        }

        console.log(`📋 Form validation result: ${isValid ? 'VALID' : 'INVALID'}`);
        return { valid: isValid };
    }
    validateBookingDateTime(selectedDate, selectedTime = null) {
        const now = new Date();
        const today = new Date(now.toDateString());
        const selected = new Date(selectedDate);

        if (selected < today) {
            return {
                valid: false,
                message: 'Cannot book for past dates. Please select today or a future date.'
            };
        }

        if (selected.getTime() === today.getTime()) {
            const currentHour = now.getHours();
            const currentMinutes = now.getMinutes();
            const currentTimeTotal = currentHour * 60 + currentMinutes;
            const cutoffTimeTotal = 12 * 60;

            if (currentTimeTotal >= cutoffTimeTotal) {
                return {
                    valid: false,
                    message: 'Same-day bookings must be made before 12:00 PM. Please select tomorrow or a future date.'
                };
            }

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

    performFinalValidation(formData, service) {
        const selectedDate = formData.get('booking-date');
        const selectedTime = formData.get('booking-time');
        const today = new Date().toISOString().split('T')[0];

        if (selectedDate === today) {
            const now = new Date();
            const currentHour = now.getHours();
            if (currentHour >= 12) {
                return {
                    valid: false,
                    message: 'Same-day bookings after 12:00 PM are not allowed',
                    targetField: 'booking-date'
                };
            }
        }

        if (!service.Is_Available) {
            return {
                valid: false,
                message: 'Selected service is no longer available',
                targetField: 'service-type'
            };
        }

        if (selectedTime) {
            const [hours] = selectedTime.split(':').map(Number);
            if (hours < 8 || hours > 17) {
                return {
                    valid: false,
                    message: 'Bookings are only available between 8:00 AM and 5:00 PM',
                    targetField: 'booking-time'
                };
            }
        }

        return { valid: true };
    }

    // FIELD-SPECIFIC ERROR METHODS
    // ============================

    showFieldError(fieldId, message, formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const field = form.querySelector(`#${fieldId}`);
        if (!field) return;

        // Remove existing error for this field
        this.removeFieldError(fieldId, formId);

        // Create error element
        const errorElement = document.createElement('div');
        errorElement.className = 'field-error-message';
        errorElement.id = `${fieldId}-error`;
        errorElement.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;

        // Insert error after the field
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('has-error');
            formGroup.appendChild(errorElement);
        } else {
            // If no form group, insert after the field itself
            field.parentNode.insertBefore(errorElement, field.nextSibling);
        }

        // Add error styling to the field
        field.classList.add('field-error');

        // Scroll to the field with error
        setTimeout(() => {
            field.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }, 100);
    }

    removeFieldError(fieldId, formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const errorElement = form.querySelector(`#${fieldId}-error`);
        if (errorElement) {
            errorElement.remove();
        }

        const field = form.querySelector(`#${fieldId}`);
        if (field) {
            field.classList.remove('field-error');
        }

        const formGroup = field?.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('has-error');
        }
    }

    clearAllFieldErrors(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        // Remove all error messages
        form.querySelectorAll('.field-error-message').forEach(error => error.remove());

        // Remove error styling from all fields
        form.querySelectorAll('.field-error').forEach(field => {
            field.classList.remove('field-error');
        });

        // Remove error classes from form groups
        form.querySelectorAll('.form-group.has-error').forEach(group => {
            group.classList.remove('has-error');
        });
    }

    // SHARED UI METHODS
    // =================

    setupFormValidation(formId) {
        const form = document.getElementById(formId);
        if (!form) return;
        this.clearAllFieldErrors(formId);
    }

    setupDateValidation(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const dateInput = form.querySelector('#booking-date');
        const timeSelect = form.querySelector('#booking-time');

        if (!dateInput) return;

        const today = new Date().toISOString().split('T')[0];
        dateInput.min = today;

        const now = new Date();
        const currentHour = now.getHours();
        const defaultDate = new Date();

        if (currentHour >= 12) {
            defaultDate.setDate(defaultDate.getDate() + 1);
        }

        dateInput.value = defaultDate.toISOString().split('T')[0];

        dateInput.addEventListener('change', () => this.updateDateValidation(dateInput, timeSelect, formId));
        this.updateDateValidation(dateInput, timeSelect, formId);
    }

    updateDateValidation(dateInput, timeSelect, formId) {
        const selectedDate = new Date(dateInput.value);
        const today = new Date();
        const isToday = selectedDate.toDateString() === today.toDateString();
        const currentHour = today.getHours();
        const currentMinutes = today.getMinutes();
        const currentTimeTotal = currentHour * 60 + currentMinutes;

        // Clear previous date validation messages
        this.removeFieldError('booking-date', formId);

        if (isToday) {
            if (currentTimeTotal >= 720) {
                this.showFieldError('booking-date', 'Same-day bookings after 12:00 PM are not allowed. Please select tomorrow or a future date.', formId);
                if (timeSelect) timeSelect.disabled = true;
            } else {
                const timeLeft = 720 - currentTimeTotal;
                const hoursLeft = Math.floor(timeLeft / 60);
                const minutesLeft = timeLeft % 60;
                // Show warning but don't prevent submission
                this.showFieldWarning('booking-date', `Same-day booking available. Must be booked within ${hoursLeft}h ${minutesLeft}m.`, formId);
                if (timeSelect) timeSelect.disabled = false;
            }
        } else if (selectedDate < today) {
            this.showFieldError('booking-date', 'Cannot book for past dates. Please select today or a future date.', formId);
            if (timeSelect) timeSelect.disabled = true;
        } else {
            // Clear any warnings for valid dates
            this.removeFieldWarning('booking-date', formId);
            if (timeSelect) timeSelect.disabled = false;
        }
    }

    showFieldWarning(fieldId, message, formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const field = form.querySelector(`#${fieldId}`);
        if (!field) return;

        // Remove existing warning for this field
        this.removeFieldWarning(fieldId, formId);

        // Create warning element
        const warningElement = document.createElement('div');
        warningElement.className = 'field-warning-message';
        warningElement.id = `${fieldId}-warning`;
        warningElement.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <span>${message}</span>
        `;

        // Insert warning after the field
        const formGroup = field.closest('.form-group');
        if (formGroup) {
            formGroup.classList.add('has-warning');
            formGroup.appendChild(warningElement);
        }

        // Add warning styling to the field
        field.classList.add('field-warning');

        // Auto-remove warning after 5 seconds
        setTimeout(() => {
            this.removeFieldWarning(fieldId, formId);
        }, 5000);
    }

    removeFieldWarning(fieldId, formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const warningElement = form.querySelector(`#${fieldId}-warning`);
        if (warningElement) {
            warningElement.remove();
        }

        const field = form.querySelector(`#${fieldId}`);
        if (field) {
            field.classList.remove('field-warning');
        }

        const formGroup = field?.closest('.form-group');
        if (formGroup) {
            formGroup.classList.remove('has-warning');
        }
    }

    setupRealTimeValidation(formId) {
        const form = document.getElementById(formId);
        if (!form) return;

        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', () => {
                this.validateFieldInRealTime(input, formId);
            });

            // Clear error when user starts typing
            input.addEventListener('input', () => {
                this.removeFieldError(input.id, formId);
                this.removeFieldWarning(input.id, formId);
            });
        });
    }

    validateFieldInRealTime(field, formId) {
        const value = field.value.trim();
        const fieldId = field.id;

        // Clear previous errors for this field
        this.removeFieldError(fieldId, formId);
        this.removeFieldWarning(fieldId, formId);

        if (!value && field.required) {
            this.showFieldError(fieldId, 'This field is required', formId);
            return;
        }

        switch (fieldId) {
            case 'customer-email':
                if (value && !this.isValidEmail(value)) {
                    this.showFieldError(fieldId, 'Please enter a valid email address', formId);
                }
                break;
            case 'address-postal-code':
                if (value && !this.isValidPostalCode(value)) {
                    this.showFieldError(fieldId, 'Please enter a valid postal code', formId);
                }
                break;
        }
    }

    showFormLoading(show, formType) {
        const formId = this.bookingForms[formType];
        const form = document.getElementById(formId);
        if (!form) return;

        const submitBtn = form.querySelector('.submit-btn, #submit-btn, button[type="submit"]');
        if (submitBtn) {
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoading = submitBtn.querySelector('.btn-loading');

            if (show) {
                if (btnText) btnText.style.display = 'none';
                if (btnLoading) btnLoading.style.display = 'block';
                submitBtn.disabled = true;
            } else {
                if (btnText) btnText.style.display = 'block';
                if (btnLoading) btnLoading.style.display = 'none';
                submitBtn.disabled = false;
            }
        }
    }

    showRestrictionAlert(messages, type = 'error', formType) {
        const formId = this.bookingForms[formType];
        const form = document.getElementById(formId);
        if (!form) return;

        const alertContainer = form.querySelector('.restrictions-alert') || this.createRestrictionAlert(form);
        const restrictionsList = alertContainer.querySelector('.restrictions-list');

        restrictionsList.innerHTML = '';
        messages.forEach(message => {
            const li = document.createElement('li');
            li.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-circle' : 'fa-exclamation-triangle'}"></i> ${message}`;
            restrictionsList.appendChild(li);
        });

        alertContainer.className = `restrictions-alert ${type}`;
        alertContainer.style.display = 'block';

        if (type === 'warning') {
            setTimeout(() => {
                alertContainer.style.display = 'none';
            }, 8000);
        }
    }

    createRestrictionAlert(form) {
        const alertContainer = document.createElement('div');
        alertContainer.className = 'restrictions-alert';
        alertContainer.innerHTML = `
            <div class="alert-header">
                <i class="fas fa-exclamation-triangle"></i>
                <h4>Booking Restrictions</h4>
            </div>
            <div class="alert-content">
                <ul class="restrictions-list"></ul>
            </div>
        `;
        form.insertBefore(alertContainer, form.firstChild);
        return alertContainer;
    }

    // SHARED UTILITY METHODS
    // ======================

    prefillUserData(formId) {
        if (!window.authManager || !window.authManager.isAuthenticated()) return;

        const user = window.authManager.getUser();
        if (!user) return;

        const form = document.getElementById(formId);
        if (!form) return;

        const fields = {
            'customer-name': user.Full_Name,
            'customer-email': user.Email,
            'customer-phone': user.Phone
        };

        Object.entries(fields).forEach(([fieldId, value]) => {
            const field = form.querySelector(`#${fieldId}`);
            if (field && value) field.value = value;
        });

        if (user.Address) {
            const parsedAddress = this.parseAddress(user.Address);
            const addressFields = {
                'address-street': parsedAddress.street,
                'address-city': parsedAddress.city,
                'address-state': parsedAddress.state,
                'address-postal-code': parsedAddress.zip
            };

            Object.entries(addressFields).forEach(([fieldId, value]) => {
                const field = form.querySelector(`#${fieldId}`);
                if (field && value) field.value = value;
            });
        }
    }

    storeIntendedBooking(formData, service, formType) {
        localStorage.setItem('intendedService', service.ID);
        localStorage.setItem('intendedServiceData', JSON.stringify(service));
        localStorage.setItem('intendedBookingData', JSON.stringify({
            date: formData.get('booking-date'),
            time: formData.get('booking-time'),
            address: {
                street: formData.get('address-street'),
                city: formData.get('address-city'),
                state: formData.get('address-state'),
                postalCode: formData.get('address-postal-code')
            },
            instructions: formData.get('special-requests'),
            propertyType: formData.get('property-type'),
            cleaningFrequency: formData.get('cleaning-frequency'),
            formType: formType
        }));
    }

    handleBookingError(error, formType) {
        let userMessage = 'Failed to submit booking. Please try again.';
        let targetField = null;

        if (error.message.includes('already have a booking') || error.message.includes('duplicate')) {
            userMessage = 'You already have an active booking for this service today.';
            targetField = 'service-type';
        } else if (error.message.includes('12:00 PM') || error.message.includes('same-day')) {
            userMessage = 'Same-day booking restriction violated.';
            targetField = 'booking-date';
        } else if (error.message.includes('authentication') || error.message.includes('login')) {
            userMessage = 'Authentication required.';
        } else if (error.message.includes('network') || error.message.includes('fetch')) {
            userMessage = 'Network connection error.';
        }

        if (targetField) {
            this.showFieldError(targetField, userMessage, this.bookingForms[formType]);
        } else {
            this.showError(userMessage);
        }
    }

    // ... [REST OF THE CODE REMAINS THE SAME AS PREVIOUS VERSION]
    // Including: API methods, service display methods, utility methods, etc.
    // Only the validation and error display methods have been modified

    // API & DATA METHODS
    async fetchRequest(method, endpoint, data = null, attempt = 1) {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;

        if (timeSinceLastRequest < this.minRequestInterval) {
            await new Promise(resolve =>
                setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
            );
        }

        try {
            const headers = {
                'Content-Type': 'application/json'
            };

            if (window.authManager && window.authManager.isAuthenticated() &&
                !endpoint.includes('/public/')) {
                headers['Authorization'] = `Bearer ${window.authManager.token}`;
            }

            const config = {
                method: method,
                headers: headers,
                credentials: 'include'
            };

            if (data && (method === 'POST' || method === 'PUT')) {
                config.body = JSON.stringify(data);
            }

            console.log(`Making ${method} request to: ${this.baseURL}${endpoint} (attempt ${attempt})`);

            this.lastRequestTime = Date.now();
            const response = await fetch(`${this.baseURL}${endpoint}`, config);

            if (response.status === 429) {
                const retryAfter = response.headers.get('Retry-After') || this.retryDelay;
                if (attempt <= this.retryAttempts) {
                    console.log(`Rate limited. Retrying after ${retryAfter}ms...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter));
                    return this.fetchRequest(method, endpoint, data, attempt + 1);
                } else {
                    throw new Error('Rate limit exceeded. Please try again later.');
                }
            }

            if (!response.ok) {
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

            if (attempt <= this.retryAttempts && !error.message.includes('Rate limit')) {
                console.log(`Retrying request (attempt ${attempt + 1})...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
                return this.fetchRequest(method, endpoint, data, attempt + 1);
            }

            throw error;
        }
    }

    async loadServices() {
        const now = Date.now();
        if (this.servicesCache.data &&
            (now - this.servicesCache.timestamp) < this.servicesCache.ttl) {
            console.log('📦 Using cached services data');
            this.services = this.servicesCache.data;
            this.filteredServices = [...this.services];
            this.renderServices();
            this.updateCategoryFilters();
            return;
        }

        try {
            this.showLoading('Loading services...');
            console.log('Loading ALL services from public endpoint...');

            const data = await this.fetchRequest('GET', '/services/public/services');

            if (data && data.success && Array.isArray(data.services)) {
                this.services = this.processServiceData(data.services);

                this.servicesCache = {
                    data: this.services,
                    timestamp: Date.now(),
                    ttl: 300000
                };

                console.log(`✅ Successfully loaded ${this.services.length} services`);

                const availableCount = this.services.filter(s => s.Is_Available).length;
                const unavailableCount = this.services.filter(s => !s.Is_Available).length;
                console.log(`📊 Services: ${availableCount} available, ${unavailableCount} unavailable`);

                if (this.services.length === 0) {
                    this.showInfo('No services available at the moment');
                }
            } else {
                throw new Error('Invalid response format from services API');
            }

        } catch (error) {
            console.error('❌ Error loading services:', error);

            if (this.servicesCache.data) {
                console.log('🔄 Using expired cache due to API error');
                this.services = this.servicesCache.data;
                this.filteredServices = [...this.services];
                this.renderServices();
                this.updateCategoryFilters();
                this.showWarning('Services loaded from cache. Some data may be outdated.');
            } else {
                this.showError('Failed to load services. Please try again later.');
                this.showDatabaseError();
            }
        } finally {
            this.filteredServices = [...this.services];
            this.renderServices();
            this.updateCategoryFilters();
            this.hideLoading();
        }
    }

    async checkBookingAvailabilityWithDuplicates(serviceId, date, customerId) {
        try {
            const user = window.authManager.getUser();
            if (!user) return { available: false, message: 'Not authenticated' };

            const response = await this.fetchRequest('GET',
                `/bookings/check-availability?Customer_ID=${customerId}&Service_ID=${serviceId}&Date=${date}`
            );

            if (!response.available) {
                return response;
            }

            const today = new Date().toISOString().split('T')[0];
            const selectedDate = new Date(date).toISOString().split('T')[0];

            if (selectedDate === today) {
                try {
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
                } catch (error) {
                    console.warn('Duplicate check failed, proceeding with booking:', error);
                }
            }

            return response;
        } catch (error) {
            console.error('Enhanced availability check failed:', error);
            return {
                available: true,
                message: 'Availability check unavailable. Your booking will be processed manually.'
            };
        }
    }

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

    // SERVICE DISPLAY METHODS
    populateBookingServiceDropdown() {
        const serviceSelect = document.getElementById('service-type');
        if (!serviceSelect) {
            console.error('Service select element not found');
            return;
        }

        // Store current selection if any
        const currentSelection = serviceSelect.value;

        serviceSelect.innerHTML = '<option value="" disabled selected>Select a service</option>';

        const availableServices = this.services.filter(service => service.Is_Available);

        if (availableServices.length === 0) {
            serviceSelect.innerHTML = `
            <option value="" disabled selected>
                ${this.services.length > 0 ? 'No available services' : 'Loading services...'}
            </option>
        `;
            serviceSelect.disabled = true;
        } else {
            availableServices.forEach(service => {
                const option = document.createElement('option');
                option.value = service.ID;
                option.textContent = `${service.Name} (${service.Duration} minutes)`;
                option.setAttribute('data-duration', service.Duration);
                serviceSelect.appendChild(option);
            });
            serviceSelect.disabled = false;

            // Restore previous selection if it exists and is valid
            if (currentSelection && availableServices.some(s => s.ID == currentSelection)) {
                serviceSelect.value = currentSelection;
                // Set current booking service when restoring selection
                this.currentBookingService = availableServices.find(s => s.ID == currentSelection);
            }

            // Add event listener to update currentBookingService when selection changes
            serviceSelect.addEventListener('change', (e) => {
                const selectedService = availableServices.find(s => s.ID == e.target.value);
                if (selectedService) {
                    this.currentBookingService = selectedService;
                    console.log('🔄 Updated currentBookingService on change:', selectedService.Name);
                }
            });
        }

        console.log(`Populated booking form with ${availableServices.length} services`);
    }
    populateModalServiceDetails(service) {
        const leftTitle = document.getElementById('popup-service-title');
        const rightTitle = document.getElementById('popup-service-title-main');
        const description = document.getElementById('popup-service-description');
        const duration = document.getElementById('popup-service-duration');

        if (leftTitle) leftTitle.textContent = service.Name;
        if (rightTitle) rightTitle.textContent = `Request Quotation - ${service.Name}`;
        if (description) description.textContent = service.Description;
        if (duration) duration.textContent = `${service.Duration} minutes`;

        const popupImage = document.getElementById('popup-service-image');
        const imagePlaceholder = document.getElementById('image-placeholder');

        if (popupImage && service.Image_URL) {
            popupImage.src = this.getImageUrl(service.Image_URL);
            popupImage.alt = service.Name;
            popupImage.style.display = 'block';

            if (imagePlaceholder) imagePlaceholder.style.display = 'none';
        } else {
            if (popupImage) popupImage.style.display = 'none';
            if (imagePlaceholder) {
                imagePlaceholder.style.display = 'flex';
                const icon = imagePlaceholder.querySelector('i');
                if (icon) {
                    icon.className = `fas ${this.getServiceIcon(service.Name)}`;
                }
            }
        }

        this.populateServiceOptions(service);
    }

    populateServiceOptions(service) {
        const serviceTypeSelect = document.getElementById('service-type');
        if (!serviceTypeSelect) return;

        serviceTypeSelect.innerHTML = '<option value="" disabled selected>Select service type</option>';

        this.serviceTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type.ID;
            option.textContent = `${type.Name} - Custom Quote`;
            option.setAttribute('data-description', type.Description);
            serviceTypeSelect.appendChild(option);
        });
    }

    // SERVICE CARDS & RENDERING
    renderServices() {
        const grid = document.querySelector('.services-grid');
        if (!grid) {
            console.log('Services grid not found - this is expected on booking page');
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

        return `
    <div class="service-card ${!isAvailable ? 'unavailable-service disabled-card' : ''}" 
         data-service-id="${service.ID}" 
         data-category="${service.Category}"
         data-available="${isAvailable}"
         ${!isAvailable ? 'style="pointer-events: none; cursor: not-allowed;"' : ''}>
      
      ${!isAvailable ? `<div class="service-badge unavailable">Currently Unavailable</div>` : ''}
      
      <div class="service-image-container">
        ${service.Image_URL ? `
          <img src="${this.getImageUrl(service.Image_URL)}" alt="${service.Name}" 
               onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
        ` : ''}
        <div class="service-image-placeholder" style="${service.Image_URL ? 'display: none;' : ''}">
          <i class="fas ${this.getServiceIcon(service.Name)}"></i>
        </div>
        ${!isAvailable ? '<div class="service-overlay unavailable-overlay"></div>' : ''}
      </div>
      
      <div class="service-description-container">
        <p class="service-description">${this.escapeHtml(service.Description)}</p>
      </div>
      
      <div class="service-content">
        <h3>${this.escapeHtml(service.Name)}</h3>
        
        <div class="service-meta">
          <span class="service-category">${this.escapeHtml(category)}</span>
          <span class="service-status ${isAvailable ? 'available' : 'unavailable'}">
            <i class="fas ${isAvailable ? 'fa-check-circle' : 'fa-times-circle'}"></i>
            ${isAvailable ? 'Available' : 'Unavailable'}
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
      </div>
    </div>
  `;
    }

    handleBookService(serviceId) {
        const service = this.services.find(s => s.ID == serviceId);
        if (!service) {
            this.showError('Service not found. Please try again.');
            return;
        }

        if (!window.authManager || !window.authManager.isAuthenticated()) {
            localStorage.setItem('intendedService', serviceId);
            localStorage.setItem('intendedServiceData', JSON.stringify(service));
            localStorage.setItem('returnUrl', window.location.href);

            this.showInfo('Please login or register to request a quotation');

            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        this.openBookingModal(service);
    }

    // UTILITY METHODS
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }


    isValidPostalCode(postalCode) {
        const postalRegex = /^[A-Za-z0-9\s\-]{3,10}$/;
        return postalRegex.test(postalCode);
    }

    getImageUrl(imageUrl) {
        if (!imageUrl) return '';
        if (imageUrl.startsWith('http')) return imageUrl;
        if (imageUrl.startsWith('/upload/')) return `http://localhost:5000${imageUrl}`;
        if (imageUrl.includes('.')) return `http://localhost:5000/upload/services/${imageUrl}`;
        return '';
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

    parseAddress(addressString) {
        if (!addressString || addressString === 'Not set') {
            return { street: '', city: '', state: '', zip: '' };
        }

        try {
            const parts = addressString.split(',').map(part => part.trim());
            if (parts.length >= 4) {
                return { street: parts[0], city: parts[1], state: parts[2], zip: parts[3] };
            } else if (parts.length === 3) {
                return { street: parts[0], city: parts[1], state: parts[2], zip: '' };
            } else if (parts.length === 2) {
                return { street: parts[0], city: parts[1], state: '', zip: '' };
            } else {
                return { street: addressString, city: '', state: '', zip: '' };
            }
        } catch (error) {
            console.error('Error parsing address:', error);
            return { street: addressString, city: '', state: '', zip: '' };
        }
    }

    processServiceData(services) {
        if (!services || !Array.isArray(services)) {
            console.warn('Invalid services data, using fallback');
            return this.getFallbackServices();
        }

        return services.map(service => ({
            ID: service.ID || service.id,
            Name: service.Name || service.service_name || 'Unknown Service',
            Description: service.Description || service.description || 'No description available',
            Duration: service.Duration || service.duration || 60,
            Category: service.Category || service.category || 'general',
            Is_Available: service.Is_Available !== undefined ? service.Is_Available :
                (service.is_available !== undefined ? service.is_available : true),
            Image_URL: service.Image_URL || service.image_url,
            Created_At: service.Created_At || service.created_at,
            Updated_At: service.Updated_At || service.updated_at
        })).filter(service => service.Name && service.Duration);
    }

    getFallbackServices() {
        return [
            {
                ID: 1,
                Name: 'Standard Cleaning',
                Description: 'Basic cleaning service for your home or office',
                Duration: 60,
                Category: 'residential',
                Is_Available: true,
                Image_URL: ''
            },
            {
                ID: 2,
                Name: 'Deep Cleaning',
                Description: 'Comprehensive deep cleaning service',
                Duration: 120,
                Category: 'residential',
                Is_Available: true,
                Image_URL: ''
            },
            {
                ID: 3,
                Name: 'Office Cleaning',
                Description: 'Professional cleaning for office spaces',
                Duration: 90,
                Category: 'commercial',
                Is_Available: true,
                Image_URL: ''
            }
        ];
    }

    // EVENT HANDLERS & SETUP
    attachServiceButtonListeners() {
        const grid = document.querySelector('.services-grid');
        if (!grid) return;

        grid.removeEventListener('click', this.handleGridClick);
        grid.addEventListener('click', this.handleGridClick.bind(this));
    }

    handleGridClick(event) {
        const target = event.target;
        const serviceCard = target.closest('.service-card');

        if (!serviceCard) return;

        const isAvailable = serviceCard.getAttribute('data-available') === 'true';
        const serviceId = serviceCard.getAttribute('data-service-id');

        // Prevent all interactions with unavailable service cards
        if (!isAvailable) {
            event.preventDefault();
            event.stopPropagation();
            this.showInfo('This service is currently unavailable. Please check back later.');
            return;
        }

        const ctaButton = target.closest('.service-cta-btn');
        if (ctaButton && !ctaButton.classList.contains('disabled')) {
            event.preventDefault();
            event.stopPropagation();
            if (serviceId) {
                this.handleBookService(serviceId);
            }
            return;
        }

        // Only allow card clicks for available services
        if (serviceCard && !target.closest('.service-cta-btn') && isAvailable) {
            event.preventDefault();
            event.stopPropagation();
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

        // Prevent showing details for unavailable services
        if (!service.Is_Available) {
            this.showInfo('This service is currently unavailable. Please check back later.');
            return;
        }

        this.openBookingModal(service);
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

    closeBookingModal() {
        const popup = document.getElementById('service-popup');
        if (popup) {
            popup.classList.remove('active');
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

            const matchesCategory = category === 'all' || service.Category === category;

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
            case 'name':
                this.filteredServices.sort((a, b) => a.Name.localeCompare(b.Name));
                break;
            case 'duration':
                this.filteredServices.sort((a, b) => (a.Duration || 0) - (b.Duration || 0));
                break;
            case 'category':
                this.filteredServices.sort((a, b) => a.Category.localeCompare(b.Category));
                break;
            default:
                // Default sorting - newest first or by ID
                this.filteredServices.sort((a, b) => (b.ID || 0) - (a.ID || 0));
                break;
        }
        this.renderServices();
    }

    updateCategoryFilters() {
        const categoryFilter = document.getElementById('categoryFilter');
        const availabilityFilter = document.getElementById('availabilityFilter');
        const sortSelect = document.getElementById('sortSelect');

        // Update category filter
        if (categoryFilter) {
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

        // Update availability filter - show ALL services including unavailable ones
        if (availabilityFilter) {
            const availableCount = this.services.filter(s => s.Is_Available).length;
            const unavailableCount = this.services.filter(s => !s.Is_Available).length;
            const totalCount = this.services.length;

            availabilityFilter.innerHTML = `
            <option value="all">All Services (${totalCount})</option>
            <option value="available">Available Only (${availableCount})</option>
            <option value="unavailable">Unavailable (${unavailableCount})</option>
        `;
        }

        // Update sort options - remove price-related sorting
        if (sortSelect) {
            sortSelect.innerHTML = `
            <option value="default">Sort By</option>
            <option value="name">Name (A-Z)</option>
            <option value="duration">Duration (Shortest First)</option>
            <option value="category">Category</option>
        `;
        }
    }

    getCategoryLabel(category) {
        const categories = {
            'residential': 'Residential',
            'commercial': 'Commercial',
            'both': 'Residential & Commercial',
            'general': 'General',
            'gardening': 'Gardening',
            'cleaning': 'Cleaning',
            'pest-control': 'Pest Control'
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
        const hasServices = this.services.length > 0;
        const hasFilteredServices = this.filteredServices.length > 0;

        if (!hasServices) {
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
        } else if (!hasFilteredServices) {
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

        return ''; // Should not reach here if there are filtered services
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

    // LOADING & NOTIFICATION METHODS
    showBookingLoading() {
        const loadingElement = document.getElementById('booking-loading');
        const errorElement = document.getElementById('booking-error');
        const formElement = document.querySelector('.book-page');

        if (loadingElement) loadingElement.style.display = 'block';
        if (errorElement) errorElement.style.display = 'none';
        if (formElement) formElement.style.display = 'none';
    }

    hideBookingLoading() {
        const loadingElement = document.getElementById('booking-loading');
        const errorElement = document.getElementById('booking-error');
        const formElement = document.querySelector('.book-page');

        if (loadingElement) loadingElement.style.display = 'none';
        if (errorElement) errorElement.style.display = 'none';
        if (formElement) formElement.style.display = 'block';
    }

    showBookingError(message) {
        const loadingElement = document.getElementById('booking-loading');
        const errorElement = document.getElementById('booking-error');
        const formElement = document.querySelector('.book-page');

        if (loadingElement) loadingElement.style.display = 'none';
        if (errorElement) {
            errorElement.style.display = 'block';
            const errorMessage = errorElement.querySelector('p');
            if (errorMessage) errorMessage.textContent = message;
        }
        if (formElement) formElement.style.display = 'none';
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

    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
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
                <i class="fas ${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        document.body.appendChild(notification);

        const removeTime = type === 'error' ? 8000 : 5000;
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, removeTime);
    }

    getNotificationIcon(type) {
        const icons = {
            'error': 'fa-exclamation-triangle',
            'warning': 'fa-exclamation-circle',
            'info': 'fa-info-circle',
            'success': 'fa-check-circle'
        };
        return icons[type] || 'fa-info-circle';
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

    async loadServiceMetadata() {
        try {
            console.log('Loading service metadata...');

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

    async loadHomeServices() {
        const homeServicesBar = document.getElementById('home-services-bar');
        if (!homeServicesBar) {
            console.log('Home services bar not found - probably not on home page');
            return;
        }

        try {
            console.log('Loading services for home page...');
            this.showHomeLoading();

            const now = Date.now();
            if (this.servicesCache.data &&
                (now - this.servicesCache.timestamp) < this.servicesCache.ttl) {
                console.log('📦 Using cached services for home page');
                this.renderHomeServices(this.servicesCache.data);
                return;
            }

            const data = await this.fetchRequest('GET', '/services/public/services');

            if (data && data.success && Array.isArray(data.services)) {
                const processedServices = this.processServiceData(data.services);

                this.servicesCache = {
                    data: processedServices,
                    timestamp: Date.now(),
                    ttl: 300000
                };

                console.log(`✅ Loaded ${processedServices.length} services for home page`);
                this.renderHomeServices(processedServices);
            } else {
                throw new Error('Invalid response format from services API');
            }

        } catch (error) {
            console.error('❌ Error loading home services:', error);

            if (this.servicesCache.data) {
                console.log('🔄 Using cached services for home page due to error');
                this.renderHomeServices(this.servicesCache.data);
                this.showWarning('Services loaded from cache. Some data may be outdated.');
            } else {
                this.renderHomeServicesError(error.message);
            }
        }
    }

    showHomeLoading() {
        const homeServicesBar = document.getElementById('home-services-bar');
        if (homeServicesBar) {
            homeServicesBar.innerHTML = `
            <div class="loading-state">
                <div class="loading-spinner"></div>
                <p>Loading our services...</p>
            </div>
        `;
        }
    }

    renderHomeServices(services) {
        const homeServicesBar = document.getElementById('home-services-bar');
        if (!homeServicesBar) {
            console.error('Home services bar element not found');
            return;
        }

        if (services.length === 0) {
            homeServicesBar.innerHTML = `
            <div class="empty-home-services">
                <i class="fas fa-concierge-bell"></i>
                <p>No services available at the moment</p>
            </div>
        `;
            return;
        }

        homeServicesBar.innerHTML = services.map(service => this.createHomeServiceCard(service)).join('');
        this.initHomeCarousel();
    }

    createHomeServiceCard(service) {
        const serviceName = service.Name || service.service_name || 'Service';
        const serviceId = service.ID || service.id || '';
        const imageUrl = service.Image_URL || service.image_url || '';

        const serviceIcons = {
            'cleaning': 'fas fa-broom',
            'gardening': 'fas fa-leaf',
            'office': 'fas fa-building',
            'corporate': 'fas fa-briefcase',
            'private': 'fas fa-home',
            'bin': 'fas fa-trash-alt',
            'default': 'fas fa-sparkles'
        };

        let serviceIcon = serviceIcons.default;
        const serviceNameLower = serviceName.toLowerCase();

        if (serviceNameLower.includes('clean')) serviceIcon = serviceIcons.cleaning;
        else if (serviceNameLower.includes('garden')) serviceIcon = serviceIcons.gardening;
        else if (serviceNameLower.includes('office')) serviceIcon = serviceIcons.office;
        else if (serviceNameLower.includes('corporate')) serviceIcon = serviceIcons.corporate;
        else if (serviceNameLower.includes('private') || serviceNameLower.includes('household')) serviceIcon = serviceIcons.private;
        else if (serviceNameLower.includes('bin')) serviceIcon = serviceIcons.bin;

        const formattedImageUrl = this.getImageUrl(imageUrl);

        return `
    <div class="home-service-card" 
         onclick="window.location.href='services.html#${this.generateServiceSlug(serviceName)}'"
         role="button"
         tabindex="0"
         aria-label="View ${this.escapeHtml(serviceName)} service details">
        <div class="home-card-image">
            ${formattedImageUrl ? `
                <img src="${formattedImageUrl}" 
                     alt="${this.escapeHtml(serviceName)}" 
                     loading="lazy"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                <div class="home-image-placeholder" style="display: none;">
                    <i class="${serviceIcon}"></i>
                </div>
            ` : `
                <div class="home-image-placeholder">
                    <i class="${serviceIcon}"></i>
                </div>
            `}
        </div>
        <div class="home-service-info">
            <h3>${this.escapeHtml(serviceName)}</h3>
            <button class="home-service-cta">
                Explore Service
                <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    </div>
    `;
    }

    generateServiceSlug(serviceName) {
        return serviceName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)+/g, '');
    }

    renderHomeServicesError(errorMessage = '') {
        const homeServicesBar = document.getElementById('home-services-bar');
        if (homeServicesBar) {
            homeServicesBar.innerHTML = `
            <div class="home-services-error">
                <i class="fas fa-exclamation-triangle" style="color: #dc3545; font-size: 3rem; margin-bottom: 1rem;"></i>
                <h4>Unable to Load Services</h4>
                <p>We're having trouble loading our services right now.</p>
                ${errorMessage ? `<p class="error-details">Error: ${errorMessage}</p>` : ''}
                <div style="margin-top: 1.5rem;">
                    <button class="retry-btn" onclick="window.customerServices.loadHomeServices()">
                        <i class="fas fa-refresh"></i> Try Again
                    </button>
                    <a href="services.html" class="btn btn-secondary" style="margin-left: 1rem;">
                        View All Services
                    </a>
                </div>
            </div>
        `;
        }
    }

    initHomeCarousel() {
        const carouselContainer = document.querySelector('.home-carousel-container');
        const carousel = document.querySelector('.home-services-bar');
        const prevBtn = document.querySelector('.home-carousel-prev');
        const nextBtn = document.querySelector('.home-carousel-next');
        const progressBar = document.querySelector('.home-progress-bar');

        if (!carouselContainer || !carousel) return;

        let currentPosition = 0;
        const cardWidth = 320;
        const visibleCards = Math.floor(carouselContainer.offsetWidth / cardWidth);
        const totalCards = carousel.children.length;
        const maxPosition = Math.max(0, (totalCards - visibleCards) * cardWidth);

        const updateCarousel = () => {
            carousel.style.transform = `translateX(-${currentPosition}px)`;

            if (maxPosition > 0) {
                const progress = (currentPosition / maxPosition) * 100;
                progressBar.style.width = `${progress}%`;
            }
        };

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                currentPosition = Math.max(0, currentPosition - (cardWidth * visibleCards));
                updateCarousel();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                currentPosition = Math.min(maxPosition, currentPosition + (cardWidth * visibleCards));
                updateCarousel();
            });
        }

        window.addEventListener('resize', () => {
            const newVisibleCards = Math.floor(carouselContainer.offsetWidth / cardWidth);
            const newMaxPosition = Math.max(0, (totalCards - newVisibleCards) * cardWidth);

            if (currentPosition > newMaxPosition) {
                currentPosition = newMaxPosition;
            }

            updateCarousel();
        });

        updateCarousel();
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

// Add CSS for field-specific error styling
const style = document.createElement('style');
style.textContent = `
    /* Field-specific error styles */
    .field-error-message {
        background: #fee;
        color: #c53030;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        margin-top: 0.25rem;
        border-left: 3px solid #fc8181;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        animation: slideInDown 0.3s ease-out;
    }

    .field-warning-message {
        background: #fffbeb;
        color: #b45309;
        padding: 0.5rem 0.75rem;
        border-radius: 6px;
        margin-top: 0.25rem;
        border-left: 3px solid #f59e0b;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.85rem;
        animation: slideInDown 0.3s ease-out;
    }

    .field-error-message i,
    .field-warning-message i {
        font-size: 0.8rem;
        flex-shrink: 0;
    }

    .field-error {
        border-color: #fc8181 !important;
        box-shadow: 0 0 0 3px rgba(252, 129, 129, 0.1) !important;
        background: #fff5f5 !important;
    }

    .field-warning {
        border-color: #f59e0b !important;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1) !important;
        background: #fffaf0 !important;
    }

    .form-group.has-error .field-error-message {
        display: block;
    }

    .form-group.has-warning .field-warning-message {
        display: block;
    }

    /* Ensure form groups have proper spacing for errors */
    .form-group {
        position: relative;
        margin-bottom: 1rem;
    }

    @keyframes slideInDown {
        from {
            opacity: 0;
            transform: translateY(-5px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    /* Rest of the existing CSS styles */
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
    
    .notification-warning { 
        background: #f39c12;
        border-left: 4px solid #e67e22;
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
    
    /* Form validation styles */
    .form-error-message {
        background: #fee;
        color: #c53030;
        padding: 0.75rem 1rem;
        border-radius: 8px;
        margin-top: 0.5rem;
        border-left: 4px solid #fc8181;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        font-size: 0.9rem;
        animation: slideInDown 0.3s ease-out;
    }
    
    .form-error-message.warning {
        background: #fffbeb;
        color: #b45309;
        border-left-color: #f59e0b;
    }
    
    .form-group.has-error .unified-input,
    .form-group.has-error .unified-textarea,
    .form-group.has-error .unified-select {
        border-color: #fc8181;
        box-shadow: 0 0 0 3px rgba(252, 129, 129, 0.1);
    }
    
    .form-group.has-warning .unified-input,
    .form-group.has-warning .unified-textarea,
    .form-group.has-warning .unified-select {
        border-color: #f59e0b;
        box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.1);
    }
    
    .live-validation-messages {
        margin-bottom: 1rem;
    }
    
    .live-validation-message {
        padding: 0.75rem 1rem;
        border-radius: 8px;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        animation: slideInRight 0.3s ease-out;
        font-size: 0.9rem;
    }
    
    .live-validation-message.error {
        background: #fed7d7;
        color: #c53030;
        border-left: 4px solid #e53e3e;
    }
    
    .live-validation-message.warning {
        background: #feebc8;
        color: #dd6b20;
        border-left: 4px solid #ed8936;
    }
    
    .live-validation-message.info {
        background: #bee3f8;
        color: #2c5aa0;
        border-left: 4px solid #3182ce;
    }
    
    .live-validation-message.success {
        background: #c6f6d5;
        color: #276749;
        border-left: 4px solid #38a169;
    }
    
    .restrictions-alert {
        background: #fff3f3;
        border: 1px solid #ffcdd2;
        border-radius: 12px;
        padding: 1.5rem;
        margin-bottom: 1.5rem;
        position: relative;
        animation: slideInDown 0.3s ease-out;
    }
    
    .restrictions-alert.warning {
        background: #fffbf0;
        border-color: #ffecb3;
    }
    
    .alert-header {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }
    
    .alert-header i {
        font-size: 1.5rem;
        color: #e53e3e;
    }
    
    .restrictions-alert.warning .alert-header i {
        color: #d69e2e;
    }
    
    .alert-header h4 {
        margin: 0;
        color: #2d3748;
        font-size: 1.1rem;
    }
    
    .alert-content ul {
        margin: 0;
        padding-left: 1.5rem;
    }
    
    .alert-content li {
        margin-bottom: 0.5rem;
        color: #4a5568;
        display: flex;
        align-items: flex-start;
        gap: 0.5rem;
    }
    
    @keyframes slideInDown {
        from {
            opacity: 0;
            transform: translateY(-20px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }
    
    /* Unavailable service styles */
    .unavailable-service {
        opacity: 0.8;
        position: relative;
    }
    
    .service-overlay.unavailable-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.4);
        z-index: 1;
        border-radius: 12px 12px 0 0;
    }
    
    .unavailable-service .service-cta-btn.disabled {
        background: #6c757d !important;
        color: white !important;
        cursor: not-allowed !important;
        opacity: 0.6;
    }
    
`;
document.head.appendChild(style);