# AI-Powered Face Authentication for Oracle APEX

A professional biometric authentication system built with **Oracle APEX**, **Oracle Database**, **PL/SQL**, **JavaScript**, and **face-api.js**.

The project adds Face ID authentication to an Oracle APEX application while preserving the original Username / Password authentication flow. The implementation uses **1:1 face verification**: the user first provides a Username or Email, then the system verifies the live face against that user's registered biometric samples.

---

## 1. Project Overview

### What is this project?

This project is a browser-based facial authentication system integrated with Oracle APEX.

Instead of relying only on a password, the application provides two authentication methods:

1. **Username / Password**
2. **Username / Email + Face ID**

The Face ID workflow uses the browser camera and `face-api.js` to:

- Detect the user's face.
- Detect facial landmarks.
- Generate a **128-dimensional face descriptor**.
- Send the descriptor to an Oracle APEX Ajax Callback.
- Validate the target user in `FA_USERS`.
- Load the user's registered face profile.
- Compare the live descriptor against the user's registered face samples.
- Select the closest matching sample using Euclidean distance.
- Validate the match against the configured threshold.
- Authenticate the Oracle APEX session with `APEX_AUTHENTICATION.POST_LOGIN`.
- Redirect the authenticated user into the application.

### Why 1:1 verification?

The project intentionally uses **Username / Email + Face ID** instead of Face-only 1:N identification.

The user's account is selected first, then the system verifies whether the live face belongs to that specific account.

This makes the workflow simpler and avoids searching every registered face in the database.

---

# 2. Technology Stack

| Technology | Purpose |
|---|---|
| Oracle APEX 26.1.x | Application platform, pages, sessions and authentication |
| Oracle Database | User and biometric data storage |
| PL/SQL | Database logic, face verification and authentication |
| JavaScript | Camera control, face recognition and APEX AJAX |
| face-api.js | Face detection, landmarks and face descriptors |
| HTML5 | Page and camera interface |
| CSS3 | UI styling and responsive layout |
| APEX AJAX | Browser-to-server communication |

### face-api.js Models Used

Only the following models are required:

```text
tiny_face_detector_model-weights_manifest.json
tiny_face_detector_model-shard1

face_landmark_68_tiny_model-weights_manifest.json
face_landmark_68_tiny_model-shard1

face_recognition_model-weights_manifest.json
face_recognition_model-shard1
face_recognition_model-shard2
```

---

# 3. Project Structure

```text
Face Authentication/
│
├── Apex_App/
│   └── f96198.sql
│
├── face-api/
│   │
│   ├── Database/
│   │   └── DB.sql
│   │
│   ├── models/
│   │   ├── face_landmark_68_tiny_model-shard1
│   │   ├── face_landmark_68_tiny_model-weights_manifest.json
│   │   ├── face_recognition_model-shard1
│   │   ├── face_recognition_model-shard2
│   │   ├── face_recognition_model-weights_manifest.json
│   │   ├── tiny_face_detector_model-shard1
│   │   └── tiny_face_detector_model-weights_manifest.json
│   │
│   ├── Pages_Codes/
│   │   │
│   │   ├── CSS/
│   │   │   ├── Face_Registration-Inline_CSS.css
│   │   │   └── Login_Page-Inline_CSS.css
│   │   │
│   │   ├── HTML/
│   │   │   ├── Face_Registration_Page_Region-HTML.html
│   │   │   └── Login_Page_Face_ID_Login_Region-HTML.html
│   │   │
│   │   ├── JS/
│   │   │   ├── Face_Registration-Execute_When_Page_Loads.js
│   │   │   └── Login_Page-Execute_when_Page_Loads.js
│   │   │
│   │   └── PLSQL/
│   │       ├── Face_Registration_Page-SAVE_FACE_SAMPLES-Ajax_Callback.sql
│   │       └── Login_Page-VERIFY_FACE_LOGIN-Ajax_Callback.sql
│   │
│   └── face-api.min.js
│
└── README.md
```

---

# 4. Prerequisites

Before starting, make sure the environment provides:

- Oracle Database
- Oracle APEX 26.1.x
- An APEX workspace
- A browser with camera access
- A secure browser context when required by the browser camera policy
- Git / GitHub Desktop if the project is being versioned

The application was implemented using Oracle APEX **26.1.3** during development.

---

# 5. Database Setup

The complete database definition is stored in:

```text
face-api/Database/DB.sql
```

This script contains:

- `FA_USERS`
- `FA_USERS_SEQ`
- `HASH_PASSWORD`
- `AUTHENTICATE_USER`
- `BI_USERS`
- `BU_USERS`
- `FA_FACE_PROFILES`
- `FA_FACE_SAMPLES`
- Primary keys
- Unique constraints
- Foreign keys
- Face angle validation

## 5.1 FA_USERS

`FA_USERS` stores the application's main user identity.

```text
FA_USERS
├── ID
├── USERNAME
├── PASSWORD
├── EMAIL
└── ACCOUNT_STATUS
```

Constraints:

```text
USERS_PK
USERS_UK1
USERS_UK2
```

## 5.2 FA_USERS_SEQ

The sequence is used to generate `FA_USERS.ID` through `BI_USERS`.

## 5.3 HASH_PASSWORD

The password hashing function uses SHA-512 through Oracle `STANDARD_HASH`.

## 5.4 BI_USERS

Before insert, this trigger:

1. Generates the user ID.
2. Converts the username to uppercase.
3. Hashes the password.

## 5.5 BU_USERS

Before update, this trigger:

1. Keeps the username uppercase.
2. Hashes a newly supplied password.
3. Preserves the previous password when the new password is null.

## 5.6 AUTHENTICATE_USER

The existing password authentication function:

1. Accepts Username or Email.
2. Finds the user in `FA_USERS`.
3. Checks `ACCOUNT_STATUS`.
4. Loads the stored password.
5. Hashes the supplied password.
6. Compares the hashes.
7. Returns `TRUE` for a valid password.
8. Raises application errors for invalid credentials.

The Face ID workflow does **not** replace this function.

---

# 6. Face Database Design

The biometric data is intentionally separated from the core user identity.

```text
FA_USERS
    │
    │ 1 : 1
    ▼
FA_FACE_PROFILES
    │
    │ 1 : N
    ▼
FA_FACE_SAMPLES
```

## 6.1 FA_FACE_PROFILES

Columns:

```text
FACE_PROFILE_ID
USER_ID
CREATED_AT
UPDATED_AT
```

`USER_ID` references `FA_USERS.ID` and is unique, so one user has one face profile.

**Important:** `FA_FACE_PROFILES` does not store `FACE_DESCRIPTOR`.

## 6.2 FA_FACE_SAMPLES

Columns:

```text
FACE_SAMPLE_ID
FACE_PROFILE_ID
ANGLE_CODE
FACE_DESCRIPTOR
CAPTURED_AT
```

Allowed `ANGLE_CODE` values:

```text
CENTER
LEFT
RIGHT
UP
DOWN
```

`FACE_DESCRIPTOR` is stored only in `FA_FACE_SAMPLES`.

The unique constraint on `(FACE_PROFILE_ID, ANGLE_CODE)` guarantees one sample per angle.

---

# 7. Oracle APEX Application Setup

The APEX application export is located at:

```text
Apex_App/f96198.sql
```

Import it into the target APEX workspace when rebuilding the complete application.

The implementation assumes:

```text
Page 1      = Home
Page 2      = Face Registration
Page 9999   = Login
```

---

# 8. Page 9999 - Login Page

Page `9999` is the Login page.

The original APEX password authentication flow is preserved.

## 8.1 Existing APEX Items

```text
P9999_USERNAME
P9999_PASSWORD
P9999_REMEMBER
```

Existing login button:

```text
LOGIN
```

A method indicator item is also used:

```text
P9999_LOGIN_METHOD
```

Expected values:

```text
PASSWORD
FACE
```

---

# 9. Login Method Buttons

Two custom buttons are used:

```text
PASSWORD_LOGIN_BTN
FACE_LOGIN_BTN
```

Set their **Static IDs exactly** to:

```text
PASSWORD_LOGIN_BTN
FACE_LOGIN_BTN
```

The JavaScript uses these IDs to control the authentication method UI.

---

# 10. Username Dynamic Action

The authentication method buttons appear automatically while the user types a Username or Email.

### Dynamic Action

```text
Event: Input
Selection Type: Item
Item: P9999_USERNAME
True Action: Execute JavaScript Code
```

Code:

