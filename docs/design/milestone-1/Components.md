# Component Architecture - Milestone 1

This document outlines the component hierarchy for Quicksilver, organized by component type. All components consume data from React DataContext and do not handle data loading directly.

## Component Types

- **Pages**: Top-level components representing routes
- **Moles** (Molecules): Complex components composed of atoms and other moles
- **Atoms**: Simple, standalone UI elements that don't contain other molecules

---

## Pages

Pages correspond to routes defined in the React Router configuration.

### Authentication Pages (`LoginPage`, `RegisterPage`, `ForgotPasswordPage`)

**Paths**: `/login`, `/register`, `/forgot-password`

Authentication-related pages for user login, registration, and password recovery.

**Props**: None (uses AuthContext)

**Common Composition**:

- Respective form (mole): LoginForm, RegistrationForm, or PasswordResetForm
- Button (atom)
- Links to other auth pages

**Variants**:

- **LoginPage**: Login form with links to register/forgot password
- **RegisterPage**: Registration form with link to login
- **ForgotPasswordPage**: Password reset form with link to login

---

### Email List Pages (`InboxPage`, `SentPage`, `DraftsPage`, `TrashPage`)

**Paths**: `/inbox`, `/sent`, `/drafts`, `/trash`

Email list views showing different categories of threads/conversations.

**Props**: None (uses DataContext)

**Common Composition**:

- Header (mole)
- ThreadList (mole)
- EmptyState (atom) - when no threads

**Variant-Specific**:

- **InboxPage**:
  - SearchBar (mole)
  - FloatingActionButton (atom) - compose button (mobile)
  - Data: `threads`, `unreadCount`
- **SentPage**:
  - SearchBar (mole)
  - Data: `sentThreads`
- **DraftsPage**:
  - Data: `drafts`
- **TrashPage**:
  - Data: `trashedThreads`

---

### `ThreadPage`

**Path**: `/thread/:threadId`

Single conversation/thread view with messages.

**Props**: None (uses DataContext, gets threadId from useParams)

**Composition**:

- ThreadHeader (mole)
- ThreadView (mole)
- MessageComposer (mole)
- LoadingSpinner (atom) - while loading

**Data from Context**:

- `getThread(threadId)` - thread details
- `getMessages(threadId)` - messages in thread

**Mobile Specific**:

- Back button in header
- Full-screen view

---

### `ComposePage`

**Path**: `/compose`

Compose new email (full page on mobile, modal on desktop).

**Props**: None (uses DataContext, query params for pre-fill)

**Composition**:

- ComposeHeader (mole)
- ComposeForm (mole)
- AttachmentList (mole)

**Data from Context**:

- `contacts` - for recipient suggestions
- `saveDraft()` - save draft action
- `sendEmail()` - send email action

---

### `ProfilePage`

**Path**: `/profile`

User profile and basic settings.

**Props**: None (uses AuthContext, DataContext)

**Composition**:

- ProfileHeader (mole)
- ProfileForm (mole)
- Button (atom)

**Data from Context**:

- `currentUser` - user information
- `updateProfile()` - update action

---

### `NotFoundPage`

**Path**: `*`

404 error page.

**Props**: None

**Composition**:

- EmptyState (atom)
- Button (atom) - back to inbox

---

## Moles (Molecules)

Complex components composed of atoms and other moles.

### `AppLayout`

Main application layout wrapper for authenticated pages.

**Props**:

- `children` - page content

**Composition**:

- Sidebar (mole) - desktop only
- Header (mole) - mobile only
- Main content area
- MobileNavBar (mole) - mobile only

**Responsive**:

- Desktop: Sidebar + content
- Mobile: Top header + content + bottom nav

---

### `Sidebar`

Desktop navigation sidebar.

**Props**: None (uses router location)

**Composition**:

- Logo/Brand (atom)
- NavItem (atom) × multiple
- UserProfile (atom)
- Button (atom) - compose

**Navigation Items**:

- Inbox (with unread badge)
- Sent
- Drafts
- Trash

---

### `Header`

Top header bar (mobile) or page header (desktop).

**Props**:

- `title` - page title
- `showBack` - show back button (mobile)
- `actions` - array of action buttons

**Composition**:

- IconButton (atom) - menu/back
- Heading (atom) - title
- IconButton (atom) × multiple - actions

---

### `MobileNavBar`

Bottom navigation bar for mobile.

**Props**: None (uses router location)

**Composition**:

- NavItem (atom) × 4-5 items
- Badge (atom) - for unread counts

---

### `SearchBar`

