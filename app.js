/**
 * HEY AI - Core Application Logic
 * Implements authentication, chat history, settings configuration,
 * OpenAI API client integration, Google Gemini API client integration,
 * and animated mock-response streaming.
 */

// Global App State
const state = {
    currentUser: null,      // Stores { id, username }
    activeChatId: null,     // Current selected chat conversation
    isGenerating: false,    // True if AI is currently responding
    settings: {
        provider: 'demo',   // 'demo', 'openai', 'gemini'
        apiKey: '',         // Stored locally in localStorage (OpenAI)
        geminiKey: '',      // Stored locally in localStorage (Gemini)
        model: 'gpt-4o',    // Default selected model
        themeAccent: 'violet', // Default theme accent color
        speed: 'normal'     // Default response typing speed
    }
};

// ==========================================
// 1. DATABASE MANAGEMENT (localStorage)
// ==========================================
const db = {
    // Read list of all registered users
    getUsers: () => JSON.parse(localStorage.getItem('hey_ai_users')) || [],
    
    // Save users list
    saveUsers: (users) => localStorage.setItem('hey_ai_users', JSON.stringify(users)),
    
    // Fetch active session user
    getCurrentUser: () => JSON.parse(localStorage.getItem('hey_ai_current_user')) || null,
    
    // Save active session
    setCurrentUser: (user) => localStorage.setItem('hey_ai_current_user', JSON.stringify(user)),
    
    // Read chats list
    getChats: () => JSON.parse(localStorage.getItem('hey_ai_chats')) || [],
    
    // Save chats list
    saveChats: (chats) => localStorage.setItem('hey_ai_chats', JSON.stringify(chats)),
    
    // Read messages list
    getMessages: () => JSON.parse(localStorage.getItem('hey_ai_messages')) || [],
    
    // Save messages list
    saveMessages: (messages) => localStorage.setItem('hey_ai_messages', JSON.stringify(messages)),
    
    // Read application settings
    getSettings: () => {
        const stored = localStorage.getItem('hey_ai_settings');
        return stored ? JSON.parse(stored) : null;
    },
    
    // Save application settings
    saveSettings: (settings) => localStorage.setItem('hey_ai_settings', JSON.stringify(settings)),
    
    // Clear all conversation data for current user
    clearAllChatsForUser: () => {
        if (!state.currentUser) return;
        if (!confirm('Are you sure you want to delete all your conversations? This cannot be undone.')) return;
        
        let chats = db.getChats();
        let messages = db.getMessages();
        
        // Filter out chats and messages belonging to the active user
        const userChats = chats.filter(c => c.userId === state.currentUser.id);
        const userChatIds = userChats.map(c => c.id);
        
        chats = chats.filter(c => c.userId !== state.currentUser.id);
        messages = messages.filter(m => !userChatIds.includes(m.chatId));
        
        db.saveChats(chats);
        db.saveMessages(messages);
        
        state.activeChatId = null;
        chat.loadChatHistory();
        chat.renderWelcomeScreen();
        ui.closeSettings();
        
        ui.notify('All conversations deleted.');
    }
};

// ==========================================
// 2. AUTHENTICATION MODULE
// ==========================================
const auth = {
    activeTab: 'login',

    init: () => {
        const user = db.getCurrentUser();
        if (user) {
            state.currentUser = user;
            auth.enterDashboard();
        } else {
            auth.showAuthOverlay();
        }
    },

    switchTab: (tab) => {
        auth.activeTab = tab;
        const loginTab = document.getElementById('tab-login');
        const signupTab = document.getElementById('tab-signup');
        const confirmGroup = document.getElementById('auth-confirm-group');
        const submitBtnText = document.querySelector('#auth-submit-btn span');
        const errorBox = document.getElementById('auth-error-box');
        
        errorBox.style.display = 'none';
        
        if (tab === 'signup') {
            loginTab.classList.remove('active');
            signupTab.classList.add('active');
            confirmGroup.style.display = 'block';
            submitBtnText.textContent = 'Sign Up';
        } else {
            loginTab.classList.add('active');
            signupTab.classList.remove('active');
            confirmGroup.style.display = 'none';
            submitBtnText.textContent = 'Log In';
        }
    },

    togglePasswordVisibility: (inputId) => {
        const input = document.getElementById(inputId);
        const buttonIcon = input.nextElementSibling.querySelector('i');
        if (input.type === 'password') {
            input.type = 'text';
            buttonIcon.setAttribute('data-lucide', 'eye-off');
        } else {
            input.type = 'password';
            buttonIcon.setAttribute('data-lucide', 'eye');
        }
        lucide.createIcons();
    },

    showAuthOverlay: () => {
        document.getElementById('auth-overlay').style.display = 'flex';
        document.getElementById('sidebar').style.display = 'none';
        document.getElementById('chat-area').style.display = 'none';
    },

    hideAuthOverlay: () => {
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('sidebar').style.display = 'flex';
        document.getElementById('chat-area').style.display = 'flex';
    },

    handleSubmit: (e) => {
        e.preventDefault();
        const username = document.getElementById('auth-username').value.trim();
        const password = document.getElementById('auth-password').value;
        const confirmPassword = document.getElementById('auth-password-confirm').value;
        const errorBox = document.getElementById('auth-error-box');
        
        errorBox.style.display = 'none';

        if (!username || !password) {
            auth.showError('Username and password are required.');
            return;
        }

        const users = db.getUsers();

        if (auth.activeTab === 'signup') {
            // Username availability check
            if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
                auth.showError('Username is already taken.');
                return;
            }

            // Confirm password check
            if (password !== confirmPassword) {
                auth.showError('Passwords do not match.');
                return;
            }

            // Simple Password strength check
            if (password.length < 6) {
                auth.showError('Password must be at least 6 characters long.');
                return;
            }

            // Create and store new user
            const newUser = {
                id: 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
                username: username,
                password: password // In production, hash passwords. 
            };
            users.push(newUser);
            db.saveUsers(users);

            // Auto-login after registration
            state.currentUser = { id: newUser.id, username: newUser.username };
            db.setCurrentUser(state.currentUser);
            auth.enterDashboard();
            ui.notify('Account created successfully!');
            
        } else {
            // Login Validation
            const existingUser = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
            if (!existingUser) {
                auth.showError('Invalid credentials. Check username or password.');
                return;
            }

            state.currentUser = { id: existingUser.id, username: existingUser.username };
            db.setCurrentUser(state.currentUser);
            auth.enterDashboard();
            ui.notify(`Welcome back, ${existingUser.username}!`);
        }
    },

    showError: (message) => {
        const errorBox = document.getElementById('auth-error-box');
        const errorMsg = document.getElementById('auth-error-msg');
        errorMsg.textContent = message;
        errorBox.style.display = 'flex';
        // Re-trigger shake animation
        errorBox.style.animation = 'none';
        errorBox.offsetHeight; // Trigger reflow
        errorBox.style.animation = 'shake 0.4s ease-in-out';
    },

    enterDashboard: () => {
        auth.hideAuthOverlay();
        
        // Display user details
        document.getElementById('profile-username').textContent = state.currentUser.username;
        document.getElementById('profile-avatar-char').textContent = state.currentUser.username.charAt(0).toUpperCase();
        document.getElementById('settings-user-display').textContent = `Logged in as: ${state.currentUser.username}`;
        
        // Clear forms
        document.getElementById('auth-form').reset();
        
        // Setup state preferences
        settings.loadPreferences();
        
        // Load layout datasets
        chat.loadChatHistory();
        chat.renderWelcomeScreen();
        
        lucide.createIcons();
    },

    logout: () => {
        if (state.isGenerating) {
            alert('Please wait for the chatbot response to finish before logging out.');
            return;
        }
        db.setCurrentUser(null);
        state.currentUser = null;
        state.activeChatId = null;
        
        // Reset inputs and messages UI
        document.getElementById('messages-list').innerHTML = '';
        document.getElementById('chat-input-box').value = '';
        
        auth.showAuthOverlay();
        auth.switchTab('login');
        ui.notify('Logged out successfully.');
    }
};

