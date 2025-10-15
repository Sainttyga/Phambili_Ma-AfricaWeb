// admin-tabs.js - Tab management for admin dashboard
class AdminTabs {
    constructor() {
        this.tablist = document.querySelector('.sidebar-nav[role="tablist"]');
        if (!this.tablist) return;
        
        this.tabs = this.tablist.querySelectorAll('[role="tab"]');
        this.panels = document.querySelectorAll('[role="tabpanel"]');
        this.init();
    }

    init() {
        // Add event listeners to tabs
        this.tabs.forEach(tab => {
            tab.addEventListener('click', (e) => this.handleTabClick(e));
            tab.addEventListener('keydown', (e) => this.handleTabKeydown(e));
        });

        // Set first tab as active by default
        if (this.tabs.length > 0) {
            this.activateTab(this.tabs[0]);
        }
    }

    handleTabClick(event) {
        event.preventDefault();
        const tab = event.currentTarget;
        this.activateTab(tab);
    }

    handleTabKeydown(event) {
        const tab = event.currentTarget;
        const key = event.key;
        let newTab;

        switch (key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                newTab = this.getPreviousTab(tab);
                break;
            case 'ArrowRight':
            case 'ArrowDown':
                newTab = this.getNextTab(tab);
                break;
            case 'Home':
                newTab = this.tabs[0];
                break;
            case 'End':
                newTab = this.tabs[this.tabs.length - 1];
                break;
            case 'Enter':
            case 'Space':
                event.preventDefault();
                this.activateTab(tab);
                return;
            default:
                return;
        }

        event.preventDefault();
        if (newTab) {
            this.activateTab(newTab);
            newTab.focus();
        }
    }

    getPreviousTab(currentTab) {
        const currentIndex = Array.from(this.tabs).indexOf(currentTab);
        return currentIndex > 0 ? this.tabs[currentIndex - 1] : this.tabs[this.tabs.length - 1];
    }

    getNextTab(currentTab) {
        const currentIndex = Array.from(this.tabs).indexOf(currentTab);
        return currentIndex < this.tabs.length - 1 ? this.tabs[currentIndex + 1] : this.tabs[0];
    }

    activateTab(selectedTab) {
        // Deactivate all tabs
        this.tabs.forEach(tab => {
            tab.setAttribute('aria-selected', 'false');
            tab.classList.remove('active');
            tab.tabIndex = -1;
        });

        // Hide all panels
        this.panels.forEach(panel => {
            panel.hidden = true;
            panel.classList.remove('active');
        });

        // Activate selected tab
        selectedTab.setAttribute('aria-selected', 'true');
        selectedTab.classList.add('active');
        selectedTab.tabIndex = 0;

        // Show associated panela
        const panelId = selectedTab.getAttribute('aria-controls');
        const selectedPanel = document.getElementById(panelId);
        if (selectedPanel) {
            selectedPanel.hidden = false;
            selectedPanel.classList.add('active');
            
            // Focus the panel for accessibility
            selectedPanel.focus();
        }

        // Update URL hash (optional)
        const tabName = selectedTab.getAttribute('data-tab');
        window.history.replaceState(null, null, `#${tabName}`);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AdminTabs();
    
    // Handle initial hash in URL
    const hash = window.location.hash.substring(1);
    if (hash) {
        const tab = document.querySelector(`[data-tab="${hash}"]`);
        if (tab) {
            setTimeout(() => {
                tab.click();
            }, 100);
        }
    }
});