Search input with filtering.

**Props**:

- `onSearch` - search callback
- `placeholder` - input placeholder

**Composition**:

- Input (atom)
- Icon (atom) - search icon
- IconButton (atom) - clear button

---

### `ThreadList`

List of email threads/conversations.

**Props**:

- `threads` - array of thread objects
- `onThreadClick` - thread selection callback
- `selectedThreadId` - currently selected thread (desktop)

**Composition**:

- ThreadListItem (mole) × multiple
- LoadingSpinner (atom)
- EmptyState (atom)

**Features**:

- Infinite scroll/pagination
- Selection state (desktop)
- Swipe actions (mobile)

---

### `ThreadListItem`

Single thread item in list.

**Props**:

- `thread` - thread object
  - `id`
  - `subject`
  - `participants`
  - `lastMessage`
  - `lastMessageTime`
  - `unreadCount`
  - `hasAttachment`
- `isSelected` - selection state
- `onClick` - click callback

**Composition**:

- Avatar (atom) - sender avatar
- ThreadSummary (atom)
- Timestamp (atom)
- Badge (atom) - unread count
- Icon (atom) - attachment indicator

**States**:

- Selected (desktop)
- Unread (bold text)
- Hover

---

### `ThreadView`

Full conversation view with all messages.

**Props**:

- `thread` - thread object
- `messages` - array of message objects

**Composition**:

- ThreadHeader (mole)
- MessageGroup (mole) × multiple
- LoadingSpinner (atom)

**Features**:

- Grouped by sender/time
- Scroll to bottom
- Load more (if paginated)

---

### `ThreadHeader`

Header for thread view.

**Props**:

- `thread` - thread object

**Composition**:

- IconButton (atom) - back (mobile)
- Avatar (atom) - participants
- ParticipantList (atom)
- ThreadActions (mole)

---

### `ThreadActions`

Action buttons for thread.

**Props**:

- `threadId` - thread ID
- `onAction` - action callback

**Composition**:

- IconButton (atom) × multiple
  - Archive
  - Delete
  - Mark unread
  - More options

---

### `MessageGroup`

Group of messages from same sender/time period.

**Props**:

- `messages` - array of consecutive messages from same sender
- `sender` - sender object

**Composition**:

- Avatar (atom) - shown once for group
- MessageBubble (mole) × multiple
- Timestamp (atom) - shown for group

---

### `MessageBubble`

Single message bubble (WhatsApp-style).

**Props**:

- `message` - message object
  - `id`
  - `content`
  - `sender`
  - `timestamp`
  - `attachments`
  - `isRead`
- `isSent` - is sent by current user

**Composition**:

- MessageContent (atom)
- AttachmentPreview (mole) - if has attachments
- MessageMeta (atom) - time, read status

**States**:

- Sent (align right, different color)
- Received (align left)
- Read/unread indicator

---

### `MessageComposer`

Reply/compose box within thread.

**Props**:

- `threadId` - thread ID
- `onSend` - send callback
- `placeholder` - input placeholder

**Composition**:

- TextArea (atom) - message input
- IconButton (atom) × multiple
  - Attach file
  - Emoji
  - Send
- AttachmentList (mole) - if attachments added

**Features**:

- Auto-resize textarea
- Enter to send (Shift+Enter for new line)
- Draft auto-save
- Character count (if needed)

---

### `ComposeForm`

Full compose email form.

**Props**:

- `initialTo` - pre-filled recipient
- `initialSubject` - pre-filled subject
- `initialBody` - pre-filled body
- `onSend` - send callback
- `onSaveDraft` - save draft callback

**Composition**:

- RecipientInput (mole)
- Input (atom) - subject
- TextArea (atom) - body
- AttachmentList (mole)
- ComposeActions (mole)

---

### `ComposeHeader`

Header for compose view.

**Props**:

- `onClose` - close callback
- `onSend` - send callback

**Composition**:

- IconButton (atom) - close/back
- Heading (atom) - "New Message"
- Button (atom) - send

---

### `ComposeActions`

Action buttons for compose.

**Props**:

- `onAttach` - attach file
- `onSaveDraft` - save draft
- `onDiscard` - discard

**Composition**:

- IconButton (atom) × multiple
- Button (atom) × multiple

---

### `RecipientInput`

Recipient input with autocomplete.

**Props**:

- `value` - array of recipients
- `onChange` - change callback
- `suggestions` - array of contact suggestions

**Composition**:

- RecipientChip (atom) × multiple
- Input (atom)
- Dropdown (atom) - suggestions

