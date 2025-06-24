// ==============================================
//           Firebase Configuration
// ==============================================
// Your web app's Firebase configuration (PASTE YOUR ACTUAL CONFIG HERE)
const firebaseConfig = {
    apiKey: "AIzaSyAc7uHnM5lxnQ9l1M0z_iUarScUtZXXXXXXXX", // <-- Replace with your actual API Key
    authDomain: "vote-7c98d.firebaseapp.com",
    projectId: "vote-7c98d",
    storageBucket: "vote-7c98d.firebasestorage.app",
    messagingSenderId: "790876453479",
    appId: "1:790876453479:web:a24133b7fdfb2f2c12f2c2",
    measurementId: "G-LSEENP94Q9"
};

// Initialize Firebase services
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app); // Use firebase.firestore(app) for compat versions
const auth = firebase.auth(app);     // Use firebase.auth(app) for compat versions

// Firestore Poll Document Reference
const pollDocRef = db.collection("polls").doc("poll_results");
// Firestore Collection Reference for tracking user votes
const usersVotedCollection = db.collection("users_voted");

// ==============================================
//           HTML Element References
// ==============================================
// Page containers
const loginPage = document.getElementById('loginPage');
const menuPage = document.getElementById('menuPage');
const pollPage = document.getElementById('pollPage');
const newPage = document.getElementById('newPage');

// Auth elements
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginButton = document.getElementById('loginButton');
const authMessage = document.getElementById('authMessage');

// Menu elements
const loggedInUsernameSpan = document.getElementById('loggedInUsername');
const goToPollButton = document.getElementById('goToPollButton');
const goToNewPageButton = document.getElementById('goToNewPageButton');
const logoutButton = document.getElementById('logoutButton');

// Poll elements
const pollUserEmailSpan = document.getElementById('pollUserEmail');
const voteYesButton = document.getElementById('voteYes');
const voteNoButton = document.getElementById('voteNo');
const voteMaybeButton = document.getElementById('voteMaybe');
const yesCountSpan = document.getElementById('yesCount');
const noCountSpan = document.getElementById('noCount');
const maybeCountSpan = document.getElementById('maybeCount');
const yourVoteStatusSpan = document.getElementById('yourVoteStatus');
const voteMessage = document.getElementById('voteMessage');
const backToMenuFromPollButton = document.getElementById('backToMenuFromPoll');

// New Page elements
const backToMenuFromNewPageButton = document.getElementById('backToMenuFromNewPage');

// Global state variables
let currentUser = null; // Stores the authenticated user object
let hasVotedCurrentUser = false; // Tracks if the current logged-in user has voted

// ==============================================
//             Utility Functions
// ==============================================

/**
 * Shows a specific page by its ID and hides all other app pages.
 * @param {string} pageId - The ID of the page to show.
 */
function showPage(pageId) {
    // Hide all pages first
    [loginPage, menuPage, pollPage, newPage].forEach(page => {
        if (page) page.classList.add('hidden');
    });
    // Show the target page
    const targetPage = document.getElementById(pageId);
    if (targetPage) targetPage.classList.remove('hidden');

    // Clear any messages when navigating pages
    displayMessage(authMessage, '', '');
    displayMessage(voteMessage, '', '');
}

/**
 * Displays a message in a designated message box.
 * @param {HTMLElement} element - The message box element.
 * @param {string} message - The message text.
 * @param {'success'|'error'|''} type - The type of message ('success', 'error', or empty for clear).
 */
function displayMessage(element, message, type) {
    element.textContent = message;
    element.className = 'message-box'; // Reset classes
    if (message) {
        element.style.display = 'block';
        if (type) {
            element.classList.add(type);
        }
    } else {
        element.style.display = 'none';
    }
}

/**
 * Enables or disables poll voting buttons.
 * @param {boolean} disabledState - True to disable, false to enable.
 */
function setPollButtonsDisabled(disabledState) {
    voteYesButton.disabled = disabledState;
    voteNoButton.disabled = disabledState;
    voteMaybeButton.disabled = disabledState;
}

// ==============================================
//             Authentication Logic
// ==============================================

/**
 * Handles user login.
 */