```javascript
const username =
    apex.item("P9999_USERNAME")
        .getValue()
        .trim();

const passwordBtn =
    document.getElementById("PASSWORD_LOGIN_BTN");

const faceBtn =
    document.getElementById("FACE_LOGIN_BTN");

if (!passwordBtn || !faceBtn) {
    console.error("Login method buttons not found");
    return;
}

if (username === "") {
    passwordBtn.classList.add("login-method-hidden");
    faceBtn.classList.add("login-method-hidden");
} else {
    passwordBtn.classList.remove("login-method-hidden");
    faceBtn.classList.remove("login-method-hidden");
}
```

This works without requiring the user to press Enter.

---

# 11. Login CSS

File:

```text
face-api/Pages_Codes/CSS/Login_Page-Inline_CSS.css
```

The method-button hiding class is:

```css
.login-method-hidden {
    display: none !important;
}
```

The same file contains the responsive Face ID login UI styling.

---

# 12. Face ID Region

Page `9999` contains the region:

```text
Face ID Login
```

Set its Static ID to:

```text
FACE_LOGIN_PANEL
```

The complete HTML is stored in:

```text
face-api/Pages_Codes/HTML/Login_Page_Face_ID_Login_Region-HTML.html
```

The internal HTML IDs are:

```text
faceLoginPanel
faceLoginVideo
faceLoginCanvas
faceLoginCountdown
faceLoginCountdownNumber
faceLoginStatus
faceLoginBackBtn
```

## Element purposes

| ID | Purpose |
|---|---|
| `faceLoginPanel` | Face ID internal panel |
| `faceLoginVideo` | Browser camera video element |
| `faceLoginCanvas` | Face overlay canvas |
| `faceLoginCountdown` | Countdown container |
| `faceLoginCountdownNumber` | Countdown value |
| `faceLoginStatus` | Current verification status |
| `faceLoginBackBtn` | Return to password login |

---

# 13. face-api.js Library

The library is stored in:

```text
face-api/face-api.min.js
```

Upload it to APEX Static Application Files.

On Page 9999 add under:

```text
Page 9999
→ JavaScript
→ File URLs
```

```text
#APP_FILES#face-api.min.js
```

The library must load before the Face ID JavaScript executes.

---

# 14. Face Recognition Models

Upload the model files to APEX Static Application Files under:

```text
models/
```

The resulting path is:

```text
#APP_FILES#models/
```

Required files:

```text
tiny_face_detector_model-weights_manifest.json
tiny_face_detector_model-shard1

face_landmark_68_tiny_model-weights_manifest.json
face_landmark_68_tiny_model-shard1

face_recognition_model-weights_manifest.json
face_recognition_model-shard1
face_recognition_model-shard2
```

---

# 15. Login JavaScript

File:

```text
face-api/Pages_Codes/JS/Login_Page-Execute_when_Page_Loads.js
```

The script is placed in:

```text
Page 9999
→ JavaScript
→ Execute when Page Loads
```

The script is responsible for:

- Loading face-api.js models.
- Starting the camera.
- Stopping the camera.
- Detecting the face.
- Detecting facial landmarks.
- Generating the 128D descriptor.
- Preventing duplicate verification requests.
- Calling `VERIFY_FACE_LOGIN`.
- Showing verification result messages.
- Redirecting after successful authentication.

State variables:

```javascript
let faceLoginStream = null;
let faceLoginRunning = false;
let faceLoginVerifying = false;
```

---

# 16. Model Loading

The login script uses:

```javascript
const MODEL_URL = '#APP_FILES#models/';
```

and loads:

```javascript
faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL)
faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL)
faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
```

The Face ID flow should not start until all three models are loaded successfully.

---

# 17. Starting and Stopping the Camera

The login script exposes:

```javascript
startFaceLoginCamera();
stopFaceLoginCamera();
```

`startFaceLoginCamera()` requests browser camera access and attaches the stream to:

```text
faceLoginVideo
```

`stopFaceLoginCamera()` stops all media tracks and clears the video source.

The camera is stopped when:

- Face verification succeeds.
- Face verification fails.
- The user clicks `Use Password`.
- The Face ID flow is cancelled.

---

# 18. Use Password Dynamic Action

The Back button uses:

```text
#faceLoginBackBtn
```

Create a Dynamic Action:

```text
Event: Click
Selection Type: jQuery Selector
jQuery Selector: #faceLoginBackBtn
True Action: Execute JavaScript Code
```

Code:

