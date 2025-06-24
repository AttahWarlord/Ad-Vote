// ==============================================
//           Firebase Configuration
// ==============================================
// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "YOUR_API_KEY", // Replace with your actual API Key
    authDomain: "YOUR_AUTH_DOMAIN", // Replace with your actual Auth Domain
    projectId: "YOUR_PROJECT_ID", // Replace with your actual Project ID
    storageBucket: "YOUR_STORAGE_BUCKET", // Replace with your actual Storage Bucket
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace with your actual Messaging Sender ID
    appId: "YOUR_APP_ID", // Replace with your actual App ID
    measurementId: "YOUR_MEASUREMENT_ID" // Replace with your actual Measurement ID
};

// Initialize Firebase services
const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore(app);
const auth = firebase.auth(app);

// Firestore Poll Document Reference
const pollDocRef = db.collection("polls").doc("poll_results");
// Firestore Collection Reference for tracking user votes
const usersVotedCollection = db.collection("users_voted");
// Firestore Collection Reference for user profiles
const usersCollection = db.collection("users");


// ==============================================
//           Global State Variables
// ==============================================
let currentUser = null;
let hasVotedCurrentUser = false;
let isAdmin = false;


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

    // If navigating to pollPage, ensure relevant data is updated
    if (pageId === 'pollPage' && currentUser) {
        checkUserVoteStatus(currentUser.uid); // Your vote status
        fetchPollCounts(); // Global poll counts and question
        displayAllUsersVoteStatus(); // NEW: All users' vote status
    }
}

/**
 * Displays a message in a designated message box.
 * @param {HTMLElement} element - The message box element.
 * @param {string} message - The message text.
 * @param {'success'|'error'|''} type - The type of message ('success', 'error', or empty for clear).
 */
function displayMessage(element, message, type) {
    if (!element) { // Added check in case element is null (e.g., adminMessage if not admin and page loads)
        console.warn("Attempted to display message to a null element:", message);
        return;
    }
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
    if (voteYesButton) voteYesButton.disabled = disabledState;
    if (voteNoButton) voteNoButton.disabled = disabledState;
    if (voteMaybeButton) voteMaybeButton.disabled = disabledState;
}

// ==============================================
//           Authentication Logic
// ==============================================

/**
 * Listens for Firebase Authentication state changes. This is the main router for pages.
 */
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        currentUser = user;
        let displayedUsername = user.email;
        isAdmin = false; // Reset isAdmin on every login check

        const userProfileRef = usersCollection.doc(user.uid);

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
            } else {
                console.log("User profile document does not exist in Firestore for UID:", user.uid);
                // Optionally, create a basic user profile if it doesn't exist (e.g., for new registrations)
                await userProfileRef.set({
                    username: user.email.split('@')[0], // Use part of email as default username
                    email: user.email,
                    isAdmin: false
                }, { merge: true }); // Use merge to avoid overwriting existing fields if they exist
            }
        } catch (error) {
            console.error("Error fetching or creating user profile:", error);
            displayedUsername = user.email + " (Error fetching username)";
        }

        if (loggedInUsernameSpan) loggedInUsernameSpan.textContent = displayedUsername;
        if (pollUserEmailSpan) pollUserEmailSpan.textContent = displayedUsername;

        // Admin UI Visibility and user list loading
        if (isAdmin) {
            if (adminControlsDiv) adminControlsDiv.classList.remove('hidden');
            loadUserListForAdmin(); // Load user list for admin
        } else {
            if (adminControlsDiv) adminControlsDiv.classList.add('hidden');
            if (userListForAdmin) userListForAdmin.innerHTML = ''; // Clear admin user list if not admin
        }

        if (emailInput) emailInput.value = '';
        if (passwordInput) passwordInput.value = '';

        showPage('menuPage');

        // Always check vote status and fetch poll counts/all votes after login
        // These are also called within showPage('pollPage') for re-entry scenarios
        await checkUserVoteStatus(currentUser.uid);
        await fetchPollCounts();
        await displayAllUsersVoteStatus(); // Initial load of all votes on login
    } else {
        // User is signed out
        currentUser = null;
        hasVotedCurrentUser = false;
        if (yourVoteStatusSpan) yourVoteStatusSpan.textContent = 'Not Voted';
        setPollButtonsDisabled(true);
        isAdmin = false;
        if (adminControlsDiv) adminControlsDiv.classList.add('hidden');
        if (userListForAdmin) userListForAdmin.innerHTML = ''; // Clear admin user list on logout
        if (usersVoteList) usersVoteList.innerHTML = '<li>Please log in to see votes.</li>'; // Clear all user votes on logout
        showPage('loginPage');
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
            if (yourVoteStatusSpan) yourVoteStatusSpan.textContent = docSnap.data().voteType;
            setPollButtonsDisabled(true);
        } else {
            hasVotedCurrentUser = false;
            if (yourVoteStatusSpan) yourVoteStatusSpan.textContent = 'Not Voted';
            if (currentUser) {
                setPollButtonsDisabled(false);
            }
        }
    } catch (e) {
        console.error("Error checking user vote status:", e);
        hasVotedCurrentUser = false;
        if (yourVoteStatusSpan) yourVoteStatusSpan.textContent = 'Error checking status';
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
            if (yesCountSpan) yesCountSpan.textContent = data.yes || 0;
            if (noCountSpan) noCountSpan.textContent = data.no || 0;
            if (maybeCountSpan) maybeCountSpan.textContent = data.maybe || 0;

            if (pollQuestionDisplay) pollQuestionDisplay.textContent = data.question || "Loading Poll Question...";
            // Check if adminControlsDiv is visible before setting input value
            if (adminControlsDiv && !adminControlsDiv.classList.contains('hidden') && pollQuestionInput) {
                pollQuestionInput.value = data.question || "";
            }

        } else {
            // Document doesn't exist, create it with initial values and a default question
            await pollDocRef.set({ yes: 0, no: 0, maybe: 0, question: "Is this the best poll ever?" });
            if (yesCountSpan) yesCountSpan.textContent = 0;
            if (noCountSpan) noCountSpan.textContent = 0;
            if (maybeCountSpan) maybeCountSpan.textContent = 0;
            if (pollQuestionDisplay) pollQuestionDisplay.textContent = "Is this the best poll ever?";
            // Check if adminControlsDiv is visible before setting input value
            if (adminControlsDiv && !adminControlsDiv.classList.contains('hidden') && pollQuestionInput) {
                pollQuestionInput.value = "Is this the best poll ever?";
            }
        }
    } catch (e) {
        console.error("Error fetching poll counts or question:", e);
        displayMessage(voteMessage, "Error fetching poll data.", 'error');
    }
}