// ==========================================
// 3. CHAT CONTROLLER
// ==========================================
const chat = {
    loadChatHistory: () => {
        if (!state.currentUser) return;
        const chats = db.getChats();
        const userChats = chats
            .filter(c => c.userId === state.currentUser.id)
            .sort((a, b) => b.createdAt - a.createdAt); // Newest first

        const container = document.getElementById('chat-history-list');
        container.innerHTML = '';

        if (userChats.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 13px; margin-top: 20px; padding: 0 10px;">No chats yet. Start a new conversation!</div>`;
            return;
        }

        userChats.forEach(c => {
            const isActive = c.id === state.activeChatId;
            const chatItem = document.createElement('div');
            chatItem.className = `chat-history-item ${isActive ? 'active' : ''}`;
            chatItem.setAttribute('data-id', c.id);
            chatItem.onclick = (e) => {
                // Prevent trigger if clicking on actions
                if (e.target.closest('.chat-item-actions') || e.target.closest('.chat-item-input')) return;
                chat.selectChat(c.id);
            };

            chatItem.innerHTML = `
                <div class="chat-item-left">
                    <i data-lucide="message-square" class="chat-item-icon"></i>
                    <span class="chat-item-title-span" id="title-span-${c.id}">${chat.escapeHTML(c.title)}</span>
                    <input type="text" class="chat-item-input" id="title-input-${c.id}" value="${chat.escapeHTML(c.title)}" style="display:none;" onblur="chat.saveRename('${c.id}')" onkeydown="chat.handleRenameKey(event, '${c.id}')">
                </div>
                <div class="chat-item-actions">
                    <button class="chat-action-btn" onclick="chat.startRename('${c.id}', event)" title="Rename chat">
                        <i data-lucide="edit-3" style="width: 14px; height: 14px;"></i>
                    </button>
                    <button class="chat-action-btn" onclick="chat.deleteChat('${c.id}', event)" title="Delete chat">
                        <i data-lucide="trash" style="width: 14px; height: 14px;"></i>
                    </button>
                </div>
            `;
            container.appendChild(chatItem);
        });

        lucide.createIcons();
    },

    startNewChat: () => {
        if (state.isGenerating) return;
        state.activeChatId = null;
        chat.renderWelcomeScreen();
        
        // Hide export button
        document.getElementById('export-chat-btn').style.display = 'none';
        
        // Remove active styling from sidebar list
        document.querySelectorAll('.chat-history-item').forEach(el => el.classList.remove('active'));
        
        const inputBox = document.getElementById('chat-input-box');
        inputBox.value = '';
        inputBox.focus();
        ui.autoExpandTextarea(inputBox);
        ui.toggleSidebar(false); // Close on mobile
    },

    selectChat: (chatId) => {
        if (state.isGenerating) return;
        state.activeChatId = chatId;
        
        const chats = db.getChats();
        const selectedChat = chats.find(c => c.id === chatId);
        if (!selectedChat) return;

        // Render Active Status
        document.getElementById('welcome-container').style.display = 'none';
        document.getElementById('chat-header-title').textContent = selectedChat.title;
        
        // Load messages
        const messages = db.getMessages().filter(m => m.chatId === chatId);
        const listContainer = document.getElementById('messages-list');
        listContainer.innerHTML = '';
        
        messages.forEach(m => {
            chat.appendMessageUI(m.role, m.content, m.timestamp);
        });
        
        // Show export button if there are messages
        document.getElementById('export-chat-btn').style.display = messages.length > 0 ? 'flex' : 'none';
        
        chat.loadChatHistory();
        chat.scrollToBottom();
        ui.toggleSidebar(false); // Close mobile panel
    },

    startRename: (chatId, event) => {
        event.stopPropagation();
        const titleSpan = document.getElementById(`title-span-${chatId}`);
        const titleInput = document.getElementById(`title-input-${chatId}`);
        
        titleSpan.style.display = 'none';
        titleInput.style.display = 'block';
        titleInput.focus();
        titleInput.select();
    },

    handleRenameKey: (event, chatId) => {
        if (event.key === 'Enter') {
            chat.saveRename(chatId);
        } else if (event.key === 'Escape') {
            const titleSpan = document.getElementById(`title-span-${chatId}`);
            const titleInput = document.getElementById(`title-input-${chatId}`);
            titleInput.value = titleSpan.textContent;
            titleInput.style.display = 'none';
            titleSpan.style.display = 'block';
        }
    },

    saveRename: (chatId) => {
        const titleSpan = document.getElementById(`title-span-${chatId}`);
        const titleInput = document.getElementById(`title-input-${chatId}`);
        const newTitle = titleInput.value.trim();

        if (newTitle && newTitle !== titleSpan.textContent) {
            const chats = db.getChats();
            const chatIndex = chats.findIndex(c => c.id === chatId);
            if (chatIndex !== -1) {
                chats[chatIndex].title = newTitle;
                db.saveChats(chats);
                titleSpan.textContent = newTitle;
                
                // If it is the active chat, update header title
                if (chatId === state.activeChatId) {
                    document.getElementById('chat-header-title').textContent = newTitle;
                }
            }
        }
        
        titleInput.style.display = 'none';
        titleSpan.style.display = 'block';
        chat.loadChatHistory();
    },

    deleteChat: (chatId, event) => {
        event.stopPropagation();
        if (state.isGenerating && chatId === state.activeChatId) {
            alert('Cannot delete conversation while generating response.');
            return;
        }
        if (!confirm('Are you sure you want to delete this conversation?')) return;

        let chats = db.getChats();
        let messages = db.getMessages();

        chats = chats.filter(c => c.id !== chatId);
        messages = messages.filter(m => m.chatId !== chatId);

        db.saveChats(chats);
        db.saveMessages(messages);

        if (state.activeChatId === chatId) {
            state.activeChatId = null;
            chat.renderWelcomeScreen();
        }

        chat.loadChatHistory();
        ui.notify('Conversation deleted.');
    },

    renderWelcomeScreen: () => {
        document.getElementById('welcome-container').style.display = 'block';
        document.getElementById('messages-list').innerHTML = '';
        document.getElementById('chat-header-title').textContent = 'New Chat';
    },

    useSuggestion: (promptText) => {
        const inputBox = document.getElementById('chat-input-box');
        inputBox.value = promptText;
        ui.autoExpandTextarea(inputBox);
        chat.sendMessage();
    },

    sendMessage: async () => {
        if (state.isGenerating) return;
        
        const inputBox = document.getElementById('chat-input-box');
        const text = inputBox.value.trim();
        if (!text) return;

        // Reset Input box
        inputBox.value = '';
        ui.autoExpandTextarea(inputBox);
        document.getElementById('char-counter').textContent = '0 chars';

        // Check if there is a running user
        if (!state.currentUser) return;

        // Create new chat ID if none exists
        if (!state.activeChatId) {
            const newChat = {
                id: 'chat_' + Date.now(),
                userId: state.currentUser.id,
                title: text.length > 24 ? text.substring(0, 24) + '...' : text,
                createdAt: Date.now()
            };
            
            const chats = db.getChats();
            chats.push(newChat);
            db.saveChats(chats);
            
            state.activeChatId = newChat.id;
            document.getElementById('chat-header-title').textContent = newChat.title;
            document.getElementById('welcome-container').style.display = 'none';
        }

        // Show export button since there is at least one message
        document.getElementById('export-chat-btn').style.display = 'flex';

        // 1. Save & Render User Message
        const userMessage = {
            id: 'msg_' + Date.now(),
            chatId: state.activeChatId,
            role: 'user',
            content: text,
            timestamp: Date.now()
        };
        
        const messages = db.getMessages();
        messages.push(userMessage);
        db.saveMessages(messages);
        
        chat.appendMessageUI('user', text, userMessage.timestamp);
        chat.loadChatHistory();
        chat.scrollToBottom();

        // 2. Set Generating State & Render Typing Placeholder
        state.isGenerating = true;
        chat.toggleInputState(true);
        const typingPlaceholderId = chat.appendTypingUI();
        chat.scrollToBottom();

        try {
            // 3. Obtain response from AI module
            let aiText = '';
            
            // Gather conversation context
            const conversationHistory = db.getMessages()
                .filter(m => m.chatId === state.activeChatId)
                .slice(-10) // Limit context length to last 10 messages
                .map(m => ({ role: m.role, content: m.content }));
            
            const provider = state.settings.provider || 'demo';
            
            if (provider === 'demo') {
                // simulated delayed reply
                await new Promise(resolve => setTimeout(resolve, 1500));
                aiText = api.generateSimulatedResponse(text);
            } else if (provider === 'openai') {
                aiText = await api.queryOpenAI(conversationHistory);
            } else if (provider === 'gemini') {
                aiText = await api.queryGemini(conversationHistory);
            }

            // 4. Remove Typing indicator and Stream Response
            chat.removeTypingUI(typingPlaceholderId);
            
            // Create AI Message Object
            const aiMessage = {
                id: 'msg_' + Date.now(),
                chatId: state.activeChatId,
                role: 'assistant',
                content: aiText,
                timestamp: Date.now()
            };
            
            // Render stream
            await chat.streamMessageUI(aiMessage.content, aiMessage.timestamp);
            
            // Save final messages DB
            const updatedMessages = db.getMessages();
            updatedMessages.push(aiMessage);
            db.saveMessages(updatedMessages);

        } catch (error) {
            console.error('AI Generation Failed:', error);
            chat.removeTypingUI(typingPlaceholderId);
            chat.appendMessageUI('assistant', `⚠️ **Error generating response:** ${error.message}. Please check your API key in the settings panel or switch back to Demo Mode.`, Date.now());
        } finally {
            state.isGenerating = false;
            chat.toggleInputState(false);
            chat.scrollToBottom();
        }
    },

    toggleInputState: (disabled) => {
        const box = document.getElementById('chat-input-box');
        const btn = document.getElementById('send-message-btn');
        box.disabled = disabled;
        btn.disabled = disabled;
        
        if (disabled) {
            btn.innerHTML = `<div class="typing-indicator-wrapper" style="gap: 3px;"><div class="typing-dot" style="width: 4px; height: 4px; background-color: white;"></div><div class="typing-dot" style="width: 4px; height: 4px; background-color: white;"></div></div>`;
        } else {
            btn.innerHTML = `<i data-lucide="arrow-up" style="width: 20px; height: 20px;"></i>`;
            lucide.createIcons();
            box.focus();
        }
    },

    appendMessageUI: (role, text, timestamp) => {
        const listContainer = document.getElementById('messages-list');
        const row = document.createElement('div');
        row.className = `message-row ${role}`;
        
        const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const displayName = role === 'user' ? state.currentUser.username : 'HEY AI';
        const avatarChar = displayName.charAt(0).toUpperCase();

        row.innerHTML = `
            <div class="message-wrapper">
                <div class="message-avatar">${avatarChar}</div>
                <div class="message-content-box">
                    <div class="message-meta">
                        <span class="message-author">${chat.escapeHTML(displayName)}</span>
                        <span class="message-time">${timeStr}</span>
                    </div>
                    <div class="message-body">${chat.parseMarkdown(text)}</div>
                </div>
            </div>
        `;
        listContainer.appendChild(row);
        
        // Add Copy handler for dynamically created code copy buttons
        row.querySelectorAll('.code-copy-btn').forEach(btn => {
            btn.onclick = () => chat.copyCode(btn);
        });
    },

    appendTypingUI: () => {
        const listContainer = document.getElementById('messages-list');
        const row = document.createElement('div');
        const id = 'typing_' + Date.now();
        row.id = id;
        row.className = 'message-row assistant';
        
        row.innerHTML = `
            <div class="message-wrapper">
                <div class="message-avatar">H</div>
                <div class="message-content-box">
                    <div class="message-meta">
                        <span class="message-author">HEY AI</span>
                    </div>
                    <div class="message-body">
                        <div class="typing-indicator-wrapper">
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                            <div class="typing-dot"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        listContainer.appendChild(row);
        return id;
    },

    removeTypingUI: (id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
    },

    streamMessageUI: (fullText, timestamp) => {
        return new Promise((resolve) => {
            const listContainer = document.getElementById('messages-list');
            const row = document.createElement('div');
            row.className = 'message-row assistant';
            
            const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            
            row.innerHTML = `
                <div class="message-wrapper">
                    <div class="message-avatar">H</div>
                    <div class="message-content-box">
                        <div class="message-meta">
                            <span class="message-author">HEY AI</span>
                            <span class="message-time">${timeStr}</span>
                        </div>
                        <div class="message-body" id="streaming-body"></div>
                    </div>
                </div>
            `;
            listContainer.appendChild(row);
            
            const bodyContainer = row.querySelector('#streaming-body');
            const speedSetting = state.settings.speed || 'normal';
            
            // If speed is instant, render immediately without animations
            if (speedSetting === 'instant') {
                bodyContainer.innerHTML = chat.parseMarkdown(fullText);
                bodyContainer.querySelectorAll('.code-copy-btn').forEach(btn => {
                    btn.onclick = () => chat.copyCode(btn);
                });
                bodyContainer.removeAttribute('id');
                chat.scrollToBottom();
                resolve();
                return;
            }

            let index = 0;
            const textLength = fullText.length;
            
            let charsPerStep = 1;
            let intervalTime = 15;
            
            if (speedSetting === 'fast') {
                charsPerStep = textLength > 800 ? 25 : (textLength > 300 ? 12 : 6);
                intervalTime = 5;
            } else {
                charsPerStep = textLength > 800 ? 8 : (textLength > 300 ? 3 : 1);
                intervalTime = textLength > 800 ? 5 : 15;
            }
            
            const interval = setInterval(() => {
                if (index >= textLength) {
                    clearInterval(interval);
                    bodyContainer.innerHTML = chat.parseMarkdown(fullText);
                    bodyContainer.querySelectorAll('.code-copy-btn').forEach(btn => {
                        btn.onclick = () => chat.copyCode(btn);
                    });
                    bodyContainer.removeAttribute('id');
                    resolve();
                } else {
                    index += charsPerStep;
                    const partialText = fullText.substring(0, Math.min(index, textLength));
                    bodyContainer.innerHTML = chat.parseMarkdown(partialText) + '<span style="display:inline-block; width:6px; height:15px; background:var(--accent-purple); margin-left:3px; animation:fadeIn 0.5s infinite alternate;"></span>';
                    chat.scrollToBottom();
                }
            }, intervalTime);
        });
    },

    copyCode: (btn) => {
        const pre = btn.closest('pre');
        const code = pre.querySelector('code').innerText;
        
        navigator.clipboard.writeText(code).then(() => {
            const labelSpan = btn.querySelector('.copy-label');
            const icon = btn.querySelector('i');
            
            labelSpan.textContent = 'Copied!';
            icon.setAttribute('data-lucide', 'check');
            lucide.createIcons();
            
            setTimeout(() => {
                labelSpan.textContent = 'Copy code';
                icon.setAttribute('data-lucide', 'copy');
                lucide.createIcons();
            }, 2000);
        }).catch(err => {
            console.error('Failed to copy text: ', err);
        });
    },

    scrollToBottom: () => {
        const thread = document.getElementById('chat-thread');
        thread.scrollTop = thread.scrollHeight;
    },

    escapeHTML: (str) => {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    },

    // Simple custom markdown renderer to parse bullet lists, code blocks, bold text
    parseMarkdown: (text) => {
        if (!text) return '';
        
        // Escape HTML tags to prevent XSS
        let html = chat.escapeHTML(text);
        
        // 1. Code Blocks: ```language \n code ```
        const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
        html = html.replace(codeBlockRegex, (match, lang, code) => {
            const cleanLang = lang || 'code';
            return `
                <pre><div class="code-header">
                    <span>${cleanLang.toLowerCase()}</span>
                    <button class="code-copy-btn">
                        <i data-lucide="copy" style="width: 12px; height: 12px;"></i>
                        <span class="copy-label">Copy code</span>
                    </button>
                </div><code class="language-${cleanLang}">${code.trim()}</code></pre>
            `;
        });
        
        // 2. Inline Code: `code`
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // 3. Bold Text: **text**
        html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        
        // 4. Bullet Lists: Lines beginning with '- ' or '* '
        const lines = html.split('\n');
        let inList = false;
        let processedLines = [];
        
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i].trim();
            if (line.startsWith('- ') || line.startsWith('* ')) {
                if (!inList) {
                    processedLines.push('<ul>');
                    inList = true;
                }
                processedLines.push(`<li>${line.substring(2)}</li>`);
            } else {
                if (inList) {
                    processedLines.push('</ul>');
                    inList = false;
                }
                processedLines.push(lines[i]);
            }
        }
        if (inList) processedLines.push('</ul>');
        html = processedLines.join('\n');

        // 5. Line Breaks / Paragraph splits
        const paragraphs = html.split('\n\n');
        html = paragraphs.map(p => {
            const trimmed = p.trim();
            if (trimmed.startsWith('<pre>') || trimmed.startsWith('<ul>') || trimmed.startsWith('<li>') || trimmed.startsWith('</pre>') || trimmed.startsWith('</ul>')) {
                return trimmed;
            }
            return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
        }).join('');
        
        return html;
    },

    // Export Chat as Markdown
    exportChat: () => {
        if (!state.activeChatId) return;
        const chats = db.getChats();
        const activeChat = chats.find(c => c.id === state.activeChatId);
        if (!activeChat) return;

        const messages = db.getMessages().filter(m => m.chatId === state.activeChatId);
        if (messages.length === 0) {
            ui.notify('No messages to export.');
            return;
        }

        let markdown = `# HEY AI Conversation: ${activeChat.title}\n`;
        markdown += `Date: ${new Date(activeChat.createdAt).toLocaleDateString()}\n`;
        markdown += `Exported: ${new Date().toLocaleString()}\n\n`;
        markdown += `--- \n\n`;

        messages.forEach(m => {
            const author = m.role === 'user' ? state.currentUser.username : 'HEY AI';
            markdown += `### **${author}** (${new Date(m.timestamp).toLocaleTimeString()}):\n${m.content}\n\n`;
            markdown += `---\n\n`;
        });

        // Trigger file download
        const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `hey_ai_chat_${activeChat.title.replace(/\s+/g, '_').toLowerCase()}.md`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        ui.notify('Chat exported as Markdown file.');
    },

    // Voice Input Controls (Speech Recognition)
    recognition: null,
    isListening: false,

    toggleVoiceInput: () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            ui.notify('Speech recognition is not supported in this browser. Please use Chrome or Edge.');
            return;
        }

        const btn = document.getElementById('voice-input-btn');

        if (chat.isListening) {
            if (chat.recognition) chat.recognition.stop();
            return;
        }

        chat.isListening = true;
        btn.classList.add('recording');
        btn.innerHTML = `<i data-lucide="mic-off" style="width: 15px; height: 15px;"></i>`;
        lucide.createIcons();
        ui.notify('Listening... speak clearly.');

        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onresult = (event) => {
            const text = event.results[0][0].transcript;
            const box = document.getElementById('chat-input-box');
            box.value = box.value ? box.value + ' ' + text : text;
            ui.autoExpandTextarea(box);
            document.getElementById('char-counter').textContent = `${box.value.length} chars`;
        };

        rec.onerror = (e) => {
            console.error('Speech recognition error:', e);
            if (e.error !== 'no-speech') {
                ui.notify('Voice error: ' + e.error);
            }
            chat.stopVoiceInput();
        };

        rec.onend = () => {
            chat.stopVoiceInput();
        };

        chat.recognition = rec;
        rec.start();
    },

    stopVoiceInput: () => {
        chat.isListening = false;
        const btn = document.getElementById('voice-input-btn');
        if (btn) {
            btn.classList.remove('recording');
            btn.innerHTML = `<i data-lucide="mic" style="width: 15px; height: 15px;"></i>`;
            lucide.createIcons();
        }
    }
};

