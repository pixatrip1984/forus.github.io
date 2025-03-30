import { config } from './config.js';
import { setupProfileInteractions, displaySavedPosts, showSaveModal, checkPassword } from './profile.js';
import { setupGematriaCalculator } from './gematria.js';

// --- Helper: Get Active Chats ---
function getActiveChats() {
  const activeChats = [];
  const keys = Object.keys(localStorage);

  keys.forEach(key => {
    if (key.startsWith('forum-messages-')) {
      try {
        const token = key.replace('forum-messages-', '');
        const messagesRaw = localStorage.getItem(key);
        if (messagesRaw){
            const messagesData = JSON.parse(messagesRaw);
            // Ensure messagesData is an array and has length
            if (Array.isArray(messagesData) && messagesData.length > 0) {
              activeChats.push({
                token,
                lastActivity: messagesData[0]?.timestamp // Get timestamp from first (latest) message
              });
            }
        }
      } catch (e) {
        console.warn(`Could not parse messages for key ${key}:`, e);
      }
    }
  });

 // Filter out chats with invalid dates and sort by last activity (most recent first)
 return activeChats
    .filter(chat => chat.lastActivity && !isNaN(new Date(chat.lastActivity).getTime()))
    .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));
}

// --- State Management ---
let currentToken = getURLToken();
let messages = loadMessages();
let isLoggedIn = sessionStorage.getItem('forum-isLoggedIn') === 'true';
let loggedInUsername = sessionStorage.getItem('forum-loggedInUsername');
let currentUser = isLoggedIn && loggedInUsername
  ? loggedInUsername
  : (sessionStorage.getItem('forum-randomUsername') || generateNewRandomUsername());
// Store the initial random username if not logged in
if (!isLoggedIn && !sessionStorage.getItem('forum-randomUsername')) {
    sessionStorage.setItem('forum-randomUsername', currentUser);
}
let chatName = localStorage.getItem(`forum-chatname-${currentToken}`) || '';
let currentImageDataUrl = null;
let currentProfile = sessionStorage.getItem('forum-profile'); // Initialize from sessionStorage
let isSidebarCollapsed = localStorage.getItem('forum-sidebarCollapsed') === 'true'; // Load left sidebar state
let isGematriaSidebarCollapsed = localStorage.getItem('forum-gematriaCollapsed') === 'true'; // Load right sidebar state
let isChatRevealed = false; // New state variable

// --- DOM Elements ---
const messagesContainer = document.getElementById('messages');
const userDisplay = document.getElementById('user-display');
const chatNameElement = document.getElementById('chat-name');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const imageInput = document.getElementById('image-input');
const imagePreview = document.getElementById('image-preview');
const uploadBtn = document.getElementById('upload-image-btn');
const refreshUserBtn = document.getElementById('refresh-user');
const tokenForm = document.getElementById('token-form');
const tokenInput = document.getElementById('token-input');
const clearTokenBtn = document.getElementById('clear-token-btn');
const copyTokenBtn = document.getElementById('copy-token');
const randomChatBtn = document.getElementById('random-chat');
const toggleSidebarBtn = document.getElementById('toggle-sidebar'); // Left sidebar toggle
const toggleGematriaBtn = document.getElementById('toggle-gematria'); // Right sidebar toggle
const container = document.querySelector('.container'); // Main container
const mainContent = document.querySelector('.main-content');
const messagesArea = document.getElementById('messages-container');
const chatOverlay = document.getElementById('chat-overlay');

// --- Core Functions ---
function generateNewRandomUsername() {
  const adj = config.adjectives[Math.floor(Math.random() * config.adjectives.length)];
  const noun = config.nouns[Math.floor(Math.random() * config.nouns.length)];
  const number = Math.random() < 0.5
    ? Math.floor(Math.random() * 900 + 100) // 100-999
    : config.numberSuffixes[Math.floor(Math.random() * config.numberSuffixes.length)];
  return `${adj} ${noun} ${number}`;
}

