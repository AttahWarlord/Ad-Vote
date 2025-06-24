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
const pollQuestionDisplay = document.getElementById('pollQuestionDisplay');

// Admin elements
const adminControlsDiv = document.getElementById('adminControlsDiv');
const pollQuestionInput = document.getElementById('pollQuestionInput');
const updateQuestionButton = document.getElementById('updateQuestionButton');
const userToClearVoteInput = document.getElementById('userToClearVoteInput');
const clearVoteButton = document.getElementById('clearVoteButton');
const adminMessage = document.getElementById('adminMessage');

// NEW: Element for displaying user list for admin
const userListForAdmin = document.getElementById('userListForAdmin');


// Global state variables
let currentUser = null;
let hasVotedCurrentUser = false;
let isAdmin = false; // GLOBAL isAdmin variable


// ==============================================
//           Utility Functions
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
    displayMessage(adminMessage, '', '');
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
//           Authentication Logic
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

        // Reset global isAdmin to false
        isAdmin = false;

        // Fetch user profile (username and isAdmin status)
        const userProfileRef = db.collection("users").doc(user.uid);

        console.log("Auth State Changed: User logged in.");
        console.log("User UID:", user.uid);

        try {
            const userProfileSnap = await userProfileRef.get();
            if (userProfileSnap.exists) {
                const userData = userProfileSnap.data();
                if (userData.username) {
                    displayedUsername = userData.username;
                }
                if (userData.isAdmin === true) {
                    isAdmin = true;
                }
                console.log("Firestore Data for user:", userData);
            } else {
                console.log("User profile document does not exist in Firestore for UID:", user.uid);
            }
        } catch (error) {
            console.error("Error fetching user profile:", error);
            displayedUsername = user.email + " (Error fetching username)";
        }

        console.log("Global isAdmin value after fetching profile:", isAdmin);

        loggedInUsernameSpan.textContent = displayedUsername;
        pollUserEmailSpan.textContent = displayedUsername;

        // Admin UI Visibility
        if (isAdmin) {
            // Admin controls are now inside pollPage, will only be visible when pollPage is active
            adminControlsDiv.classList.remove('hidden');
            loadUserListForAdmin(); // NEW: Load user list for admin
            console.log("Admin controls should now be VISIBLE (on poll page).");
        } else {
            adminControlsDiv.classList.add('hidden'); // Ensure it's hidden if not admin
            if (userListForAdmin) userListForAdmin.innerHTML = ''; // NEW: Clear user list if not admin
            console.log("Admin controls should now be HIDDEN.");
        }
        console.log("Current adminControlsDiv classes:", adminControlsDiv.classList.value);

        emailInput.value = '';
        passwordInput.value = '';

        showPage('menuPage');

        // After logging in, always check vote status and fetch poll counts for the poll page
        await checkUserVoteStatus(currentUser.uid);
        await fetchPollCounts();
    } else {
        // User is signed out
        currentUser = null;
        hasVotedCurrentUser = false;
        yourVoteStatusSpan.textContent = 'Not Voted';
        setPollButtonsDisabled(true);
        isAdmin = false; // Reset global isAdmin on logout
        adminControlsDiv.classList.add('hidden'); // Hide admin controls on logout
        if (userListForAdmin) userListForAdmin.innerHTML = ''; // NEW: Clear user list on logout
        showPage('loginPage');
        console.log("Auth State Changed: User logged out.");
    }
});