```javascript
stopFaceLoginCamera();

const panel =
    document.getElementById("faceLoginPanel");

if (panel) {
    panel.style.display = "none";
}
```

This prevents the camera from continuing to run when the user switches back to password authentication.

---

# 19. Face Descriptor Generation

The detector uses the Tiny Face Detector:

```javascript
new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.35
})
```

The detection chain is:

```javascript
.detectSingleFace(...)
.withFaceLandmarks(true)
.withFaceDescriptor();
```

The expected descriptor length is:

```text
128
```

The descriptor is converted to a normal array with:

```javascript
const descriptor =
    Array.from(detection.descriptor);
```

---

# 20. VERIFY_FACE_LOGIN Ajax Callback

Create an Ajax Callback on Page `9999` named:

```text
VERIFY_FACE_LOGIN
```

PL/SQL source file:

```text
face-api/Pages_Codes/PLSQL/Login_Page-VERIFY_FACE_LOGIN-Ajax_Callback.sql
```

The browser sends:

```text
x01 = Username / Email
x02 = JSON encoded descriptor
```

with:

```javascript
apex.server.process(
    "VERIFY_FACE_LOGIN",
    {
        x01: identifier,
        x02: JSON.stringify(descriptor)
    },
    ...
);
```

---

# 21. VERIFY_FACE_LOGIN Server Workflow

The callback performs the following operations:

1. Read `G_X01` and `G_X02`.
2. Validate Username / Email.
3. Validate that the descriptor contains 128 values.
4. Find an active user in `FA_USERS`.
5. Find the user's `FA_FACE_PROFILES` record.
6. Load all `FA_FACE_SAMPLES` for that profile.
7. Parse the registered descriptors.
8. Calculate Euclidean distance between the current descriptor and every registered descriptor.
9. Keep the smallest distance.
10. Compare the best distance with the configured threshold.
11. On `MATCH`, call `APEX_AUTHENTICATION.POST_LOGIN`.
12. Return the verification result to the browser.

---

# 22. Face Matching Logic

The current initial threshold is:

```text
0.60
```

The system chooses the minimum Euclidean distance among the five samples.

Conceptually:

```text
Current Descriptor
        ↓
CENTER   → distance
LEFT     → distance
RIGHT    → distance
UP       → distance
DOWN     → distance
        ↓
minimum distance
        ↓
threshold check
```

If:

```text
best_distance <= 0.60
```

then the initial development result is:

```text
MATCH
```

Otherwise:

```text
NO_MATCH
```

The `0.60` value is a development threshold and should be calibrated before production deployment.

---

# 23. APEX Session Authentication

After a successful match, the server calls:

```sql
APEX_AUTHENTICATION.POST_LOGIN(
    p_username           => l_username,
    p_password           => NULL,
    p_uppercase_username => TRUE
);
```

This converts the successful biometric verification into an authenticated APEX session.

The browser then redirects to the application Home Page.

---

# 24. Face Login Error States

The client handles these server statuses:

```text
MATCH
NO_MATCH
USER_NOT_FOUND
NO_FACE_PROFILE
NO_FACE_SAMPLES
INVALID_DESCRIPTOR
DESCRIPTOR_REQUIRED
USERNAME_REQUIRED
ERROR
```

Examples:

```text
User not found.
Please enter a valid Username or Email.
```

```text
Face not recognized.
The face does not match the registered Face ID.
```

```text
Face ID is not registered for this user.
```

---

# 25. Page 2 - Face Registration

Page 2 is the Face Registration page.

Files:

```text
face-api/Pages_Codes/CSS/Face_Registration-Inline_CSS.css
face-api/Pages_Codes/HTML/Face_Registration_Page_Region-HTML.html
face-api/Pages_Codes/JS/Face_Registration-Execute_When_Page_Loads.js
face-api/Pages_Codes/PLSQL/Face_Registration_Page-SAVE_FACE_SAMPLES-Ajax_Callback.sql
```

The page provides:

- Camera preview.
- Face detection.
- Face landmarks.
- Pose detection.
- Countdown.
- Registration progress.
- Descriptor capture.
- Five-angle enrollment.

---

# 26. Face Registration Poses

The required sequence is:

```text
CENTER
↓
LEFT
↓
RIGHT
↓
UP
↓
DOWN
```

For every pose:

1. Detect the face.
2. Confirm the expected orientation.
3. Run the countdown.
4. Capture a descriptor.
5. Store the descriptor temporarily.
6. Move to the next pose.