**Features**:

- Multiple recipients
- Autocomplete from contacts
- Email validation
- Chip removal

---

### `AttachmentList`

List of file attachments.

**Props**:

- `attachments` - array of attachment objects
- `onRemove` - remove callback (if editable)
- `editable` - can remove attachments

**Composition**:

- AttachmentPreview (mole) × multiple

---

### `AttachmentPreview`

Preview of single attachment.

**Props**:

- `attachment` - attachment object
  - `id`
  - `name`
  - `size`
  - `type`
  - `url`
- `onRemove` - remove callback (optional)
- `onDownload` - download callback

**Composition**:

- Icon (atom) - file type icon
- AttachmentInfo (atom) - name, size
- IconButton (atom) - remove/download

**File Types**:

- Image: show thumbnail
- PDF: show icon
- Other: show generic icon

---

### `LoginForm`

Login form fields and validation.

**Props**:

- `onSubmit` - submit callback
- `loading` - loading state

**Composition**:

- Input (atom) - email
- Input (atom) - password
- Checkbox (atom) - remember me
- Button (atom) - submit
- ErrorMessage (atom)

---

### `RegistrationForm`

Registration form fields.

**Props**:

- `onSubmit` - submit callback
- `loading` - loading state

**Composition**:

- Input (atom) × multiple (email, name, password, confirm)
- Button (atom) - submit
- ErrorMessage (atom)

---

### `PasswordResetForm`

Password reset form.

**Props**:

- `onSubmit` - submit callback
- `loading` - loading state

**Composition**:

- Input (atom) - email
- Button (atom) - submit
- ErrorMessage (atom)

---

### `ProfileHeader`

Profile page header with avatar.

**Props**:

- `user` - user object

**Composition**:

- Avatar (atom) - large
- Heading (atom) - user name
- Text (atom) - user email

---

### `ProfileForm`

Profile edit form.

**Props**:

- `user` - user object
- `onSubmit` - submit callback

**Composition**:

- Input (atom) × multiple
- Button (atom) - save
- ErrorMessage (atom)

---

## Atoms

Simple, standalone UI elements.

### `Button`

Standard button component.

**Props**:

- `variant` - 'primary' | 'secondary' | 'text' | 'danger'
- `size` - 'small' | 'medium' | 'large'
- `disabled` - boolean
- `loading` - boolean
- `onClick` - click handler
- `children` - button text/content

**Variants**:

- Primary: filled, main action
- Secondary: outlined
- Text: no border
- Danger: red, destructive action

---

### `IconButton`

Button with icon only.

**Props**:

- `icon` - icon name/component
- `onClick` - click handler
- `disabled` - boolean
- `size` - 'small' | 'medium' | 'large'
- `ariaLabel` - accessibility label

---

### `Input`

Text input field.

**Props**:

- `type` - input type
- `value` - input value
- `onChange` - change handler
- `placeholder` - placeholder text
- `disabled` - boolean
- `error` - error message
- `label` - input label

**Types**: text, email, password, search

---

### `TextArea`

Multi-line text input.

**Props**:

- `value` - text value
- `onChange` - change handler
- `placeholder` - placeholder text
- `disabled` - boolean
- `rows` - number of rows
- `maxLength` - character limit
- `autoResize` - auto-resize to content

---

### `Avatar`

User avatar/profile picture.

**Props**:

- `src` - image URL
- `name` - user name (for fallback initials)
- `size` - 'small' | 'medium' | 'large'
- `status` - 'online' | 'offline' | 'away' (optional)

**Fallback**: Shows initials if no image

---

### `Badge`

Notification badge (e.g., unread count).

**Props**:

- `count` - number to display
- `max` - maximum number (shows 99+)
- `variant` - 'primary' | 'error'
- `dot` - show as dot instead of number

---

### `Icon`

Icon component.

**Props**:

- `name` - icon name
- `size` - icon size
- `color` - icon color

**Icon Set**: Material Icons or similar

---

### `Checkbox`

Checkbox input.

**Props**:

- `checked` - boolean
- `onChange` - change handler
- `disabled` - boolean
- `label` - checkbox label

---

### `Dropdown`

Dropdown/select menu.

**Props**:

- `options` - array of options
- `value` - selected value
- `onChange` - change handler
- `placeholder` - placeholder text

---

### `LoadingSpinner`

Loading indicator.

**Props**:

- `size` - 'small' | 'medium' | 'large'
- `color` - spinner color

---

### `EmptyState`

Empty state placeholder.

**Props**:

- `icon` - icon to display
- `title` - main message
- `description` - secondary message
- `action` - optional action button

**Use Cases**:

- No threads in inbox
- No search results
- No drafts

---

### `ErrorMessage`

Error message display.

**Props**:

- `message` - error text
- `onDismiss` - dismiss handler (optional)

---

### `Timestamp`

Formatted timestamp display.

**Props**:

- `date` - Date object or timestamp
- `format` - 'relative' | 'absolute' | 'time-only'

**Formats**:

- Relative: "2 hours ago", "Yesterday"
- Absolute: "Jan 5, 2026"
- Time-only: "2:30 PM"

---

### `NavItem`

Navigation item for sidebar/nav bar.

**Props**:

- `icon` - navigation icon
- `label` - item label
- `path` - route path
- `badge` - badge count (optional)
- `isActive` - active state

---

### `RecipientChip`

Chip for recipient in compose.

**Props**:

- `email` - email address
- `name` - contact name (optional)
- `onRemove` - remove callback

---

### `FloatingActionButton`

FAB for primary action (compose on mobile).

**Props**:

- `icon` - button icon
- `onClick` - click handler
- `ariaLabel` - accessibility label

---

### `Heading`

Text heading component.

**Props**:

- `level` - 1-6 (h1-h6)
- `children` - heading text

---

### `Text`

Text display component.

**Props**:

- `variant` - 'body' | 'caption' | 'label'
- `color` - text color
- `children` - text content

---

### `MessageContent`

Formatted message content display.

**Props**:

- `content` - message text (may contain HTML/markdown)

**Features**:

- Sanitize HTML
- Linkify URLs
- Basic formatting (bold, italic)

---

### `MessageMeta`

Message metadata (time, read status).

**Props**:

- `timestamp` - message time
- `isRead` - read status
- `isSent` - is sent by current user

**Composition**:

- Timestamp (atom)
- Icon (atom) - checkmark for read

---

### `ThreadSummary`

Thread summary text in list item.

**Props**:

- `subject` - thread subject
- `preview` - last message preview
- `participants` - participant names

**Features**:

- Truncate long text
- Highlight unread (bold)

---

### `AttachmentInfo`

Attachment information display.

**Props**:

- `name` - file name
- `size` - file size in bytes

**Features**:

- Format file size (KB, MB)
- Truncate long names

---

### `ParticipantList`

List of thread participants.

**Props**:

- `participants` - array of participant objects
- `max` - max to show before "+N more"

---

## Data Context Structure

Components consume data from these contexts:

### `AuthContext`

```javascript
{
  currentUser: User,
  isAuthenticated: boolean,
  login: (email, password) => Promise,
  logout: () => void,
  register: (userData) => Promise,
  updateProfile: (userData) => Promise
}
```

### `DataContext`

```javascript
{
  threads: Thread[],
  sentThreads: Thread[],
  drafts: Draft[],
  trashedThreads: Thread[],
  contacts: Contact[],
  getThread: (id) => Thread,
  getMessages: (threadId) => Message[],
  sendEmail: (emailData) => Promise,
  saveDraft: (draftData) => Promise,
  deleteThread: (threadId) => Promise,
  markAsRead: (threadId) => Promise,
  // ... other data operations
}
```

---

## Component Directory Structure

```
src/
  view/
    pages/
      LoginPage.js
      InboxPage.js
      ThreadPage.js
      ComposePage.js
      ProfilePage.js
      ...
    moles/
      AppLayout.js
      Sidebar.js
      Header.js
      ThreadList.js
      ThreadListItem.js
      ThreadView.js
      MessageBubble.js
      MessageComposer.js
      ComposeForm.js
      ...
    atoms/
      Button.js
      Input.js
      TextArea.js
      Avatar.js
      Badge.js
      Icon.js
      LoadingSpinner.js
      EmptyState.js
      ...
```

---

## Implementation Priority

### Phase 1 - Foundation

1. Atoms: Button, Input, Avatar, Icon, LoadingSpinner
2. Authentication pages: LoginPage, LoginForm
3. AppLayout, Sidebar, Header

### Phase 2 - Core Email

1. ThreadList, ThreadListItem
2. InboxPage, SentPage
3. ThreadView, MessageBubble
4. ThreadPage

### Phase 3 - Composition

1. ComposeForm, MessageComposer
2. RecipientInput, AttachmentPreview
3. ComposePage

### Phase 4 - Polish

1. ProfilePage, ProfileForm
2. EmptyState, ErrorMessage
3. Mobile-specific components
4. Responsive refinements
