# React Router Design - Milestone 1

This document outlines the BrowserRouter structure for Quicksilver's Milestone 1 implementation.

## Design Philosophy

The routing structure follows a **mobile-first, conversation-centric** approach inspired by modern messaging apps like WhatsApp. The design prioritizes:

- **Simplicity**: Clear, intuitive URL patterns
- **Deep linking**: Every state should be URL-addressable
- **Progressive disclosure**: Navigate from list to detail seamlessly
- **Responsive**: Same routes work for mobile and desktop with different layouts

## Route Structure

### Public Routes (Unauthenticated)

```plaintext
/login                    - Login page
/register                 - Registration page (if supported)
/forgot-password          - Password recovery
```

### Protected Routes (Authenticated)

All protected routes require authentication and redirect to `/login` if not authenticated.

```plaintext
/                         - Redirect to /inbox (default)
/inbox                    - Inbox view (list of conversations)
/sent                     - Sent emails view
/drafts                   - Draft emails view
/trash                    - Trash/deleted emails view

/thread/:threadId         - Single conversation/thread view
/compose                  - Compose new email (modal/overlay on desktop, full page on mobile)
/compose?to=:email        - Compose with pre-filled recipient
/compose?reply=:threadId  - Reply to a thread
/compose?forward=:threadId - Forward an email

/profile                  - User profile and settings
```

## Future Considerations (Milestone 2+)

Routes to add in later milestones:

```plaintext
/search?q=:query          - Search results (Milestone 2)
/settings                 - Settings page (Milestone 2)
/settings/language        - Language settings (Milestone 2)
/settings/roles           - Role management (Milestone 2)
/calendar                 - Calendar view (Milestone 3)
/tasks                    - Task management (Milestone 3)
/analytics                - Analytics dashboard (Milestone 4)
```

## Security Considerations

1. **Protected Routes**: All email-related routes require authentication
2. **Thread Access**: Validate user has permission to access threadId
3. **HTTPS Only**: Ensure BrowserRouter is served over HTTPS in production
4. **Token Refresh**: Handle token expiration and refresh without losing navigation state
5. **XSS Protection**: Sanitize all URL parameters before rendering

## Performance Considerations

1. **Code Splitting**: Lazy load routes to reduce initial bundle size
2. **Prefetching**: Prefetch thread data when hovering over thread list items
3. **Caching**: Cache thread list and thread details with React Query or similar
4. **Optimistic Navigation**: Show loading states immediately when navigating
