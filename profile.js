import { config } from './config.js';

// --- DOM Element References ---
let savedPostsContainer;
let savedForm;
let savedUserInput;
let savedPassInput;
let profileLoginBtn;
let saveModal;
let saveModalForm;
let saveModalUserField;
let saveModalPassField;
let modalOverlay;

// --- State (managed by app.js, passed via callbacks/params) ---
let getAppState; // Function to get { currentUser, currentToken, chatName, currentProfile, isLoggedIn, loggedInUsername }
let updateAppState; // Function to update app state and trigger UI refreshes

// --- Helper Functions ---

function hashCredentials(username, password) {
   try {
      // Basic obfuscation, not secure hashing. Replace if real security needed.
      return btoa(username + ':' + password).slice(0, config.profileTokenLength);
   } catch (e) {
       console.error("Error encoding credentials:", e);
       // Fallback for environments where btoa might fail (less likely in modern browsers)
       return (username + ':' + password).slice(0, config.profileTokenLength);
   }
}

function loadSavedPosts(profileToken) {
  if (!profileToken) return [];
  return JSON.parse(localStorage.getItem(`forum-profile-${profileToken}`)) || [];
}

// --- Core Profile Logic ---

export function displaySavedPosts() {
  const { currentProfile } = getAppState();
  savedPostsContainer.innerHTML = ''; // Clear previous posts

  if (!currentProfile) {
     savedPostsContainer.innerHTML = '<p class="empty">Login to see saved posts.</p>';
     return;
  }

  const posts = loadSavedPosts(currentProfile);
  if (posts.length === 0) {
    savedPostsContainer.innerHTML = '<p class="empty">No hay posts guardados.</p>';
    return;
  }

  posts.forEach(post => {
    const div = document.createElement('div');
    div.className = 'saved-message';
    div.innerHTML = `
      <div class="meta">Chat: ${post.chatName || post.chatToken}</div>
      <div class="content">${post.content || ''}</div>
      ${post.image ? `<img src="${post.image}" class="message-image" style="max-height: 60px; padding: 1px;">` : ''}
      <div class="meta" style="margin-top: 4px; font-size: 0.7em;">Saved from ${post.user}</div>
    `;
    div.onclick = () => {
      window.location.href = `?token=${post.chatToken}#${post.timestamp}`;
    };
    savedPostsContainer.appendChild(div);
  });
}

function saveToProfile(message, password) {
  const { currentUser, currentToken, chatName, currentProfile } = getAppState();
  // Use the currently displayed username for hashing and saving
  const profileToken = hashCredentials(currentUser, password);
  if (!profileToken) return;

  const saved = loadSavedPosts(profileToken);

  if (!saved.some(m => m.timestamp === message.timestamp && m.chatToken === currentToken)) {
    saved.unshift({
      chatToken: currentToken,
      chatName: chatName || 'Chat sin nombre',
      user: message.user, // User who posted the message
      timestamp: message.timestamp,
      content: message.content,
      image: message.image
    });

    localStorage.setItem(`forum-profile-${profileToken}`,
      JSON.stringify(saved.slice(0, config.maxSavedPosts)));

    // If saving establishes a profile session or confirms the current one
    if (currentProfile !== profileToken) {
        updateAppState({
            currentProfile: profileToken,
            isLoggedIn: true,
            loggedInUsername: currentUser, // The user performing the save becomes the logged-in user
            clearRandomUsername: true
        });
        savedForm.classList.add('hidden'); // Hide form after save/login
    }
     // Even if profile was already current, refresh display
     displaySavedPosts();

  } else {
      alert('Este post ya está guardado.');
  }
}