authForm.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default form submission
    const email = emailInput.value;
    const password = passwordInput.value;
    displayMessage(authMessage, '', ''); // Clear previous messages

    // Disable login button during auth operation
    loginButton.disabled = true;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        // onAuthStateChanged will handle UI update if successful
        displayMessage(authMessage, 'Login successful!', 'success');
        // Inputs are cleared by onAuthStateChanged when page switches
    } catch (error) {
        console.error("Login failed:", error.code, error.message);
        let errorMessage = "Login failed. Please check your credentials.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
            errorMessage = "Invalid email or password.";
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = "Please enter a valid email address.";
        }
        displayMessage(authMessage, errorMessage, 'error');
    } finally {
        // Re-enable login button regardless of success or failure
        loginButton.disabled = false;
    }
});

// The entire registerButton.addEventListener block has been removed from here.

/**
 * Handles user logout.
 */
logoutButton.addEventListener('click', async () => {
    try {
        await auth.signOut();
        displayMessage(authMessage, 'You have been logged out.', 'success');
        // onAuthStateChanged will handle showing loginPage
    } catch (error) {
        console.error("Logout failed:", error.message);
        displayMessage(authMessage, "Failed to log out. Please try again.", 'error');
    }
});

/**
 * Listens for Firebase Authentication state changes. This is the main router for pages.
 */
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        // Fetch username from Firestore
        const userProfileRef = db.collection("users").doc(user.uid); // Reference to the user's profile document
        try {
            const userProfileSnap = await userProfileRef.get();
            if (userProfileSnap.exists && userProfileSnap.data().username) {
                // If username exists in the profile, use it
                loggedInUsernameSpan.textContent = userProfileSnap.data().username;
            } else {
                // Fallback to email if no username is found in Firestore
                loggedInUsernameSpan.textContent = user.email;
                // Optional: You could also create the document with the email as username here if it doesn't exist
                // userProfileRef.set({ username: user.email }, { merge: true }); 
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            loggedInUsernameSpan.textContent = user.email + " (Error fetching username)"; // Show email with an error hint
        }
        pollUserEmailSpan.textContent = user.email; // Display email on poll page

        emailInput.value = ''; // Clear login form inputs
        passwordInput.value = '';

        showPage('menuPage'); // Show the menu page

        // After logging in, always check vote status and fetch poll counts for the poll page
        await checkUserVoteStatus(currentUser.uid);
        await fetchPollCounts();

    } else {
        // User is signed out
        currentUser = null;
        hasVotedCurrentUser = false;
        yourVoteStatusSpan.textContent = 'Not Voted'; // Reset vote status display
        setPollButtonsDisabled(true); // Disable poll buttons when not logged in
        
        showPage('loginPage'); // Show the login page
    }
});

// ==============================================
//             Poll Logic (Firestore)
// ==============================================

/**
 * Checks if the current user has already voted.
 * @param {string} uid - The User ID (UID) of the current user.
 */
async function checkUserVoteStatus(uid) {
    try {
        const userVoteDocRef = usersVotedCollection.doc(uid);
        const docSnap = await userVoteDocRef.get();
        if (docSnap.exists) {
            hasVotedCurrentUser = true;
            yourVoteStatusSpan.textContent = docSnap.data().voteType; // Display what they voted
            setPollButtonsDisabled(true); // Disable if already voted
        } else {
            hasVotedCurrentUser = false;
            yourVoteStatusSpan.textContent = 'Not Voted';
            // Only enable buttons if user is currently logged in
            if (currentUser) { 
                setPollButtonsDisabled(false); 
            }
        }
    } catch (e) {
        console.error("Error checking user vote status:", e);
        hasVotedCurrentUser = false;
        yourVoteStatusSpan.textContent = 'Error checking status';
        // Only enable buttons if user is currently logged in
        if (currentUser) {
            setPollButtonsDisabled(false);
        }
    }
}

/**
 * Fetches and updates global poll counts from Firestore.
 */
