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
const db = firebase.firestore(app);
const auth = firebase.auth(app);

// ==============================================
//           Global Variables
// ==============================================
let currentUser = null; // Stores the currently logged-in user object
let currentUserId = null; // Stores the UID of the logged-in user
let currentUserIsAdmin = false; // Flag to check if the current user is an admin
let currentPollQuestion = ""; // Stores the current poll question
let currentUserCurrency = 0; // Stores the current user's currency balance
let userClickCount = 0; // Tracks clicks for the current session (not saved)
const coinsPerClick = 1; // How many coins per click

// ==============================================
//           DOM Element References
// ==============================================
// Pages
const loginPage = document.getElementById('loginPage');
const menuPage = document.getElementById('menuPage');
const pollPage = document.getElementById('pollPage');
const currencyPage = document.getElementById('currencyPage'); // Renamed from newPage

// Currency Sub-pages
const currencyHubMainContent = document.getElementById('currencyHubMainContent'); // NEW REFERENCE
const currencySubPagesContainer = document.getElementById('currencySubPagesContainer');
const clickerGamePage = document.getElementById('clickerGamePage');

// Login/Auth Page elements
const authForm = document.getElementById('authForm');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const authMessage = document.getElementById('authMessage');

// Menu Page elements
const loggedInUsernameDisplay = document.getElementById('loggedInUsername');
const goToPollButton = document.getElementById('goToPollButton');
const goToCurrencyPageButton = document.getElementById('goToCurrencyPageButton'); // Renamed
const logoutButton = document.getElementById('logoutButton');

// Poll Page elements
const pollUserEmailDisplay = document.getElementById('pollUserEmail');
const pollQuestionDisplay = document.getElementById('pollQuestionDisplay');
const voteYesButton = document.getElementById('voteYes');
const voteNoButton = document.getElementById('voteNo');
const voteMaybeButton = document.getElementById('voteMaybe');
const yesCountDisplay = document.getElementById('yesCount');
const noCountDisplay = document.getElementById('noCount');
const maybeCountDisplay = document.getElementById('maybeCount');
const yourVoteStatusDisplay = document.getElementById('yourVoteStatus');
const voteMessageDisplay = document.getElementById('voteMessage');
const backToMenuFromPollButton = document.getElementById('backToMenuFromPoll');
const allUsersVoteStatusSection = document.getElementById('allUsersVoteStatus');
const usersVoteList = document.getElementById('usersVoteList');

// Admin Controls (Poll Page)
const adminControlsDiv = document.getElementById('adminControlsDiv');
const adminMessage = document.getElementById('adminMessage');
const pollQuestionInput = document.getElementById('pollQuestionInput');
const updateQuestionButton = document.getElementById('updateQuestionButton');
const userListForAdmin = document.getElementById('userListForAdmin');

// Currency Hub Page elements
const userCurrencyBalanceDisplay = document.getElementById('userCurrencyBalance');
const goToClickerButton = document.getElementById('goToClickerButton');
const backToMenuFromCurrencyButton = document.getElementById('backToMenuFromCurrency'); // Renamed

// Clicker Game Page elements
const clickCountDisplay = document.getElementById('clickCountDisplay');
const earningPerClickDisplay = document.getElementById('earningPerClick');
const clickButton = document.getElementById('clickButton');
const backToCurrencyHubButton = document.getElementById('backToCurrencyHubButton');

// ==============================================
//           Utility Functions
// ==============================================

/**
 * Shows a specific application page and hides all others.
 * @param {HTMLElement} pageToShow - The DOM element of the page to display.
 */
function showPage(pageToShow) {
    const pages = [loginPage, menuPage, pollPage, currencyPage]; // Include all top-level pages
    pages.forEach(page => {
        if (page === pageToShow) {
            page.classList.remove('hidden');
        } else {
            page.classList.add('hidden');
        }
    });
}

/**
 * Shows a specific currency sub-page and hides others within the currencyPage.
 * Also manages the visibility of the main currency hub content.
 * @param {HTMLElement} subPageToShow - The DOM element of the currency sub-page to display, or null to show main hub.
 */
function showCurrencySubPage(subPageToShow) {
    const subPages = [clickerGamePage /* Add other currency sub-pages here later */];

    if (subPageToShow) {
        // If a sub-page is being shown, hide the main currency hub content
        currencyHubMainContent.classList.add('hidden');
    } else {
        // If no sub-page is being shown (i.e., back to main hub), show the main currency hub content
        currencyHubMainContent.classList.remove('hidden');
    }

    subPages.forEach(page => {
        if (page === subPageToShow) {
            page.classList.remove('hidden');
        } else {
            page.classList.add('hidden');
        }
    });
}


