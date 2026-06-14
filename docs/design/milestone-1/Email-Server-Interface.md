# Email Server Interface - Milestone 1

## Introduction

Quicksilver is designed as a unified email client that provides a consistent, modern interface across multiple email providers. Rather than being tied to a single service, Quicksilver can connect to any email service that supports IMAP/SMTP, including Gmail, Outlook, Yahoo, and custom mail servers.

**This document focuses on Milestone 1**, which establishes the foundational architecture for email provider integration. Milestone 1 delivers a working email client with direct IMAP/SMTP connections, allowing users to connect their email accounts and view/send messages. **This implementation is optimized for Vercel deployment**, using browser localStorage and serverless functions to eliminate database dependencies.

### Milestone 1 Goals

1. **User Registration & Authentication**: Allow users to register and log in to Quicksilver
2. **Email Service Configuration**: Collect email provider credentials during registration
3. **IMAP/SMTP Support**: Enable direct connections using app-specific passwords
4. **Basic Email Operations**: Read emails, send emails, basic folder management
5. **Provider Auto-Configuration**: Pre-populate settings for Gmail, Outlook, Yahoo
6. **Security Foundation**: Encrypt credentials at rest, use TLS for all connections
7. **Vercel Deployment**: Deploy as serverless application with no database dependencies

### Design Principles

1. **Simplicity First**: Get a working system with standard protocols (IMAP/SMTP)
2. **Provider Agnostic**: Support any email provider through standard protocols
3. **Security by Default**: Encrypt credentials at rest and use TLS for all communications
4. **User-Friendly Configuration**: Auto-populate settings for popular providers
5. **Standard Protocols**: Leverage IMAP/SMTP for maximum compatibility
6. **Vercel-Optimized**: Serverless architecture with browser-based storage, no database

### Milestone 1 Scope

This document covers the foundational implementation:

- **In Scope for Milestone 1:**
  - Direct IMAP/SMTP authentication with app-specific passwords
  - User registration with email service configuration
  - Browser localStorage for user profiles (no database required)
  - Vercel serverless functions for stateless API endpoints
  - Basic IMAP operations (list folders, fetch emails, mark read/unread)
  - Basic SMTP operations (send email, reply, forward)
  - Pre-configured settings for Gmail, Outlook, Yahoo
  - Security foundations (credential encryption, TLS)
  - One-click Vercel deployment

### Why Multiple Providers?

Supporting multiple email providers allows Quicksilver to:

- Give users freedom to use Gmail, Outlook, Yahoo, or any custom IMAP/SMTP provider
- Provide a unified interface regardless of email provider
- Ensure compatibility with any standard IMAP/SMTP email service
- Allow users to switch providers without changing their workflow

## Architecture Overview

Quicksilver's Milestone 1 architecture is optimized for Vercel deployment with three main layers:

1. **Frontend Layer**: React application deployed to Vercel's edge network
2. **Backend Layer**: Vercel Serverless Functions that handle IMAP/SMTP operations
3. **Email Provider Layer**: External email services (Gmail, Outlook, Yahoo, etc.)

All user data is stored in browser localStorage - no database server required. The serverless functions are completely stateless, receiving user credentials with each request.

### What We Build

**Quicksilver Frontend** (Custom Implementation)

- React-based single-page application
- Deployed to Vercel's global edge network
- UI components for email viewing, composition, and management
- Authentication flows and account setup wizards
- State management with localStorage persistence
- Responsive design for desktop and mobile

**Quicksilver Backend** (Custom Implementation)

- Vercel Serverless Functions (API routes)
- Stateless request handlers
- IMAP/SMTP connection management
- Request routing and middleware
- No database required - fully stateless architecture

**Data Storage** (Frontend localStorage)

- User profiles stored in browser localStorage
- Credentials encrypted client-side before storage
- Each user's data isolated in their browser

### What We Use (Third-Party)

**Email Providers** (External Services)

