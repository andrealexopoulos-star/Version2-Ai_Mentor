# Mobile Device Testing Checklist
## Strategy Squad - Supabase OAuth Authentication

**Test URL:** https://beta.thestrategysquad.com

**Date:** _____________
**Device:** _____________
**OS:** _____________
**Browser:** _____________

---

## PRE-TEST SETUP

- [ ] Use **incognito/private browsing mode** (to avoid cached sessions)
- [ ] Ensure stable internet connection
- [ ] Have a Google account ready for testing
- [ ] Have a Microsoft account ready for testing (Hotmail, Outlook, or work account)
- [ ] Clear browser data if testing multiple times

---

## TEST 1: LANDING PAGE (/)

### Navigation & Layout
- [ ] Page loads within 3 seconds
- [ ] No horizontal scrolling
- [ ] All text is readable (not too small)
- [ ] Logo visible at top
- [ ] Navigation menu accessible

### Header Navigation
- [ ] Tap "Log In" button → Goes to /login-supabase
- [ ] Tap "Start Free" button → Goes to /register-supabase
- [ ] Tap "Pricing" link (if visible) → Goes to /pricing
- [ ] All buttons are large enough to tap easily (thumb-friendly)

### Hero Section
- [ ] Headline is visible and readable
- [ ] Subtext is visible
- [ ] Primary CTA button is visible
- [ ] Tap primary CTA → Goes to /register-supabase
- [ ] Button is at least 48px tall (easy to tap)

### Features Section
- [ ] Scroll down to features
- [ ] All 5 feature cards visible
- [ ] Cards display properly on mobile
- [ ] Icons visible

### Pricing Section
- [ ] Scroll to pricing
- [ ] 3 pricing cards visible
- [ ] Cards stack vertically on mobile (not side-by-side)
- [ ] Tap "Get Started" on FREE plan → Goes to /register-supabase
- [ ] Tap "Get Started" on PROFESSIONAL plan → Goes to /register-supabase
- [ ] Tap "Get Started" on ENTERPRISE plan → Goes to /register-supabase

### Footer
- [ ] Scroll to footer
- [ ] Footer links visible
- [ ] Tap "Pricing" → Goes to /pricing
- [ ] Tap "Terms & Conditions" → Goes to /terms
- [ ] Tap "Privacy Policy" → Visible
- [ ] Copyright text visible

### Bottom CTA
- [ ] Bottom CTA button visible before footer
- [ ] Tap button → Goes to /register-supabase

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 2: REGISTRATION PAGE (/register-supabase)

### Page Load & Layout
- [ ] Page loads properly
- [ ] No horizontal scroll
- [ ] Left side (form) visible
- [ ] Right side (blue background with text) visible OR hidden on mobile
- [ ] "Back to home" link visible at top

### OAuth Buttons
- [ ] "Continue with Google" button visible
- [ ] Google logo shows in button
- [ ] Button is large (easy to tap)
- [ ] "Continue with Microsoft" button visible
- [ ] Microsoft logo shows in button
- [ ] Both buttons are full-width on mobile
- [ ] "Or register with email" divider visible

### Form Fields
- [ ] "Full Name" field visible with red asterisk (required)
- [ ] "Email" field visible with red asterisk
- [ ] "Company Name" field visible (optional)
- [ ] "Industry" field visible (optional)
- [ ] "Password" field visible with red asterisk
- [ ] Password has eye icon for show/hide
- [ ] "Minimum 6 characters" helper text visible
- [ ] All fields have proper spacing (not cramped)
- [ ] Fields are at least 48px tall (easy to tap)

### Form Validation
- [ ] Tap "Create account" with empty form → Shows error
- [ ] Enter only full name → Button stays disabled
- [ ] Enter full name + invalid email (e.g., "notanemail") → Try submit → Error shown
- [ ] Enter full name + valid email + password (4 chars) → Button disabled
- [ ] Enter full name + valid email + password (6+ chars) → Button enabled
- [ ] Tap password eye icon → Password becomes visible
- [ ] Tap eye icon again → Password hidden

### Navigation Links
- [ ] Tap "Back to home" → Goes to landing page (/)
- [ ] Tap "Already have an account? Sign in" → Goes to /login-supabase

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 3: LOGIN PAGE (/login-supabase)

