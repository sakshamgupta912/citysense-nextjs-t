## CitySense Next: Implementation Details

##### Folder Structure (Key Parts)

```
|-- app
|   |-- login/         # Login page (Google Auth)
|   |-- poem/          # Poem generator (calls Firebase Function)
|   |-- voting/        # Voting on issues (fetch, upvote/downvote)
|   |-- page.tsx       # Main civic issue reporting UI
|   |-- layout.tsx     # App layout, AuthProvider, Navbar
|-- components
|   |-- Auth.tsx       # Google sign-in button
|   |-- AuthProvider.tsx # Auth context
|   |-- Navbar.tsx     # Top navigation bar
|   |-- Spinner.tsx    # Loading spinner
|-- firebase.ts        # Firebase config (db, auth, functions)
|-- firestore.rules    # Firestore security rules
|-- public/            # Static assets
```

---

## Data Flow Overview

### 1. Authentication

- User logs in via Google (component: `Auth.tsx`).
- Auth state is provided globally via `AuthProvider.tsx`.
- User info (uid, etc.) is available in all pages/components.

### 2. Issue Reporting (`/app/page.tsx`)

#### a. Modes

- **Live**: Uses device geolocation and camera for instant reporting.
- **Manual**: User selects location on map and uploads a photo.

#### b. Form Fields

- Description (required)
- Photo Evidence (required)
- Location (auto/manual)
- Category (optional)
- Persistence (short/long/unknown)

#### c. Data Flow

1. User fills form and submits.
2. Image is uploaded to imgbb via POST request:
   - Endpoint: `https://api.imgbb.com/1/upload?key=...`
   - Method: `POST`
   - Body: `FormData` with image file
   - Response: `{ data: { url: string, ... } }`
3. Report object is constructed:
   ```ts
   {
     description: string,
     imageUrl: string,
     credibility: number, // computed (see below)
     location: { lat: number, lng: number },
     timestamp: Timestamp,
     category?: string,
     persistence: string,
     userId: string,
   }
   ```
4. Report is saved to Firestore: `addDoc(collection(db, 'reports'), reportData)`

#### d. Credibility Calculation

- Based on user credibility (from `users` collection) and whether the photo is geotagged.
- Weighted formula:
  - If userCredibility < 0.3: 0.3 user, 0.7 geotag
  - 0.3 <= userCredibility <= 0.65: 0.55 user, 0.45 geotag
  - 0.65 < userCredibility <= 1: 0.8 user, 0.2 geotag
  - Else: 0.5 user, 0.5 geotag

---

### 3. Voting (`/app/voting/page.tsx`)

#### a. Fetching Issues

- User location is auto-detected (or entered manually).
- Issues are fetched from Firestore `issues` collection.
- Geohash logic is used to optimize Firestore queries:
  - The user provides a search radius in kilometers (km).
  - Geohash precision is dynamically chosen based on the radius:
    - Precision 4: ~20km
    - Precision 5: ~4.9km
    - Precision 6: ~1.2km
    - Precision 7: ~0.15km
  - The center geohash and its 8 neighbors are queried (up to 10 geohashes, Firestore limit for 'in' queries).
  - After fetching, the Haversine formula is used to filter issues to those within the exact radius in km.
- Only issues not created by the current user are shown.

#### b. Voting

- User must enter their User ID (uid).
- Can upvote or downvote an issue.
- Voting is handled via a Firebase Function (httpsCallable):
  - Example call: `httpsCallable(functions, 'voteOnIssue')({ issueId, voteType, userId })`
  - Handles duplicate voting, updates credibility, etc.
- UI shows loading, error, and success states.

#### c. Voting POST Request Schema

```json
{
  "issueId": "string",
  "voteType": "up" | "down",
  "userId": "string"
}
```

Response: `{ success: boolean, message?: string }`

---

### 4. Poem Generator (`/app/poem/page.tsx`)

- User enters a subject and clicks generate.
- Calls Firebase Function `generatePoem` via httpsCallable.
- Shows loading and displays result or error.

---

## Additional Notes

- All forms are responsive and accessible.
- Navbar shows user info if logged in, login button otherwise.
- Spinner is used for loading states.
- Firestore security rules and indexes are defined in `firestore.rules` and `firestore.indexes.json`.
- Environment variables (API keys, etc.) are in `.env.local` (not committed).

---

## Example: Report Submission Flow

1. User logs in (Google Auth)
2. Fills out report form (description, photo, location, etc.)
3. Image is uploaded to imgbb (POST)
4. Report object is created and saved to Firestore
5. User sees confirmation and form resets

---

## Example: Voting Flow

1. User logs in (Google Auth)
2. Navigates to Voting page
3. Location is detected or entered
4. Nearby issues are fetched
5. User upvotes/downvotes an issue (calls Firebase Function)
6. UI updates with result

---

## Example: Poem Generator Flow

1. User enters subject
2. Clicks generate
3. Calls Firebase Function
4. Poem is displayed

---

## Security

- Firestore rules restrict access to authenticated users
- Voting and reporting are protected against abuse (duplicate votes, etc.)

---

## References

- See `/app/page.tsx`, `/app/voting/page.tsx`, `/components/Auth.tsx`, `/firebase.ts` for implementation details.

---

*Last updated: 22 July 2025*
