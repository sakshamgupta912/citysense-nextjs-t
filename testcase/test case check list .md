# Test Case Checklist

## 1. Authentication

- [X] User can sign up with valid credentials
- [X] User can log in with valid credentials
- [X] User cannot log in with invalid credentials
- [X] User can log out successfully
- [X] Auth state persists across reloads
- [X] Auth state is cleared on logout

## 2. Issue Reporting

- [ ] User can open the report form
- [ ] User can enter a description
- [ ] User can upload an image
- [ ] User can select a category
- [ ] User can select persistence
- [ ] User can set credibility score
- [ ] User can select location (auto)
- [ ] User can select location (manual: map click)
- [ ] User can select location (manual: lat/lng input)
- [ ] User cannot submit with missing required fields
- [ ] User receives error for invalid manual coordinates
- [ ] User receives error for failed image upload
- [ ] User receives error for failed report submission
- [ ] User sees success message on successful submission
- [ ] User can use "Test Mode" to submit raw JSON
- [ ] "Test Mode" rejects invalid JSON

## 3. Voting

- [ ] User can fetch nearby issues (auto location)
- [ ] User can fetch nearby issues (manual location)
- [ ] User sees message if no issues are found
- [ ] User can upvote an issue
- [ ] User can downvote an issue
- [ ] User cannot vote without entering User ID
- [ ] User sees error if voting fails
- [ ] User sees confirmation on successful vote

## 4. Poem Generator

- [ ] User can enter a subject and generate a poem
- [ ] Loading state is shown while generating
- [ ] Poem is displayed after generation
- [ ] Error is shown if generation fails

## 5. UI/UX

- [ ] Navbar displays correct user info when logged in
- [ ] Navbar displays login option when logged out
- [ ] Spinner appears during loading states
- [ ] All forms are responsive and accessible
- [ ] Error and success messages are clear and visible

## 6. Edge Cases & Security

- [ ] Submitting large images is handled gracefully
- [ ] Invalid file types are rejected for image upload
- [ ] User cannot access voting/reporting without authentication (if required)
- [ ] Rate limiting or spam prevention for submissions
- [ ] All sensitive data is not exposed in the client

## 7. Integration

- [ ] Reports are saved in Firestore with correct fields
- [ ] Votes are saved and reflected in issue credibility
- [ ] Location is stored and retrieved correctly
- [ ] All environment variables are loaded correctly
