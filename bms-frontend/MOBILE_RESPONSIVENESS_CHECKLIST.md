# Mobile Responsiveness Checklist

This document outlines the mobile responsiveness testing requirements for the tenant portal.

## Test 10.5.1: Various Screen Sizes

### Small Phones (320px width)

- [ ] Dashboard displays correctly without horizontal scrolling
- [ ] All cards stack vertically
- [ ] Text is readable without zooming
- [ ] Buttons are accessible and not cut off
- [ ] Forms fit within viewport
- [ ] Navigation menu is usable

### Large Phones (428px width - iPhone 14 Pro Max)

- [ ] Dashboard uses available space efficiently
- [ ] Cards can display in grid layout (if applicable)
- [ ] Images scale appropriately
- [ ] Tables (if any) are scrollable horizontally or stacked
- [ ] Modals/bottom sheets fit within viewport

### Tablets (768px+ width)

- [ ] Layout adapts to larger screen
- [ ] Multiple columns used where appropriate
- [ ] Sidebar navigation (if applicable) is accessible
- [ ] Content doesn't appear too narrow
- [ ] Touch targets remain appropriately sized

## Test 10.5.2: Touch Interactions

### Swipe Gestures

- [ ] Swipeable cards work smoothly
- [ ] Swipe actions are discoverable
- [ ] Swipe doesn't interfere with scrolling
- [ ] Swipe gestures work on both iOS and Android

### Tap Targets (Minimum 44x44px)

- [ ] All buttons meet minimum size requirement
- [ ] Links are easily tappable
- [ ] Form inputs have adequate touch area
- [ ] Navigation items are easily accessible
- [ ] Checkboxes and radio buttons are large enough
- [ ] Icon-only buttons have sufficient padding

### Form Inputs (Keyboard-Friendly)

- [ ] Input fields are properly focused when tapped
- [ ] Keyboard doesn't cover input fields
- [ ] Form scrolls to keep focused input visible
- [ ] Input types are appropriate (tel, email, number, etc.)
- [ ] Autocomplete suggestions work
- [ ] Submit buttons are accessible when keyboard is open
- [ ] "Done" or "Next" buttons appear on keyboard (iOS)

## Browser Testing

### iOS Safari

- [ ] Viewport meta tag prevents zooming issues
- [ ] Safe area insets respected (notch/home indicator)
- [ ] Bottom navigation doesn't conflict with home indicator
- [ ] Pull-to-refresh works (if implemented)
- [ ] Fixed elements don't cause layout issues

### Android Chrome/Edge

- [ ] Viewport scaling works correctly
- [ ] Status bar color matches theme
- [ ] Navigation bar doesn't interfere with content
- [ ] Swipe gestures work smoothly

## Common Issues to Check

### Layout Issues

- [ ] No horizontal scrolling on any page
- [ ] Content doesn't overflow containers
- [ ] Images don't break layout
- [ ] Text wraps correctly
- [ ] Long words don't break layout

### Performance

- [ ] Pages load quickly on mobile networks
- [ ] Images are optimized and lazy-loaded
- [ ] Animations are smooth (60fps)
- [ ] No layout shifts during load

### Accessibility

- [ ] Touch targets are accessible
- [ ] Text contrast meets WCAG standards
- [ ] Focus indicators are visible
- [ ] Screen reader compatible (if applicable)

## Testing Tools

### Browser DevTools

- Chrome DevTools: Device Toolbar (Ctrl+Shift+M / Cmd+Shift+M)
- Firefox DevTools: Responsive Design Mode
- Safari: Develop > Enter Responsive Design Mode

### Real Devices (Recommended)

- iPhone (various models)
- Android phone (various models)
- iPad/Android tablet

### Online Tools

- BrowserStack
- Responsive Design Checker
- Google Mobile-Friendly Test

## Quick Test Commands

### Viewport Sizes to Test

```bash
# Small phone
# 320x568 (iPhone SE)
# 375x667 (iPhone 8)

# Large phone
# 428x926 (iPhone 14 Pro Max)
# 414x896 (iPhone 11 Pro Max)

# Tablet
# 768x1024 (iPad)
# 1024x1366 (iPad Pro)
```

### CSS Media Queries Used

```css
/* Mobile first approach */
@media (min-width: 640px) {
  /* sm */
}
@media (min-width: 768px) {
  /* md */
}
@media (min-width: 1024px) {
  /* lg */
}
@media (min-width: 1280px) {
  /* xl */
}
```

## Notes

- All tenant portal pages should be mobile-first
- Use Tailwind CSS responsive utilities (`sm:`, `md:`, `lg:`, etc.)
- Test with actual touch, not just mouse
- Consider landscape orientation as well
- Test with slow 3G network throttling
- Verify on both light and dark themes