// ==========================================
// 4. AI INTEGRATION CLIENT (OPENAI, GEMINI & SIMULATED)
// ==========================================
const api = {
    queryOpenAI: async (messages) => {
        const apiKey = state.settings.apiKey;
        if (!apiKey) {
            throw new Error('OpenAI API Key is missing. Please configure it in Settings.');
        }

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: state.settings.model || 'gpt-4o',
                messages: messages
            })
        });

        if (!response.ok) {
            const errDetails = await response.json().catch(() => ({}));
            throw new Error(errDetails.error?.message || `API HTTP Error ${response.status}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    },

    queryGemini: async (messages) => {
        const apiKey = state.settings.geminiKey;
        if (!apiKey) {
            throw new Error('Google Gemini API Key is missing. Please configure it in Settings.');
        }

        const model = state.settings.model || 'gemini-2.5-flash';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Map roles: assistant -> model, user -> user
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ contents })
        });

        if (!response.ok) {
            const errDetails = await response.json().catch(() => ({}));
            throw new Error(errDetails.error?.message || `Gemini API HTTP Error ${response.status}`);
        }

        const data = await response.json();
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
            return data.candidates[0].content.parts[0].text;
        } else {
            throw new Error('Google Gemini returned an empty response.');
        }
    },

    generateSimulatedResponse: (prompt) => {
        const q = prompt.toLowerCase();
        
        if (q.includes('javascript') || q.includes('code') || q.includes('function') || q.includes('program')) {
            return `Here is a robust JavaScript implementation of a **debounce function**. 

Debouncing limits the rate at which a function triggers. It is extremely useful for performance on search inputs, window resize handles, or scroll listeners.

\`\`\`javascript
/**
 * Creates a debounced function that delays invoking func until after wait 
 * milliseconds have elapsed since the last time the debounced function was invoked.
 *
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The delay in milliseconds.
 * @return {Function} The new debounced function.
 */
function debounce(func, wait) {
    let timeout;
    
    return functionExecuted = function(...args) {
        const context = this;
        
        clearTimeout(timeout);
        
        timeout = setTimeout(() => {
            func.apply(context, args);
        }, wait);
    };
}

// Example usage:
const handleSearch = debounce((query) => {
    console.log("Fetching API results for:", query);
}, 300);

// Bind to event listener
const searchInput = document.getElementById("search-box");
if (searchInput) {
    searchInput.addEventListener("input", (e) => handleSearch(e.target.value));
}
\`\`\`

### Features of this implementation:
- **Scope Context Binding**: It properly forwards the \`this\` context to the original handler.
- **Argument Forwarding**: Forwards all passed arguments (like the event object \`e\`).
- **Memory Cleanup**: Clears existing timeouts on keystrokes to reset the countdown clock.`;
        }
        
        if (q.includes('quantum') || q.includes('physics') || q.includes('computing')) {
            return `**Quantum Computing** shifts computation from traditional binary structures to the complex laws of quantum mechanics.

Here is a simple breakdown of the core principles:

1. **Qubits (Quantum Bits)**
   Unlike classical computer bits that are fixed as either \`0\` or \`1\`, a qubit can exist in a state of both values simultaneously. This is called **Superposition**.
   
2. **Superposition**
   Think of a coin. Static on a table, it is heads (\`0\`) or tails (\`1\`). While spinning, it represents a mixture of both states at once. Only when stopped (measured) does it settle.
   
3. **Entanglement**
   Qubits can become connected in pairs. Modifying the state of one instantly shapes the state of its partner, regardless of physical distance. Einstein referred to this as *"spooky action at a distance"*.
   
4. **Quantum Interference**
   Quantum systems amplify paths leading to the correct answer and cancel out paths leading to wrong answers.

### Why does it matter?
Quantum computers don't just search faster; they solve computational tasks in chemistry, cryptography, and scheduling optimizations that would take modern supercomputers thousands of years to process.`;
        }

        if (q.includes('team') || q.includes('build') || q.includes('remote') || q.includes('activit')) {
            return `Working in a remote setup can sometimes feel isolating. Here are **5 creative and highly engaging remote team-building activities** to boost morale:

- **1. "Show and Tell" Lightning Rounds**
  Ask teammates to grab one item within arm's reach that has a story behind it. Give everyone 2 minutes to explain what it is and why they have it. It is simple, requires zero prep, and fosters deep personal connections.
- **2. Collaborative Online escape rooms**
  Use digital platforms (like *Mystery Escape Room* or *Escapely*) to group teams into groups of 4-6. They must solve virtual puzzles and decrypt codes together. Excellent for teamwork and problem-solving.
- **3. GeoGuessr Challenge**
  GeoGuessr drops players into Google Street View locations globally. Share a screen and have the team collaborate on clues (street signs, geography, trees) to pin where they are.
- **4. Async Coffee Pairs**
  Automate randomized meetings using Slack integrations like *Donut*. Pairs up teammates for a casual 15-minute virtual coffee break weekly. Keep work talk restricted!
- **5. Collaborative Pixel Art or Draw-Alongs**
  Use virtual whiteboards like *Miro* or *FigJam*. Draw a basic prompt together or play a round of online Pictionary (like *skribbl.io*).

Would you like tips on how to facilitate these meetings smoothly?`;
        }

        if (q.includes('negotiate') || q.includes('salary') || q.includes('email') || q.includes('letter')) {
            return `Here is a professional email template designed for salary negotiation after receiving a job offer. 

Remember to customize the bracketed information to fit your exact circumstances:

\`\`\`
Subject: Job Offer - [Your Name] - [Job Title]

Dear [Hiring Manager Name],

Thank you so much for offering me the [Job Title] position at [Company Name]. I am incredibly excited about the opportunity to join the team and contribute to [mention a specific goal or project mentioned during interviews].

Before signing the contract, I wanted to discuss the compensation package. Given my [number] years of experience in [specialized skill/field], along with my track record of [mention a key past achievement, e.g., boosting team metrics by 20%], I was hoping we could explore a starting salary of [Requested Salary, e.g. $95,000]. 

This figure aligns with market rates for this role in [Location/Region] and reflects the specialized value I will bring to the team from day one.

I am very enthusiastic about joining [Company Name] and am confident we can find an arrangement that works well for both of us. Thank you again for your time, consideration, and this offer.

Best regards,

[Your Name]
[Your Phone Number]
[Your Email]
\`\`\`

### Quick Negotiation Tips:
1. **Never negotiate without a counter**: Back up your requested salary with real data points or achievements.
2. **Be enthusiastic**: Maintain a collaborative, friendly tone throughout the exchange.
3. **Consider the full package**: If they cannot increase base salary, negotiate for extra vacation days, flexible hours, sign-on bonuses, or education stipend.`;
        }

        if (q.includes('who are you') || q.includes('your name') || q.includes('what is this')) {
            return `I am **HEY AI**, a premium, ChatGPT-style conversational assistant designed to help you brainstorm, code, analyze, and learn.

Currently, I am running in **Demo Mode**, which means I simulate intelligent replies instantly. You can go to the **AI Configuration** settings panel to configure a custom OpenAI or Google Gemini API Key. This will unlock real, dynamic connections to models like \`gpt-4o\` or \`gemini-2.5-flash\`.`;
        }

        // Generic intelligent response
        return `Hello! I received your query: *"${prompt}"*.

I am currently running in **Demo Mode** (no API key configured). To show you my streaming mechanics, I am printing this response.

Here's what you can do next:
- **Configure AI Key**: Click the **"Configure API"** button in the header, choose your provider (OpenAI or Gemini), input your secret key, and select a model.
- **Try Suggestions**: Select one of the cards on the welcome page (like *"Write a JavaScript debounce function"*) to see my predefined smart responses.
- **Explore Chats**: Create new chats, rename them inline, delete conversations, or toggle views.

Let me know if there's anything specific you want me to mock, write, or explain!`;
    }
};