After the five descriptors have been captured, they are sent to `SAVE_FACE_SAMPLES`.

---

# 27. SAVE_FACE_SAMPLES Ajax Callback

Create an Ajax Callback on Page 2 named:

```text
SAVE_FACE_SAMPLES
```

PL/SQL source:

```text
face-api/Pages_Codes/PLSQL/Face_Registration_Page-SAVE_FACE_SAMPLES-Ajax_Callback.sql
```

Expected values:

```text
G_X01 = CENTER
G_X02 = LEFT
G_X03 = RIGHT
G_X04 = UP
G_X05 = DOWN
```

Each value is a JSON encoded 128-dimensional descriptor.

---

# 28. SAVE_FACE_SAMPLES Server Workflow

The callback:

1. Reads the five descriptors.
2. Validates each descriptor has 128 values.
3. Reads `APEX_APPLICATION.G_USER`.
4. Finds the active user in `FA_USERS`.
5. Finds the existing `FA_FACE_PROFILES` row.
6. Creates the profile if it does not exist.
7. Deletes previous samples for that profile.
8. Inserts five new rows into `FA_FACE_SAMPLES`.
9. Updates `FA_FACE_PROFILES.UPDATED_AT`.
10. Commits the complete enrollment.

The stored profile does not contain the descriptor. All descriptors are stored in `FA_FACE_SAMPLES`.

---

# 29. Registration Database Result

A successful enrollment produces:

```text
FA_FACE_PROFILES
----------------
One row for the user
```

and:

```text
FA_FACE_SAMPLES
----------------
CENTER
LEFT
RIGHT
UP
DOWN
```

Example verification query:

```sql
SELECT
    fp.USER_ID,
    fp.FACE_PROFILE_ID,
    fs.ANGLE_CODE,
    DBMS_LOB.GETLENGTH(fs.FACE_DESCRIPTOR) AS DESCRIPTOR_SIZE
FROM FA_FACE_PROFILES fp
JOIN FA_FACE_SAMPLES fs
    ON fs.FACE_PROFILE_ID = fp.FACE_PROFILE_ID
ORDER BY fs.ANGLE_CODE;
```

---

# 30. Static IDs and DOM IDs Reference

## Page 9999

### Custom buttons

```text
PASSWORD_LOGIN_BTN
FACE_LOGIN_BTN
```

### Face ID region

```text
FACE_LOGIN_PANEL
```

### Face Login DOM IDs

```text
faceLoginPanel
faceLoginVideo
faceLoginCanvas
faceLoginCountdown
faceLoginCountdownNumber
faceLoginStatus
faceLoginBackBtn
```

### APEX Items

```text
P9999_USERNAME
P9999_PASSWORD
P9999_REMEMBER
P9999_LOGIN_METHOD
```

### Existing APEX login button

```text
LOGIN
```

---

# 31. File-to-Feature Map

| Feature | File |
|---|---|
| Complete database schema | `face-api/Database/DB.sql` |
| APEX application export | `Apex_App/f96198.sql` |
| Face-api models | `face-api/models/` |
| face-api library | `face-api/face-api.min.js` |
| Registration HTML | `face-api/Pages_Codes/HTML/Face_Registration_Page_Region-HTML.html` |
| Login Face ID HTML | `face-api/Pages_Codes/HTML/Login_Page_Face_ID_Login_Region-HTML.html` |
| Registration CSS | `face-api/Pages_Codes/CSS/Face_Registration-Inline_CSS.css` |
| Login CSS | `face-api/Pages_Codes/CSS/Login_Page-Inline_CSS.css` |
| Registration JS | `face-api/Pages_Codes/JS/Face_Registration-Execute_When_Page_Loads.js` |
| Login JS | `face-api/Pages_Codes/JS/Login_Page-Execute_when_Page_Loads.js` |
| Registration callback | `face-api/Pages_Codes/PLSQL/Face_Registration_Page-SAVE_FACE_SAMPLES-Ajax_Callback.sql` |
| Login callback | `face-api/Pages_Codes/PLSQL/Login_Page-VERIFY_FACE_LOGIN-Ajax_Callback.sql` |

---

# 32. Complete Authentication Workflows

## Enrollment