function handleProfileLoginAttempt(e) {
  e.preventDefault();
  const username = savedUserInput.value.trim();
  const password = savedPassInput.value;

  if (!username || !password) {
      alert('Por favor, introduce usuario y contraseña.');
      return;
  }

  const potentialProfileToken = hashCredentials(username, password);

  // Check if a profile exists with these credentials
  if (localStorage.getItem(`forum-profile-${potentialProfileToken}`) !== null) {
    // SUCCESSFUL LOGIN
    updateAppState({
        currentProfile: potentialProfileToken,
        currentUser: username, // Update displayed username
        loggedInUsername: username,
        isLoggedIn: true,
        clearRandomUsername: true
    });

    savedForm.classList.add('hidden'); // Hide login form
    displaySavedPosts(); // Show the saved posts for this profile
  } else {
    // FAILED LOGIN
    alert('Perfil no encontrado o contraseña incorrecta.');
    savedPassInput.value = ''; // Clear password field
    // Do not change logged-in status on failed attempt unless explicitly logging out
    // displaySavedPosts will show the empty state if currentProfile remains null
  }
}

function handleSaveFormSubmit(e) {
  e.preventDefault();
  const password = saveModalPassField.value;
  // Retrieve message from data attribute (set when modal opened)
  const message = JSON.parse(e.target.dataset.message);

  if (!password) {
      alert("Por favor, introduce una contraseña para guardar.");
      return;
  }

  saveToProfile(message, password); // This function now handles potential login state update
  e.target.reset();
  saveModal.style.display = 'none';
  modalOverlay.style.display = 'none';
}

// --- NEW: Password Check Function (for deletion) ---
export function checkPassword(username, password) {
    if (!username || !password) return false;
    const potentialProfileToken = hashCredentials(username, password);
    // Check if a profile storage exists for these credentials
    return localStorage.getItem(`forum-profile-${potentialProfileToken}`) !== null;
}

// --- Initialization and Event Listeners ---

export function setupProfileInteractions(getAppStateFunc, updateAppStateFunc) {
  getAppState = getAppStateFunc;
  updateAppState = updateAppStateFunc;

  // Cache DOM elements
  savedPostsContainer = document.getElementById('saved-posts');
  savedForm = document.getElementById('saved-form');
  savedUserInput = document.getElementById('saved-user');
  savedPassInput = document.getElementById('saved-pass');
  profileLoginBtn = document.getElementById('profile-login-btn');
  saveModal = document.getElementById('save-modal');
  saveModalForm = document.getElementById('profile-form');
  saveModalUserField = document.getElementById('profile-user');
  saveModalPassField = document.getElementById('profile-pass');
  modalOverlay = document.querySelector('.modal-overlay');

  // Profile Login Toggle Button
  profileLoginBtn.addEventListener('click', () => {
    const isCurrentlyHidden = savedForm.classList.contains('hidden');
    const { isLoggedIn, loggedInUsername } = getAppState();

    if (isCurrentlyHidden) { // If hidden, show it
        savedForm.classList.remove('hidden');
         // Pre-fill username if logged in, otherwise clear fields
         if (isLoggedIn && loggedInUsername) {
             savedUserInput.value = loggedInUsername;
             savedPassInput.value = '';
             savedPassInput.focus(); // Focus password if pre-filling user
         } else {
             savedUserInput.value = '';
             savedPassInput.value = '';
             savedUserInput.focus();
         }
    } else { // If shown, hide it
         savedForm.classList.add('hidden');
    }
    // No change to login state or saved posts display here
  });

  // Profile Login Form Submission
  savedForm.addEventListener('submit', handleProfileLoginAttempt);

  // Save Post Modal Form Submission
  saveModalForm.addEventListener('submit', handleSaveFormSubmit);

   // Modal overlay click to close save modal
    modalOverlay.addEventListener('click', () => {
        saveModal.style.display = 'none';
        modalOverlay.style.display = 'none';
    });

    // Initial display based on state from app.js
    const { currentProfile, isLoggedIn } = getAppState();
    if (currentProfile && isLoggedIn) {
        savedForm.classList.add('hidden');
        displaySavedPosts();
    } else {
        savedForm.classList.remove('hidden'); // Ensure form is visible if not logged in
        displaySavedPosts(); // Show empty state
    }
}

export function showSaveModal(message) {
    const { currentUser } = getAppState();
    saveModalUserField.value = currentUser; // Pre-fill with the *current* user
    saveModalPassField.value = '';
    saveModalForm.dataset.message = JSON.stringify(message); // Store message data

    saveModal.style.display = 'block';
    modalOverlay.style.display = 'block';
    saveModalPassField.focus();
}