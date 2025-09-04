// ===== ADVANCED CHATSPEED JAVASCRIPT =====

// Global Configuration
const CONFIG = {
    API_BASE_URL: 'https://api.chatspeed.com',
    WEBSOCKET_URL: 'wss://ws.chatspeed.com',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    SUPPORTED_FORMATS: ['jpg', 'jpeg', 'png', 'gif', 'mp4', 'webm'],
    POSTS_PER_PAGE: 10,
    NOTIFICATION_TIMEOUT: 5000,
    TYPING_TIMEOUT: 3000,
    THEME_STORAGE_KEY: 'chatspeed_theme',
    USER_STORAGE_KEY: 'chatspeed_user'
};

// Global State Management
class StateManager {
    constructor() {
        this.state = {
            user: null,
            theme: 'light',
            notifications: [],
            posts: [],
            currentPage: 1,
            isLoading: false,
            websocket: null,
            typingUsers: new Set(),
            onlineUsers: new Set()
        };
        this.listeners = new Map();
    }

    setState(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        this.notifyListeners(key, value, oldValue);
    }

    getState(key) {
        return this.state[key];
    }

    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set());
        }
        this.listeners.get(key).add(callback);
    }

    unsubscribe(key, callback) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).delete(callback);
        }
    }

    notifyListeners(key, newValue, oldValue) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(callback => {
                callback(newValue, oldValue);
            });
        }
    }
}

// Initialize Global State
const appState = new StateManager();

// ===== UTILITY FUNCTIONS =====

// Debounce Function
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

// Throttle Function
function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Format Time Ago
function timeAgo(date) {
    const now = new Date();
    const diffInSeconds = Math.floor((now - new Date(date)) / 1000);
    
    const intervals = [
        { label: 'year', seconds: 31536000 },
        { label: 'month', seconds: 2592000 },
        { label: 'week', seconds: 604800 },
        { label: 'day', seconds: 86400 },
        { label: 'hour', seconds: 3600 },
        { label: 'minute', seconds: 60 }
    ];
    
    for (const interval of intervals) {
        const count = Math.floor(diffInSeconds / interval.seconds);
        if (count >= 1) {
            return `${count} ${interval.label}${count > 1 ? 's' : ''} ago`;
        }
    }
    
    return 'Just now';
}

// Format Numbers (1.2K, 1.5M, etc.)
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Generate UUID
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Sanitize HTML
function sanitizeHTML(str) {
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
}

// ===== LOADING SCREEN MANAGEMENT =====
class LoadingManager {
    constructor() {
        this.loadingScreen = document.getElementById('loadingScreen');
        this.progressBar = document.querySelector('.loading-progress');
        this.isLoading = true;
    }

    updateProgress(percentage) {
        if (this.progressBar) {
            this.progressBar.style.width = `${percentage}%`;
        }
    }

    hide() {
        if (this.loadingScreen && this.isLoading) {
            this.loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                this.loadingScreen.style.display = 'none';
                this.isLoading = false;
            }, 500);
        }
    }

    show() {
        if (this.loadingScreen) {
            this.loadingScreen.style.display = 'flex';
            this.loadingScreen.classList.remove('fade-out');
            this.isLoading = true;
        }
    }
}

const loadingManager = new LoadingManager();

// ===== THEME MANAGEMENT =====
class ThemeManager {
    constructor() {
        this.currentTheme = localStorage.getItem(CONFIG.THEME_STORAGE_KEY) || 'light';
        this.applyTheme(this.currentTheme);
    }

    toggleTheme() {
        this.currentTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.applyTheme(this.currentTheme);
        this.saveTheme();
    }

    applyTheme(theme) {
        document.documentElement.setAttribute('data-bs-theme', theme);
        appState.setState('theme', theme);
        
        // Update theme toggle icon
        const themeIcon = document.querySelector('#themeToggle i');
        if (themeIcon) {
            themeIcon.className = theme === 'light' ? 'bi bi-moon-stars' : 'bi bi-sun';
        }
    }

    saveTheme() {
        localStorage.setItem(CONFIG.THEME_STORAGE_KEY, this.currentTheme);
    }

    setCustomTheme(themeName) {
        document.body.className = `theme-${themeName}`;
        this.saveTheme();
    }
}

const themeManager = new ThemeManager();

// ===== NOTIFICATION SYSTEM =====
class NotificationManager {
    constructor() {
        this.container = document.getElementById('toastContainer');
        this.notifications = [];
    }

    show(message, type = 'info', duration = CONFIG.NOTIFICATION_TIMEOUT) {
        const id = generateUUID();
        const notification = this.createNotification(id, message, type);
        
        this.container.appendChild(notification);
        this.notifications.push({ id, element: notification });
        
        // Trigger animation
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Auto remove
        if (duration > 0) {
            setTimeout(() => this.remove(id), duration);
        }
        
        return id;
    }

