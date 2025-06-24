// ==============================================
//           Firebase Configuration
// ==============================================
// Your web app's Firebase configuration - MUST BE THE SAME AS BEFORE
const firebaseConfig = {
    apiKey: "AIzaSyAc7uHnM5lxnQ9l1M0z_iUarScUtJZI678", // Replace with your actual API Key
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

// Firestore Collection References
const usersCollection = db.collection("users");
const pollsCollection = db.collection("polls"); // Reference to the 'polls' collection

// ==============================================
//           Global State Variables
// ==============================================
let currentUser = null;
let isAdmin = false; // Track admin status
let currentPollQuestion = ""; // Store the current poll question
let currentPollOptions = {}; // Store the current poll options and counts

// ==============================================
//           Utility Functions
// ==============================================

/**
 * Displays a message in a designated message box.
 * @param {HTMLElement} element - The message box element.
 * @param {string} message - The message text.
 * @param {'success'|'error'|''} type - The type of message ('success', 'error', or empty for clear).
 */
function displayMessage(element, message, type) {
    if (!element) {
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
 * Shows a specific page and hides others.
 * @param {string} pageId - The ID of the page to show.
 */
function showPage(pageId) {
    const pages = document.querySelectorAll('.app-page');
    pages.forEach(page => page.classList.add('hidden'));
    const pageToShow = document.getElementById(pageId);
    if (pageToShow) {
        pageToShow.classList.remove('hidden');
    }
}

// ==============================================
//           Authentication Handlers
// ==============================================

/**
 * Handles user login.
 * @param {string} email - The user's email.
 * @param {string} password - The user's password.
 */
async function handleLogin(email, password) {
    if (!authForm || !authMessage) return; // Ensure elements exist

    displayMessage(authMessage, 'Logging in...', '');
    loginButton.disabled = true; // Disable login button

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const user = userCredential.user;
        if (user) {
            displayMessage(authMessage, 'Login successful!', 'success');
            // Fetch username and admin status immediately after login
            await fetchUserProfile(user);
            showPage('menuPage');
        }
    } catch (error) {
        console.error("Login error:", error);
        let errorMessage = "Login failed. Please check your credentials.";
        if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            errorMessage = "Invalid email or password.";
        } else if (error.code === 'auth/invalid-email') {
             errorMessage = "Invalid email format.";
        }
        displayMessage(authMessage, errorMessage, 'error');
    } finally {
        loginButton.disabled = false; // Re-enable login button
    }
}

/**
 * Handles user logout.
 */
async function handleLogout() {
    try {
        await auth.signOut();
        console.log('User signed out.');
        // Clear global state
        currentUser = null;
        isAdmin = false;
        currentPollQuestion = "";
        currentPollOptions = {};
        showPage('loginPage'); // Go back to login page
        displayMessage(authMessage, '', ''); // Clear any login messages
        document.getElementById('email').value = ''; // Clear login form
        document.getElementById('password').value = '';
    } catch (error) {
        console.error("Logout error:", error);
        alert('Failed to logout. Please try again.');
    }
}

// ==============================================
//           User Profile Management
// ==============================================

/**
 * Fetches the user's profile from Firestore and updates the UI.
 * @param {firebase.User} user - The currently logged-in user.
 */
async function fetchUserProfile(user) {
    try {
        const userDoc = await usersCollection.doc(user.uid).get();
        if (userDoc.exists) {
            const userData = userDoc.data();
            const username = userData.username || user.email; // Use username if available
            loggedInUsernameSpan.textContent = username;
            pollUserEmailSpan.textContent = username; // Update poll page username as well
            isAdmin = userData.isAdmin || false; // Set admin status (default to false if not set)
            updateAdminUI(); // Update UI visibility based on admin status
        } else {
            console.warn("User document not found for:", user.uid, ". Creating default profile.");
            // If user doc doesn't exist, create it with default values
            await createDefaultUserProfile(user);
            // After creating, re-fetch to ensure UI is updated
            await fetchUserProfile(user);
        }
    } catch (error) {
        console.error("Error fetching user profile:", error);
        loggedInUsernameSpan.textContent = user.email; // Fallback to email
        pollUserEmailSpan.textContent = user.email;
    }
}

/**
 * Creates a default user profile in Firestore if one doesn't exist.
 * This is called if a user logs in for the first time and has no profile document.
 * @param {firebase.User} user - The currently logged-in user.
 */
async function createDefaultUserProfile(user) {
    try {
        // Use set with merge:true to ensure it doesn't overwrite existing fields if any
        await usersCollection.doc(user.uid).set({
            username: user.email, // Default to email as username
            isAdmin: false, // Default to non-admin
            currency: 0 // Initialize currency for new users
        }, { merge: true });
        console.log("Default user profile created for:", user.uid);
    } catch (error) {
        console.error("Error creating default user profile for UID:", user.uid, error);
    }
}


/**
 * Updates the admin-specific UI elements based on the user's admin status.
 */
function updateAdminUI() {
    const adminControlsDiv = document.getElementById('adminControlsDiv');
    if (adminControlsDiv) {
        adminControlsDiv.classList.toggle('hidden', !isAdmin); // Show/hide admin section
    }
    // Also, if not admin, clear admin specific input fields
    if (!isAdmin) {
        if (pollQuestionInput) pollQuestionInput.value = '';
        if (newPollOptionInput) newPollOptionInput.value = '';
        if (userListForAdmin) userListForAdmin.innerHTML = ''; // Clear admin list
        if (adminMessage) displayMessage(adminMessage, '', ''); // Clear admin messages
    }
}

// ==============================================
//           Poll Functionality (Modified for dynamic options)
// ==============================================

/**
 * Fetches the poll question and options from Firestore and updates the UI.
 * This is the central function for loading poll data.
 */
async function fetchPollData() {
    try {
        const pollDoc = await pollsCollection.doc('poll_results').get();
        if (pollDoc.exists) {
            const pollData = pollDoc.data();
            currentPollQuestion = pollData.question || "Loading question...";
            // Ensure options is an object, default to empty if not present or not an object
            currentPollOptions = (typeof pollData.options === 'object' && pollData.options !== null) ? pollData.options : {};
        } else {
            // If poll_results document doesn't exist, create it with default empty values
            await pollsCollection.doc('poll_results').set({
                question: "What's your opinion?",
                options: {}
            });
            currentPollQuestion = "What's your opinion?";
            currentPollOptions = {};
        }

        // Update UI elements
        if (pollQuestionDisplay) pollQuestionDisplay.textContent = currentPollQuestion;
        generatePollButtons();
        generatePollResults();

        // Admin-specific UI update
        if (isAdmin) {
            generateCurrentPollOptionsList();
            if (pollQuestionInput) pollQuestionInput.value = currentPollQuestion; // Prefill admin input
        }

        // Fetch user's vote status (after poll data is loaded)
        if (currentUser) {
            await fetchUserVoteStatus();
        }

    } catch (error) {
        console.error("Error fetching poll data:", error);
        if (pollQuestionDisplay) pollQuestionDisplay.textContent = "Error loading poll.";
    }
}

/**
 * Generates the poll option buttons dynamically based on the current options.
 */
function generatePollButtons() {
    if (!pollButtonsContainer) return;

    pollButtonsContainer.innerHTML = ''; // Clear existing buttons

    const optionKeys = Object.keys(currentPollOptions);
    if (optionKeys.length === 0) {
        pollButtonsContainer.innerHTML = '<p>No poll options available. Admin can add them.</p>';
        return;
    }

    optionKeys.forEach(option => {
        const button = document.createElement('button');
        button.textContent = option;
        button.classList.add('poll-button');

        // Add specific color classes if they match (optional, but good for consistency)
        const lowerCaseOption = option.toLowerCase();
        if (lowerCaseOption.includes('yes')) {
            button.classList.add('yes-button');
        } else if (lowerCaseOption.includes('no')) {
            button.classList.add('no-button');
        } else if (lowerCaseOption.includes('maybe')) {
            button.classList.add('maybe-button');
        } else {
            // Default styling for custom options if no specific class matches
            button.style.backgroundColor = '#4CAF50'; // A generic green
            button.style.color = 'white';
        }

        button.addEventListener('click', () => handleVote(option));
        pollButtonsContainer.appendChild(button);
    });
}

/**
 * Generates the poll results display dynamically based on the current options.
 */
function generatePollResults() {
    if (!pollResultsContainer) return;

    // Preserve yourVoteStatusSpan by temporarily detaching it or recreating it
    const yourVoteStatusParagraph = pollResultsContainer.querySelector('.small-text');
    if (yourVoteStatusParagraph) yourVoteStatusParagraph.remove();

    pollResultsContainer.innerHTML = ''; // Clear existing results except your vote

    const optionKeys = Object.keys(currentPollOptions);
    if (optionKeys.length === 0) {
        pollResultsContainer.innerHTML = '<p>No results available.</p>';
        // Re-append the yourVoteStatusParagraph if it existed
        if (yourVoteStatusParagraph) pollResultsContainer.appendChild(yourVoteStatusParagraph);
        return;
    }

    optionKeys.forEach(option => {
        const count = currentPollOptions[option] || 0; // Default to 0 if count is missing
        const resultParagraph = document.createElement('p');
        resultParagraph.textContent = `${option} votes: `;
        const countSpan = document.createElement('span');
        countSpan.textContent = count;
        resultParagraph.appendChild(countSpan);
        pollResultsContainer.appendChild(resultParagraph);
    });

    // Re-append the yourVoteStatusParagraph at the end
    if (yourVoteStatusParagraph) pollResultsContainer.appendChild(yourVoteStatusParagraph);
}

/**
 * Handles a user's vote.
 * @param {string} selectedOption - The option the user selected.
 */
async function handleVote(selectedOption) {
    if (!currentUser) {
        displayMessage(voteMessage, "You must be logged in to vote.", 'error');
        return;
    }

    displayMessage(voteMessage, 'Submitting your vote...', '');

    try {
        // Use a transaction for atomic updates to both user's vote and poll results
        await db.runTransaction(async (transaction) => {
            const pollDocRef = pollsCollection.doc('poll_results');
            // Each user has a subcollection 'votes' and a document 'poll_vote' to store their current vote
            const userVoteDocRef = usersCollection.doc(currentUser.uid).collection('votes').doc('poll_vote');

            const pollDoc = await transaction.get(pollDocRef);
            const userVoteDoc = await transaction.get(userVoteDocRef);

            if (!pollDoc.exists) {
                throw new Error("Poll data not found.");
            }

            const pollData = pollDoc.data();
            let currentOptions = (typeof pollData.options === 'object' && pollData.options !== null) ? pollData.options : {};
            let previousVote = userVoteDoc.exists ? userVoteDoc.data().vote : null;

            // If user previously voted, decrement their old vote count
            if (previousVote && currentOptions[previousVote]) {
                currentOptions = {
                    ...currentOptions,
                    [previousVote]: (currentOptions[previousVote] || 0) - 1
                };
            }

            // Increment the selected option's count
            currentOptions = {
                ...currentOptions,
                [selectedOption]: (currentOptions[selectedOption] || 0) + 1
            };

            // Update the poll results document
            transaction.update(pollDocRef, { options: currentOptions });

            // Record the user's new vote
            transaction.set(userVoteDocRef, { vote: selectedOption });
        });

        displayMessage(voteMessage, 'Vote submitted successfully!', 'success');
        await fetchPollData(); // Refresh poll data and UI (counts and buttons)
        await fetchUserVoteStatus(); // Update user's specific vote status display
        fetchAllUserVotes(); // Refresh the 'All User Votes' list

    } catch (error) {
        console.error("Error submitting vote:", error);
        let errorMessage = "Failed to submit vote. Please try again.";
        if (error.code === 'permission-denied') {
            errorMessage = "Permission denied. Check Firestore security rules.";
        } else if (error.message.includes("Poll data not found")) {
            errorMessage = "Poll data is missing or corrupted. Admin needs to set up a poll.";
        }
        displayMessage(voteMessage, errorMessage, 'error');
    }
}

/**
 * Fetches and displays the current user's vote status.
 */
async function fetchUserVoteStatus() {
     if (!currentUser || !yourVoteStatusSpan) return;

    try {
        const userVoteDoc = await usersCollection.doc(currentUser.uid).collection('votes').doc('poll_vote').get();
        if (userVoteDoc.exists) {
            const voteData = userVoteDoc.data();
            yourVoteStatusSpan.textContent = voteData.vote;

            // Add a class for styling (e.g., "yes-button", "no-button", "maybe-button" or generic)
            yourVoteStatusSpan.className = 'vote-status'; // Reset class
            // Use the option name to create a class, replacing spaces with hyphens
            yourVoteStatusSpan.classList.add(voteData.vote.toLowerCase().replace(/\s/g, '-'));
        } else {
            yourVoteStatusSpan.textContent = "Not Voted";
            yourVoteStatusSpan.className = 'vote-status not-voted'; // Default "not-voted" class
        }
    } catch (error) {
        console.error("Error fetching user vote status:", error);
        yourVoteStatusSpan.textContent = "Error";
        yourVoteStatusSpan.className = 'vote-status error';
    }
}

// ==============================================
//           Admin Functionality
// ==============================================

/**
 * Updates the poll question and optionally resets all votes.
 * This function is now also responsible for triggering a full vote reset.
 * @param {string} newQuestion - The new poll question.
 * @param {boolean} resetVotes - Whether to reset all user votes and option counts to 0.
 */
async function updatePollQuestionAndResetVotes(newQuestion, resetVotes = false) {
    if (!isAdmin) {
        displayMessage(adminMessage, "Unauthorized action.", 'error');
        return;
    }

    if (!newQuestion.trim()) {
        displayMessage(adminMessage, "Please enter a poll question.", 'error');
        return;
    }

    displayMessage(adminMessage, 'Updating poll question and resetting votes...', '');
    updateQuestionButton.disabled = true;

    try {
        const batch = db.batch();
        const pollDocRef = pollsCollection.doc('poll_results');

        // Update the question
        const updateData = { question: newQuestion };

        // If resetting votes, also reset all option counts to 0
        if (resetVotes) {
            updateData.options = {}; // Clear all options and their counts
            // Also delete all individual user votes from their subcollections
            const usersSnapshot = await usersCollection.get();
            for (const userDoc of usersSnapshot.docs) {
                const votesSnapshot = await userDoc.ref.collection('votes').get();
                for (const voteDoc of votesSnapshot.docs) {
                    batch.delete(voteDoc.ref);
                }
            }
        } else {
            // If not resetting votes, ensure the options map is still an object if it was null/undefined
            // This case should ideally not happen if fetchPollData initializes it correctly
            updateData.options = currentPollOptions || {};
        }

        batch.update(pollDocRef, updateData);
        await batch.commit();

        displayMessage(adminMessage, 'Poll question updated and votes reset!', 'success');
        pollQuestionInput.value = ''; // Clear input field after successful update
        await fetchPollData(); // Refresh all poll data and UI
        fetchAllUserVotes(); // Refresh the list of all user votes
    } catch (error) {
        console.error("Error updating poll question and resetting votes:", error);
        let errorMessage = "Failed to update poll question and reset votes. Please try again.";
        if (error.code === 'permission-denied') {
            errorMessage = "Permission denied. Check Firestore rules for admin write access.";
        }
        displayMessage(adminMessage, errorMessage, 'error');
    } finally {
        updateQuestionButton.disabled = false;
    }
}


/**
 * Adds a new poll option to the current poll. This will automatically reset all existing votes.
 */
async function addPollOption() {
    if (!isAdmin) {
        displayMessage(adminMessage, "Unauthorized action.", 'error');
        return;
    }

    const newOption = newPollOptionInput.value.trim();
    if (!newOption) {
        displayMessage(adminMessage, "Please enter a new poll option.", 'error');
        return;
    }

    // Check for duplicate options (case-insensitive for better UX)
    const normalizedNewOption = newOption.toLowerCase();
    const existingOptionsLower = Object.keys(currentPollOptions).map(key => key.toLowerCase());
    if (existingOptionsLower.includes(normalizedNewOption)) {
        displayMessage(adminMessage, "This option already exists (case-insensitive).", 'error');
        return;
    }

    displayMessage(adminMessage, `Adding "${newOption}" and resetting votes...`, '');
    addPollOptionButton.disabled = true;

    try {
        const batch = db.batch();
        const pollDocRef = pollsCollection.doc('poll_results');

        // Prepare updated options: add the new one, and reset ALL existing ones to 0
        const resetOptions = {};
        Object.keys(currentPollOptions).forEach(option => {
            resetOptions[option] = 0; // Reset existing counts
        });
        resetOptions[newOption] = 0; // Add new option with count 0

        // Update the poll results document with the new options map
        batch.update(pollDocRef, { options: resetOptions });

        // Delete all individual user votes as options have changed
        const usersSnapshot = await usersCollection.get();
        for (const userDoc of usersSnapshot.docs) {
            const votesSnapshot = await userDoc.ref.collection('votes').get();
            for (const voteDoc of votesSnapshot.docs) {
                batch.delete(voteDoc.ref);
            }
        }

        await batch.commit();

        displayMessage(adminMessage, `"${newOption}" added successfully! All votes reset.`, 'success');
        newPollOptionInput.value = ''; // Clear input field
        await fetchPollData(); // Refresh poll data and UI
        fetchAllUserVotes(); // Refresh the list of all user votes
    } catch (error) {
        console.error("Error adding poll option:", error);
        let errorMessage = "Failed to add poll option. Please try again.";
        if (error.code === 'permission-denied') {
            errorMessage = "Permission denied. Check Firestore rules for admin write access.";
        }
        displayMessage(adminMessage, errorMessage, 'error');
    } finally {
        addPollOptionButton.disabled = false;
    }
}


/**
 * Deletes a specific poll option. This will also automatically reset all existing votes.
 * @param {string} optionToDelete - The name of the option to delete.
 */
async function deletePollOption(optionToDelete) {
    if (!isAdmin) {
        displayMessage(adminMessage, "Unauthorized action.", 'error');
        return;
    }

    if (!confirm(`Are you sure you want to delete the option "${optionToDelete}"? This will reset ALL votes!`)) {
        return; // User cancelled
    }

    displayMessage(adminMessage, `Deleting "${optionToDelete}" and resetting votes...`, '');

    try {
        const batch = db.batch();
        const pollDocRef = pollsCollection.doc('poll_results');

        // Prepare updated options: remove the deleted one, and reset ALL remaining ones to 0
        const updatedOptions = { ...currentPollOptions };
        delete updatedOptions[optionToDelete]; // Remove the option

        const resetOptions = {};
        Object.keys(updatedOptions).forEach(option => {
            resetOptions[option] = 0; // Reset remaining counts
        });

        // Update the poll results document with the new options map
        batch.update(pollDocRef, { options: resetOptions });

        // Delete all individual user votes as options have changed
        const usersSnapshot = await usersCollection.get();
        for (const userDoc of usersSnapshot.docs) {
            const votesSnapshot = await userDoc.ref.collection('votes').get();
            for (const voteDoc of votesSnapshot.docs) {
                batch.delete(voteDoc.ref);
            }
        }

        await batch.commit();

        displayMessage(adminMessage, `"${optionToDelete}" deleted successfully! All votes reset.`, 'success');
        await fetchPollData(); // Refresh poll data and UI
        fetchAllUserVotes(); // Refresh the list of all user votes
    } catch (error) {
        console.error("Error deleting poll option:", error);
        let errorMessage = "Failed to delete poll option. Please try again.";
        if (error.code === 'permission-denied') {
            errorMessage = "Permission denied. Check Firestore rules for admin write access.";
        }
        displayMessage(adminMessage, errorMessage, 'error');
    }
}


/**
 * Generates the list of current poll options for the admin to manage (delete buttons).
 */
function generateCurrentPollOptionsList() {
    if (!currentPollOptionsList) return; // Ensure the element exists

    currentPollOptionsList.innerHTML = ''; // Clear existing list

    const optionKeys = Object.keys(currentPollOptions);
    if (optionKeys.length === 0) {
        currentPollOptionsList.innerHTML = '<li>No options currently defined.</li>';
        return;
    }

    optionKeys.forEach(option => {
        const listItem = document.createElement('li');
        listItem.classList.add('user-list-item'); // Reuse styling

        const optionNameSpan = document.createElement('span');
        optionNameSpan.textContent = option;
        listItem.appendChild(optionNameSpan);

        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.classList.add('clear-vote-button'); // Reuse styling
        deleteButton.addEventListener('click', () => deletePollOption(option));
        listItem.appendChild(deleteButton);

        currentPollOptionsList.appendChild(listItem);
    });
}


/**
 * Fetches and displays all user votes (for the "All User Votes" section).
 * This remains largely the same, but adapts to the new 'options' map for vote status display.
 */
async function fetchAllUserVotes() {
    const usersVoteList = document.getElementById('usersVoteList');
    if (!usersVoteList) return; // Exit if the element doesn't exist

    usersVoteList.innerHTML = '<li>Loading all user votes...</li>'; // Initial loading state

    try {
        const allVotes = [];
        // Get all user documents
        const usersSnapshot = await usersCollection.get();

        // For each user, get their specific vote document
        for (const userDoc of usersSnapshot.docs) {
            const voteDoc = await userDoc.ref.collection('votes').doc('poll_vote').get();
            const username = userDoc.data().username || userDoc.data().email; // Use username or email

            if (voteDoc.exists) {
                const voteData = voteDoc.data();
                allVotes.push({ username, vote: voteData.vote });
            } else {
                allVotes.push({ username: username, vote: 'Not Voted' });
            }
        }

        // Render the list of all votes
        if (allVotes.length > 0) {
            usersVoteList.innerHTML = ''; // Clear loading message
            allVotes.forEach(item => {
                const listItem = document.createElement('li');
                listItem.classList.add('user-list-item');

                const usernameSpan = document.createElement('span');
                usernameSpan.textContent = item.username;
                listItem.appendChild(usernameSpan);

                const voteStatusSpan = document.createElement('span');
                voteStatusSpan.textContent = item.vote;
                voteStatusSpan.classList.add('vote-status');
                // Use the vote string to generate a class (replace spaces for CSS)
                voteStatusSpan.classList.add(item.vote.toLowerCase().replace(/\s/g, '-'));
                listItem.appendChild(voteStatusSpan);

                usersVoteList.appendChild(listItem);
            });
        } else {
            usersVoteList.innerHTML = '<li>No votes recorded yet.</li>';
        }

    } catch (error) {
        console.error('Error fetching all user votes:', error);
        usersVoteList.innerHTML = '<li>Error loading all user votes.</li>';
    }
}


// ==============================================
//           Initial App Load & Setup
// ==============================================

// Declare all global DOM element variables
let loginPage, menuPage, pollPage;
let authForm, authMessage, loginButton;
let loggedInUsernameSpan, pollUserEmailSpan;
let goToPollButton, goToNewPageButton, logoutButton;
let pollQuestionDisplay, pollButtonsContainer, pollResultsContainer, yourVoteStatusSpan;
let voteMessage;
let backToMenuFromPollButton;
let adminMessage, pollQuestionInput, updateQuestionButton, currentPollOptionsList, addPollOptionButton, newPollOptionInput; // Admin elements
let allUsersVoteStatusSection, usersVoteList; // All user votes section

document.addEventListener('DOMContentLoaded', () => {
    // Assign HTML element references
    loginPage = document.getElementById('loginPage');
    menuPage = document.getElementById('menuPage');
    pollPage = document.getElementById('pollPage');

    authForm = document.getElementById('authForm');
    authMessage = document.getElementById('authMessage');
    loginButton = document.getElementById('loginButton');

    loggedInUsernameSpan = document.getElementById('loggedInUsername');
    pollUserEmailSpan = document.getElementById('pollUserEmail');

    goToPollButton = document.getElementById('goToPollButton');
    goToNewPageButton = document.getElementById('goToNewPageButton');
    logoutButton = document.getElementById('logoutButton');

    pollQuestionDisplay = document.getElementById('pollQuestionDisplay');
    pollButtonsContainer = document.getElementById('pollButtonsContainer');
    pollResultsContainer = document.getElementById('pollResultsContainer');
    yourVoteStatusSpan = document.getElementById('yourVoteStatus');
    voteMessage = document.getElementById('voteMessage');
    backToMenuFromPollButton = document.getElementById('backToMenuFromPoll');

    // Admin elements
    adminMessage = document.getElementById('adminMessage');
    pollQuestionInput = document.getElementById('pollQuestionInput');
    updateQuestionButton = document.getElementById('updateQuestionButton');
    currentPollOptionsList = document.getElementById('currentPollOptionsList'); // Changed from userListForAdmin to a more specific name for clarity
    addPollOptionButton = document.getElementById('addPollOptionButton');
    newPollOptionInput = document.getElementById('newPollOptionInput');

    // All User Votes section elements
    allUsersVoteStatusSection = document.getElementById('allUsersVoteStatus');
    usersVoteList = document.getElementById('usersVoteList');

    // ==============================================
    //           Event Listeners
    // ==============================================

    // Login/Auth Form Submission
    if (authForm) authForm.addEventListener('submit', (e) => {
        e.preventDefault(); // Prevent default form submission
        if (authForm.checkValidity()) { // Check HTML5 form validation
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            handleLogin(email, password);
        } else {
            // Display browser's default validation message or custom message
            displayMessage(authMessage, 'Please fill in all required fields.', 'error');
        }
    });

    // Logout Button
    if (logoutButton) logoutButton.addEventListener('click', handleLogout);

    // Navigation Buttons
    if (goToPollButton) goToPollButton.addEventListener('click', () => {
        showPage('pollPage');
        fetchPollData(); // Re-fetch data every time poll page is accessed
        fetchAllUserVotes(); // Re-fetch all user votes
    });

    // Modified to redirect to currency.html
    if (goToNewPageButton) {
        goToNewPageButton.addEventListener('click', () => {
            window.location.href = 'currency.html'; // Redirect to the new currency page
        });
    }

    if (backToMenuFromPollButton) backToMenuFromPollButton.addEventListener('click', () => showPage('menuPage'));

    // Admin Action Buttons
    // Update poll question - this now explicitly resets votes
    if (updateQuestionButton) updateQuestionButton.addEventListener('click', () => {
        updatePollQuestionAndResetVotes(pollQuestionInput.value, true); // true to reset votes
    });

    // Add new poll option - this also explicitly resets votes
    if (addPollOptionButton) addPollOptionButton.addEventListener('click', addPollOption);


    // ==============================================
    //           Authentication State Listener
    // ==============================================
    // This listener runs every time the user's auth state changes (login, logout, page load)
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            await fetchUserProfile(user); // Fetch user profile and set isAdmin
            showPage('menuPage'); // Default to menu page after login
            await fetchPollData(); // Load poll data for display
            fetchAllUserVotes(); // Load all user votes
        } else {
            // User is signed out
            currentUser = null;
            isAdmin = false; // Reset admin status
            updateAdminUI(); // Ensure admin UI is hidden
            showPage('loginPage'); // Go to login page
        }
    });
});