function generateToken() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({length: config.tokenLength}, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

function getURLToken() {
  const params = new URLSearchParams(window.location.search);
  const tokenFromUrl = params.get('token');

  if (tokenFromUrl) {
      return tokenFromUrl; // Use token from URL if present
  }

  // If no token in URL, try to find a random active chat
  const activeChats = getActiveChats();
  if (activeChats.length > 0) {
    // Pick a random chat from the active ones
    const randomChat = activeChats[Math.floor(Math.random() * activeChats.length)];
    return randomChat.token;
  }

  // If no token in URL and no active chats, generate a new one
  return generateToken();
}

function loadMessages() {
  const stored = JSON.parse(localStorage.getItem(`forum-messages-${currentToken}`)) || [];
  return stored.slice(-config.maxMessages);
}

function saveMessages() {
  localStorage.setItem(`forum-messages-${currentToken}`, JSON.stringify(messages));
}

function updateUsernameDisplay() {
    userDisplay.textContent = currentUser;
}

// --- Profile/State Update Callback ---
// This function is passed to profile.js to allow it to update app.js's state
function updateAppState(newState) {
    let profileChanged = false;
    if (newState.hasOwnProperty('currentUser')) {
        currentUser = newState.currentUser;
        updateUsernameDisplay(); // Update UI immediately
    }
    if (newState.hasOwnProperty('isLoggedIn')) {
        isLoggedIn = newState.isLoggedIn;
        sessionStorage.setItem('forum-isLoggedIn', isLoggedIn ? 'true' : 'false');
    }
    if (newState.hasOwnProperty('loggedInUsername')) {
        loggedInUsername = newState.loggedInUsername;
        if (loggedInUsername) {
            sessionStorage.setItem('forum-loggedInUsername', loggedInUsername);
        } else {
            sessionStorage.removeItem('forum-loggedInUsername');
        }
    }
    if (newState.hasOwnProperty('currentProfile')) {
        const oldProfile = currentProfile;
        currentProfile = newState.currentProfile;
        if (currentProfile) {
             sessionStorage.setItem('forum-profile', currentProfile);
        } else {
             sessionStorage.removeItem('forum-profile');
        }
        profileChanged = oldProfile !== currentProfile;
    }
     if (newState.hasOwnProperty('clearRandomUsername') && newState.clearRandomUsername) {
        sessionStorage.removeItem('forum-randomUsername');
    }

    // If profile changed, refresh the saved posts display (handled within profile.js now)
    // if (profileChanged) {
    //     displaySavedPosts(); // Make sure this is called after state update
    // }
}

// --- Event Handlers ---
refreshUserBtn.addEventListener('click', () => {
  // Log out explicitly
  updateAppState({
    isLoggedIn: false,
    loggedInUsername: null,
    currentProfile: null,
    currentUser: generateNewRandomUsername() // Generate and set new random user
  });
  // Store the new random username for the session
  sessionStorage.setItem('forum-randomUsername', currentUser);
  sessionStorage.removeItem('forum-profile'); // Ensure profile token is cleared

  // Update profile UI (clear posts, show login form if hidden)
  document.getElementById('saved-form').classList.remove('hidden');
  document.getElementById('saved-user').value = ''; // Clear login form fields
  document.getElementById('saved-pass').value = '';
  displaySavedPosts(); // Refresh saved posts section (will show empty/login state)
});

uploadBtn.addEventListener('click', () => {
    imageInput.click();
});

imageInput.addEventListener('change', function(e) {
  const file = e.target.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      currentImageDataUrl = event.target.result;
      imagePreview.innerHTML = `<img src="${currentImageDataUrl}" alt="Preview"> ${file.name}`;
      imagePreview.style.display = 'block';
       uploadBtn.textContent = 'Imagen Cargada';
       uploadBtn.style.borderColor = '#4CAF50';
    };
    reader.readAsDataURL(file);
  } else {
    currentImageDataUrl = null;
    imagePreview.style.display = 'none';
    imagePreview.innerHTML = '';
    uploadBtn.textContent = 'Cargar Imagen';
    uploadBtn.style.borderColor = '#ccc';
  }
});

messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const content = messageInput.value.trim();
  const imageDataUrl = currentImageDataUrl;

  if (!content && !imageDataUrl) return;

  if (messages.length === 0 && !chatName && content) {
    // Limit chat name length if taken from first post
    chatName = content.length > 35 ? content.substring(0, 32) + '...' : content;
    saveChatName();
    updateChatNameDisplay();
  }

  const newMessage = {
    id: Date.now() + Math.random().toString(36).substring(2, 8), // Add unique ID
    user: currentUser, // Uses the current user (random or logged in)
    content,
    timestamp: new Date().toISOString(),
    image: imageDataUrl || null,
    type: 'user' // Add type
  };

  messages.unshift(newMessage);
  if (messages.length > config.maxMessages) messages.pop();

  addMessageToDOM(newMessage);
  messageInput.value = '';
  imageInput.value = '';
  currentImageDataUrl = null;
  imagePreview.style.display = 'none';
  imagePreview.innerHTML = '';
  uploadBtn.textContent = 'Cargar Imagen';
  uploadBtn.style.borderColor = '#ccc';
  messagesContainer.scrollTop = 0;
});

function addMessageToDOM(message, prepend = true) {
  const msgElement = document.createElement('div');
  msgElement.className = `message message-${message.type || 'user'}`; // Add type class
  msgElement.dataset.id = message.id; // Use unique ID
  msgElement.dataset.timestamp = message.timestamp; // Keep timestamp for potential linking

  if (message.type === 'system') {
      msgElement.innerHTML = `
          <div class="content system-content">${message.content}</div>
          <div class="meta system-meta">
              <span class="timestamp">${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
      `;
  } else {
      // User message structure
      msgElement.innerHTML = `
        <div class="message-header">
          <span class="user">${message.user}</span>
          <div class="message-actions">
              <span class="timestamp">${new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <button class="save-btn action-btn" title="Guardar Post">
                <svg class="action-icon save-icon" viewBox="0 0 24 24">
                  <path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2zm0 15l-5-2.18L7 18V5h10v13z"/>
                </svg>
              </button>
              <button class="delete-btn action-btn" title="Eliminar Post">
                <svg class="action-icon delete-icon" viewBox="0 0 24 24">
                   <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
          </div>
        </div>
        <div class="content">${message.content || ''}</div>
      `;

      if (message.image) {
        const img = document.createElement('img');
        img.src = message.image;
        img.alt = "Imagen adjunta";
        img.className = 'message-image';
        const contentDiv = msgElement.querySelector('.content');
        if (contentDiv) {
             contentDiv.appendChild(img);
        } else {
             const header = msgElement.querySelector('.message-header');
             header.insertAdjacentElement('afterend', img);
        }
      }

      const saveBtn = msgElement.querySelector('.save-btn');
      if (saveBtn) {
           saveBtn.onclick = () => showSaveModal(message);
      }

      const deleteBtn = msgElement.querySelector('.delete-btn');
      if (deleteBtn) {
          deleteBtn.onclick = () => handleDeleteRequest(message);
      }
  }


  if (prepend) {
    messagesContainer.prepend(msgElement);
  } else {
    messagesContainer.appendChild(msgElement);
  }
  setTimeout(() => msgElement.style.opacity = '1', 10);
}

// --- Delete Logic ---
function handleDeleteRequest(messageToDelete) {
    const { currentUser: appCurrentUser, isLoggedIn: appIsLoggedIn } = getAppState();

    // 1. Check if the current user is the message owner
    if (messageToDelete.user !== appCurrentUser) {
        alert("Sólo puedes eliminar tus propios posts.");
        return;
    }

    // 2. Determine deletion flow based on whether the current user (who is the author) is logged in
    if (appIsLoggedIn) {
        // Logged-in user deleting their own post - requires password, no system message on success
        const password = prompt(`Para eliminar este post, por favor introduce tu contraseña para "${appCurrentUser}":`);
        if (password === null) return; // User cancelled prompt

        if (checkPassword(appCurrentUser, password)) {
            // Password correct - Delete silently
            deleteMessage(messageToDelete.id, appCurrentUser, messageToDelete.timestamp, true); // Pass true to suppress system message
        } else {
            alert("Contraseña incorrecta.");
        }
    } else {
        // Random (not logged-in) user deleting their own post - no password needed, add system message
        // (This assumes the current random user session matches the one that posted)
        if (confirm("¿Estás seguro de que quieres eliminar este post? Esta acción no se puede deshacer.")) {
             // Delete and show system message
             deleteMessage(messageToDelete.id, appCurrentUser, messageToDelete.timestamp, false); // Pass false to show system message
        }
    }
}