    createNotification(id, message, type) {
        const toast = document.createElement('div');
        toast.className = `toast align-items-center text-bg-${type} border-0`;
        toast.setAttribute('role', 'alert');
        toast.setAttribute('data-id', id);
        
        const iconMap = {
            success: 'check-circle-fill',
            danger: 'exclamation-triangle-fill',
            warning: 'exclamation-triangle-fill',
            info: 'info-circle-fill'
        };
        
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body">
                    <i class="bi bi-${iconMap[type]} me-2"></i>
                    ${sanitizeHTML(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" 
                        onclick="notificationManager.remove('${id}')"></button>
            </div>
        `;
        
        return toast;
    }

    remove(id) {
        const notification = this.notifications.find(n => n.id === id);
        if (notification) {
            notification.element.classList.remove('show');
            setTimeout(() => {
                if (notification.element.parentNode) {
                    notification.element.parentNode.removeChild(notification.element);
                }
                this.notifications = this.notifications.filter(n => n.id !== id);
            }, 300);
        }
    }

    clear() {
        this.notifications.forEach(n => this.remove(n.id));
    }
}

const notificationManager = new NotificationManager();

// ===== WEBSOCKET MANAGER =====
class WebSocketManager {
    constructor() {
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.heartbeatInterval = null;
    }

    connect() {
        try {
            this.ws = new WebSocket(CONFIG.WEBSOCKET_URL);
            this.setupEventListeners();
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.handleReconnect();
        }
    }

    setupEventListeners() {
        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            notificationManager.show('Connected to ChatSpeed', 'success');
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.stopHeartbeat();
            this.handleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleMessage(data) {
        switch (data.type) {
            case 'new_post':
                this.handleNewPost(data.payload);
                break;
            case 'user_online':
                appState.getState('onlineUsers').add(data.payload.userId);
                break;
            case 'user_offline':
                appState.getState('onlineUsers').delete(data.payload.userId);
                break;
            case 'typing_start':
                appState.getState('typingUsers').add(data.payload.userId);
                break;
            case 'typing_stop':
                appState.getState('typingUsers').delete(data.payload.userId);
                break;
            case 'notification':
                notificationManager.show(data.payload.message, data.payload.type);
                break;
        }
    }

    handleNewPost(post) {
        const banner = document.getElementById('liveUpdatesBanner');
        if (banner) {
            banner.style.display = 'block';
            banner.querySelector('.new-posts-count').textContent = '1';
        }
    }

    send(data) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(data));
        }
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            this.send({ type: 'ping' });
        }, 30000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            setTimeout(() => {
                this.reconnectAttempts++;
                console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
                this.connect();
            }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
        } else {
            notificationManager.show('Connection lost. Please refresh the page.', 'danger', 0);
        }
    }

    disconnect() {
        this.stopHeartbeat();
        if (this.ws) {
            this.ws.close();
        }
    }
}

const wsManager = new WebSocketManager();

// ===== POST MANAGER =====
class PostManager {
    constructor() {
        this.posts = [];
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMore = true;
    }

    async createPost(content, media = null, privacy = 'public') {
        const postData = {
            id: generateUUID(),
            content: sanitizeHTML(content),
            media: media,
            privacy: privacy,
            timestamp: new Date().toISOString(),
            author: appState.getState('user') || {
                id: 'demo_user',
                name: 'Demo User',
                avatar: 'https://via.placeholder.com/50x50',
                verified: false
            },
            likes: 0,
            comments: 0,
            shares: 0,
            reactions: {}
        };

        // Add to local state immediately for instant feedback
        this.posts.unshift(postData);
        this.renderPost(postData, true);

        // Send to server
        try {
            const response = await this.sendToServer('/posts', postData);
            if (response.success) {
                notificationManager.show('Post created successfully!', 'success');
                wsManager.send({ type: 'new_post', payload: postData });
            }
        } catch (error) {
            console.error('Error creating post:', error);
            notificationManager.show('Failed to create post. Please try again.', 'danger');
            // Remove from local state if server request failed
            this.posts = this.posts.filter(p => p.id !== postData.id);
            document.querySelector(`[data-post-id="${postData.id}"]`)?.remove();
        }

        return postData;
    }

    renderPost(post, prepend = false) {
        const postElement = this.createPostElement(post);
        const container = document.getElementById('postsContainer');
        
        if (prepend) {
            container.insertBefore(postElement, container.firstChild);
        } else {
            container.appendChild(postElement);
        }

        // Animate in
        setTimeout(() => postElement.classList.add('fade-in'), 100);
    }

    createPostElement(post) {
        const article = document.createElement('article');
        article.className = 'card glass-card mb-4 post-card';
        article.setAttribute('data-post-id', post.id);
        article.setAttribute('data-aos', 'fade-up');

        const mediaHtml = post.media ? this.createMediaHtml(post.media) : '';
        const timeAgoText = timeAgo(post.timestamp);

        article.innerHTML = `
            <div class="card-body">
                <div class="post-header mb-3">
                    <div class="d-flex align-items-center justify-content-between">
                        <div class="d-flex align-items-center">
                            <div class="position-relative">
                                <img src="${post.author.avatar}" class="rounded-circle me-3 post-avatar" alt="User avatar">
                                <span class="online-indicator"></span>
                            </div>
                            <div>
                                <div class="d-flex align-items-center">
                                    <h6 class="mb-0 me-2">${sanitizeHTML(post.author.name)}</h6>
                                    ${post.author.verified ? '<i class="bi bi-patch-check-fill text-primary verified-badge"></i>' : ''}
                                </div>
                                <div class="post-meta">
                                    <span class="text-muted">${timeAgoText}</span>
                                    <span class="mx-1">•</span>
                                    <i class="bi bi-globe text-muted" title="Public"></i>
                                </div>
                            </div>
                        </div>
                        <div class="dropdown">
                            <button class="btn btn-ghost btn-sm" data-bs-toggle="dropdown">
                                <i class="bi bi-three-dots"></i>
                            </button>
                            <ul class="dropdown-menu">
                                <li><a class="dropdown-item" href="#"><i class="bi bi-bookmark me-2"></i>Save Post</a></li>
                                <li><a class="dropdown-item" href="#"><i class="bi bi-flag me-2"></i>Report</a></li>
                                <li><a class="dropdown-item" href="#"><i class="bi bi-eye-slash me-2"></i>Hide</a></li>
                            </ul>
                        </div>
                    </div>
                </div>
                
                <div class="post-content">
                    <p>${this.formatPostContent(post.content)}</p>
                    ${mediaHtml}
                </div>
                
                <div class="engagement-stats">
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="reaction-summary">
                            <div class="reaction-icons">
                                <span class="reaction-icon bg-primary">👍</span>
                                <span class="reaction-icon bg-danger">❤️</span>
                                <span class="reaction-icon bg-warning">😂</span>
                            </div>
                            <span class="reaction-count">${formatNumber(post.likes)} reactions</span>
                        </div>
                        <div class="interaction-stats">
                            <span class="me-3">${formatNumber(post.comments)} comments</span>
                            <span>${formatNumber(post.shares)} shares</span>
                        </div>
                    </div>
                </div>
                
                <div class="post-actions border-top pt-3">
                    <div class="row g-1">
                        <div class="col">
                            <button class="btn btn-ghost w-100 reaction-btn" onclick="postManager.toggleReaction('${post.id}', 'like')">
                                <i class="bi bi-heart me-2"></i> Like
                            </button>
                        </div>
                        <div class="col">
                            <button class="btn btn-ghost w-100" onclick="toggleComments('${post.id}')">
                                <i class="bi bi-chat me-2"></i> Comment
                            </button>
                        </div>
                        <div class="col">
                            <button class="btn btn-ghost w-100" onclick="postManager.sharePost('${post.id}')">
                                <i class="bi bi-share me-2"></i> Share
                            </button>
                        </div>
                        <div class="col">
                            <button class="btn btn-ghost w-100" onclick="postManager.savePost('${post.id}')">
                                <i class="bi bi-bookmark me-2"></i> Save
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="comments-section d-none" id="comments-${post.id}">
                    <div class="comment-input mt-3">
                        <div class="d-flex">
                            <img src="https://via.placeholder.com/32x32" class="rounded-circle me-2" alt="Your avatar">
                            <input type="text" class="form-control" placeholder="Write a comment..." 
                                   onkeypress="handleCommentSubmit(event, '${post.id}')">
                        </div>
                    </div>
                    <div class="comments-list mt-3" id="commentsList-${post.id}">
                        <!-- Comments will be loaded here -->
                    </div>
                </div>
            </div>
        `;

        return article;
    }

    createMediaHtml(media) {
        if (!media) return '';

        const { type, url, thumbnail } = media;
        
        if (type === 'image') {
            return `
                <div class="post-media">
                    <img src="${url}" class="img-fluid rounded post-image" alt="Post image" 
                         onclick="openImageModal('${url}')">
                    <div class="media-overlay">
                        <button class="btn btn-light btn-sm">
                            <i class="bi bi-arrows-fullscreen"></i>
                        </button>
                    </div>
                </div>
            `;
        } else if (type === 'video') {
            return `
                <div class="post-media">
                    <div class="video-container">
                        <div class="video-placeholder" onclick="playVideo('${url}')">
                            <img src="${thumbnail}" class="img-fluid rounded" alt="Video thumbnail">
                            <div class="video-play-btn">
                                <i class="bi bi-play-fill"></i>
                            </div>
                            <div class="video-duration">2:34</div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        return '';
    }

    formatPostContent(content) {
        // Convert URLs to links
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        content = content.replace(urlRegex, '<a href="$1" target="_blank" class="text-primary">$1</a>');
        
        // Convert hashtags
        const hashtagRegex = /#(\w+)/g;
        content = content.replace(hashtagRegex, '<a href="#" class="text-primary">#$1</a>');
        
        // Convert mentions
        const mentionRegex = /@(\w+)/g;
        content = content.replace(mentionRegex, '<a href="#" class="text-primary">@$1</a>');
        
        return content;
    }

    async toggleReaction(postId, reactionType) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) return;

        const button = document.querySelector(`[data-post-id="${postId}"] .reaction-btn`);
        const isActive = button.classList.contains('active');

        if (isActive) {
            post.likes = Math.max(0, post.likes - 1);
            button.classList.remove('active');
            button.innerHTML = '<i class="bi bi-heart me-2"></i> Like';
        } else {
            post.likes += 1;
            button.classList.add('active');
            button.innerHTML = '<i class="bi bi-heart-fill text-danger me-2"></i> Liked';
        }

        // Update reaction count
        const reactionCount = document.querySelector(`[data-post-id="${postId}"] .reaction-count`);
        if (reactionCount) {
            reactionCount.textContent = `${formatNumber(post.likes)} reactions`;
        }

        // Send to server
        try {
            await this.sendToServer(`/posts/${postId}/react`, {
                type: reactionType,
                action: isActive ? 'remove' : 'add'
            });
        } catch (error) {
            console.error('Error updating reaction:', error);
        }
    }