### Page Load & Layout
- [ ] Page loads properly
- [ ] No horizontal scroll
- [ ] "Welcome back" headline visible
- [ ] "Sign in to your account" subtext visible

### OAuth Buttons
- [ ] "Continue with Google" button visible and tappable
- [ ] "Continue with Microsoft" button visible and tappable
- [ ] Both buttons full-width on mobile
- [ ] Buttons have good spacing
- [ ] "Or continue with email" divider visible

### Form Fields
- [ ] Email field visible
- [ ] Password field visible
- [ ] Password show/hide toggle present
- [ ] "Sign in" button visible
- [ ] All fields properly sized for mobile

### Form Validation
- [ ] Try to submit with empty fields → Error shown
- [ ] Enter email only → Still shows error
- [ ] Enter invalid email → Error shown
- [ ] Password toggle works (show/hide)

### Navigation Links
- [ ] Tap "Back to home" → Goes to /
- [ ] Tap "Don't have an account? Sign up" → Goes to /register-supabase

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 4: GOOGLE OAUTH FLOW (COMPLETE END-TO-END)

### Initial Click
- [ ] From /register-supabase, tap "Continue with Google"
- [ ] Confirmation dialog appears with message:
      "You will be redirected to Google to securely sign in..."
- [ ] Dialog shows checkmarks (Create account, Connect identity, Keep data secure)
- [ ] Tap "OK" in dialog

### Google Authentication
- [ ] Redirects to Google sign-in page (accounts.google.com)
- [ ] Google page loads properly on mobile
- [ ] Account picker shows (lists your Google accounts)
- [ ] Tap your Google account
- [ ] If first time: Consent screen appears asking for permissions
- [ ] Tap "Continue" or "Allow" on consent screen

### Callback & Redirect
- [ ] Redirects back to your app at /auth/callback
- [ ] Briefly see "Completing sign in..." message (1-2 seconds)
- [ ] Spinner/loading indicator visible
- [ ] Redirects to either:
      - /onboarding (if new user)
      - /advisor (if existing user)

### Post-Login Experience
- [ ] Onboarding wizard loads (if new user) OR
- [ ] Advisor dashboard loads (if existing user)
- [ ] Sidebar visible
- [ ] User menu/profile visible in top-right
- [ ] No error messages
- [ ] No blank screens

### Verify in Supabase
- [ ] Open Supabase Dashboard on computer
- [ ] Go to Authentication → Users
- [ ] Verify your account appears in the list
- [ ] Check email matches your Google account

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 5: MICROSOFT OAUTH FLOW (COMPLETE END-TO-END)

### Initial Click
- [ ] Logout first (or use different browser/incognito)
- [ ] From /register-supabase, tap "Continue with Microsoft"
- [ ] Confirmation dialog appears
- [ ] Tap "OK"

### Microsoft Authentication
- [ ] Redirects to Microsoft sign-in (login.microsoftonline.com)
- [ ] Microsoft page loads on mobile
- [ ] Account picker shows your Microsoft accounts
- [ ] Tap your Microsoft account (Hotmail, Outlook, or work email)
- [ ] Enter password if prompted
- [ ] If first time: Consent screen appears
- [ ] Tap "Accept" on consent screen

### Callback & Redirect
- [ ] Redirects back to /auth/callback
- [ ] See "Completing sign in..." message
- [ ] Redirects to /onboarding or /advisor

### Post-Login Experience
- [ ] Dashboard loads properly
- [ ] Sidebar visible
- [ ] User menu visible
- [ ] No errors

### Verify in Supabase
- [ ] Check Supabase Dashboard → Authentication → Users
- [ ] Verify Microsoft account appears
- [ ] Email should match your Microsoft account

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 6: ONBOARDING WIZARD (If Triggered)

### Step 1: Business Stage Selection
- [ ] Onboarding wizard loads
- [ ] Progress indicator visible at top
- [ ] "Select your business stage" heading visible
- [ ] 3 stage cards visible:
      - Business Idea
      - Startup
      - Established Business
- [ ] Cards are tappable
- [ ] Tap a stage → Card highlights/selects
- [ ] "Next" button appears or becomes enabled
- [ ] Tap "Next" → Proceeds to next step