// ==========================================
// 5. PREFERENCES & SETTINGS MODULE
// ==========================================
const settings = {
    loadPreferences: () => {
        let prefs = db.getSettings();
        if (!prefs) {
            // Default setup
            prefs = {
                provider: 'demo',
                apiKey: '',
                geminiKey: '',
                model: 'gpt-4o',
                themeAccent: 'violet',
                speed: 'normal'
            };
            db.saveSettings(prefs);
        }
        
        // Backward compatibility properties checks
        if (!prefs.hasOwnProperty('provider')) {
            prefs.provider = prefs.demoMode === false ? 'openai' : 'demo';
            delete prefs.demoMode;
            db.saveSettings(prefs);
        }
        if (!prefs.hasOwnProperty('geminiKey')) {
            prefs.geminiKey = '';
            db.saveSettings(prefs);
        }
        if (!prefs.hasOwnProperty('themeAccent')) {
            prefs.themeAccent = 'violet';
            db.saveSettings(prefs);
        }
        if (!prefs.hasOwnProperty('speed')) {
            prefs.speed = 'normal';
            db.saveSettings(prefs);
        }
        
        state.settings = prefs;
        
        // Sync UI inputs
        document.getElementById('settings-provider').value = prefs.provider;
        document.getElementById('settings-api-key').value = prefs.apiKey;
        document.getElementById('settings-gemini-key').value = prefs.geminiKey;
        document.getElementById('settings-accent').value = prefs.themeAccent;
        document.getElementById('settings-speed').value = prefs.speed;
        
        // Trigger UI modifications
        settings.updateProviderUI(prefs.provider);
        document.getElementById('settings-model').value = prefs.model;
        settings.updateModelBadge(prefs.provider, prefs.model);
        settings.applyThemeAccent(prefs.themeAccent);
    },

    updateProvider: (providerVal) => {
        state.settings.provider = providerVal;
        
        // Choose reasonable default model when switching provider
        if (providerVal === 'openai') {
            state.settings.model = 'gpt-4o';
        } else if (providerVal === 'gemini') {
            state.settings.model = 'gemini-2.5-flash';
        } else {
            state.settings.model = '';
        }
        
        db.saveSettings(state.settings);
        
        // Sync UI dropdown options
        settings.updateProviderUI(providerVal);
        document.getElementById('settings-model').value = state.settings.model;
        settings.updateModelBadge(providerVal, state.settings.model);
        
        ui.notify(`API Engine Provider set to ${providerVal === 'demo' ? 'Demo Mode' : providerVal.toUpperCase()}.`);
    },

    updateProviderUI: (provider) => {
        const openaiGroup = document.getElementById('openai-key-group');
        const geminiGroup = document.getElementById('gemini-key-group');
        const modelSelectGroup = document.getElementById('model-select-group');
        const modelSelect = document.getElementById('settings-model');

        if (provider === 'demo') {
            openaiGroup.style.display = 'none';
            geminiGroup.style.display = 'none';
            modelSelectGroup.style.display = 'none';
        } else if (provider === 'openai') {
            openaiGroup.style.display = 'flex';
            geminiGroup.style.display = 'none';
            modelSelectGroup.style.display = 'flex';
            
            modelSelect.innerHTML = `
                <option value="gpt-4o">gpt-4o (Standard)</option>
                <option value="gpt-4-turbo">gpt-4-turbo (Advanced)</option>
                <option value="gpt-3.5-turbo">gpt-3.5-turbo (Fast)</option>
            `;
        } else if (provider === 'gemini') {
            openaiGroup.style.display = 'none';
            geminiGroup.style.display = 'flex';
            modelSelectGroup.style.display = 'flex';
            
            modelSelect.innerHTML = `
                <option value="gemini-2.5-flash">gemini-2.5-flash (Fast & Smart)</option>
                <option value="gemini-2.5-pro">gemini-2.5-pro (Highly Capable)</option>
                <option value="gemini-1.5-flash">gemini-1.5-flash (Legacy Fast)</option>
            `;
        }
    },

    updateApiKey: (key) => {
        state.settings.apiKey = key.trim();
        db.saveSettings(state.settings);
        ui.notify('OpenAI API Key saved successfully.');
    },

    updateGeminiKey: (key) => {
        state.settings.geminiKey = key.trim();
        db.saveSettings(state.settings);
        ui.notify('Google Gemini API Key saved successfully.');
    },

    updateModel: (modelName) => {
        state.settings.model = modelName;
        db.saveSettings(state.settings);
        settings.updateModelBadge(state.settings.provider, modelName);
        ui.notify(`Preferred model set to ${modelName}.`);
    },

    updateModelBadge: (provider, modelName) => {
        const badge = document.getElementById('chat-header-model');
        if (provider === 'demo') {
            badge.textContent = 'Demo Mode';
            badge.style.color = 'var(--accent-teal)';
            badge.style.borderColor = 'rgba(20, 184, 166, 0.3)';
        } else {
            badge.textContent = modelName;
            if (provider === 'openai') {
                badge.style.color = 'var(--accent-purple)';
                badge.style.borderColor = 'rgba(139, 92, 246, 0.3)';
            } else {
                badge.style.color = '#38bdf8'; // Sky blue for Gemini
                badge.style.borderColor = 'rgba(56, 189, 248, 0.3)';
            }
        }
    },

    updateSpeed: (speed) => {
        state.settings.speed = speed;
        db.saveSettings(state.settings);
        ui.notify(`Response typing speed set to ${speed}.`);
    },

    updateThemeAccent: (accent) => {
        state.settings.themeAccent = accent;
        db.saveSettings(state.settings);
        settings.applyThemeAccent(accent);
        ui.notify(`Theme accent set to ${accent.charAt(0).toUpperCase() + accent.slice(1)}.`);
    },

    applyThemeAccent: (accent) => {
        const root = document.documentElement;
        
        const colors = {
            violet: {
                purple: '#8b5cf6',
                indigo: '#6366f1',
                teal: '#14b8a6',
                gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 50%, #14b8a6 100%)',
                focus: 'rgba(139, 92, 246, 0.4)'
            },
            emerald: {
                purple: '#10b981',
                indigo: '#059669',
                teal: '#34d399',
                gradient: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #34d399 100%)',
                focus: 'rgba(16, 185, 129, 0.4)'
            },
            amber: {
                purple: '#f59e0b',
                indigo: '#d97706',
                teal: '#fbbf24',
                gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #fbbf24 100%)',
                focus: 'rgba(245, 158, 11, 0.4)'
            },
            crimson: {
                purple: '#ef4444',
                indigo: '#dc2626',
                teal: '#f87171',
                gradient: 'linear-gradient(135deg, #ef4444 0%, #dc2626 50%, #f87171 100%)',
                focus: 'rgba(239, 68, 68, 0.4)'
            },
            slate: {
                purple: '#64748b',
                indigo: '#475569',
                teal: '#94a3b8',
                gradient: 'linear-gradient(135deg, #64748b 0%, #475569 50%, #94a3b8 100%)',
                focus: 'rgba(100, 116, 139, 0.4)'
            }
        };
        
        const activeColors = colors[accent] || colors.violet;
        
        root.style.setProperty('--accent-purple', activeColors.purple);
        root.style.setProperty('--accent-indigo', activeColors.indigo);
        root.style.setProperty('--accent-teal', activeColors.teal);
        root.style.setProperty('--accent-gradient', activeColors.gradient);
        root.style.setProperty('--border-color-focus', activeColors.focus);
    }
};