    async sharePost(postId) {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Check out this post on ChatSpeed',
                    url: `${window.location.origin}/post/${postId}`
                });
            } catch (error) {
                console.log('Share cancelled');
            }
        } else {
            // Fallback: copy to clipboard
            const url = `${window.location.origin}/post/${postId}`;
            await navigator.clipboard.writeText(url);
            notificationManager.show('Link copied to clipboard!', 'success');
        }
    }

    async savePost(postId) {
        try {
            await this.sendToServer(`/posts/${postId}/save`, { action: 'save' });
            notificationManager.show('Post saved successfully!', 'success');
        } catch (error) {
            console.error('Error saving post:', error);
            notificationManager.show('Failed to save post', 'danger');
        }
    }

    async loadMore() {
        if (this.isLoading || !this.hasMore) return;

        this.isLoading = true;
        const loadMoreBtn = document.getElementById('loadMore');
        const spinner = loadMoreBtn.querySelector('.spinner-border');
        
        spinner.classList.remove('d-none');
        loadMoreBtn.disabled = true;

        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Generate demo posts
            const newPosts = this.generateDemoPosts(CONFIG.POSTS_PER_PAGE);
            newPosts.forEach(post => this.renderPost(post));
            
            this.currentPage++;
            
            // Simulate end of posts
            if (this.currentPage > 3) {
                this.hasMore = false;
                loadMoreBtn.textContent = 'No more posts';
            }
        } catch (error) {
            console.error('Error loading posts:', error);
            notificationManager.show('Failed to load more posts', 'danger');
        } finally {
            this.isLoading = false;
            spinner.classList.add('d-none');
            loadMoreBtn.disabled = false;
        }
    }

    generateDemoPosts(count) {
        const demoUsers = [
            { name: 'Alice Johnson', avatar: 'https://via.placeholder.com/50x50', verified: true },
            { name: 'Bob Smith', avatar: 'https://via.placeholder.com/50x50', verified: false },
            { name: 'Carol Davis', avatar: 'https://via.placeholder.com/50x50', verified: true },
            { name: 'David Wilson', avatar: 'https://via.placeholder.com/50x50', verified: false }
        ];

        const demoContent = [
            "Just finished an amazing project! 🚀 #coding #webdev",
            "Beautiful sunset today! Nature never fails to amaze me 🌅",
            "Coffee and code - the perfect combination ☕️💻",
            "Excited to share my latest blog post about React hooks!",
            "Weekend vibes! Time to relax and recharge 😊"
        ];

        return Array.from({ length: count }, (_, i) => ({
            id: generateUUID(),
            content: demoContent[Math.floor(Math.random() * demoContent.length)],
            author: {
                id: generateUUID(),
                ...demoUsers[Math.floor(Math.random() * demoUsers.length)]
            },
            timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(),
            likes: Math.floor(Math.random() * 1000),
            comments: Math.floor(Math.random() * 50),
            shares: Math.floor(Math.random() * 20),
            media: Math.random() > 0.7 ? {
                type: 'image',
                url: `https://via.placeholder.com/600x400?text=Post+${i + 1}`
            } : null
        }));
    }

    async sendToServer(endpoint, data) {
        // Simulate API call
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.1) { // 90% success rate
                    resolve({ success: true, data });
                } else {
                    reject(new Error('Network error'));
                }
            }, 500);
        });
    }
}