// ==============================================
//           Poll Logic (Firestore)
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
            yourVoteStatusSpan.textContent = docSnap.data().voteType;
            setPollButtonsDisabled(true);
        } else {
            hasVotedCurrentUser = false;
            yourVoteStatusSpan.textContent = 'Not Voted';
            if (currentUser) {
                setPollButtonsDisabled(false);
            }
        }
    } catch (e) {
        console.error("Error checking user vote status:", e);
        hasVotedCurrentUser = false;
        yourVoteStatusSpan.textContent = 'Error checking status';
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

            pollQuestionDisplay.textContent = data.question || "Default Poll Question";
            if (!adminControlsDiv.classList.contains('hidden')) {
                pollQuestionInput.value = data.question || "";
            }

        } else {
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
    displayMessage(voteMessage, '', '');

    if (!currentUser) {
        displayMessage(voteMessage, "You must be logged in to vote!", 'error');
        return;
    }
    if (hasVotedCurrentUser) {
        displayMessage(voteMessage, "You have already voted!", 'error');
        return;
    }

    setPollButtonsDisabled(true);

    try {
        await db.runTransaction(async (transaction) => {
            const currentPollDoc = await transaction.get(pollDocRef);
            if (!currentPollDoc.exists) {
                transaction.set(pollDocRef, { yes: 0, no: 0, maybe: 0 });
            }

            const currentData = currentPollDoc.data();
            const newCounts = {
                yes: currentData.yes || 0,
                no: currentData.no || 0,
                maybe: currentData.maybe || 0
            };
            newCounts[voteType]++;

            transaction.update(pollDocRef, newCounts);

            const userVoteDocRef = usersVotedCollection.doc(currentUser.uid);
            transaction.set(userVoteDocRef, {
                voteType: voteType,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        hasVotedCurrentUser = true;
        yourVoteStatusSpan.textContent = voteType;
        await fetchPollCounts();
        displayMessage(voteMessage, "Your vote has been recorded!", 'success');

    } catch (e) {
        console.error("Error voting:", e);
        let errorMessage = "Failed to record your vote. Please try again.";
        if (e.code === 'permission-denied') {
            await checkUserVoteStatus(currentUser.uid);
            if (hasVotedCurrentUser) {
                 errorMessage = "You have already voted!";
            } else {
                 errorMessage = "Missing or insufficient permissions. Check Firestore rules.";
            }
        }
        displayMessage(voteMessage, errorMessage, 'error');
        if (!hasVotedCurrentUser) {
            setPollButtonsDisabled(false);
        }
    }
}

// ==============================================
//           Admin Logic
// ==============================================

/**
 * Fetches and displays a list of all registered users (username and UID) for admin use.
 */
async function loadUserListForAdmin() {
    if (!userListForAdmin) return; // Ensure element exists

    userListForAdmin.innerHTML = '<h4>Registered Users:</h4><ul id="adminUserList"></ul>';
    const adminUserList = document.getElementById('adminUserList');
    if (!adminUserList) return;

    try {
        const usersSnapshot = await db.collection("users").get();
        if (usersSnapshot.empty) {
            adminUserList.innerHTML = '<li>No users registered yet.</li>';
            return;
        }

        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            const uid = doc.id;
            const username = userData.username || userData.email || 'No Username'; // Fallback to email or a default

            const listItem = document.createElement('li');
            listItem.classList.add('user-list-item'); // Add a class for styling
            listItem.innerHTML = `<strong>${username}</strong> (UID: <span class="user-uid">${uid}</span>)`;

            const copyButton = document.createElement('button');
            copyButton.textContent = 'Copy UID';
            copyButton.classList.add('copy-uid-button'); // Add a class for styling
            copyButton.onclick = () => {
                navigator.clipboard.writeText(uid)
                    .then(() => {
                        console.log('UID copied:', uid);
                        copyButton.textContent = 'Copied!';
                        setTimeout(() => copyButton.textContent = 'Copy UID', 1500);
                    })
                    .catch(err => console.error('Failed to copy UID:', err));
            };
            listItem.appendChild(copyButton);
            adminUserList.appendChild(listItem);
        });
    } catch (error) {
        console.error("Error loading user list for admin:", error);
        adminUserList.innerHTML = '<li>Error loading user list. Check Firestore rules for "users" collection.</li>';
    }
}


/**
 * Handles updating the poll question by an admin.
 */
updateQuestionButton.addEventListener('click', async () => {
    if (!currentUser || !isAdmin) {
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
        await fetchPollCounts();
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
    if (!currentUser || !isAdmin) {
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
                transaction.update(pollDocRef, {
                    [voteTypeToDecrement]: firebase.firestore.FieldValue.increment(-1)
                });
            }

            transaction.delete(userVoteDocRef);
        });

        displayMessage(adminMessage, `Vote for ${targetUid} cleared successfully!`, 'success');
        userToClearVoteInput.value = '';
        await fetchPollCounts();
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
        if (!hasVotedCurrentUser) {
            setPollButtonsDisabled(false);
        }
    }
});


// ==============================================
//           Event Listeners
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
document.addEventListener('DOMContentLoaded', () => {
    if (!auth.currentUser) {
        showPage('loginPage');
    }
});
