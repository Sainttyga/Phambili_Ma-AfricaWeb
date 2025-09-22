document.addEventListener('DOMContentLoaded', function () {
  // --- Registration Form Handler ---
  const registerForm = document.getElementById('register-form');

  if (registerForm) {
    registerForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const Full_Name = document.getElementById('auth-fullname')?.value.trim();
      const Email = document.getElementById('auth-register-email')?.value.trim();
      const Password = document.getElementById('auth-register-password')?.value;
      const ConfirmPassword = document.getElementById('auth-confirm-password')?.value;
      const Phone = document.getElementById('auth-phone')?.value.trim();
      const Address = document.getElementById('auth-address')?.value.trim();

      // --- Client-side validation ---
      if (!Full_Name || !Email || !Password || !ConfirmPassword) {
        alert('Please fill in all required fields.');
        return;
      }

      if (Password !== ConfirmPassword) {
        alert('Passwords do not match.');
        return;
      }

      try {
        await axios.post('http://localhost:5000/api/auth/register', {
          Full_Name,
          Email,
          Password,
          Phone: Phone || null,
          Address: Address || null
        });

        // --- Show success message instead of alert ---
        const successBox = document.getElementById('register-success');
        if (successBox) {
          successBox.style.display = 'block';
          successBox.innerHTML = `<i class="fas fa-check-circle"></i> Registration successful! Redirecting to login...`;
        }

        // Save tab state
        localStorage.setItem('activeTab', 'login');

        // Redirect after 5 seconds
        setTimeout(() => {
          switchTab('login');
        }, 5000);

      } catch (error) {
        console.log("Register error:", error.response?.data);
        alert(error.response?.data?.message || 'Registration failed');
      }
    });
  }

  // --- Login Form Handler ---
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function (e) {
      e.preventDefault();

      const Email = document.getElementById('auth-login-email')?.value.trim();
      const Password = document.getElementById('auth-login-password')?.value;

      if (!Email || !Password) {
        alert('Email and password are required.');
        return;
      }

      try {
        const response = await axios.post('http://localhost:5000/api/auth/login', {
          Email,
          Password
        });

        if (response.data.token) {
          localStorage.setItem('authToken', response.data.token);
          localStorage.setItem('role', response.data.role);

          // --- Show login success message ---
          const successBox = document.getElementById('login-success');
          if (successBox) {
            successBox.style.display = 'block';
            successBox.innerHTML = `<i class="fas fa-check-circle"></i> Login successful! Redirecting...`;
          }

          // Redirect after 5 seconds
          setTimeout(() => {
            if (response.data.role === 'admin') {
              window.location.href = "admin-dashboard.html";
            } else {
              window.location.href = "index.html";
            }
          }, 2000);

        } else {
          alert('Login successful, but no token received.');
        }
      } catch (error) {
        console.log("Login error:", error.response?.data);
        alert(error.response?.data?.message || 'Login failed');
      }
    });
  }

  // --- Tab Switching (with persistence) ---
  let lastTab = localStorage.getItem('activeTab');
  if (lastTab !== 'login' && lastTab !== 'register') lastTab = 'login';
  switchTab(lastTab);

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', function () {
      const tabName = this.getAttribute('data-tab');
      localStorage.setItem('activeTab', tabName);
      switchTab(tabName);
    });
    tab.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const tabName = this.getAttribute('data-tab');
        localStorage.setItem('activeTab', tabName);
        switchTab(tabName);
      }
    });
  });

  // --- Social login buttons ---
  document.querySelectorAll('.auth-social-btn').forEach(button => {
    button.addEventListener('click', function () {
      alert('Social login functionality would be implemented here');
    });
  });

  // --- Forgot password link ---
  document.querySelector('.auth-forgot')?.addEventListener('click', function (e) {
    e.preventDefault();
    alert('Password reset functionality would be implemented here');
  });
});