async function fetchPollCounts() {
    try {
        const docSnap = await pollDocRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            yesCountSpan.textContent = data.yes || 0;
            noCountSpan.textContent = data.no || 0;
            maybeCountSpan.textContent = data.maybe || 0;
        } else {
            // Document doesn't exist, create it with initial values
            await pollDocRef.set({ yes: 0, no: 0, maybe: 0 });
            yesCountSpan.textContent = 0;
            noCountSpan.textContent = 0;
            maybeCountSpan.textContent = 0;
        }
    } catch (e) {
        console.error("Error fetching poll counts:", e);
        displayMessage(voteMessage, "Error fetching poll data.", 'error');
    }
}

/**
 * Handles a user's vote.
 * @param {string} voteType - The type of vote ('yes', 'no', 'maybe').
 */
async function handleVote(voteType) {
    displayMessage(voteMessage, '', ''); // Clear previous messages

    if (!currentUser) {
        displayMessage(voteMessage, "You must be logged in to vote!", 'error');
        return;
    }
    if (hasVotedCurrentUser) {
        displayMessage(voteMessage, "You have already voted!", 'error');
        return;
    }

    setPollButtonsDisabled(true); // Client-side disable immediately to prevent double-clicks

    try {
        // --- Transactional write ---
        // Firestore transactions ensure both updates (poll counts and user vote record) succeed or fail together.
        await db.runTransaction(async (transaction) => {
            // Get the current poll counts
            const currentPollDoc = await transaction.get(pollDocRef);
            if (!currentPollDoc.exists) {
                // Initialize if it doesn't exist (should be handled by fetchPollCounts, but good fallback)
                transaction.set(pollDocRef, { yes: 0, no: 0, maybe: 0 });
            }

            const currentData = currentPollDoc.data();
            const newCounts = {
                yes: currentData.yes || 0,
                no: currentData.no || 0,
                maybe: currentData.maybe || 0
            };
            newCounts[voteType]++; // Increment the chosen vote type

            // Update the poll_results document
            transaction.update(pollDocRef, newCounts);

            // Mark this user as having voted in their own document
            const userVoteDocRef = usersVotedCollection.doc(currentUser.uid);
            transaction.set(userVoteDocRef, {
                voteType: voteType,
                timestamp: firebase.firestore.FieldValue.serverTimestamp() // Use server timestamp for accuracy
            });
        });

        // If transaction succeeds:
        hasVotedCurrentUser = true;
        yourVoteStatusSpan.textContent = voteType; // Update local UI
        await fetchPollCounts(); // Fetch updated global counts
        displayMessage(voteMessage, "Your vote has been recorded!", 'success');

    } catch (e) {
        console.error("Error voting:", e);
        let errorMessage = "Failed to record your vote. Please try again.";
        if (e.code === 'permission-denied') {
            // This is crucial: If the poll_results rule denied it, it's likely a second vote attempt.
            await checkUserVoteStatus(currentUser.uid); // Re-check state to confirm if user has voted
            if (hasVotedCurrentUser) {
                 errorMessage = "You have already voted!";
            } else {
                 errorMessage = "Missing or insufficient permissions. Check Firestore rules.";
            }
        }
        displayMessage(voteMessage, errorMessage, 'error');
        // Re-enable buttons if the vote wasn't cast (e.g., general error or permission denied without vote)
        if (!hasVotedCurrentUser) {
            setPollButtonsDisabled(false); 
        }
    }
}

// ==============================================
//               Event Listeners
// ==============================================

// Poll button event listeners
voteYesButton.addEventListener('click', () => handleVote('yes'));
voteNoButton.addEventListener('click', () => handleVote('no'));
voteMaybeButton.addEventListener('click', () => handleVote('maybe'));

// Navigation button event listeners
goToPollButton.addEventListener('click', () => showPage('pollPage'));
goToNewPageButton.addEventListener('click', () => showPage('newPage'));
backToMenuFromPollButton.addEventListener('click', () => showPage('menuPage'));
backToMenuFromNewPageButton.addEventListener('click', () => showPage('menuPage'));

// ==============================================
//            Initial App Load & Setup
// ==============================================
// On initial page load, ensure the login page is shown.
// The onAuthStateChanged listener will handle subsequent state changes.
document.addEventListener('DOMContentLoaded', () => {
    // This ensures the page is correctly displayed on initial load before auth state is fully resolved.
    if (!auth.currentUser) {
        showPage('loginPage');
    }
});