/**
 * Displays a message in the specified message box.
 * @param {HTMLElement} messageBox - The DOM element to display the message in.
 * @param {string} message - The message text.
 * @param {string} type - 'success', 'error', or '' (default/info).
 */
function displayMessage(messageBox, message, type = '') {
    messageBox.textContent = message;
    messageBox.className = `message-box ${type}`; // Apply class for styling
    messageBox.classList.remove('hidden'); // Ensure it's visible
    if (message === '') {
        messageBox.classList.add('hidden'); // Hide if message is empty
    }
}

// ==============================================
//           Authentication Functions
// ==============================================

/**
 * Handles user login or registration.
 * @param {Event} event - The form submission event.
 */
async function handleAuth(event) {
    event.preventDefault();
    const email = emailInput.value;
    const password = passwordInput.value;
    displayMessage(authMessage, ''); // Clear previous messages

    try {
        // Try to sign in first
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        console.log('Logged in successfully:', userCredential.user);
        displayMessage(authMessage, 'Login successful!', 'success');

    } catch (error) {
        // If sign-in fails, try to register
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                currentUser = userCredential.user;
                currentUserId = currentUser.uid;
                console.log('Registered successfully:', currentUser);

                // Create a new user document in Firestore for new registrations
                await db.collection('users').doc(currentUserId).set({
                    email: currentUser.email,
                    isAdmin: false, // Default to non-admin
                    username: email.split('@')[0], // Default username from email
                    currency: 0 // Initialize currency for new users
                });
                displayMessage(authMessage, 'Registration successful! You are now logged in.', 'success');

            } catch (registerError) {
                console.error('Registration failed:', registerError);
                displayMessage(authMessage, `Registration failed: ${registerError.message}`, 'error');
                return; // Stop execution if registration also fails
            }
        } else {
            console.error('Login failed:', error);
            displayMessage(authMessage, `Login failed: ${error.message}`, 'error');
            return; // Stop execution if login fails for other reasons
        }
    }
    // If login or registration was successful, update UI
    await updateUserDataAndUI();
    showPage(menuPage); // Go to menu page on success
}

/**
 * Handles user logout.
 */
async function handleLogout() {
    try {
        await auth.signOut();
        console.log('User logged out');
        currentUser = null;
        currentUserId = null;
        currentUserIsAdmin = false;
        showPage(loginPage); // Go back to login page
        displayMessage(authMessage, 'You have been logged out.', 'info');
        // Clear inputs for security
        emailInput.value = '';
        passwordInput.value = '';
        // Reset any UI elements that depend on user data
        loggedInUsernameDisplay.textContent = 'User';
    } catch (error) {
        console.error('Logout failed:', error);
        displayMessage(authMessage, `Logout failed: ${error.message}`, 'error');
    }
}

/**
 * Fetches user data from Firestore and updates global variables and UI.
 */
async function updateUserDataAndUI() {
    if (!currentUser || !currentUserId) return;

    try {
        const userDocRef = db.collection('users').doc(currentUserId);
        const userDoc = await userDocRef.get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            currentUserIsAdmin = userData.isAdmin || false;
            loggedInUsernameDisplay.textContent = userData.username || currentUser.email.split('@')[0];
            pollUserEmailDisplay.textContent = currentUser.email;
            currentUserCurrency = userData.currency || 0; // Get user's currency
            userCurrencyBalanceDisplay.textContent = currentUserCurrency; // Update currency display
            console.log('User data loaded:', userData);

            // Show/hide admin controls based on admin status
            if (currentUserIsAdmin) {
                adminControlsDiv.classList.remove('hidden');
            } else {
                adminControlsDiv.classList.add('hidden');
            }
        } else {
            console.warn("User document not found for:", currentUserId);
            // If user doc not found, it might be a new registration, create it
            await userDocRef.set({
                email: currentUser.email,
                isAdmin: false,
                username: currentUser.email.split('@')[0],
                currency: 0
            });
            currentUserIsAdmin = false;
            loggedInUsernameDisplay.textContent = currentUser.email.split('@')[0];
            pollUserEmailDisplay.textContent = currentUser.email;
            currentUserCurrency = 0;
            userCurrencyBalanceDisplay.textContent = 0;
        }
    } catch (error) {
        console.error("Error fetching user data:", error);
    }
}