// --- Tab Switch Function ---
function switchTab(tabName) {
  if (tabName !== 'login' && tabName !== 'register') return;

  document.querySelectorAll('.auth-tab-content').forEach(content => {
    content.classList.remove('active');
    content.setAttribute('aria-hidden', 'true');
  });

  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.classList.remove('active');
    tab.setAttribute('aria-selected', 'false');
  });

  const tabContent = document.getElementById(tabName + '-tab');
  const tabButton = document.querySelector(`.auth-tab[data-tab="${tabName}"]`);

  if (tabContent && tabButton) {
    tabContent.classList.add('active');
    tabContent.setAttribute('aria-hidden', 'false');
    tabButton.classList.add('active');
    tabButton.setAttribute('aria-selected', 'true');

    const firstInput = tabContent.querySelector('input');
    if (firstInput) firstInput.focus();
  }
}


document.addEventListener('DOMContentLoaded', function () {
  // ========== Variables ==========
  const hamburgerBtn = document.getElementById('hamburger-btn');
  const mainNav = document.getElementById('main-nav');
  const closeNavBtn = document.getElementById('close-nav-btn');
  const cartBtn = document.getElementById('cart-btn');
  const cartSidebar = document.getElementById('cart-sidebar');
  const closeCartBtn = document.getElementById('close-cart-btn');
  const menuOverlay = document.getElementById('menu-overlay');
  const cartItemsContainer = document.querySelector('.cart-items');
  const cartTotal = document.querySelector('.cart-total');
  const cartBadge = document.querySelector('.cart-badge');
  const header = document.querySelector('.header');

  let cartItems = [];

  // ========== Header Scroll Effect ==========
  function handleHeaderScroll() {
    if (window.scrollY > 50) {
      header.classList.add('header-scrolled');
    } else {
      header.classList.remove('header-scrolled');
    }
  }

  window.addEventListener('scroll', handleHeaderScroll);
  handleHeaderScroll();

  // ========== Navigation Functions ==========
  function openNav() {
    document.body.classList.add('overlay-active');
    menuOverlay.classList.add('active');
    mainNav.classList.add('active');
  }

  function closeNav() {
    document.body.classList.remove('overlay-active');
    menuOverlay.classList.remove('active');
    mainNav.classList.remove('active');
  }

  hamburgerBtn.addEventListener('click', openNav);
  closeNavBtn.addEventListener('click', closeNav);

  // ========== Cart Functions ==========
  function toggleCart() {
    document.body.classList.toggle('overlay-active');
    menuOverlay.classList.toggle('active');
    cartSidebar.classList.toggle('active');

    // Close nav if open
    if (mainNav.classList.contains('active')) {
      closeNav();
    }
  }
  // ========== Cart Functions ==========
  function updateCartDisplay() {
    // Clear current items
    cartItemsContainer.innerHTML = '';

    if (cartItems.length === 0) {
      // Show empty cart message
      cartItemsContainer.innerHTML = `
            <div class="empty-cart">
                <svg viewBox="0 0 24 24" width="48" height="48">
                    <path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
                <p>Your cart is empty</p>
            </div>
        `;
    } else {
      // Add cart items
      cartItems.forEach(item => {
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        cartItem.innerHTML = `
                <div class="cart-item-details">
                    <div class="cart-item-name">${item.name}</div>
                    <div class="cart-item-price">R${(item.price * item.quantity).toFixed(2)}</div>
                </div>
                <div class="cart-item-controls">
                    <button class="cart-item-decrease" data-id="${item.id}" aria-label="Decrease quantity">-</button>
                    <span class="cart-item-quantity">${item.quantity}</span>
                    <button class="cart-item-increase" data-id="${item.id}" aria-label="Increase quantity">+</button>
                    <button class="cart-item-remove" data-id="${item.id}" aria-label="Remove item">
                        <svg viewBox="0 0 24 24" width="16" height="16">
                            <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                        </svg>
                    </button>
                </div>
                <div class="cart-item-unit-price">R${item.price.toFixed(2)} each</div>
            `;
        cartItemsContainer.appendChild(cartItem);
      });
    }

    // Update total and badge
    const total = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const itemCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

    document.querySelector('.cart-total').textContent = `R${total.toFixed(2)}`;
    document.querySelector('.cart-badge').textContent = itemCount;
    document.querySelector('.cart-subtotal span:last-child').textContent = `R${total.toFixed(2)}`;

    // Update item count in header
    const itemText = itemCount === 1 ? 'item' : 'items';
    document.querySelector('.cart-header p').textContent = `${itemCount} ${itemText}`;
  }

  function addToCart(product) {
    const existingItem = cartItems.find(item => item.id === product.id);

    if (existingItem) {
      existingItem.quantity += 1;
    } else {
      cartItems.push({
        ...product,
        quantity: 1
      });
    }

    updateCartDisplay();

    // Show cart if it's hidden
    if (!cartSidebar.classList.contains('active')) {
      toggleCart();
    }

    // Show success animation
    cartBtn.classList.add('animate-bounce');
    setTimeout(() => {
      cartBtn.classList.remove('animate-bounce');
    }, 1000);
  }

  function removeFromCart(productId) {
    cartItems = cartItems.filter(item => item.id !== productId);
    updateCartDisplay();

    // Show remove animation
    if (cartItems.length === 0) {
      cartItemsContainer.classList.add('empty-animation');
      setTimeout(() => {
        cartItemsContainer.classList.remove('empty-animation');
      }, 500);
    }
  }

  function updateQuantity(productId, change) {
    const item = cartItems.find(item => item.id === productId);

    if (item) {
      item.quantity += change;

      if (item.quantity <= 0) {
        removeFromCart(productId);
      } else {
        updateCartDisplay();
      }
    }
  }

  // Add animation styles for cart actions
  const style = document.createElement('style');
  style.textContent = `
    @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-5px); }
    }
    @keyframes fadeOut {
        from { opacity: 1; transform: scale(1); }
        to { opacity: 0; transform: scale(0.9); }
    }
    .animate-bounce {
        animation: bounce 0.5s;
    }
    .empty-animation {
        animation: fadeOut 0.3s ease-out;
    }
`;
  document.head.appendChild(style);

  // ========== Event Listeners ==========
  cartBtn.addEventListener('click', toggleCart);
  closeCartBtn.addEventListener('click', toggleCart);

  // Overlay click handler
  menuOverlay.addEventListener('click', function () {
    closeNav();
    if (cartSidebar.classList.contains('active')) {
      toggleCart();
    }
  });

  // Close menus on ESC key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (mainNav.classList.contains('active')) closeNav();
      if (cartSidebar.classList.contains('active')) toggleCart();
    }
  });

  // Handle cart item interactions
  document.addEventListener('click', function (e) {
    // Add to cart buttons
    if (e.target.classList.contains('add-to-cart') || e.target.closest('.add-to-cart')) {
      const btn = e.target.classList.contains('add-to-cart') ? e.target : e.target.closest('.add-to-cart');
      const id = btn.dataset.id;
      const name = btn.dataset.name;
      const price = parseFloat(btn.dataset.price);

      if (id && name && !isNaN(price)) {
        addToCart({ id, name, price });
      }
    }

    // Cart item controls
    if (e.target.classList.contains('cart-item-remove') || e.target.closest('.cart-item-remove')) {
      const btn = e.target.classList.contains('cart-item-remove') ? e.target : e.target.closest('.cart-item-remove');
      removeFromCart(btn.dataset.id);
    }

    if (e.target.classList.contains('cart-item-increase') || e.target.closest('.cart-item-increase')) {
      const btn = e.target.classList.contains('cart-item-increase') ? e.target : e.target.closest('.cart-item-increase');
      updateQuantity(btn.dataset.id, 1);
    }

    if (e.target.classList.contains('cart-item-decrease') || e.target.closest('.cart-item-decrease')) {
      const btn = e.target.classList.contains('cart-item-decrease') ? e.target : e.target.closest('.cart-item-decrease');
      updateQuantity(btn.dataset.id, -1);
    }
  });

  // Close menus on ESC key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (mainNav.classList.contains('active')) closeNav();
      if (cartSidebar.classList.contains('active')) toggleCart();
    }
  });

  // Initialize cart display
  updateCartDisplay();

  // ========== Sample Products (for demo) ==========
  // In a real implementation, these would come from your backend
  const sampleProducts = [
    { id: '1', name: 'African Print Dress', price: 45.99 },
    { id: '2', name: 'Handcrafted Necklace', price: 29.50 },
    { id: '3', name: 'Wooden Sculpture', price: 65.00 }
  ];

  // For demo purposes - add sample products after 2 seconds
  setTimeout(() => {
    sampleProducts.forEach(product => {
      addToCart({ ...product, quantity: 1 });
    });
  }, 2000);
});