const postManager = new PostManager();

// ===== SEARCH MANAGER =====
class SearchManager {
    constructor() {
        this.searchInput = document.getElementById('searchInput');
        this.searchSuggestions = document.createElement('div');
        this.searchSuggestions.className = 'search-suggestions';
        this.searchInput?.parentNode.appendChild(this.searchSuggestions);
        
        this.debouncedSearch = debounce(this.performSearch.bind(this), 300);
        this.setupEventListeners();
    }

    setupEventListeners() {
        if (!this.searchInput) return;

        this.searchInput.addEventListener('input', (e) => {
            const query = e.target.value.trim();
            if (query.length >= 2) {
                this.debouncedSearch(query);
            } else {
                this.hideSuggestions();
            }
        });

        this.searchInput.addEventListener('focus', () => {
            if (this.searchInput.value.trim().length >= 2) {
                this.showSuggestions();
            }
        });

        document.addEventListener('click', (e) => {
            if (!this.searchInput.parentNode.contains(e.target)) {
                this.hideSuggestions();
            }
        });
    }

    async performSearch(query) {
        try {
            // Simulate API search
            const results = await this.mockSearch(query);
            this.displaySuggestions(results);
        } catch (error) {
            console.error('Search error:', error);
        }
    }

    async mockSearch(query) {
        // Simulate search results
        const mockResults = [
            { type: 'user', name: 'John Doe', avatar: 'https://via.placeholder.com/32x32' },
            { type: 'hashtag', name: '#webdevelopment', count: '1.2K posts' },
            { type: 'page', name: 'ChatSpeed Official', verified: true },
            { type: 'user', name: 'Jane Smith', avatar: 'https://via.placeholder.com/32x32' }
        ];

        return mockResults.filter(item => 
            item.name.toLowerCase().includes(query.toLowerCase())
        );
    }

    displaySuggestions(results) {
        this.searchSuggestions.innerHTML = '';
        
        if (results.length === 0) {
            this.searchSuggestions.innerHTML = '<div class="p-3 text-muted">No results found</div>';
        } else {
            results.forEach(result => {
                const item = document.createElement('div');
                item.className = 'search-suggestion-item p-2 d-flex align-items-center';
                item.style.cursor = 'pointer';
                
                const icon = this.getResultIcon(result.type);
                const verified = result.verified ? '<i class="bi bi-patch-check-fill text-primary ms-1"></i>' : '';
                
                item.innerHTML = `
                    <div class="me-2">${icon}</div>
                    <div class="flex-grow-1">                        
                      <div class="fw-medium">${sanitizeHTML(result.name)}${verified}</div>
                        ${result.count ? `<small class="text-muted">${result.count}</small>` : ''}
                    </div>
                `;
                
                item.addEventListener('click', () => this.selectResult(result));
                this.searchSuggestions.appendChild(item);
            });
        }
        
        this.showSuggestions();
    }