```text
Authenticated User
       ↓
Page 2 - Face Registration
       ↓
Camera
       ↓
CENTER
       ↓
LEFT
       ↓
RIGHT
       ↓
UP
       ↓
DOWN
       ↓
Five 128D descriptors
       ↓
SAVE_FACE_SAMPLES
       ↓
FA_FACE_PROFILES
       ↓
FA_FACE_SAMPLES
```

## Face Login

```text
Page 9999
       ↓
Username / Email
       ↓
Face ID
       ↓
Camera
       ↓
Face Detection
       ↓
Landmarks
       ↓
128D Descriptor
       ↓
VERIFY_FACE_LOGIN
       ↓
FA_USERS
       ↓
FA_FACE_PROFILES
       ↓
FA_FACE_SAMPLES
       ↓
Euclidean Distance
       ↓
Best Match
       ↓
Threshold
       ↓
MATCH
       ↓
APEX_AUTHENTICATION.POST_LOGIN
       ↓
Home Page
```

---

# 33. Password vs Face ID

## Password path

```text
P9999_USERNAME
       ↓
P9999_PASSWORD
       ↓
AUTHENTICATE_USER
       ↓
FA_USERS
       ↓
APEX Login
```

## Face ID path

```text
P9999_USERNAME
       ↓
FACE_LOGIN_BTN
       ↓
Camera
       ↓
face-api.js
       ↓
128D Descriptor
       ↓
VERIFY_FACE_LOGIN
       ↓
FA_FACE_SAMPLES
       ↓
Match
       ↓
POST_LOGIN
       ↓
APEX Session
```

The two authentication flows remain separate.

---

# 34. Security Considerations

The current design includes:

- 1:1 verification.
- Active account validation.
- Multiple registered samples.
- Server-side comparison through APEX.
- APEX session authentication after successful verification.
- Password fallback.
- Camera shutdown after verification or cancellation.

Before production deployment, consider additionally implementing:

- HTTPS everywhere.
- APEX authorization and Session State Protection review.
- Rate limiting / lockout for repeated face failures.
- Strong access control around enrollment.
- Audit logging.
- Liveness / anti-spoofing protections for high-risk use cases.
- Threshold calibration using representative genuine and impostor attempts.
- Protection of biometric information.
- No real credentials, secrets, or private biometric data in the public Git repository.

---

# 35. Matching Threshold Calibration

The current development value is:

```text
0.60
```

This value should be considered an initial calibration value, not a universally optimal biometric security threshold.

The development test produced:

```text
Best Angle: DOWN
Distance: 0.343206
Threshold: 0.600000
Result: MATCH
```

For production use, test the system across representative conditions and calibrate the threshold according to the required false-acceptance and false-rejection tradeoff.

---

# 36. Rebuild the Project From Scratch

## Step 1 - Create the Oracle objects

Run:

```text
face-api/Database/DB.sql
```

in:

```text
SQL Workshop → SQL Commands
```

## Step 2 - Import the APEX application

Import:

```text
Apex_App/f96198.sql
```

## Step 3 - Upload face-api.js

Upload:

```text
face-api/face-api.min.js
```

to APEX Static Application Files.

## Step 4 - Upload the models

Create:

```text
models/
```

and upload all required model files.

## Step 5 - Configure Page 9999 JavaScript

Add:

```text
#APP_FILES#face-api.min.js
```

under:

```text
Page 9999 → JavaScript → File URLs
```

Then place the content from:

```text
Login_Page-Execute_when_Page_Loads.js
```

in Execute when Page Loads.

## Step 6 - Configure Page 9999 Face ID region

Use:

```text
Login_Page_Face_ID_Login_Region-HTML.html
```

and set:

```text
FACE_LOGIN_PANEL
```

as the region Static ID.

## Step 7 - Configure Login CSS

Use:

```text
Login_Page-Inline_CSS.css
```

in the Page 9999 Inline CSS section.

## Step 8 - Create VERIFY_FACE_LOGIN

Create an Ajax Callback named:

```text
VERIFY_FACE_LOGIN
```

and use:

```text
Login_Page-VERIFY_FACE_LOGIN-Ajax_Callback.sql
```

## Step 9 - Configure Login Dynamic Actions

Configure the Username `Input` Dynamic Action as documented in Section 10.

Configure the Password and Face ID buttons with these Static IDs:

```text
PASSWORD_LOGIN_BTN
FACE_LOGIN_BTN
```

Configure the `Use Password` selector:

```text
#faceLoginBackBtn
```

## Step 10 - Configure Page 2

