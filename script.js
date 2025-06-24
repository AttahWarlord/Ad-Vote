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
// Firestore Collection Reference for user profiles
const usersCollection = db.collection("users");


// ==============================================
//           HTML Element References
// ==============================================
// New Page elements
const backToMenuFromNewPageButton = document.getElementById('backToMenuFromNewPage');

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

// NEW: All Users Vote Status Elements
const allUsersVoteStatus = document.getElementById('allUsersVoteStatus');
const usersVoteList = document.getElementById('usersVoteList'); // The <ul> inside allUsersVoteStatus

// Admin elements
const adminControlsDiv = document.getElementById('adminControlsDiv');
const pollQuestionInput = document.getElementById('pollQuestionInput');
const updateQuestionButton = document.getElementById('updateQuestionButton');
const userToClearVoteInput = document.getElementById('userToClearVoteInput');
const clearVoteButton = document.getElementById('clearVoteButton');
const adminMessage = document.getElementById('adminMessage');
const userListForAdmin = document.getElementById('userListForAdmin'); // For displaying admin's list of users


// Global state variables
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

    loginButton.disabled = true;

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

        loggedInUsernameSpan.textContent = displayedUsername;
        pollUserEmailSpan.textContent = displayedUsername;

        // Admin UI Visibility and user list loading
        if (isAdmin) {
            adminControlsDiv.classList.remove('hidden');
            loadUserListForAdmin(); // Load user list for admin
        } else {
            adminControlsDiv.classList.add('hidden');
            if (userListForAdmin) userListForAdmin.innerHTML = ''; // Clear admin user list if not admin
        }

        emailInput.value = '';
        passwordInput.value = '';

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
        yourVoteStatusSpan.textContent = 'Not Voted';
        setPollButtonsDisabled(true);
        isAdmin = false;
        adminControlsDiv.classList.add('hidden');
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
        yourVoteStatusSpan.textContent = voteType;
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
        pollQuestionInput.value = newQuestion; // Ensure input reflects new question
        await fetchPollCounts(); // Re-fetch global counts (should be 0)
        await checkUserVoteStatus(currentUser.uid); // Reset current user's vote status
        await displayAllUsersVoteStatus(); // Update all votes display
    } catch (error) {
        console.error("Error resetting poll votes and question:", error);
        displayMessage(adminMessage, "Failed to update question and clear votes. Check console and rules.", 'error');
    }
}

/**
 * NEW FEATURE: Clears a specific user's vote. Used by admin list buttons and input field.
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
        userToClearVoteInput.value = ''; // Clear input field
        // Update UI
        await fetchPollCounts(); // Re-fetch global counts
        await displayAllUsersVoteStatus(); // Update all votes display
        // If the cleared user is the current logged-in user, allow them to vote again
        if (currentUser && currentUser.uid === targetUid) {
            hasVotedCurrentUser = false;
            yourVoteStatusSpan.textContent = 'Not Voted';
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
    }
}


/**
 * Fetches and displays a list of all registered users (username and UID) for admin use.
 */
async function loadUserListForAdmin() {
    if (!userListForAdmin) return; // Ensure element exists

    userListForAdmin.innerHTML = '<h4>Registered Users:</h4><ul id="adminUserList"><li>Loading admin user list...</li></ul>';
    const adminUserList = document.getElementById('adminUserList');
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
            clearUserButton.classList.add('copy-uid-button'); // Reuse styling for now
            clearUserButton.onclick = () => clearSpecificUserVote(user.uid);
            listItem.appendChild(clearUserButton);

            adminUserList.appendChild(listItem);
        });

    } catch (error) {
        console.error("Error loading user list for admin:", error);
        adminUserList.innerHTML = '<li>Error loading user list. Check Firestore rules.</li>';
    }
}


/**
 * Handles updating the poll question by an admin. Now also clears votes.
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

    // NEW: Call the function that resets votes and updates question
    await resetPollVotesAndQuestion(newQuestion);
});

/**
 * Handles clearing a user's vote by an admin via the input field.
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
    // Call the shared function to clear specific user's vote
    await clearSpecificUserVote(targetUid);
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