    getResultIcon(type) {
        const icons = {
            user: '<img src="https://via.placeholder.com/24x24" class="rounded-circle" alt="User">',
            hashtag: '<i class="bi bi-hash text-primary"></i>',
            page: '<i class="bi bi-building text-success"></i>',
            post: '<i class="bi bi-file-text text-info"></i>'
        };
        return icons[type] || '<i class="bi bi-search"></i>';
    }

    selectResult(result) {
        this.searchInput.value = result.name;
        this.hideSuggestions();
        
        // Handle different result types
        switch (result.type) {
            case 'user':
                this.navigateToProfile(result);
                break;
            case 'hashtag':
                this.searchHashtag(result.name);
                break;
            case 'page':
                this.navigateToPage(result);
                break;
        }
    }

    navigateToProfile(user) {
        console.log('Navigate to profile:', user);
        notificationManager.show(`Viewing ${user.name}'s profile`, 'info');
    }

    searchHashtag(hashtag) {
        console.log('Search hashtag:', hashtag);
        notificationManager.show(`Searching for ${hashtag}`, 'info');
    }

    navigateToPage(page) {
        console.log('Navigate to page:', page);
        notificationManager.show(`Viewing ${page.name}`, 'info');
    }

    showSuggestions() {
        this.searchSuggestions.style.display = 'block';
    }

    hideSuggestions() {
        this.searchSuggestions.style.display = 'none';
    }
}

const searchManager = new SearchManager();

// ===== MEDIA MANAGER =====
class MediaManager {
    constructor() {
        this.selectedFiles = [];
        this.maxFiles = 10;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // File input handlers
        document.addEventListener('change', (e) => {
            if (e.target.type === 'file') {
                this.handleFileSelect(e);
            }
        });

        // Drag and drop
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        document.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (e.target.closest('.post-textarea')) {
                this.handleFileDrop(e);
            }
        });
    }

    handleFileSelect(event) {
        const files = Array.from(event.target.files);
        this.processFiles(files);
    }

    handleFileDrop(event) {
        const files = Array.from(event.dataTransfer.files);
        this.processFiles(files);
    }

    processFiles(files) {
        const validFiles = files.filter(file => this.validateFile(file));
        
        if (validFiles.length === 0) {
            notificationManager.show('No valid files selected', 'warning');
            return;
        }

        if (this.selectedFiles.length + validFiles.length > this.maxFiles) {
            notificationManager.show(`Maximum ${this.maxFiles} files allowed`, 'warning');
            return;
        }

        validFiles.forEach(file => {
            this.selectedFiles.push(file);
            this.createPreview(file);
        });
    }

    validateFile(file) {
        // Check file size
        if (file.size > CONFIG.MAX_FILE_SIZE) {
            notificationManager.show(`File ${file.name} is too large (max 10MB)`, 'danger');
            return false;
        }

        // Check file type
        const extension = file.name.split('.').pop().toLowerCase();
        if (!CONFIG.SUPPORTED_FORMATS.includes(extension)) {
            notificationManager.show(`File type ${extension} not supported`, 'danger');
            return false;
        }

        return true;
    }

    createPreview(file) {
        const previewContainer = document.getElementById('mediaPreview');
        if (!previewContainer) return;

        const previewElement = document.createElement('div');
        previewElement.className = 'preview-container me-2 mb-2';
        previewElement.setAttribute('data-file-name', file.name);

        if (file.type.startsWith('image/')) {
            const img = document.createElement('img');
            img.className = 'preview-image';
            img.src = URL.createObjectURL(file);
            previewElement.appendChild(img);
        } else if (file.type.startsWith('video/')) {
            const video = document.createElement('video');
            video.className = 'preview-image';
            video.src = URL.createObjectURL(file);
            video.controls = true;
            video.muted = true;
            previewElement.appendChild(video);
        }

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-media';
        removeBtn.innerHTML = '<i class="bi bi-x"></i>';
        removeBtn.onclick = () => this.removeFile(file.name);
        previewElement.appendChild(removeBtn);

        previewContainer.appendChild(previewElement);
        previewContainer.style.display = 'block';
    }

    removeFile(fileName) {
        this.selectedFiles = this.selectedFiles.filter(file => file.name !== fileName);
        
        const previewElement = document.querySelector(`[data-file-name="${fileName}"]`);
        if (previewElement) {
            URL.revokeObjectURL(previewElement.querySelector('img, video').src);
            previewElement.remove();
        }

        const previewContainer = document.getElementById('mediaPreview');
        if (this.selectedFiles.length === 0 && previewContainer) {
            previewContainer.style.display = 'none';
        }
    }

    async uploadFiles() {
        if (this.selectedFiles.length === 0) return null;

        const uploadPromises = this.selectedFiles.map(file => this.uploadSingleFile(file));
        
        try {
            const results = await Promise.all(uploadPromises);
            return results;
        } catch (error) {
            console.error('Upload error:', error);
            notificationManager.show('Failed to upload media files', 'danger');
            return null;
        }
    }

    async uploadSingleFile(file) {
        // Simulate file upload
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    type: file.type.startsWith('image/') ? 'image' : 'video',
                    url: URL.createObjectURL(file),
                    thumbnail: file.type.startsWith('video/') ? URL.createObjectURL(file) : null,
                    name: file.name,
                    size: file.size
                });
            }, 1000);
        });
    }

    clearAll() {
        this.selectedFiles.forEach(file => {
            const previewElement = document.querySelector(`[data-file-name="${file.name}"]`);
            if (previewElement) {
                const media = previewElement.querySelector('img, video');
                if (media) URL.revokeObjectURL(media.src);
            }
        });

        this.selectedFiles = [];
        const previewContainer = document.getElementById('mediaPreview');
        if (previewContainer) {
            previewContainer.innerHTML = '';
            previewContainer.style.display = 'none';
        }
    }
}

