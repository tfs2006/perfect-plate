# Copilot Instructions for Perfect-Plate

## Project Overview
Perfect-Plate is an AI-powered meal planning application that generates personalized 7-day meal plans with grocery lists. The app uses Google's Gemini API to create customized meal plans based on user preferences, dietary restrictions, and health goals. It exports plans to PDF format for easy use.

## Tech Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Styling**: Tailwind CSS (CDN)
- **Backend**: Netlify Serverless Functions (Node.js)
- **AI Integration**: Google Gemini API
- **Deployment**: 
  - Frontend: GitHub Pages
  - Backend Functions: Netlify
- **Libraries**:
  - jsPDF (PDF generation)
  - html2canvas (DOM to image conversion)
  - Lucide Icons (icon library)

## Architecture Overview
```
/ (GitHub Pages frontend - static site)
  index.html           # Single-page application entry point
  css/
    style.css          # Custom styles (complements Tailwind)
  js/
    config.js          # API endpoint configuration
    script.js          # Main application logic
  assets/              # Static assets (images, icons)
  netlify/
    functions/
      generate-plan.js # Serverless function for Gemini API proxy
  netlify.toml         # Netlify configuration
```

## Coding Standards

### JavaScript
- **ES6+ Syntax**: Use modern JavaScript features (arrow functions, destructuring, template literals, optional chaining, nullish coalescing)
- **No Build Step**: Code must work directly in browsers without transpilation
- **IIFE Pattern**: Wrap code in immediately invoked function expressions to avoid global namespace pollution
- **Utility Functions**: Keep small, focused utility functions at the top of files
- **Comments**: Add JSDoc-style comments for complex functions
- **Error Handling**: Always include try-catch blocks for async operations and API calls
- **Security**: 
  - Never expose API keys in frontend code
  - Always escape user-generated content with `escapeHTML()` utility
  - Use serverless functions as proxy for external API calls

### HTML
- **Semantic HTML**: Use appropriate semantic elements (`<main>`, `<aside>`, `<section>`, etc.)
- **Accessibility**: Include ARIA labels, proper form labels, and keyboard navigation support
- **Progressive Enhancement**: Ensure core functionality works without JavaScript
- **IDs over Classes**: Prefer IDs for JavaScript selection, classes for styling

### CSS
- **Tailwind First**: Use Tailwind utility classes for most styling
- **Custom CSS**: Use `style.css` only for:
  - Component-specific styles not available in Tailwind
  - Animations and transitions
  - Complex layouts requiring custom CSS
- **Responsive Design**: Always consider mobile-first design
- **Accessibility**: Include `:focus-visible` states, `prefers-reduced-motion` support

### Netlify Functions
- **CORS**: Always include proper CORS headers for cross-origin requests
- **Environment Variables**: Use `process.env` for sensitive data (API keys)
- **Error Handling**: Return appropriate HTTP status codes and error messages
- **Security**: Validate all input, sanitize data, implement rate limiting if needed

## Development Workflow

### Branch Naming
- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Critical production fixes
- `docs/` - Documentation updates

### Commit Messages
Use conventional commits format:
```
<type>(<scope>): <description>

[optional body]
[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(ui): add grocery list export to CSV`
- `fix(api): handle null values in meal plan response`
- `docs(readme): update deployment instructions`

### PR Requirements
- Clear description of changes
- Reference to related issues
- Manual testing performed (no automated tests currently)
- No console errors
- Works on mobile and desktop

## Code Patterns & Best Practices

### Form Handling
- Save form state to localStorage for persistence
- Use debouncing for frequent updates
- Validate inputs before submission
- Show clear error messages to users

### API Communication
```javascript
// Always use the proxy pattern
const response = await fetch(`${window.API_BASE}/generate-plan`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ endpoint, body })
});
```

### DOM Manipulation
```javascript
// Use utility function for element selection
const $ = (id) => document.getElementById(id);

// Always check for null before accessing properties
const element = $("my-element");
if (element) {
  element.textContent = "New content";
}
```

### Error Display
```javascript
// Use the message box pattern
function showMessage(text, isError = false) {
  const box = $("message-box");
  const msgText = $("message-text");
  if (box && msgText) {
    msgText.textContent = text;
    box.classList.remove("hidden");
    setTimeout(() => box.classList.add("hidden"), 4000);
  }
}
```

## State Management
- Use localStorage for form persistence
- Store minimal state in global variables within IIFE scope
- Pass data through function parameters rather than globals
- Clear sensitive data after use

## Performance Guidelines
- Debounce frequent operations (form saves, API calls)
- Use efficient DOM queries (getElementById over querySelector)
- Minimize reflows and repaints
- Lazy load heavy libraries when needed
- Cache DOM references in long-running functions

## Accessibility Requirements
- All form inputs must have proper `<label>` elements
- Include ARIA labels for icon-only buttons
- Ensure keyboard navigation works for all interactive elements
- Support `prefers-reduced-motion` for animations
- Maintain color contrast ratios (WCAG AA minimum)
- Use semantic HTML for screen reader compatibility

## Security Practices
1. **API Keys**: Never commit API keys; use environment variables in Netlify Functions
2. **Input Validation**: Validate all user inputs on both client and server
3. **Output Escaping**: Always escape user-generated content before rendering
4. **CORS**: Configure CORS properly to restrict unauthorized access
5. **HTTPS**: Use HTTPS for all API communications
6. **Content Security**: Be cautious with innerHTML; prefer textContent or element creation

## Testing Guidelines
Since this project has no automated test infrastructure:
1. **Manual Testing**: Test all features after changes
2. **Browser Testing**: Test on Chrome, Firefox, Safari, and Edge
3. **Mobile Testing**: Test on iOS and Android devices
4. **Form Validation**: Verify all form validations work
5. **Error Scenarios**: Test with invalid inputs and API failures
6. **Console Monitoring**: Check browser console for errors

## Common Tasks

### Adding a New Form Field
1. Add input element to `index.html`
2. Update form state saving in `script.js`
3. Update form state restoration in `script.js`
4. Add validation if required
5. Update API call if needed

### Modifying Meal Plan Display
1. Update rendering logic in `script.js`
2. Ensure icons are re-initialized with `initIcons()`
3. Test responsive layout on mobile
4. Verify PDF export still works

### Updating Serverless Function
1. Edit `netlify/functions/generate-plan.js`
2. Ensure CORS headers remain correct
3. Test locally using Netlify CLI
4. Update environment variables if needed
5. Deploy to Netlify

## Documentation Standards
- Update README.md for deployment changes
- Comment complex algorithms inline
- Use JSDoc for function documentation
- Keep TESTING_SUMMARY.md updated with test results
- Document API endpoint changes

## Known Limitations
- No automated test suite (manual testing only)
- No build system or bundler
- CDN dependencies (requires internet connection)
- Serverless function cold starts may cause delays (typically 1-3 seconds on first invocation)
- PDF generation limited by browser capabilities

## Resources
- [Netlify Functions Documentation](https://docs.netlify.com/functions/overview/)
- [Google Gemini API Reference](https://ai.google.dev/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [MDN Web Docs](https://developer.mozilla.org/)