// ==========================================
// 6. UI & LAYOUT UTILS
// ==========================================
const ui = {
    init: () => {
        // Character counter setup for input box
        const input = document.getElementById('chat-input-box');
        const counter = document.getElementById('char-counter');
        
        input.addEventListener('input', () => {
            counter.textContent = `${input.value.length} chars`;
        });
        
        // Enter key to send (Shift + Enter for new lines)
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                chat.sendMessage();
            }
        });

        // Initialize mobile sidebar overlay
        document.body.insertAdjacentHTML('beforeend', `<div id="app-notifications" style="position: fixed; bottom: 20px; right: 20px; z-index: 2000; display: flex; flex-direction: column; gap: 10px; pointer-events: none;"></div>`);
    },

    toggleSidebar: (show) => {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        
        if (show) {
            sidebar.classList.add('mobile-active');
            overlay.classList.add('active');
        } else {
            sidebar.classList.remove('mobile-active');
            overlay.classList.remove('active');
        }
    },

    autoExpandTextarea: (textarea) => {
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    },

    openSettings: () => {
        document.getElementById('settings-modal').classList.add('active');
        ui.switchSettingsTab('general');
    },

    closeSettings: () => {
        document.getElementById('settings-modal').classList.remove('active');
    },

    switchSettingsTab: (tabId) => {
        document.querySelectorAll('.modal-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.modal-pane').forEach(pane => pane.classList.remove('active'));
        
        if (tabId === 'general') {
            document.getElementById('setting-tab-general').classList.add('active');
            document.getElementById('pane-general').classList.add('active');
        } else if (tabId === 'api') {
            document.getElementById('setting-tab-api').classList.add('active');
            document.getElementById('pane-api').classList.add('active');
        }
    },

    // Premium micro-notifications system
    notify: (message, duration = 3000) => {
        const container = document.getElementById('app-notifications');
        const notification = document.createElement('div');
        notification.style.cssText = `
            background: rgba(18, 19, 26, 0.9);
            border: 1px solid var(--border-color);
            border-left: 4px solid var(--accent-purple);
            color: var(--text-primary);
            padding: 12px 20px;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 500;
            box-shadow: var(--shadow-md);
            pointer-events: auto;
            transform: translateY(20px);
            opacity: 0;
            transition: all var(--transition-normal);
            backdrop-filter: blur(10px);
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        notification.innerHTML = `<i data-lucide="check-circle" style="color: var(--accent-teal); width:16px; height:16px;"></i><span>${message}</span>`;
        
        container.appendChild(notification);
        lucide.createIcons();
        
        // Trigger slide-in
        setTimeout(() => {
            notification.style.transform = 'translateY(0)';
            notification.style.opacity = '1';
        }, 50);

        // Slide-out and remove
        setTimeout(() => {
            notification.style.transform = 'translateY(-20px)';
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
};

// ==========================================
// 7. INITIALIZE APPLICATION
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    ui.init();
    auth.init();
});