- Gmail, Outlook, Yahoo, and other IMAP/SMTP providers
- We connect to these; we don't build or control them
- Each provider has its own servers and infrastructure

**NPM Libraries** (Open Source Dependencies)

- `imap`: IMAP protocol implementation (we configure and use it)
- `nodemailer`: SMTP client for sending emails (we configure and use it)
- `mailparser`: Email parsing utilities (we use its parsing logic)
- `express`: Web framework (we build our API on top of it)
- `mongoose` or `sequelize`: Database ORM (we use it for data modeling)

**Infrastructure** (Deployment Environment)

- Vercel platform for static hosting and serverless functions
- Automatic HTTPS/TLS certificates
- No separate database hosting required

### Interaction Flow

```plaintext
┌─────────────────────┐
│                     │
│  Quicksilver UI     │  ← We Build This
│  (React Frontend)   │
│                     │
└──────────┬──────────┘
           │
           │ HTTPS/WebSocket
           │
┌──────────▼──────────┐
│                     │
│  Quicksilver API    │  ← We Build This
│  (Node.js Backend)  │
│                     │
└──────────┬──────────┘
           │
           │ Uses NPM Libraries ← Third-Party Code
           │ (imap, nodemailer, googleapis, etc.)
           │
           │ IMAP/SMTP/HTTPS
           │
┌──────────▼──────────┐
│                     │
│  Email Providers    │  ← Third-Party Services
│  (Gmail, Outlook,   │     (We Don't Control)
│   Yahoo, Custom)    │
│                     │
└─────────────────────┘
```

### Division of Responsibilities

| Component | Who Builds/Maintains | Our Responsibility |
|-----------|---------------------|-------------------|
| Frontend UI | Quicksilver Team | Design, implement, and maintain all React components |
| Backend API | Quicksilver Team | Implement serverless API routes and business logic |
| Data Storage | Browser localStorage | Store user profiles in browser (no database) |
| IMAP/SMTP Connections | NPM Libraries + Our Config | Configure connections, handle errors, manage sessions |
| Email Protocol | Standard (IETF) | Follow standards; use libraries for implementation |
| Email Servers | Email Providers | They host and maintain; we just connect to them |
| User Authentication | Frontend (localStorage) | Manage user session in browser |

## Standard Email Protocols

### IMAP (Internet Message Access Protocol)

IMAP is used for retrieving and managing emails from the server.

**Standard Operations**:

- Connect to IMAP server with TLS/SSL
- Authenticate using app-specific passwords
- List mailboxes/folders
- Fetch email messages and metadata
- Search emails
- Mark messages as read/unread, flagged, etc.
- Move messages between folders
- Delete messages

**Configuration Requirements**:

- IMAP server hostname and port (typically 993 for SSL)
- Authentication credentials (app passwords)
- TLS/SSL certificate validation

### SMTP (Simple Mail Transfer Protocol)

SMTP is used for sending emails.

**Standard Operations**:

- Connect to SMTP server with TLS/SSL
- Authenticate using app-specific passwords
- Send email messages
- Handle attachments
- Manage delivery status notifications

**Configuration Requirements**:

- SMTP server hostname and port (typically 587 for STARTTLS or 465 for SSL)
- Authentication credentials (app passwords)
- TLS/SSL configuration

## Authentication Architecture

Quicksilver uses direct IMAP/SMTP connections with user-provided app-specific passwords. This approach provides immediate functionality, maximum compatibility, and works with any standard email provider without requiring OAuth app registration.

### Direct IMAP/SMTP Authentication

**Purpose**: Direct connection to email servers using username/password  
**Requires**: User provides email address, password, and server settings during registration  
**Advantages**: Simple, works with any IMAP/SMTP provider, no OAuth setup required

#### User-Level Configuration (Stored in Profile)

Collected during registration/profile setup:

- **Email Address**: <user@example.com>
- **Email Password**: App-specific password or regular password
- **IMAP Settings**: Host, port, security (auto-populated for Gmail/Outlook/Yahoo)
- **SMTP Settings**: Host, port, security (auto-populated for Gmail/Outlook/Yahoo)

**Pre-configured Providers**: Gmail, Outlook, Yahoo (server settings auto-populated)  
**Custom Provider**: User manually enters IMAP/SMTP server details

#### Supported Authentication Methods

| Provider | Authentication Method | User Experience |
|----------|----------------------|-----------------|
| Gmail | App Password + IMAP/SMTP | Enter 16-char app password |
| Outlook | App Password + IMAP/SMTP | Enter app-specific password |
| Yahoo | IMAP/SMTP with App Password | Enter Yahoo app password |
| Custom | IMAP/SMTP with credentials | Enter server details and password |

## Gmail Integration

**Implementation**: Direct IMAP/SMTP using app-specific passwords

**User Setup Steps**:

1. Enable 2-Factor Authentication on Gmail account
2. Generate app-specific password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. Enter app password in Quicksilver registration form

### IMAP/SMTP Configuration

**IMAP Settings**:

- Server: `imap.gmail.com`
- Port: `993`
- Security: SSL/TLS
- Authentication: App-specific password

**SMTP Settings**:

- Server: `smtp.gmail.com`
- Port: `587` (STARTTLS) or `465` (SSL)
- Security: TLS/SSL
- Authentication: App-specific password

### Implementation Tasks

1. **IMAP Connection** ✅
   - Connect to `imap.gmail.com:993` with TLS
   - Authenticate using app-specific password
   - List folders/labels
   - Fetch email messages

2. **SMTP Connection** ✅
   - Connect to `smtp.gmail.com:587` with STARTTLS
   - Authenticate using app-specific password
   - Send emails with attachments

3. **Label Mapping** 🔄
   - Map Gmail labels to standard folders (INBOX, SENT, DRAFTS, TRASH)
   - Handle Gmail's "All Mail" folder

4. **Error Handling** 🔄
   - Handle authentication failures
   - Detect invalid app passwords
   - Display helpful error messages

## Outlook/Hotmail Integration

**Implementation**: Direct IMAP/SMTP using app-specific passwords

**User Setup Steps**:

1. Enable 2-Factor Authentication on Microsoft account
2. Generate app password in Microsoft account security settings
3. Enter app password in Quicksilver registration form

### IMAP/SMTP Configuration

**IMAP Settings**:

- Server: `outlook.office365.com`
- Port: `993`
- Security: SSL/TLS
- Authentication: App-specific password

**SMTP Settings**:

- Server: `smtp.office365.com`
- Port: `587`
- Security: STARTTLS
- Authentication: App-specific password

### Implementation Tasks

1. **IMAP Connection** ✅
   - Connect to `outlook.office365.com:993` with TLS
   - Authenticate using app-specific password
   - List folders
   - Fetch email messages
   - Support both personal and organizational accounts

2. **SMTP Connection** ✅
   - Connect to `smtp.office365.com:587` with STARTTLS
   - Authenticate using app-specific password
   - Send emails with attachments

3. **Folder Management** 🔄
   - Support Outlook folder hierarchy
   - Map to standard folder names

4. **Error Handling** 🔄
   - Handle authentication failures
   - Detect invalid app passwords
   - Display helpful error messages

## Server-Side Implementation

### Technology Stack

**Frontend**: React deployed on Vercel

**Backend**: Vercel Serverless Functions (Node.js)

**Email Libraries**:

- `imap`: For IMAP connections
- `nodemailer`: For SMTP sending
- `mailparser`: For parsing email content

**Storage**: Browser localStorage (no database)

### Data Storage (localStorage)

User profiles stored in browser `localStorage` - no database required:

