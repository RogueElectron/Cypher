// Lightweight scroll effects for Cypher
// Adds 'scrolled' class to body and navbar on scroll

(function() {
    let ticking = false;
    let lastScrollY = 0;
    
    function updateScrollClasses() {
        const scrollY = window.scrollY;
        const navbar = document.querySelector('.navbar');
        const body = document.body;
        
        if (scrollY > 50) {
            navbar?.classList.add('scrolled');
            body.classList.add('scrolled');
        } else {
            navbar?.classList.remove('scrolled');
            body.classList.remove('scrolled');
        }
        
        ticking = false;
    }
    
    function onScroll() {
        lastScrollY = window.scrollY;
        
        if (!ticking) {
            window.requestAnimationFrame(updateScrollClasses);
            ticking = true;
        }
    }
    
    // Initialize on load
    window.addEventListener('scroll', onScroll, { passive: true });
    
    // Check initial state
    updateScrollClasses();
})();