// Listen for authentication state changes (handles page reloads, initial load)
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        currentUserId = user.uid;
        await updateUserDataAndUI();
        showPage(menuPage); // Show menu if logged in
    } else {
        showPage(loginPage); // Show login if not logged in
    }
});


// ==============================================
//           Poll Functions
// ==============================================

/**
 * Fetches poll question and votes from Firestore and updates UI.
 */
async function loadPoll() {
    displayMessage(voteMessageDisplay, ''); // Clear messages

    try {
        // Fetch poll question
        const pollDoc = await db.collection('polls').doc('currentPoll').get();
        if (pollDoc.exists && pollDoc.data().question) {
            currentPollQuestion = pollDoc.data().question;
            pollQuestionDisplay.textContent = currentPollQuestion;
        } else {
            pollQuestionDisplay.textContent = "No poll question set. Admin can set one.";
            currentPollQuestion = ""; // Reset if no question
        }

        // Fetch vote counts
        const voteCountsDoc = await db.collection('polls').doc('voteCounts').get();
        let yesCount = 0;
        let noCount = 0;
        let maybeCount = 0;

        if (voteCountsDoc.exists) {
            const counts = voteCountsDoc.data();
            yesCount = counts.yes || 0;
            noCount = counts.no || 0;
            maybeCount = counts.maybe || 0;
        }
        yesCountDisplay.textContent = yesCount;
        noCountDisplay.textContent = noCount;
        maybeCountDisplay.textContent = maybeCount;

        // Fetch user's own vote
        if (currentUserId) {
            const userVoteDoc = await db.collection('users_voted').doc(currentUserId).get();
            if (userVoteDoc.exists && userVoteDoc.data().vote) {
                yourVoteStatusDisplay.textContent = userVoteDoc.data().vote;
            } else {
                yourVoteStatusDisplay.textContent = 'Not Voted';
            }
        } else {
            yourVoteStatusDisplay.textContent = 'N/A (Log in)';
        }

        // Load all user votes for display
        await loadAllUserVotes();

    } catch (error) {
        console.error("Error loading poll:", error);
        pollQuestionDisplay.textContent = "Error loading poll.";
        displayMessage(voteMessageDisplay, `Error loading poll: ${error.message}`, 'error');
    }
}

/**
 * Handles voting for the poll.
 * @param {string} voteType - 'yes', 'no', or 'maybe'.
 */