const mediaManager = new MediaManager();

// ===== CHAT MANAGER =====
class ChatManager {
    constructor() {
        this.activeChats = new Map();
        this.typingTimeouts = new Map();
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Chat item clicks
        document.addEventListener('click', (e) => {
            const chatItem = e.target.closest('.chat-item');
            if (chatItem) {
                this.openChat(chatItem.dataset.userId);
            }
        });
    }

    openChat(userId) {
        // Remove active class from all chat items
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });

        // Add active class to selected chat
        const selectedChat = document.querySelector(`[data-user-id="${userId}"]`);
        if (selectedChat) {
            selectedChat.classList.add('active');
        }

        // Open chat window or navigate to chat page
        this.loadChatMessages(userId);
    }

    async loadChatMessages(userId) {
        try {
            // Simulate loading chat messages
            const messages = await this.fetchChatMessages(userId);
            this.displayChatMessages(messages);
        } catch (error) {
            console.error('Error loading chat messages:', error);
        }
    }

    async fetchChatMessages(userId) {
        // Mock chat messages
        return [
            {
                id: '1',
                senderId: userId,
                content: 'Hey! How are you doing?',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                read: true
            },
            {
                id: '2',
                senderId: 'current_user',
                content: 'I\'m doing great! Thanks for asking 😊',
                timestamp: new Date(Date.now() - 3000000).toISOString(),
                read: true
            }
        ];
    }

    displayChatMessages(messages) {
        // This would typically open a chat modal or navigate to chat page
        console.log('Display chat messages:', messages);
        notificationManager.show('Chat feature coming soon!', 'info');
    }

    sendTypingIndicator(userId) {
        wsManager.send({
            type: 'typing_start',
            payload: { userId, targetUserId: userId }
        });

        // Clear existing timeout
        if (this.typingTimeouts.has(userId)) {
            clearTimeout(this.typingTimeouts.get(userId));
        }

        // Set new timeout
        const timeout = setTimeout(() => {
            wsManager.send({
                type: 'typing_stop',
                payload: { userId, targetUserId: userId }
            });
            this.typingTimeouts.delete(userId);
        }, CONFIG.TYPING_TIMEOUT);

        this.typingTimeouts.set(userId, timeout);
    }
}

const chatManager = new ChatManager();

// ===== STORY MANAGER =====
class StoryManager {
    constructor() {
        this.stories = [];
        this.currentStoryIndex = 0;
        this.storyModal = null;
        this.setupEventListeners();
    }

    setupEventListeners() {
        document.addEventListener('click', (e) => {
            const storyItem = e.target.closest('.story-item');
            if (storyItem && !storyItem.classList.contains('add-story')) {
                this.openStory(storyItem.dataset.storyId);
            }
        });
    }

    openStory(storyId) {
        const story = this.stories.find(s => s.id === storyId);
        if (!story) return;

        this.createStoryModal(story);
    }