```javascript
// Stored in localStorage as JSON
{
  // User Authentication (for Quicksilver app)
  id: String,                       // Generated UUID
  name: String,
  email: String,                    // Quicksilver account email
  
  // Email Service Configuration (collected at registration)
  emailServiceProvider: String,     // 'gmail', 'outlook', 'yahoo', 'custom'
  emailAddress: String,             // Actual email address (e.g., user@gmail.com)
  
  // Direct IMAP/SMTP Credentials (encrypted with Web Crypto API)
  credentials: {
    emailPassword: String,          // Encrypted - app-specific or email password
  },
  
  // IMAP Configuration (auto-populated for known providers, customizable for 'custom')
  imapConfig: {
    host: String,                   // e.g., 'imap.gmail.com'
    port: Number,                   // e.g., 993
    secure: Boolean                 // true for SSL/TLS
  },
  
  // SMTP Configuration (auto-populated for known providers, customizable for 'custom')
  smtpConfig: {
    host: String,                   // e.g., 'smtp.gmail.com'
    port: Number,                   // e.g., 587
    secure: Boolean                 // true for STARTTLS/SSL
  },
  
  // Sync and Status
  lastSync: Date,
  status: String,                   // 'active', 'auth_error', 'disconnected'
  createdAt: Date,
  updatedAt: Date
}

// Storage operations
localStorage.setItem('quicksilver_user', JSON.stringify(userProfile));
const userProfile = JSON.parse(localStorage.getItem('quicksilver_user'));
```

**Pre-configured Provider Settings:**

- **Gmail**: `imap.gmail.com:993`, `smtp.gmail.com:587`
- **Outlook**: `outlook.office365.com:993`, `smtp.office365.com:587`
- **Yahoo**: `imap.mail.yahoo.com:993`, `smtp.mail.yahoo.com:587`
- **Custom**: User-defined IMAP/SMTP settings

### API Endpoints (Vercel Serverless Functions)

```javascript
// All endpoints are stateless - user credentials passed with each request

// Email Service Testing
POST   /api/emails/test-connection     // Test IMAP/SMTP connection
GET    /api/emails/connection-status   // Check email service status

// Email operations (all require user config in request body/headers)
GET    /api/emails/folders              // List folders
GET    /api/emails/:folderId            // List emails in folder  
GET    /api/emails/:id                  // Get single email
POST   /api/emails/send                 // Send email
POST   /api/emails/:id/reply            // Reply to email
POST   /api/emails/:id/forward          // Forward email
PUT    /api/emails/:id/flag             // Update flags (read/unread)
DELETE /api/emails/:id                  // Delete email
```

**Request Format:**
Each API request includes user configuration (from localStorage):

```javascript
// Example request to list emails
POST /api/emails/folders
Headers: Content-Type: application/json
Body: {
  emailAddress: "user@gmail.com",
  credentials: { emailPassword: "encrypted_password" },
  imapConfig: { host: "imap.gmail.com", port: 993, secure: true }
}
```

### Security Considerations

1. **Credential Storage**
   - Encrypt user credentials using Web Crypto API before storing in localStorage
   - Use user-specific encryption keys derived from a passphrase
   - Credentials never stored in plain text
   - localStorage is per-origin (isolated between users)

2. **Data in Transit**
   - Enforce HTTPS for all API communications (Vercel automatic)
   - Use TLS 1.2 or higher for email server connections
   - Validate SSL certificates
   - Credentials encrypted even in API requests

3. **Serverless Security**
   - Each function invocation is isolated
   - No shared state between requests
   - Implement input validation on all endpoints
   - Rate limiting via Vercel configuration

4. **Browser Security**
   - Use HttpOnly cookies for any session tokens
   - Implement CSRF protection
   - Clear localStorage on logout
   - Warn users to logout on shared computers

## Configuration Management

### Environment Variables

```env
# Vercel Serverless Configuration
# No database credentials needed - using localStorage

# Server Configuration (local development only)
PORT=3001
NODE_ENV=development
```

### User-Level Configuration (Stored in localStorage)