/**
 * NEW FEATURE: Displays a list of all registered users and their current vote status.
 * Visible to all logged-in users on the poll page.
 */
async function displayAllUsersVoteStatus() {
    if (!usersVoteList) return; // Ensure element exists

    usersVoteList.innerHTML = '<li>Loading user votes...</li>'; // Show loading message

    try {
        // Fetch all users
        const usersSnapshot = await usersCollection.get();
        const allUsers = {};
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            allUsers[doc.id] = userData.username || userData.email.split('@')[0]; // Use username or part of email
        });

        // Fetch all votes
        const votesSnapshot = await usersVotedCollection.get();
        const userVotes = {};
        votesSnapshot.forEach(doc => {
            userVotes[doc.id] = doc.data().voteType;
        });

        // Generate the list
        usersVoteList.innerHTML = ''; // Clear loading message
        if (Object.keys(allUsers).length === 0) {
            usersVoteList.innerHTML = '<li>No users registered yet.</li>';
            return;
        }

        // Sort users alphabetically by username
        const sortedUserUids = Object.keys(allUsers).sort((uidA, uidB) =>
            allUsers[uidA].localeCompare(allUsers[uidB])
        );

        sortedUserUids.forEach(uid => {
            const username = allUsers[uid];
            const voteType = userVotes[uid] || 'Not Voted';
            const listItem = document.createElement('li');
            const voteClass = voteType.toLowerCase().replace(' ', '-'); // For CSS styling

            listItem.innerHTML = `<span>${username}:</span> <span class="vote-status ${voteClass}">${voteType}</span>`;
            usersVoteList.appendChild(listItem);
        });

    } catch (error) {
        console.error("Error displaying all users' vote status:", error);
        usersVoteList.innerHTML = '<li>Error loading user votes. Please check Firestore rules.</li>';
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
            let currentData = currentPollDoc.data() || { yes: 0, no: 0, maybe: 0 }; // Initialize if doc doesn't exist

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
        if (yourVoteStatusSpan) yourVoteStatusSpan.textContent = voteType;
        await fetchPollCounts();
        await displayAllUsersVoteStatus(); // Update all votes display
        displayMessage(voteMessage, "Your vote has been recorded!", 'success');

    } catch (e) {
        console.error("Error voting:", e);
        let errorMessage = "Failed to record your vote. Please try again.";
        if (e.code === 'permission-denied') {
            await checkUserVoteStatus(currentUser.uid); // Re-check state to confirm if user has voted
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
 * NEW FEATURE: Resets poll votes and updates the question.
 * @param {string} newQuestion - The new poll question.
 */
async function resetPollVotesAndQuestion(newQuestion) {
    displayMessage(adminMessage, 'Updating question and clearing votes...', '');

    try {
        await db.runTransaction(async (transaction) => {
            // 1. Reset poll counts and update question
            transaction.set(pollDocRef, {
                yes: 0,
                no: 0,
                maybe: 0,
                question: newQuestion,
            });

            // 2. Delete all user vote records
            const votesSnapshot = await usersVotedCollection.get();
            votesSnapshot.forEach(doc => {
                transaction.delete(doc.ref);
            });
        });

        displayMessage(adminMessage, 'Poll question updated and all votes cleared!', 'success');
        // Update UI
        if (pollQuestionInput) pollQuestionInput.value = newQuestion; // Ensure input reflects new question
        await fetchPollCounts(); // Re-fetch global counts (should be 0)
        await checkUserVoteStatus(currentUser.uid); // Reset current user's vote status
        await displayAllUsersVoteStatus(); // Update all votes display
        await loadUserListForAdmin(); // Refresh admin user list to show cleared votes/new state
    } catch (error) {
        console.error("Error resetting poll votes and question:", error);
        displayMessage(adminMessage, "Failed to update question and clear votes. Check console and rules.", 'error');
    }
}

/**
 * NEW FEATURE: Clears a specific user's vote. Used by admin list buttons.
 * @param {string} targetUid - The UID of the user whose vote to clear.
 */
async function clearSpecificUserVote(targetUid) {
    displayMessage(adminMessage, `Clearing vote for ${targetUid}...`, '');

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
        // Update UI
        await fetchPollCounts(); // Re-fetch global counts
        await displayAllUsersVoteStatus(); // Update all votes display
        // If the cleared user is the current logged-in user, allow them to vote again
        if (currentUser && currentUser.uid === targetUid) {
            hasVotedCurrentUser = false;
            if (yourVoteStatusSpan) yourVoteStatusSpan.textContent = 'Not Voted';
            setPollButtonsDisabled(false);
        }
        // Refresh admin user list to reflect cleared vote
        if (isAdmin) {
            loadUserListForAdmin();
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
        if (!hasVotedCurrentUser) { // Only enable buttons if user hasn't voted
            setPollButtonsDisabled(false);
        }
    }
}


/**
 * Fetches and displays a list of all registered users (username and UID) for admin use.
 * Includes "Clear Vote" buttons next to each user.
 */
async function loadUserListForAdmin() {
    if (!userListForAdmin) return; // Ensure element exists

    userListForAdmin.innerHTML = '<h4>Registered Users:</h4><ul id="adminUserList"><li>Loading admin user list...</li></ul>';
    const adminUserList = document.getElementById('adminUserList'); // Get local ref after HTML is populated
    if (!adminUserList) return;

    try {
        const usersSnapshot = await usersCollection.get();
        const votesSnapshot = await usersVotedCollection.get(); // Fetch votes to show status

        const userVotes = {};
        votesSnapshot.forEach(doc => {
            userVotes[doc.id] = doc.data().voteType;
        });

        adminUserList.innerHTML = ''; // Clear loading message

        if (usersSnapshot.empty) {
            adminUserList.innerHTML = '<li>No users registered yet.</li>';
            return;
        }

        // Sort users alphabetically by username
        const sortedUsers = [];
        usersSnapshot.forEach(doc => {
            const userData = doc.data();
            sortedUsers.push({
                uid: doc.id,
                username: userData.username || userData.email.split('@')[0], // Use username or part of email
                voteStatus: userVotes[doc.id] || 'Not Voted'
            });
        });

        sortedUsers.sort((a, b) => a.username.localeCompare(b.username));


        sortedUsers.forEach(user => {
            const listItem = document.createElement('li');
            listItem.classList.add('user-list-item');
            const voteClass = user.voteStatus.toLowerCase().replace(' ', '-');

            listItem.innerHTML = `
                <div>
                    <strong>${user.username}</strong>
                    <span class="vote-status ${voteClass}">(${user.voteStatus})</span>
                    <br>
                    <span class="user-uid">UID: ${user.uid}</span>
                </div>
            `;

            // NEW: Clear vote button next to each user
            const clearUserButton = document.createElement('button');
            clearUserButton.textContent = 'Clear Vote';
            clearUserButton.classList.add('clear-vote-button'); // Use specific class for clear vote button
            clearUserButton.onclick = () => clearSpecificUserVote(user.uid);
            listItem.appendChild(clearUserButton);

            adminUserList.appendChild(listItem);
        });

    } catch (error) {
        console.error("Error loading user list for admin:", error);
        adminUserList.innerHTML = '<li>Error loading user list. Check Firestore rules.</li>';
    }
}


// ==============================================
//           Initial App Load & Setup (and Event Listeners)
// ==============================================
// Declare global HTML element references. They might be null initially
// but will be correctly set when DOMContentLoaded fires.
let backToMenuFromNewPageButton;
let loginPage, menuPage, pollPage, newPage;
let authForm, emailInput, passwordInput, loginButton, authMessage;
let loggedInUsernameSpan, goToPollButton, goToNewPageButton, logoutButton;
let pollUserEmailSpan, voteYesButton, voteNoButton, voteMaybeButton;
let yesCountSpan, noCountSpan, maybeCountSpan, yourVoteStatusSpan, voteMessage;
let backToMenuFromPollButton;
let pollQuestionDisplay;
let allUsersVoteStatus, usersVoteList;
let adminControlsDiv, pollQuestionInput, updateQuestionButton, adminMessage;
let userListForAdmin; // Removed userToClearVoteInput and clearVoteButton


document.addEventListener('DOMContentLoaded', () => {
    // Assign HTML element references here, guaranteeing they are in the DOM
    backToMenuFromNewPageButton = document.getElementById('backToMenuFromNewPage');
    loginPage = document.getElementById('loginPage');
    menuPage = document.getElementById('menuPage');
    pollPage = document.getElementById('pollPage');
    newPage = document.getElementById('newPage');

    authForm = document.getElementById('authForm');
    emailInput = document.getElementById('email');
    passwordInput = document.getElementById('password');
    loginButton = document.getElementById('loginButton');
    authMessage = document.getElementById('authMessage');

    loggedInUsernameSpan = document.getElementById('loggedInUsername');
    goToPollButton = document.getElementById('goToPollButton');
    goToNewPageButton = document.getElementById('goToNewPageButton');
    logoutButton = document.getElementById('logoutButton');

    pollUserEmailSpan = document.getElementById('pollUserEmail');
    voteYesButton = document.getElementById('voteYes');
    voteNoButton = document.getElementById('voteNo');
    voteMaybeButton = document.getElementById('voteMaybe');
    yesCountSpan = document.getElementById('yesCount');
    noCountSpan = document.getElementById('noCount');
    maybeCountSpan = document.getElementById('maybeCount');
    yourVoteStatusSpan = document.getElementById('yourVoteStatus');
    voteMessage = document.getElementById('voteMessage');
    backToMenuFromPollButton = document.getElementById('backToMenuFromPoll');
    pollQuestionDisplay = document.getElementById('pollQuestionDisplay');

    allUsersVoteStatus = document.getElementById('allUsersVoteStatus');
    usersVoteList = document.getElementById('usersVoteList');

    adminControlsDiv = document.getElementById('adminControlsDiv');
    pollQuestionInput = document.getElementById('pollQuestionInput');
    updateQuestionButton = document.getElementById('updateQuestionButton');
    adminMessage = document.getElementById('adminMessage');
    userListForAdmin = document.getElementById('userListForAdmin');

    // ==============================================
    //           Event Listeners (Now inside DOMContentLoaded)
    // ==============================================

    // Auth form submission
    if (authForm) {
        authForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = emailInput.value;
            const password = passwordInput.value;
            displayMessage(authMessage, '', '');

            if (loginButton) loginButton.disabled = true;

            try {
                await auth.signInWithEmailAndPassword(email, password);
                displayMessage(authMessage, 'Login successful!', 'success');
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
                if (loginButton) loginButton.disabled = false;
            }
        });
    }


    // Logout button
    if (logoutButton) {
        logoutButton.addEventListener('click', async () => {
            try {
                await auth.signOut();
                displayMessage(authMessage, 'You have been logged out.', 'success');
            } catch (error) {
                console.error("Logout failed:", error.message);
                displayMessage(authMessage, "Failed to log out. Please try again.", 'error');
            }
        });
    }

    // Poll button event listeners
    if (voteYesButton) voteYesButton.addEventListener('click', () => handleVote('yes'));
    if (voteNoButton) voteNoButton.addEventListener('click', () => handleVote('no'));
    if (voteMaybeButton) voteMaybeButton.addEventListener('click', () => handleVote('maybe'));

    // Navigation button event listeners
    if (goToPollButton) goToPollButton.addEventListener('click', () => showPage('pollPage'));
    if (goToNewPageButton) goToNewPageButton.addEventListener('click', () => showPage('newPage'));
    if (backToMenuFromPollButton) backToMenuFromPollButton.addEventListener('click', () => showPage('menuPage'));
    if (backToMenuFromNewPageButton) backToMenuFromNewPageButton.addEventListener('click', () => showPage('menuPage'));

    // Admin control event listeners
    if (updateQuestionButton) {
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

            await resetPollVotesAndQuestion(newQuestion);
        });
    }

    // Initial page load for the app based on auth state
    // This part stays within DOMContentLoaded as it sets up the initial view.
    if (!auth.currentUser) {
        showPage('loginPage');
    }
});