### Step 2: Business Profile
- [ ] Form fields visible:
      - Business Name
      - Industry
      - Target Country
      - Mission Statement
- [ ] Fields are properly sized for mobile
- [ ] Can type in all fields
- [ ] "Next" button visible
- [ ] Tap "Next" → Proceeds

### Step 3: Focus Areas
- [ ] Multiple focus area cards visible:
      - Growth & Strategy
      - Operations
      - Financial
      - Marketing & Sales
      - Team & Leadership
- [ ] Can select multiple areas (tap to select/deselect)
- [ ] Selected areas highlight
- [ ] "Complete Setup" or "Finish" button visible
- [ ] Tap finish button

### Onboarding Completion
- [ ] Loading state shown briefly
- [ ] Success message appears
- [ ] Redirects to /advisor
- [ ] Dashboard loads successfully
- [ ] No errors during save

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 7: ADVISOR DASHBOARD (After Login)

### Layout & Navigation
- [ ] Sidebar visible on mobile (or hamburger menu)
- [ ] Top bar visible with user info
- [ ] "MyIntel" menu item visible
- [ ] "MyAdvisor" menu item visible (highlighted)
- [ ] "MySoundboard" menu item visible
- [ ] Profile dropdown/menu accessible

### Advisor Interface
- [ ] Main chat area visible
- [ ] Focus area selection cards visible:
      - Growth & Strategy
      - Operations
      - Financial
      - Marketing & Sales
      - Team & Leadership
- [ ] Cards are tappable
- [ ] Message input field visible at bottom
- [ ] Message input is properly sized
- [ ] Send button visible

### Try Using Advisor (Basic Test)
- [ ] Tap in message field → Keyboard appears
- [ ] Type: "What should I focus on?"
- [ ] Tap send button
- [ ] Loading indicator appears
- [ ] AI response appears (may take 5-10 seconds)
- [ ] Response is readable
- [ ] Can scroll through response

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 8: LOGOUT FLOW

### Logout Process
- [ ] Find user menu/profile icon (usually top-right)
- [ ] Tap profile menu
- [ ] Dropdown menu appears
- [ ] "Logout" option visible
- [ ] Tap "Logout"

### After Logout
- [ ] Redirects to landing page (/)
- [ ] NOT stuck on login page
- [ ] No errors shown
- [ ] Can navigate normally

### Re-Login Test
- [ ] Tap "Log In" from landing
- [ ] OAuth buttons still visible
- [ ] Can log back in with same account

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 9: EMAIL/PASSWORD REGISTRATION (Alternative Flow)

### Registration
- [ ] Go to /register-supabase
- [ ] Scroll past OAuth buttons to email form
- [ ] Fill in all fields:
      - Full Name: "Mobile Test User"
      - Email: Use a real email you can access
      - Company Name: "Test Company"
      - Industry: "Technology"
      - Password: "TestPass123"
- [ ] Verify submit button becomes enabled
- [ ] Tap "Create account"
- [ ] Check for success message or email confirmation notice
- [ ] Should redirect to /login-supabase OR show email confirmation message

### Email Confirmation (If Enabled)
- [ ] Check your email on mobile
- [ ] Look for confirmation email from Supabase
- [ ] Tap confirmation link in email
- [ ] Should open browser and confirm account

### Login with Email
- [ ] Go to /login-supabase
- [ ] Enter the email and password you just registered with
- [ ] Tap "Sign in"
- [ ] Should successfully log in
- [ ] Should land on /onboarding or /advisor

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 10: EDGE CASES & ERROR SCENARIOS

### Network Interruption
- [ ] Start OAuth flow
- [ ] Turn off WiFi/data during redirect
- [ ] Turn back on
- [ ] Check if app recovers gracefully

### Back Button Behavior
- [ ] Start at landing page
- [ ] Navigate to /register-supabase
- [ ] Tap browser/device BACK button
- [ ] Should return to landing page
- [ ] OAuth buttons should still be visible on register page if you go forward

### Session Persistence
- [ ] Log in with OAuth
- [ ] Close browser completely
- [ ] Reopen browser
- [ ] Navigate to https://beta.thestrategysquad.com/advisor
- [ ] Should still be logged in (session persisted)