These are **per-user** settings collected during registration or profile setup and stored in browser:

```javascript
// Collected in RegistrationForm/ProfileForm, stored in localStorage
{
  emailServiceProvider: "gmail" | "outlook" | "yahoo" | "custom",
  emailAddress: "user@gmail.com",
  
  // Direct IMAP/SMTP credentials (encrypted with Web Crypto API)
  credentials: {
    emailPassword: "user_encrypted_app_password"
  },
  
  // Auto-populated based on provider, or user-entered for custom
  imapConfig: { host: "imap.gmail.com", port: 993, secure: true },
  smtpConfig: { host: "smtp.gmail.com", port: 587, secure: true }
}
```

### Configuration Summary

| Setting | Scope | Where Stored | Purpose |
|---------|-------|--------------|----------|
| `emailAddress` | User-level | Browser localStorage | User's actual email address |
| `emailPassword` | User-level | Browser localStorage (encrypted) | User's app password or credentials |
| `imapConfig` | User-level | Browser localStorage | User's IMAP server settings |
| `smtpConfig` | User-level | Browser localStorage | User's SMTP server settings |
| User Profile | User-level | Browser localStorage | Complete user configuration |

### Provider Setup Resources

- **Gmail App Passwords**: [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
- **Microsoft App Passwords**: Microsoft Account Security Settings
- **Yahoo App Passwords**: Yahoo Account Security Settings

## User Registration & Profile Management

### Registration Flow

When users register for Quicksilver, they provide both account credentials (for Quicksilver itself) and email service configuration (for connecting to their email provider).

#### Registration Form Fields

**Quicksilver Account Information:**

- Full Name
- Email Address (for Quicksilver account - can be different from email service)
- Password (for Quicksilver login)
- Confirm Password

**Email Service Configuration:**

- Email Service Provider (dropdown: Gmail, Outlook, Yahoo, Custom)
- Email Address (actual email to connect to, e.g., <user@gmail.com>)
- Email Password / App Password
- IMAP/SMTP Settings (auto-populated for Gmail/Outlook/Yahoo, manual for Custom)

#### Auto-Configuration by Provider

When a user selects a known provider, IMAP/SMTP settings are automatically populated:

**Gmail:**

```
IMAP: imap.gmail.com:993 (SSL)
SMTP: smtp.gmail.com:587 (STARTTLS)
```

**Outlook:**

```
IMAP: outlook.office365.com:993 (SSL)
SMTP: smtp.office365.com:587 (STARTTLS)
```

**Yahoo:**

```
IMAP: imap.mail.yahoo.com:993 (SSL)
SMTP: smtp.mail.yahoo.com:587 (STARTTLS)
```

**Custom:**

- User manually enters IMAP host, port, and security settings
- User manually enters SMTP host, port, and security settings

#### Validation

Registration validates:

- All required fields are filled
- Email formats are valid
- Password meets minimum length requirements (6+ characters)
- Passwords match
- Email service configuration is complete

#### Backend Processing

On registration submission:

1. Validate all input data
2. Generate unique user ID (UUID)
3. Encrypt sensitive data using Web Crypto API:
   - Email password/app password encrypted client-side
4. Store user profile in localStorage as JSON
5. Optionally: Test IMAP/SMTP connection before completing registration
6. Set authentication state in AuthContext
7. Redirect to inbox

### Profile Management

Users can update their email service configuration after registration via the Profile page:

- Change email service provider
- Update email address and password
- Modify IMAP/SMTP settings (for custom configurations)
- Test connection before saving changes
- Change Quicksilver account password

### Milestone 1: Vercel Serverless Architecture

Milestone 1 implements a **Vercel-native serverless architecture** with browser-based storage.

**Why Vercel for Milestone 1:**

✅ **Advantages:**

- Zero database setup - use localStorage instead
- Serverless functions automatically scale
- One-click deployment from GitHub
- Automatic HTTPS and global CDN
- No infrastructure management required
- Free tier perfect for development and testing
- Fast iteration and deployment

⚠️ **Trade-offs:**

- Requires app-specific passwords for Gmail/Outlook (extra user setup step)
- IMAP/SMTP may be slower for very large mailboxes
- Manual refresh required (no automatic push notifications)
- User data limited to single browser (until cloud sync added later)
- Serverless function cold starts (typically 1-2 seconds)

## Testing Strategy

### Testing Requirements

1. **Unit Tests**
   - User registration validation
   - Credential encryption/decryption (Web Crypto API)
   - Email address validation
   - IMAP/SMTP configuration logic
   - localStorage operations

2. **Integration Tests**
   - IMAP connections with Gmail/Outlook/Yahoo app passwords
   - SMTP sending via Gmail/Outlook/Yahoo
   - Custom IMAP/SMTP server connections
   - Serverless API endpoints (local and deployed)
   - Email operations (fetch, send, reply, forward)
   - localStorage persistence and retrieval

3. **End-to-End Tests**
   - Complete registration flow with email configuration
   - Login and view inbox
   - Compose and send email
   - Reply to and forward emails
   - Move and delete emails
   - Update profile and email settings

4. **Security Tests**
   - Verify credentials are encrypted in localStorage
   - Verify TLS/SSL connections to email servers
   - Test input validation and sanitization
   - Verify data isolation in browser storage
   - Test logout clears sensitive data

## Implementation Plan

### Phase 1: Frontend Foundation ✅ COMPLETED

- ✅ Set up React frontend with Material-UI
- ✅ Implement user registration with email service configuration
- ✅ Create profile management forms
- ✅ Implement basic authentication framework (AuthContext)
- ✅ Auto-populate IMAP/SMTP settings for Gmail, Outlook, Yahoo
- ✅ Support custom IMAP/SMTP configuration

### Phase 2: Backend Infrastructure 🔄 IN PROGRESS

- 🔄 Set up Vercel serverless functions (API routes)
- 🔄 Implement stateless API endpoints
- 🔄 Create IMAP/SMTP proxy functions
- 🔄 Implement request validation
- 🔄 Set up CORS and security headers
- 🔄 Create basic API error handling

### Phase 3: IMAP Integration 📋 TODO

- 📋 Implement IMAP connection manager
- 📋 Connect to Gmail/Outlook/Yahoo using app passwords
- 📋 List folders/mailboxes
- 📋 Fetch email messages and metadata
- 📋 Mark emails as read/unread
- 📋 Move emails between folders
- 📋 Delete emails
- 📋 Handle IMAP errors gracefully

### Phase 4: SMTP Integration 📋 TODO

- 📋 Implement SMTP connection manager
- 📋 Send new emails
- 📋 Reply to emails
- 📋 Forward emails
- 📋 Handle attachments
- 📋 Handle SMTP errors gracefully

### Phase 5: UI Email Operations 📋 TODO

- 📋 Inbox view with email list
- 📋 Email detail/reading view
- 📋 Compose email interface
- 📋 Reply/forward interface
- 📋 Folder navigation
- 📋 Basic error messages and loading states

### Phase 6: Testing & Validation 📋 TODO

- ✅ Test with Gmail app passwords
- ✅ Test with Outlook app passwords
- ✅ Test with Yahoo app passwords
- ✅ Test with custom IMAP/SMTP servers
- ✅ Verify credential encryption in localStorage
- ✅ Test error handling flows
- ✅ Deploy to Vercel and test production environment
- ✅ Verify serverless function performance
- ✅ Test across different browsers (Chrome, Firefox, Safari)

### Success Criteria

- Users can register and configure email accounts
- Users can view their inbox and read emails
- Users can compose and send new emails
- Users can reply to and forward emails
- All credentials are encrypted at rest in localStorage
- All connections use TLS/SSL
- Application successfully deploys to Vercel
- No database or additional infrastructure required
