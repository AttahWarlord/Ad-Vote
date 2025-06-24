// ==============================================
//           Firebase Configuration
// ==============================================
// Your web app's Firebase configuration 
const firebaseConfig = {
    apiKey: "AIzaSyAc7uHnM5lxnQ9l1M0z_iUarScUtJZI678",
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
//                   Admin
// ==============================================

// Admin elements
const adminControlsDiv = document.getElementById('adminControlsDiv');
const pollQuestionInput = document.getElementById('pollQuestionInput');
const updateQuestionButton = document.getElementById('updateQuestionButton');
const userToClearVoteInput = document.getElementById('userToClearVoteInput');
const clearVoteButton = document.getElementById('clearVoteButton');
const adminMessage = document.getElementById('adminMessage');

// Poll elements (add this one if you didn't already for the question display)
const pollQuestionDisplay = document.getElementById('pollQuestionDisplay');

// ==============================================
//           Admin Logic
// ==============================================

/**
 * Handles updating the poll question by an admin.
 */
updateQuestionButton.addEventListener('click', async () => {
    if (!currentUser || !adminControlsDiv.classList.contains('hidden')) { // Ensure user is logged in AND is admin
        displayMessage(adminMessage, "Authentication or Admin status required.", 'error');
        return;
    }

    const newQuestion = pollQuestionInput.value.trim();
    if (!newQuestion) {
        displayMessage(adminMessage, "Poll question cannot be empty.", 'error');
        return;
    }

    displayMessage(adminMessage, 'Updating question...', '');
    try {
        await pollDocRef.update({ question: newQuestion });
        displayMessage(adminMessage, 'Poll question updated!', 'success');
        await fetchPollCounts(); // Update display immediately
    } catch (error) {
        console.error("Error updating poll question:", error);
        displayMessage(adminMessage, "Failed to update question. Check console and rules.", 'error');
    }
});

/**
 * Handles clearing a user's vote by an admin.
 * This involves deleting the user's vote record and decrementing the poll count.
 */
clearVoteButton.addEventListener('click', async () => {
    if (!currentUser || !isAdmin) { // Ensure user is logged in AND is admin
    // The isAdmin variable is now global
    displayMessage(adminMessage, "Authentication or Admin status required.", 'error');
    return;
}
        displayMessage(adminMessage, "Authentication or Admin status required.", 'error');
        return;
    }

    const targetUid = userToClearVoteInput.value.trim();
    if (!targetUid) {
        displayMessage(adminMessage, "Please enter a User UID to clear.", 'error');
        return;
    }

    displayMessage(adminMessage, 'Clearing vote...', '');
    try {
        await db.runTransaction(async (transaction) => {
            const userVoteDocRef = usersVotedCollection.doc(targetUid);
            const userVoteSnap = await transaction.get(userVoteDocRef);

            if (!userVoteSnap.exists) {
                throw new Error("User has not voted or invalid UID.");
            }

            const voteTypeToDecrement = userVoteSnap.data().voteType;
            const currentPollDoc = await transaction.get(pollDocRef);
            const currentData = currentPollDoc.data();

            if (currentData[voteTypeToDecrement] && currentData[voteTypeToDecrement] > 0) {
                // Decrement the specific vote count
                transaction.update(pollDocRef, {
                    [voteTypeToDecrement]: firebase.firestore.FieldValue.increment(-1)
                });
            }

            // Delete the user's vote record
            transaction.delete(userVoteDocRef);
        });

        displayMessage(adminMessage, `Vote for ${targetUid} cleared successfully!`, 'success');
        userToClearVoteInput.value = ''; // Clear input
        await fetchPollCounts(); // Update display
        // If the cleared user is the current logged-in user, allow them to vote again
        if (currentUser && currentUser.uid === targetUid) {
            hasVotedCurrentUser = false;
            yourVoteStatusSpan.textContent = 'Not Voted';
            setPollButtonsDisabled(false);
        }
    } catch (error) {
        console.error("Error clearing user vote:", error);
        let errorMessage = "Failed to clear vote. ";
        if (error.message.includes("User has not voted")) {
            errorMessage += "User has not voted or invalid UID.";
        } else if (error.code === 'permission-denied') {
            errorMessage += "Permission denied. Check Firestore rules.";
        }
        displayMessage(adminMessage, errorMessage, 'error');
    }
});

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
let isAdmin = false;

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

        let displayedUsername = user.email;

        // Reset global isAdmin to false, ensure no 'let' here as it's declared globally
        isAdmin = false;

        // Fetch user profile (username and isAdmin status)
        const userProfileRef = db.collection("users").doc(user.uid);

        // --- DEBUGGING LOGS START ---
        console.log("Auth State Changed: User logged in.");
        console.log("User UID:", user.uid); // Ensure this line is exactly as written
        // --- DEBUGGING LOGS END ---

        try {
            const userProfileSnap = await userProfileRef.get();
            if (userProfileSnap.exists) {
                const userData = userProfileSnap.data();
                if (userData.username) {
                    displayedUsername = userData.username;
                }
                // Assign to the global isAdmin variable
                if (userData.isAdmin === true) {
                    isAdmin = true;
                }
                // --- DEBUGGING LOGS START ---
                console.log("Firestore Data for user:", userData); // Ensure this line is exactly as written
                // --- DEBUGGING LOGS END ---
            } else {
                console.log("User profile document does not exist in Firestore for UID:", user.uid);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            displayedUsername = user.email + " (Error fetching username)";
        }

        // --- DEBUGGING LOGS START ---
        console.log("Global isAdmin value after fetching profile:", isAdmin); // Ensure this line is exactly as written
        // --- DEBUGGING LOGS END ---

        loggedInUsernameSpan.textContent = displayedUsername;
        pollUserEmailSpan.textContent = displayedUsername;

        // Admin UI Visibility
        if (isAdmin) {
            adminControlsDiv.classList.remove('hidden');
            // --- DEBUGGING LOGS START ---
            console.log("Admin controls should now be VISIBLE."); // Ensure this line is exactly as written
            // --- DEBUGGING LOGS END ---
        } else {
            adminControlsDiv.classList.add('hidden'); // Ensure it's hidden if not admin
            // --- DEBUGGING LOGS START ---
            console.log("Admin controls should now be HIDDEN."); // Ensure this line is exactly as written
            // --- DEBUGGING LOGS END ---
        }
        // --- DEBUGGING LOGS START ---
        console.log("Current adminControlsDiv classes:", adminControlsDiv.classList.value); // Ensure this line is exactly as written
        // --- DEBUGGING LOGS END ---

        emailInput.value = '';
        passwordInput.value = '';

        showPage('menuPage');

        // After logging in, always check vote status and fetch poll counts for the poll page
        await checkUserVoteStatus(currentUser.uid);
        await fetchPollCounts(); // This function will also now fetch the question
    } else {
        // User is signed out
        currentUser = null;
        hasVotedCurrentUser = false;
        yourVoteStatusSpan.textContent = 'Not Voted';
        setPollButtonsDisabled(true);
        isAdmin = false; // Reset global isAdmin on logout
        adminControlsDiv.classList.add('hidden'); // Hide admin controls on logout
        showPage('loginPage');
        console.log("Auth State Changed: User logged out.");
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
 * Fetches and updates global poll counts and the poll question from Firestore.
 */
async function fetchPollCounts() {
    try {
        const docSnap = await pollDocRef.get();
        if (docSnap.exists) {
            const data = docSnap.data();
            yesCountSpan.textContent = data.yes || 0;
            noCountSpan.textContent = data.no || 0;
            maybeCountSpan.textContent = data.maybe || 0;

            // Display the poll question
            pollQuestionDisplay.textContent = data.question || "Default Poll Question";
            // Populate admin input if visible
            if (!adminControlsDiv.classList.contains('hidden')) {
                pollQuestionInput.value = data.question || "";
            }

        } else {
            // Document doesn't exist, create it with initial values and a default question
            await pollDocRef.set({ yes: 0, no: 0, maybe: 0, question: "Is this the best poll ever?" });
            yesCountSpan.textContent = 0;
            noCountSpan.textContent = 0;
            maybeCountSpan.textContent = 0;
            pollQuestionDisplay.textContent = "Is this the best poll ever?";
            if (!adminControlsDiv.classList.contains('hidden')) {
                pollQuestionInput.value = "Is this the best poll ever?";
            }
        }
    } catch (e) {
        console.error("Error fetching poll counts or question:", e);
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