    createStoryModal(story) {
        // Create story viewer modal
        const modal = document.createElement('div');
        modal.className = 'modal fade story-modal';
        modal.innerHTML = `
            <div class="modal-dialog modal-fullscreen">
                <div class="modal-content bg-dark">
                    <div class="modal-header border-0">
                        <div class="d-flex align-items-center text-white">
                            <img src="${story.author.avatar}" class="rounded-circle me-2" width="32" height="32">
                            <div>
                                <h6 class="mb-0">${story.author.name}</h6>
                                <small class="text-muted">${timeAgo(story.timestamp)}</small>
                            </div>
                        </div>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body d-flex align-items-center justify-content-center p-0">
                        <img src="${story.media.url}" class="img-fluid" alt="Story">
                    </div>
                    <div class="story-progress">
                        <div class="progress-bar"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        // Auto-advance story
        this.startStoryProgress(modal);

        // Clean up when modal is hidden
        modal.addEventListener('hidden.bs.modal', () => {
            document.body.removeChild(modal);
        });
    }

    startStoryProgress(modal) {
        const progressBar = modal.querySelector('.progress-bar');
        let progress = 0;
        const duration = 5000; // 5 seconds
        const interval = 50;
        const increment = (interval / duration) * 100;

        const timer = setInterval(() => {
            progress += increment;
            progressBar.style.width = `${progress}%`;

            if (progress >= 100) {
                clearInterval(timer);
                bootstrap.Modal.getInstance(modal).hide();
            }
        }, interval);

        // Pause on click/touch
        modal.addEventListener('click', () => {
            clearInterval(timer);
        });
    }

    async createStory(media) {
        const storyData = {
            id: generateUUID(),
            media: media,
            timestamp: new Date().toISOString(),
            author: appState.getState('user') || {
                id: 'demo_user',
                name: 'Demo User',
                avatar: 'https://via.placeholder.com/50x50'
            },
            views: 0,
            duration: 24 * 60 * 60 * 1000 // 24 hours
        };

        try {
            // Send to server
            await postManager.sendToServer('/stories', storyData);
            this.stories.unshift(storyData);
            notificationManager.show('Story created successfully!', 'success');
        } catch (error) {
            console.error('Error creating story:', error);
            notificationManager.show('Failed to create story', 'danger');
        }
    }
}

const storyManager = new StoryManager();

// ===== FLOATING ACTION BUTTON =====
class FABManager {
    constructor() {
        this.fab = document.querySelector('.fab-container');
        this.isOpen = false;
        this.setupEventListeners();
    }

    setupEventListeners() {
        const fabMain = document.querySelector('.fab-main');
        if (fabMain) {
            fabMain.addEventListener('click', () => this.toggle());
        }

        // Close FAB when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.fab.contains(e.target) && this.isOpen) {
                this.close();
            }
        });

        // FAB option handlers
        document.addEventListener('click', (e) => {
            const fabOption = e.target.closest('.fab-option');
            if (fabOption) {
                this.handleFABAction(fabOption.dataset.action);
            }
        });
    }

    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    open() {
        this.fab.classList.add('active');
        this.isOpen = true;
    }

    close() {
        this.fab.classList.remove('active');
        this.isOpen = false;
    }

    handleFABAction(action) {
        switch (action) {
            case 'post':
                document.getElementById('postTextarea')?.focus();
                break;
            case 'photo':
                document.getElementById('photoInput')?.click();
                break;
            case 'video':
                document.getElementById('videoInput')?.click();
                break;
            case 'story':
                document.getElementById('storyInput')?.click();
                break;
            case 'live':
                this.startLiveStream();
                break;
        }
        this.close();
    }

    startLiveStream() {
        notificationManager.show('Live streaming feature coming soon!', 'info');
    }
}

const fabManager = new FABManager();

// ===== GLOBAL EVENT HANDLERS =====

// Post creation
async function createPost() {
    const textarea = document.getElementById('postTextarea');
    const content = textarea.value.trim();
    
    if (!content && mediaManager.selectedFiles.length === 0) {
        notificationManager.show('Please enter some content or select media', 'warning');
        return;
    }

    const submitBtn = document.getElementById('submitPost');
    const originalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Posting...';

    try {
        // Upload media if any
        let media = null;
        if (mediaManager.selectedFiles.length > 0) {
            const uploadResults = await mediaManager.uploadFiles();
            media = uploadResults[0]; // Use first media for now
        }

        // Create post
        await postManager.createPost(content, media);
        
        // Clear form
        textarea.value = '';
        mediaManager.clearAll();
        
        // Reset character count
        updateCharacterCount();
        
    } catch (error) {
        console.error('Error creating post:', error);
        notificationManager.show('Failed to create post', 'danger');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

// Character count for post textarea
function updateCharacterCount() {
    const textarea = document.getElementById('postTextarea');
    const counter = document.getElementById('charCount');
    
    if (textarea && counter) {
        const remaining = 280 - textarea.value.length;
        counter.textContent = remaining;
        counter.className = remaining < 20 ? 'text-danger' : remaining < 50 ? 'text-warning' : 'text-muted';
    }
}

// Toggle comments section
function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (commentsSection) {
        commentsSection.classList.toggle('d-none');
        
        if (!commentsSection.classList.contains('d-none')) {
            // Load comments if not already loaded
            loadComments(postId);
        }
    }
}

// Load comments for a post
async function loadComments(postId) {
    const commentsList = document.getElementById(`commentsList-${postId}`);
    if (!commentsList || commentsList.children.length > 0) return;

    // Show loading
    commentsList.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div></div>';

    try {
        // Simulate loading comments
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const comments = [
            {
                id: '1',
                author: { name: 'John Doe', avatar: 'https://via.placeholder.com/32x32' },
                content: 'Great post! Thanks for sharing.',
                timestamp: new Date(Date.now() - 3600000).toISOString(),
                likes: 5
            },
            {
                id: '2',
                author: { name: 'Jane Smith', avatar: 'https://via.placeholder.com/32x32' },
                content: 'I completely agree with this!',
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                likes: 2
            }
        ];

        commentsList.innerHTML = '';
        comments.forEach(comment => {
            const commentElement = createCommentElement(comment);
            commentsList.appendChild(commentElement);
        });

    } catch (error) {
        console.error('Error loading comments:', error);
        commentsList.innerHTML = '<div class="text-center py-3 text-muted">Failed to load comments</div>';
    }
}

// Create comment element
function createCommentElement(comment) {
    const div = document.createElement('div');
    div.className = 'comment';
    div.innerHTML = `
        <div class="d-flex">
            <img src="${comment.author.avatar}" class="rounded-circle me-2" width="32" height="32" alt="Avatar">
            <div class="flex-grow-1">
                <div class="comment-bubble">
                    <div class="fw-medium mb-1">${sanitizeHTML(comment.author.name)}</div>
                    <div>${sanitizeHTML(comment.content)}</div>
                </div>
                <div class="comment-actions">
                    <small class="text-muted me-3">${timeAgo(comment.timestamp)}</small>
                    <button class="btn btn-link btn-sm p-0 me-3">Like</button>
                    <button class="btn btn-link btn-sm p-0">Reply</button>
                    ${comment.likes > 0 ? `<small class="text-muted ms-3">${comment.likes} likes</small>` : ''}
                </div>
            </div>
        </div>
    `;
    return div;
}

// Handle comment submission
function handleCommentSubmit(event, postId) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        const input = event.target;
        const content = input.value.trim();
        
        if (content) {
            submitComment(postId, content);
            input.value = '';
        }
    }
}

// Submit comment
async function submitComment(postId, content) {
    try {
        const comment = {
            id: generateUUID(),
            author: {
                name: 'You',
                avatar: 'https://via.placeholder.com/32x32'
            },
            content: content,
            timestamp: new Date().toISOString(),
            likes: 0
        };

        const commentsList = document.getElementById(`commentsList-${postId}`);
        const commentElement = createCommentElement(comment);
        commentsList.appendChild(commentElement);

        // Animate in
        commentElement.style.opacity = '0';
        commentElement.style.transform = 'translateY(20px)';
        setTimeout(() => {
            commentElement.style.transition = 'all 0.3s ease';
            commentElement.style.opacity = '1';
            commentElement.style.transform = 'translateY(0)';
        }, 100);

        // Update comment count
        const post = postManager.posts.find(p => p.id === postId);
        if (post) {
            post.comments += 1;
            const commentCount = document.querySelector(`[data-post-id="${postId}"] .interaction-stats`);
            if (commentCount) {
                commentCount.innerHTML = commentCount.innerHTML.replace(/\d+ comments/, `${post.comments} comments`);
            }
        }

        notificationManager.show('Comment posted successfully!', 'success');

    } catch (error) {
        console.error('Error posting comment:', error);
        notificationManager.show('Failed to post comment', 'danger');
    }
}

// Open image modal
function openImageModal(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content bg-transparent border-0">
                <div class="modal-header border-0">
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body text-center p-0">
                    <img src="${imageUrl}" class="img-fluid rounded" alt="Full size image">
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => {
        document.body.removeChild(modal);
    });
}

// Play video
function playVideo(videoUrl) {
    const modal = document.createElement('div');
    modal.className = 'modal fade';
    modal.innerHTML = `
        <div class="modal-dialog modal-lg modal-dialog-centered">
            <div class="modal-content bg-dark">
                <div class="modal-header border-0">
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body p-0">
                    <video controls autoplay class="w-100">
                        <source src="${videoUrl}" type="video/mp4">
                        Your browser does not support the video tag.
                    </video>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();

    modal.addEventListener('hidden.bs.modal', () => {
        const video = modal.querySelector('video');
        if (video) video.pause();
        document.body.removeChild(modal);
    });
}

// Load new posts (live updates)
function loadNewPosts() {
    const banner = document.getElementById('liveUpdatesBanner');
    banner.style.display = 'none';
    
    // Simulate loading new posts
    const newPosts = postManager.generateDemoPosts(3);
    newPosts.forEach(post => postManager.renderPost(post, true));
    
    notificationManager.show('New posts loaded!', 'success');
}

// Initialize tooltips
function initializeTooltips() {
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
}

// Initialize popovers
function initializePopovers() {
    const popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 ChatSpeed Advanced - Initializing...');
    
    // Simulate loading process
    let progress = 0;
    const loadingInterval = setInterval(() => {
        progress += Math.random() * 30;
        if (progress >= 100) {
            progress = 100;
            clearInterval(loadingInterval);
            setTimeout(() => {
                loadingManager.hide();
                initializeApp();
            }, 500);
        }
        loadingManager.updateProgress(progress);
    }, 200);
});

