/**
 * Expandable Cards Interaction Handler
 * Handles touch/click interactions for mobile expandable product cards
 */

document.addEventListener('DOMContentLoaded', () => {
  const productsGrid = document.getElementById('products-grid');
  
  if (!productsGrid) return;
  
  // Handle mobile tap to expand
  productsGrid.addEventListener('click', (e) => {
    const card = e.target.closest('.product-card');
    if (!card) return;
    
    // Don't expand if clicking on action buttons or CTA
    if (e.target.closest('.product-card-action-btn') || 
        e.target.closest('.product-card-cta')) {
      return;
    }
    
    // Only toggle on mobile
    if (window.innerWidth <= 768) {
      const isActive = card.classList.contains('is-active');
      
      // Close all other cards
      productsGrid.querySelectorAll('.product-card.is-active').forEach(c => {
        if (c !== card) {
          c.classList.remove('is-active');
        }
      });
      
      // Toggle current card
      card.classList.toggle('is-active', !isActive);
    }
  });
  
  // Handle keyboard navigation
  productsGrid.addEventListener('keydown', (e) => {
    const card = e.target.closest('.product-card');
    if (!card) return;
    
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      
      if (window.innerWidth <= 768) {
        const isActive = card.classList.contains('is-active');
        
        productsGrid.querySelectorAll('.product-card.is-active').forEach(c => {
          if (c !== card) {
            c.classList.remove('is-active');
          }
        });
        
        card.classList.toggle('is-active', !isActive);
      } else {
        // On desktop, navigate to product detail on Enter
        const link = card.querySelector('.product-card-cta');
        if (link) {
          window.location.href = link.href;
        }
      }
    }
  });
  
  // Close cards when clicking outside
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (!e.target.closest('.products-grid')) {
        productsGrid.querySelectorAll('.product-card.is-active').forEach(card => {
          card.classList.remove('is-active');
        });
      }
    }
  });
  
  // Handle scroll to close cards on mobile
  let lastScrollY = window.scrollY;
  window.addEventListener('scroll', () => {
    if (window.innerWidth <= 768) {
      const currentScrollY = window.scrollY;
      if (Math.abs(currentScrollY - lastScrollY) > 50) {
        productsGrid.querySelectorAll('.product-card.is-active').forEach(card => {
          card.classList.remove('is-active');
        });
      }
      lastScrollY = currentScrollY;
    }
  }, { passive: true });
});