### Multiple Tab Behavior
- [ ] Open app in one mobile browser tab
- [ ] Log in
- [ ] Open same URL in another tab
- [ ] Should show logged-in state in both tabs

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 11: CROSS-BROWSER TESTING (Mobile)

**Test on multiple mobile browsers if possible:**

### Safari (iOS)
- [ ] Landing page works
- [ ] OAuth buttons work
- [ ] Can complete registration
- [ ] Can log in

### Chrome (iOS/Android)
- [ ] Landing page works
- [ ] OAuth buttons work
- [ ] Can complete registration
- [ ] Can log in

### Firefox (iOS/Android)
- [ ] Landing page works
- [ ] OAuth buttons work
- [ ] Can complete registration
- [ ] Can log in

### Samsung Internet (Android)
- [ ] Landing page works
- [ ] OAuth buttons work
- [ ] Can complete registration
- [ ] Can log in

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## TEST 12: VISUAL/UX REVIEW

### Overall Impression
- [ ] Site looks professional on mobile
- [ ] Colors/branding consistent
- [ ] Buttons look clickable
- [ ] Forms look trustworthy
- [ ] No visual glitches

### Touch Targets
- [ ] All buttons at least 48×48px (comfortable to tap)
- [ ] Enough spacing between tappable elements
- [ ] No accidental taps

### Typography
- [ ] Headlines readable (not too small)
- [ ] Body text readable
- [ ] Form labels clear
- [ ] No text cutoff

### Images/Icons
- [ ] OAuth button icons (Google, Microsoft) visible
- [ ] Feature icons load
- [ ] No broken images
- [ ] Images properly sized for mobile

**NOTES:**
_______________________________________________________________
_______________________________________________________________

---

## CRITICAL BUGS TO WATCH FOR

### Show-Stopper Issues (Report Immediately!)
- [ ] White screen/blank page after OAuth
- [ ] Infinite redirect loops
- [ ] Cannot tap OAuth buttons
- [ ] Error messages instead of login success
- [ ] Cannot complete onboarding
- [ ] Dashboard doesn't load after login

### Major Issues
- [ ] Horizontal scrolling
- [ ] Text too small to read
- [ ] Buttons too small to tap
- [ ] Forms don't submit
- [ ] Validation doesn't work
- [ ] Back button breaks navigation

### Minor Issues (Note but not blocking)
- [ ] Slow page loads (>5 seconds)
- [ ] Animations janky
- [ ] Colors slightly off
- [ ] Minor layout shifts

**BUGS FOUND:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

## QUICK CHECKLIST (If Short on Time)

**Minimum Viable Test:**
1. [ ] Load landing page - looks good?
2. [ ] Tap "Start Free" - goes to register?
3. [ ] See OAuth buttons (Google + Microsoft)?
4. [ ] Tap "Continue with Google" - confirmation dialog?
5. [ ] Complete Google OAuth - lands on dashboard?
6. [ ] Logout - goes back to landing?
7. [ ] Log in again - works?

**If all 7 pass → OAuth is working on mobile! ✅**

---

## RESULTS SUMMARY

**Total Tests Completed:** ___ / 100+

**Tests Passed:** ___

**Tests Failed:** ___

**Critical Bugs Found:** ___

**Minor Issues Found:** ___

**Overall Assessment:**
□ Ready for production
□ Needs minor fixes
□ Needs major fixes
□ Not ready

**Confidence Level (1-10):** ___

---

## DETAILED FINDINGS

**What Worked Well:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

**What Needs Improvement:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

**User Experience Notes:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

**Security Concerns:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

**Performance Issues:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

## SIGN-OFF

**Tested By:** _____________________

**Date:** _____________________

**Approved for Production:** □ Yes  □ No  □ With Conditions

**Conditions/Notes:**
_______________________________________________________________
_______________________________________________________________
_______________________________________________________________

---

# Quick Reference URLs

**Landing:** https://beta.thestrategysquad.com/

**Login:** https://beta.thestrategysquad.com/login-supabase

**Register:** https://beta.thestrategysquad.com/register-supabase

**Pricing:** https://beta.thestrategysquad.com/pricing

**Terms:** https://beta.thestrategysquad.com/terms

**Advisor:** https://beta.thestrategysquad.com/advisor

---

**END OF CHECKLIST**