function deleteMessage(messageId, deletedByUser, originalTimestamp, suppressSystemMessage = false) {
    const messageIndex = messages.findIndex(m => m.id === messageId);
    if (messageIndex === -1) return; // Message already gone?

    // Remove from array
    messages.splice(messageIndex, 1);

    // Remove from DOM
    const messageElement = messagesContainer.querySelector(`.message[data-id="${messageId}"]`);
    if (messageElement) {
        messageElement.style.transition = 'opacity 0.3s ease, height 0.3s ease, padding 0.3s ease, margin 0.3s ease, border 0.3s ease'; // Added border transition
        messageElement.style.opacity = '0';
        messageElement.style.height = '0px';
        messageElement.style.paddingTop = '0';
        messageElement.style.paddingBottom = '0';
        messageElement.style.marginTop = '0';
        messageElement.style.marginBottom = '0';
        messageElement.style.borderWidth = '0'; // Fade out border
        setTimeout(() => messageElement.remove(), 300); // Remove after transition
    }

    // Add system message only if not suppressed
    if (!suppressSystemMessage) {
        const systemMessage = {
            id: Date.now() + Math.random().toString(36).substring(2, 9), // Unique ID
            type: 'system',
            // Simplified message as requested: User X deleted *their own* post.
            content: `"${deletedByUser}" eliminó su post (publicado originalmente el ${new Date(originalTimestamp).toLocaleString()}).`,
            timestamp: new Date().toISOString()
        };
        messages.unshift(systemMessage); // Add to the start of the array
        addMessageToDOM(systemMessage, true); // Add to the top of the display
    }

    saveMessages(); // Persist changes
}

// --- Token Form Submit Handler ---
tokenForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const newToken = tokenInput.value.trim();
  if (newToken && newToken !== currentToken) { // Navigate only if token is different
    window.location.search = `?token=${newToken}`;
  }
});

// --- Clear Token Button Handler ---
clearTokenBtn.addEventListener('click', () => {
    tokenInput.value = '';
    tokenInput.focus(); // Optional: focus the input after clearing
});

// --- Copy Token Button Handler ---
copyTokenBtn.addEventListener('click', () => {
  navigator.clipboard.writeText(window.location.href)
    .then(() => {
        // Optional visual feedback: Temporarily change icon or button style
        const icon = copyTokenBtn.querySelector('.copy-icon');
        const originalPath = icon.querySelector('path').getAttribute('d');
        // Example: Change path to a checkmark temporarily
        const checkPath = "M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z";
        icon.querySelector('path').setAttribute('d', checkPath);
        setTimeout(() => {
            icon.querySelector('path').setAttribute('d', originalPath);
        }, 1500);
    })
    .catch(err => console.error('Failed to copy URL: ', err));
});

// --- Toggle Left Sidebar Button Handler ---
toggleSidebarBtn.addEventListener('click', () => {
    isSidebarCollapsed = !isSidebarCollapsed;
    container.classList.toggle('sidebar-collapsed', isSidebarCollapsed);
    localStorage.setItem('forum-sidebarCollapsed', isSidebarCollapsed ? 'true' : 'false'); // Save state
});

// --- Toggle Right (Gematria) Sidebar Button Handler ---
toggleGematriaBtn.addEventListener('click', () => {
    isGematriaSidebarCollapsed = !isGematriaSidebarCollapsed;
    container.classList.toggle('gematria-collapsed', isGematriaSidebarCollapsed);
    localStorage.setItem('forum-gematriaCollapsed', isGematriaSidebarCollapsed ? 'true' : 'false'); // Save state
});