Use the four Face Registration files:

```text
Face_Registration-Inline_CSS.css
Face_Registration_Page_Region-HTML.html
Face_Registration-Execute_When_Page_Loads.js
Face_Registration_Page-SAVE_FACE_SAMPLES-Ajax_Callback.sql
```

## Step 11 - Create the registration Ajax Callback

Name:

```text
SAVE_FACE_SAMPLES
```

## Step 12 - Test enrollment

Capture:

```text
CENTER
LEFT
RIGHT
UP
DOWN
```

Confirm five rows are present in `FA_FACE_SAMPLES`.

## Step 13 - Test Face ID Login

1. Enter Username or Email.
2. Choose Face ID.
3. Allow camera access.
4. Look at the camera.
5. Wait for face detection.
6. Generate the live descriptor.
7. Verify against the stored samples.
8. Confirm `MATCH`.
9. Confirm `POST_LOGIN`.
10. Confirm redirect to the Home Page.

---

# 37. Troubleshooting

## Models do not load

Verify the exact `#APP_FILES#models/` path and all manifest/shard filenames.

## Camera does not start

Check browser camera permission, secure context requirements and the `faceLoginVideo` element.

## Face is detected but descriptor is not generated

Confirm that these models loaded:

```text
tinyFaceDetector
tinyFaceLandmark68
tinyFaceRecognition
```

Specifically:

```text
faceapi.nets.tinyFaceDetector
faceapi.nets.faceLandmark68TinyNet
faceapi.nets.faceRecognitionNet
```

## AJAX returns Unexpected token '<'

An APEX Ajax request expected JSON but the server returned HTML or another non-JSON response. Inspect the Network response and the underlying Oracle error.

## ORA-00904 FACE_DESCRIPTOR

`FA_FACE_PROFILES` does not contain `FACE_DESCRIPTOR`.

The correct location is:

```text
FA_FACE_SAMPLES.FACE_DESCRIPTOR
```

## No face profile

Confirm that `FA_FACE_PROFILES.USER_ID` matches the active `FA_USERS.ID`.

## No face samples

Confirm that five rows exist for the profile in `FA_FACE_SAMPLES`.

---

# 38. Development Test Result

A successful development verification produced:

```text
Descriptor Length: 128
Status: MATCH
Distance: 0.343206
Threshold: 0.600000
Matched Angle: DOWN
```

The camera was stopped after successful verification and the APEX authentication flow was completed.

---

# 39. Final Architecture

```text
                         USER
                          │
                          ▼
                ┌──────────────────┐
                │  APEX Login Page │
                │     Page 9999    │
                └────────┬─────────┘
                         │
              ┌──────────┴──────────┐
              │                     │
              ▼                     ▼
       Username/Password        Username/Email
              │                     │
              ▼                     ▼
       AUTHENTICATE_USER         Face ID
              │                     │
              │                     ▼
              │               Browser Camera
              │                     │
              │                     ▼
              │                face-api.js
              │                     │
              │                     ▼
              │               128D Descriptor
              │                     │
              │                     ▼
              │              VERIFY_FACE_LOGIN
              │                     │
              │                     ▼
              │                 FA_USERS
              │                     │
              │                     ▼
              │              FA_FACE_PROFILES
              │                     │
              │                     ▼
              │               FA_FACE_SAMPLES
              │                     │
              │                     ▼
              │               Face Comparison
              │                     │
              │                   MATCH
              │                     │
              │                     ▼
              │              POST_LOGIN
              │                     │
              └──────────────┬──────┘
                             ▼
                    AUTHENTICATED SESSION
                             │
                             ▼
                         HOME PAGE
```

---

# 40. Project Status

The current development implementation supports:

- Face enrollment with five poses.
- 128-dimensional face descriptors.
- Oracle biometric storage.
- 1:1 face verification.
- Browser camera integration.
- Face detection.
- Facial landmarks.
- Face recognition.
- Euclidean distance comparison.
- APEX Ajax verification.
- APEX session authentication.
- Password fallback.
- Camera shutdown after verification / cancellation.
- Error popups for invalid users and failed biometric verification.

Further production hardening and biometric threshold calibration are recommended before deployment in a high-security environment.

---

# 41. License

Add the project's selected license here.

Example:

```text
MIT License
```

---

# 42. Author

```text
Author: Your Name
GitHub: https://github.com/YOUR_USERNAME
```