async function handleVote(voteType) {
    if (!currentUser || !currentUserId) {
        displayMessage(voteMessageDisplay, 'Please log in to vote.', 'error');
        return;
    }
    if (!currentPollQuestion) {
        displayMessage(voteMessageDisplay, 'No active poll to vote on.', 'error');
        return;
    }
    displayMessage(voteMessageDisplay, ''); // Clear previous messages

    const userVoteRef = db.collection('users_voted').doc(currentUserId);
    const voteCountsRef = db.collection('polls').doc('voteCounts');

    try {
        await db.runTransaction(async (transaction) => {
            const userVoteDoc = await transaction.get(userVoteRef);
            const voteCountsDoc = await transaction.get(voteCountsRef);

            let oldVote = null;
            if (userVoteDoc.exists && userVoteDoc.data().vote) {
                oldVote = userVoteDoc.data().vote;
            }

            const currentCounts = voteCountsDoc.exists ? voteCountsDoc.data() : { yes: 0, no: 0, maybe: 0 };

            // Decrement old vote count if user changed their vote
            if (oldVote && oldVote !== voteType) {
                currentCounts[oldVote] = (currentCounts[oldVote] || 0) - 1;
            }

            // Increment new vote count
            if (oldVote !== voteType) { // Only increment if it's a new vote or a change
                currentCounts[voteType] = (currentCounts[voteType] || 0) + 1;
            }

            // Update user's vote
            transaction.set(userVoteRef, {
                userId: currentUserId,
                vote: voteType,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Update global vote counts
            transaction.set(voteCountsRef, currentCounts);
        });

        displayMessage(voteMessageDisplay, 'Your vote has been recorded!', 'success');
        await loadPoll(); // Reload poll to update counts and user's vote status
    } catch (error) {
        console.error("Error voting:", error);
        displayMessage(voteMessageDisplay, `Error recording vote: ${error.message}`, 'error');
    }
}

/**
 * Loads and displays all user votes (visible to all logged-in users).
 */
async function loadAllUserVotes() {
    if (!currentUser) {
        usersVoteList.innerHTML = '<li>Log in to see all user votes.</li>';
        return;
    }

    try {
        const usersRef = db.collection('users');
        const usersVotedRef = db.collection('users_voted');

        const [usersSnapshot, usersVotedSnapshot] = await Promise.all([
            usersRef.get(),
            usersVotedRef.get()
        ]);

        const allUsers = {};
        usersSnapshot.forEach(doc => {
            const data = doc.data();
            allUsers[doc.id] = data.username || data.email.split('@')[0];
        });

        const userVotes = {};
        usersVotedSnapshot.forEach(doc => {
            userVotes[doc.id] = doc.data().vote;
        });

        usersVoteList.innerHTML = ''; // Clear previous list

        // Determine which list to populate based on admin status
        const targetList = currentUserIsAdmin ? userListForAdmin : usersVoteList;
        targetList.innerHTML = ''; // Clear the appropriate list

        if (currentUserIsAdmin) {
            // For admin view, list all registered users and their votes
            for (const userId in allUsers) {
                const username = allUsers[userId];
                const vote = userVotes[userId] || 'Not Voted';
                const li = document.createElement('li');
                li.innerHTML = `
                    <strong>${username}</strong> (UID:${userId}): ${vote}
                    <button class="copy-uid-button secondary-button" data-uid="${userId}">Copy UID</button>
                    <button class="clear-vote-button danger-button" data-uid="${userId}">Clear Vote</button>
                `;
                targetList.appendChild(li);
            }
            // Add event listeners for copy/clear buttons
            targetList.querySelectorAll('.copy-uid-button').forEach(button => {
                button.addEventListener('click', (e) => {
                    const uid = e.target.dataset.uid;
                    navigator.clipboard.writeText(uid).then(() => {
                        alert('UID copied: ' + uid);
                    }).catch(err => {
                        console.error('Failed to copy UID:', err);
                    });
                });
            });
            targetList.querySelectorAll('.clear-vote-button').forEach(button => {
                button.addEventListener('click', (e) => clearUserVote(e.target.dataset.uid));
            });

        } else {
            // For regular users, just list username and vote
            const sortedUserIds = Object.keys(allUsers).sort((a, b) => allUsers[a].localeCompare(allUsers[b]));
            sortedUserIds.forEach(userId => {
                const username = allUsers[userId];
                const vote = userVotes[userId] || 'Not Voted';
                const li = document.createElement('li');
                li.textContent = `${username}: ${vote}`;
                usersVoteList.appendChild(li);
            });
        }
    } catch (error) {
        console.error("Error loading all user votes:", error);
        usersVoteList.innerHTML = '<li>Error loading votes.</li>';
    }
}

// ==============================================
//           Admin Functions (Poll)
// ==============================================

/**
 * Handles updating the poll question (admin function).
 */
async function handleUpdatePollQuestion() {
    if (!currentUserIsAdmin) {
        displayMessage(adminMessage, 'Access denied. You are not an admin.', 'error');
        return;
    }
    const newQuestion = pollQuestionInput.value.trim();
    if (!newQuestion) {
        displayMessage(adminMessage, 'Poll question cannot be empty.', 'error');
        return;
    }
    displayMessage(adminMessage, ''); // Clear previous messages

    try {
        await db.runTransaction(async (transaction) => {
            const currentPollRef = db.collection('polls').doc('currentPoll');
            const voteCountsRef = db.collection('polls').doc('voteCounts');
            const usersVotedCollectionRef = db.collection('users_voted');

            // 1. Update the poll question
            transaction.set(currentPollRef, { question: newQuestion });

            // 2. Reset vote counts to zero
            transaction.set(voteCountsRef, { yes: 0, no: 0, maybe: 0 });

            // 3. Delete all documents in the 'users_voted' collection
            const usersVotedSnapshot = await usersVotedCollectionRef.get();
            usersVotedSnapshot.docs.forEach(doc => {
                transaction.delete(usersVotedCollectionRef.doc(doc.id));
            });
        });

        displayMessage(adminMessage, 'Poll question updated and all votes reset successfully!', 'success');
        pollQuestionInput.value = ''; // Clear input
        await loadPoll(); // Reload poll to show new question and reset counts
    } catch (error) {
        console.error("Error updating poll question:", error);
        displayMessage(adminMessage, `Error updating poll question: ${error.message}`, 'error');
    }
}

/**
 * Clears a specific user's vote (admin function).
 * @param {string} userIdToClear - The UID of the user whose vote to clear.
 */
async function clearUserVote(userIdToClear) {
    if (!currentUserIsAdmin) {
        displayMessage(adminMessage, 'Access denied. You are not an admin.', 'error');
        return;
    }
    if (!userIdToClear) {
        displayMessage(adminMessage, 'Please provide a User ID to clear.', 'error');
        return;
    }
    displayMessage(adminMessage, ''); // Clear previous messages

    const userVoteRef = db.collection('users_voted').doc(userIdToClear);
    const voteCountsRef = db.collection('polls').doc('voteCounts');

    try {
        await db.runTransaction(async (transaction) => {
            const userVoteDoc = await transaction.get(userVoteRef);
            if (!userVoteDoc.exists || !userVoteDoc.data().vote) {
                console.log(`User ${userIdToClear} had no vote to clear.`);
                return; // Nothing to do
            }

            const oldVote = userVoteDoc.data().vote;
            const voteCountsDoc = await transaction.get(voteCountsRef);
            const currentCounts = voteCountsDoc.exists ? voteCountsDoc.data() : { yes: 0, no: 0, maybe: 0 };

            // Decrement the count of the cleared vote
            if (currentCounts[oldVote] > 0) {
                currentCounts[oldVote]--;
            }

            // Delete the user's vote document
            transaction.delete(userVoteRef);

            // Update global vote counts
            transaction.set(voteCountsRef, currentCounts);
        });

        displayMessage(adminMessage, `Vote for user ${userIdToClear} cleared successfully!`, 'success');
        await loadPoll(); // Reload poll to update counts and user list
    } catch (error) {
        console.error("Error clearing user vote:", error);
        displayMessage(adminMessage, `Error clearing user vote: ${error.message}`, 'error');
    }
}

// ==============================================
//           Currency Hub Functions
// ==============================================

/**
 * Handles the click action for the clicker game.
 */
async function handleCoinClick() {
    if (!currentUser || !currentUserId) {
        console.log("Not logged in, cannot earn currency.");
        return;
    }

    userClickCount++; // Increment session click count
    currentUserCurrency += coinsPerClick; // Increment user's currency

    clickCountDisplay.textContent = userClickCount;
    userCurrencyBalanceDisplay.textContent = currentUserCurrency; // Update balance in Currency Hub

    try {
        // Update currency in Firestore
        await db.collection('users').doc(currentUserId).update({
            currency: currentUserCurrency
        });
        console.log(`Currency updated for ${currentUserId}: ${currentUserCurrency}`);
    } catch (error) {
        console.error("Error updating currency:", error);
        // You might want to display a message to the user here
    }
}

// ==============================================
//           Event Listeners
// ==============================================

// Auth Form
authForm.addEventListener('submit', handleAuth);

// Menu Page Buttons
goToPollButton.addEventListener('click', () => {
    showPage(pollPage);
    loadPoll(); // Load poll data when navigating to poll page
});

// Corrected: Navigate to Currency Hub, then hide sub-pages to show main hub view
goToCurrencyPageButton.addEventListener('click', () => {
    showPage(currencyPage);
    showCurrencySubPage(null); // Hide all sub-pages, showing only the main hub buttons
});

logoutButton.addEventListener('click', handleLogout);

// Poll Page Buttons
voteYesButton.addEventListener('click', () => handleVote('yes'));
voteNoButton.addEventListener('click', () => handleVote('no'));
voteMaybeButton.addEventListener('click', () => handleVote('maybe'));
backToMenuFromPollButton.addEventListener('click', () => showPage(menuPage));

// Admin Controls (Poll Page)
updateQuestionButton.addEventListener('click', handleUpdatePollQuestion);

// Currency Hub Buttons
goToClickerButton.addEventListener('click', () => {
    showCurrencySubPage(clickerGamePage); // Show the clicker game sub-page
    userClickCount = 0; // Reset click count when entering clicker game
    clickCountDisplay.textContent = userClickCount; // Update display
});

// Clicker Game Buttons
clickButton.addEventListener('click', handleCoinClick);
backToCurrencyHubButton.addEventListener('click', () => {
    showCurrencySubPage(null); // Hide all sub-pages, return to main currency hub view
});

// Back from Currency Hub to Main Menu
backToMenuFromCurrencyButton.addEventListener('click', () => showPage(menuPage));

// Initial checks/loads when script starts (after Firebase init)
// Handled by onAuthStateChanged listener