function initializeApp() {
    console.log('✨ ChatSpeed Advanced - Ready!');
    
    // Initialize components
    initializeTooltips();
    initializePopovers();
    
    // Setup event listeners
    setupGlobalEventListeners();
    
    // Load initial data
    loadInitialPosts();
    
    // Connect WebSocket
    // wsManager.connect(); // Uncomment when WebSocket server is available
    
    // Show welcome notification
    setTimeout(() => {
        notificationManager.show('Welcome to ChatSpeed! 🚀', 'success');
    }, 1000);
}

function setupGlobalEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle')?.addEventListener('click', () => {
        themeManager.toggleTheme();
    });

    // Post textarea character count
    document.getElementById('postTextarea')?.addEventListener('input', updateCharacterCount);

    // Load more posts
    document.getElementById('loadMore')?.addEventListener('click', () => {
        postManager.loadMore();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + Enter to submit post
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            const textarea = document.getElementById('postTextarea');
            if (textarea === document.activeElement) {
                createPost();
            }
        }
        
        // Escape to close modals
        if (e.key === 'Escape') {
            const openModals = document.querySelectorAll('.modal.show');
            openModals.forEach(modal => {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            });
        }
    });

    // Infinite scroll
    window.addEventListener('scroll', throttle(() => {
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
            if (!postManager.isLoading && postManager.hasMore) {
                postManager.loadMore();
            }
        }
    }, 250));

    // Online/offline status
    window.addEventListener('online', () => {
        notificationManager.show('Connection restored', 'success');
    });

    window.addEventListener('offline', () => {
        notificationManager.show('Connection lost', 'warning');
    });
}

function loadInitialPosts() {
    // Generate and display initial posts
    const initialPosts = postManager.generateDemoPosts(5);
    initialPosts.forEach(post => {
        postManager.posts.push(post);
        postManager.renderPost(post);
    });
}

// ===== EXPORT FOR GLOBAL ACCESS =====
window.ChatSpeed = {
    postManager,
    themeManager,
    notificationManager,
    mediaManager,
    searchManager,
    chatManager,
    storyManager,
    fabManager,
    wsManager,
    appState,
    
    // Utility functions
    createPost,
    toggleComments,
    loadNewPosts,
    openImageModal,
    playVideo,
    timeAgo,
    formatNumber,
    sanitizeHTML
};

console.log('🎉 ChatSpeed Advanced JavaScript loaded successfully!');