// Service Booking Popup Functionality
// Redirect to product page when cleaning-products CTA is clicked

document.addEventListener('DOMContentLoaded', function () {
  const cleaningProductsBtn = document.querySelector('.service-cta-btn[data-service="cleaning-products"]');
  if (cleaningProductsBtn) {
    cleaningProductsBtn.addEventListener('click', function (e) {
      window.location.href = 'products.html'; // Change to your actual product page if different
    });
  }
  const serviceButtons = document.querySelectorAll('.service-cta-btn');
  const servicePopup = document.getElementById('service-popup');
  const popupClose = document.querySelector('.popup-close');
  const popupOverlay = document.querySelector('.popup-overlay');

  // Service data for dynamic popup content
  const services = {
    'deep-cleaning': {
      title: 'Standard & Deep Cleaning',
      price: 'From R350',
      description: 'Refresh your space from top to bottom with our thorough deep cleaning — perfect for hard-to-reach areas and detailed care.',
      image: '/images/deepcleaning.jpg',
      options: [
        'Standard Cleaning',
        'Deep Cleaning',
        'Move-in/Move-out Cleaning',
        'Post-Construction Cleaning'
      ]
    },
    'office-cleaning': {
      title: 'Office Cleaning',
      price: 'From R500',
      description: 'Boost your workplace productivity and professionalism with our expert office cleaning services tailored to your needs.',
      image: '/images/office.jpg',
      options: [
        'Daily Office Cleaning',
        'Weekly Office Cleaning',
        'Deep Office Cleaning',
        'Carpet Cleaning for Offices'
      ]
    },
    'window-cleaning': {
      title: 'Window Cleaning',
      price: 'From R500',
      description: "Let the light shine in! Our crystal-clear window cleaning enhances your space's appearance inside and out. Streak-free results for homes and businesses.",
      image: '/images/window.jpg',
      options: [
        'Interior Window Cleaning',
        'Exterior Window Cleaning',
        'High-Rise Window Cleaning',
        'Glass Door Cleaning'
      ]
    },
    'carpet-cleaning': {
      title: 'Carpet Cleaning',
      price: 'From R300',
      description: 'Restore the beauty of your carpets with our deep cleaning and stain removal. Safe for kids and pets, and quick drying.',
      image: '/images/carpet.jpg',
      options: [
        'Rug Cleaning',
        'Wall-to-Wall Carpet Cleaning',
        'Stain Removal',
        'Pet Odor Removal'
      ]
    },
    'upholstery-cleaning': {
      title: 'Upholstery Cleaning',
      price: 'From R400',
      description: 'Refresh your sofas, chairs, and mattresses. We remove stains, odors, and allergens for a healthier home.',
      image: '/images/upholstery.jpg',
      options: [
        'Sofa Cleaning',
        'Mattress Cleaning',
        'Chair Cleaning',
        'Stain & Odor Removal'
      ]
    },
    'pest-control': {
      title: 'Pest Control',
      price: 'From R250',
      description: 'Protect your property from unwanted pests. We offer safe and effective pest management solutions for all environments.',
      image: '/images/pest-control.jpg',
      options: [
        'Ant Control',
        'Cockroach Control',
        'Rodent Control',
        'General Pest Management'
      ]
    },
    'fumigation': {
      title: 'Fumigation',
      price: 'From R250',
      description: 'Comprehensive fumigation services to eliminate insects and pests. Safe for families and businesses.',
      image: '/images/fumigation.jpg',
      options: [
        'Residential Fumigation',
        'Commercial Fumigation',
        'Termite Fumigation',
        'Bed Bug Fumigation'
      ]
    },
    'disinfecting': {
      title: 'Disinfecting',
      price: 'From R350',
      description: 'Professional disinfecting for homes, offices, and public spaces. Kills 99.9% of germs and viruses for peace of mind.',
      image: '/images/disinfect.jpg',
      options: [
        'Home Disinfecting',
        'Office Disinfecting',
        'Vehicle Disinfecting',
        'Fogging Service'
      ]
    }
  };

  // Open popup when service button is clicked
  serviceButtons.forEach(button => {
    button.addEventListener('click', function () {
      const serviceId = this.getAttribute('data-service');
      const service = services[serviceId];

      // Set popup content
      document.getElementById('popup-service-title').textContent = service.title;
      document.getElementById('popup-service-price').textContent = service.price;
      document.getElementById('popup-service-description').textContent = service.description;
      document.getElementById('popup-service-image').src = service.image;
      document.getElementById('popup-service-image').alt = service.title;

      // Populate service type options
      const serviceTypeSelect = document.getElementById('service-type');
      serviceTypeSelect.innerHTML = '<option value="" disabled selected>Select service type</option>';

      service.options.forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.toLowerCase().replace(/ /g, '-');
        opt.textContent = option;
        serviceTypeSelect.appendChild(opt);
      });

      // Show popup
      servicePopup.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
  });

  // Close popup
  function closePopup() {
    servicePopup.classList.remove('active');
    document.body.style.overflow = '';
  }

  popupClose.addEventListener('click', closePopup);
  popupOverlay.addEventListener('click', closePopup);

  // Close popup when pressing Escape key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && servicePopup.classList.contains('active')) {
      closePopup();
    }
  });

  // Form submission
  const bookingForm = document.getElementById('service-booking-form');
  bookingForm.addEventListener('submit', function (e) {
    e.preventDefault();

    // Here you would typically send the form data to your server
    // For demonstration, we'll just show an alert
    alert('Booking request submitted! We will contact you shortly to confirm.');
    closePopup();
    this.reset();
  });
});
document.addEventListener('DOMContentLoaded', function () {
  // Gallery Filter Functionality
  const filterButtons = document.querySelectorAll('.filter-btn');
  const galleryItems = document.querySelectorAll('.gallery-item');

  filterButtons.forEach(button => {
    button.addEventListener('click', function () {
      // Remove active class from all buttons
      filterButtons.forEach(btn => btn.classList.remove('active'));

      // Add active class to clicked button
      this.classList.add('active');

      const filterValue = this.getAttribute('data-filter');

      // Filter items
      galleryItems.forEach(item => {
        if (filterValue === 'all' || item.getAttribute('data-category') === filterValue) {
          item.style.display = 'block';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  // Play videos on hover
  const videoItems = document.querySelectorAll('.gallery-item video');
  videoItems.forEach(video => {
    video.addEventListener('mouseenter', function () {
      this.play();
    });

    video.addEventListener('mouseleave', function () {
      this.pause();
      this.currentTime = 0;
    });
  });

  // Before/After Slider
  const slider = document.querySelector('.ba-slider');
  if (slider) {
    const before = slider.querySelector('.before');
    const handle = slider.querySelector('.slider-handle');
    let isDragging = false;

    function updateSliderPosition(clientX) {
      const rect = slider.getBoundingClientRect();
      let position = clientX - rect.left;

      // Constrain position within slider bounds
      position = Math.max(0, Math.min(position, rect.width));

      const percentage = (position / rect.width) * 100;
      before.style.width = `${percentage}%`;
      handle.style.left = `${percentage}%`;
    }

    handle.addEventListener('mousedown', function (e) {
      isDragging = true;
      e.preventDefault(); // Prevent text selection
    });

    document.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      updateSliderPosition(e.clientX);
    });

    document.addEventListener('mouseup', function () {
      isDragging = false;
    });

    // Touch support
    handle.addEventListener('touchstart', function () {
      isDragging = true;
    });

    document.addEventListener('touchmove', function (e) {
      if (!isDragging) return;
      updateSliderPosition(e.touches[0].clientX);
    });

    document.addEventListener('touchend', function () {
      isDragging = false;
    });
  }
});


document.addEventListener('DOMContentLoaded', function () {
  const track = document.querySelector('.home-services-bar');
  const cards = Array.from(document.querySelectorAll('.home-service-card'));
  const prevBtn = document.querySelector('.home-carousel-prev');
  const nextBtn = document.querySelector('.home-carousel-next');
  const progressBar = document.querySelector('.home-progress-bar');

  const cardCount = cards.length;
  let cardWidth = cards[0].offsetWidth + 24; // width + gap
  let currentPosition = 0;
  let maxVisibleCards = Math.floor(track.parentElement.offsetWidth / cardWidth);

  function updateCarousel() {
    // Calculate the maximum scroll position
    const maxScroll = (cardCount - maxVisibleCards) * cardWidth;

    // Handle boundary conditions
    if (currentPosition * cardWidth > maxScroll) {
      currentPosition = 0;
      track.style.transition = 'none';
      track.style.transform = `translateX(0)`;
      setTimeout(() => {
        track.style.transition = 'transform 0.6s ease';
      }, 10);
    } else if (currentPosition < 0) {
      currentPosition = Math.floor(maxScroll / cardWidth);
      track.style.transition = 'none';
      track.style.transform = `translateX(-${maxScroll}px)`;
      setTimeout(() => {
        track.style.transition = 'transform 0.6s ease';
      }, 10);
    }

    // Update position
    track.style.transform = `translateX(-${currentPosition * cardWidth}px)`;

    // Update progress bar
    const maxProgress = (cardCount - maxVisibleCards);
    const progress = (currentPosition % cardCount) / maxProgress * 100;
    progressBar.style.transform = `translateX(${Math.min(100, progress)}%)`;
  }

  // Initialize
  updateCarousel();

  // Navigation
  nextBtn.addEventListener('click', () => {
    currentPosition++;
    updateCarousel();
  });

  prevBtn.addEventListener('click', () => {
    currentPosition--;
    updateCarousel();
  });

  // Touch support
  let startX, moveX;
  track.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    track.style.transition = 'none';
  });

  track.addEventListener('touchmove', (e) => {
    moveX = e.touches[0].clientX;
    track.style.transform = `translateX(calc(-${currentPosition * cardWidth}px - ${startX - moveX}px))`;
  });

  track.addEventListener('touchend', () => {
    const diff = startX - moveX;
    if (diff > 50) {
      currentPosition++;
    } else if (diff < -50) {
      currentPosition--;
    }
    track.style.transition = 'transform 0.6s ease';
    updateCarousel();
  });

  // Auto-scroll (optional)
  let autoScroll = setInterval(() => {
    currentPosition++;
    updateCarousel();
  }, 5000);

  track.addEventListener('mouseenter', () => clearInterval(autoScroll));
  track.addEventListener('mouseleave', () => {
    autoScroll = setInterval(() => {
      currentPosition++;
      updateCarousel();
    }, 5000);
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    cardWidth = cards[0].offsetWidth + 24;
    maxVisibleCards = Math.floor(track.parentElement.offsetWidth / cardWidth);
    updateCarousel();
  });
});