// --- Join Random Chat Button Handler ---
function joinRandomChat() {
  const activeChats = getActiveChats();
  const availableChats = activeChats.filter(chat => chat.token !== currentToken);

  if (availableChats.length === 0) {
     // If no *other* chats, generate a new one instead of an alert
     console.log('No other active chats found. Generating a new one.');
     window.location.search = `?token=${generateToken()}`;
    return;
  }

  const randomChat = availableChats[Math.floor(Math.random() * availableChats.length)];
  window.location.search = `?token=${randomChat.token}`;
}

randomChatBtn.addEventListener('click', joinRandomChat);

// --- Initialization ---
function init() {
  // Ensure URL reflects the current token
  if (window.location.search !== `?token=${currentToken}`) {
    window.history.replaceState({}, '', `?token=${currentToken}`);
  }

  // Update initial UI elements
  updateUsernameDisplay();
  tokenInput.value = currentToken;
  updateChatNameDisplay();

  // Render messages (ensure IDs are assigned if loading old messages without them)
  messages = messages.map(msg => ({ ...msg, id: msg.id || (Date.parse(msg.timestamp) + Math.random().toString(36).substring(2, 8)) }));
  messages.forEach(msg => addMessageToDOM(msg, false)); // Append in original order

  // Set up profile interactions
  setupProfileInteractions(
      () => ({ currentUser, currentToken, chatName, currentProfile, isLoggedIn, loggedInUsername }),
      updateAppState
  );

  // Set up Gematria calculator interactions
  setupGematriaCalculator();

  // Start auto-save interval
  setInterval(saveMessages, config.saveInterval);

  // Handle scrolling to a specific message if hash present
  handleHashScroll();

  // Modified Reveal Logic to scroll after reveal
   if (messages.length > 0 && !isChatRevealed) { // Check isChatRevealed state
    mainContent.classList.remove('chat-revealed');
    chatOverlay.style.display = 'flex'; // Make sure it's visible

    // Add one-time click listener to overlay
    chatOverlay.addEventListener('click', revealChat, { once: true });

  } else {
    // Chat is empty or already revealed: hide overlay, show form immediately
    revealChat(); // Call revealChat directly to set the revealed state
    chatOverlay.style.display = 'none'; // Ensure overlay is hidden
    // Scroll to bottom if not empty and already revealed
    if (messages.length > 0) {
    }
  }
}

// --- Reveal Chat Function ---
function revealChat() {
  if (!isChatRevealed) {
      mainContent.classList.add('chat-revealed');
      chatOverlay.style.display = 'none'; // Hide overlay explicitly
      isChatRevealed = true;

      // Scroll to bottom after revealing chat content
      setTimeout(() => {
           messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 50); // Short delay to allow layout reflow
  }
}

// --- Utility Functions ---
function updateChatNameDisplay() {
  const displayChatName = chatName || 'Chat sin nombre';
  chatNameElement.textContent = displayChatName;
  // Also update the document title
  document.title = `${displayChatName} - Forum`;
}

function saveChatName() {
  localStorage.setItem(`forum-chatname-${currentToken}`, chatName);
}

function handleHashScroll() {
  const hash = window.location.hash.substring(1);
  if (hash) {
    const targetMsg = document.querySelector(`.message[data-timestamp="${hash}"]`);
    if (targetMsg) {
        // Delay slightly to ensure smooth scrolling after initial render potentially shifts layout
        setTimeout(() => {
             messagesContainer.scrollTo({ top: targetMsg.offsetTop - messagesContainer.offsetTop - 10, behavior: 'smooth' });
             // Highlight the message temporarily
             targetMsg.style.transition = 'background-color 0.5s ease-in-out';
             targetMsg.style.backgroundColor = '#ffffc0'; // Light yellow highlight
             setTimeout(() => {
                 targetMsg.style.backgroundColor = ''; // Remove highlight
             }, 2000); // Highlight duration
        }, 200); // Delay before scroll/highlight
    }
  }
}

// --- Get App State Helper (for profile.js) ---
function getAppState() {
    return { currentUser, currentToken, chatName, currentProfile, isLoggedIn, loggedInUsername };
}

// --- Start the application ---
init();