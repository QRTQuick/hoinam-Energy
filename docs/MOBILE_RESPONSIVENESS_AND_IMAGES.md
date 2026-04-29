# Product Images & Mobile Responsiveness Improvements

## Summary of Changes

### 1. Mobile Responsiveness Enhancements

#### Login Page (`login.html`)
- Added responsive styles for screens up to 860px
- Added ultra-mobile styles for screens < 480px
- Added extra-small device support < 360px
- Improved button sizing for touch (minimum 44px height)
- Adjusted padding and font sizes for smaller screens

#### Shop Page (`shop.html`)
- Enhanced mobile layouts with breakpoints at 640px, 480px, and 360px
- Adjusted product grid to 2 columns on mobile
- Made search and sort controls stack vertically on small screens
- Improved button sizing and spacing for touch interactions
- Fixed sidebar toggle behavior on mobile

#### Home Page (`index.html`)
- Added "Brands We Carry" section with 4 stores (EcoFlow, Deye, Bluetti, Buttu)
- Responsive brand cards that adapt from 4 columns → 2 columns → 1 column
- Mobile-friendly vertical layout for brand cards on small screens

### 2. Added Bluetti Store
Updated `backend/stores.py` to include Bluetti in the store catalog with:
- Name: "Bluetti Store"
- Description: "Portable power stations and solar panels for mobile power"
- Featured: True

### 3. Product Image Download Helper
Created `scripts/download_product_images.py` that:
- Downloads product images from official brand websites
- Saves them to `assets/images/products/`
- Supports EcoFlow, Bluetti, Deye, and Buttu products
- Uses placeholder images for products without direct links

## How to Use Product Image Download

### Option 1: Manual Download
1. Visit each brand's official website:
   - **EcoFlow**: https://www.ecoflow.com/
   - **Bluetti**: https://www.bluettipower.com/
   - **Deye**: https://www.deye.com/
   - **Buttu**: Check product documentation

2. Download product images (PNG or JPG)

3. Save to: `assets/images/products/`

4. Rename files to match product slugs:
   - Format: `product-name.png` or `product-name.jpg`
   - Example: `ecoflow-delta-pro.png`

### Option 2: Automated Download (requires Python 3.7+)
```bash
cd scripts
python3 download_product_images.py
```

This will download sample images from official sources.

### File Naming Convention
Product images should be named using the product slug:
```
assets/images/products/
├── ecoflow-delta-pro.png
├── bluetti-ac500.jpg
├── deye-sun-12k-es.png
└── buttu-mounting-kit.jpg
```

## Mobile Testing Checklist

### Login Page
- [ ] Form inputs are at least 44px tall
- [ ] Buttons are touchable on mobile
- [ ] Text is readable on small screens
- [ ] No horizontal scrolling
- [ ] Brand logo and heading visible on mobile

### Shop Page
- [ ] Products display in 2 columns on mobile
- [ ] Search box is accessible
- [ ] Sort dropdown works on touch
- [ ] "Add to Cart" buttons are easily tappable
- [ ] Sidebar collapses properly

### Logout Functionality
- [x] Desktop: Logout button in top navigation
- [x] Mobile: Logout button accessible in hamburger menu
- [x] Touch-friendly button sizing

## Fixing Image Display Issues

If product images still aren't showing:

1. **Check image file paths:**
   ```
   assets/images/products/product-name.png
   ```

2. **Verify database has correct image URLs:**
   - Upload inventory with image URLs via admin panel
   - Or place images in folder and they'll be auto-discovered

3. **Clear browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

4. **Check console for errors:**
   - Open DevTools (F12)
   - Check Console tab for 404 errors

## Database Schema for Products

The product model includes:
- `image_url`: Direct URL or path to image
- `slug`: Used to auto-find images in `assets/images/products/`
- `store_slug`: Links to store (ecoflow, deye, bluetti, buttu)
- `brand`: Brand name

Images are auto-discovered by matching product slug with files in `assets/images/products/`.

## Brands Section URLs

The new brands section includes direct links to filter by store:
- EcoFlow: `/shop.html?store=ecoflow`
- Deye: `/shop.html?store=deye`
- Bluetti: `/shop.html?store=bluetti`
- Buttu: `/shop.html?store=buttu`

## Performance Notes

- Images should be optimized (< 200KB each for web)
- Use PNG or JPG format
- Consider using WebP for better compression (fallback to PNG)
- Lazy load images on mobile for better performance

## Troubleshooting

### "Images not loading"
1. Check file exists: `assets/images/products/image-name.png`
2. Check image URL in database
3. Verify image format is PNG/JPG/WebP
4. Check for CORS issues if external URL

### "Mobile buttons not responding"
1. Ensure minimum 44px touch target
2. Check for JavaScript errors (DevTools Console)
3. Verify event listeners are attached
4. Test with real mobile device or emulator

### "Shop page layout broken on mobile"
1. Clear cache and reload
2. Check viewport meta tag exists
3. Test in different browsers
4. Open DevTools responsive mode (F12 → rotation icon)

## Next Steps

1. Download/upload all product images
2. Test on real mobile devices (iOS and Android)
3. Test touch interactions (tap, scroll, swipe)
4. Monitor performance metrics
5. Optimize images if needed

## Mobile Optimization Quick Tips

1. **Touch targets**: Minimum 44x44px (recommended)
2. **Text sizing**: Minimum 16px base font size
3. **Spacing**: Use generous padding between interactive elements
4. **Responsiveness**: Test at 320px, 480px, 768px, 1024px widths
5. **Performance**: Keep images < 200KB, use lazy loading

## Testing Tools

- **DevTools**: Press F12, use responsive mode
- **Mobile device emulator**: Chrome emulator built-in
- **Real device**: Test on actual phone/tablet
- **Lighthouse**: Check performance metrics (DevTools → Lighthouse)
