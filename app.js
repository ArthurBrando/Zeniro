import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, onValue, update, remove, get } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyASxTiAzWJ3TNJ8OZLxNiNR85dbAl68t-U",
  authDomain: "zeniro.firebaseapp.com",
  databaseURL: "https://zeniro-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "zeniro",
  storageBucket: "zeniro.firebasestorage.app",
  messagingSenderId: "82254521841",
  appId: "1:82254521841:web:36a0726dd15fa3698a5050"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let userId = localStorage.getItem('zeniro_uid') || 'user_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('zeniro_uid', userId);

const $ = id => document.getElementById(id);

let currentServerId = 'global';
let currentChannelId = 'geral';
let userProfile = { name: 'Usuário', avatar: '', banner: '', decoration: '', font: "'Inter', sans-serif", bio: '', bgType: 'solid', bgColor: '#1e1f22', tagText: '', tagIcon: '' };
let replyingToData = null;
let localStream = null;
let peerConnection = null;
let loadedMessages = {};
let viewingUserId = null;
let newTagIconBase64 = null;

// Auxiliares
const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
});

// 1. NAVEGAÇÃO MOBILE
$('mobile-menu-btn').addEventListener('click', () => {
    $('server-sidebar').classList.add('open');
    $('channel-sidebar').classList.add('open');
    $('sidebar-backdrop').classList.remove('hidden');
    setTimeout(() => $('sidebar-backdrop').classList.add('show'), 10);
    $('mobile-menu-btn').classList.add('hide');
});

$('sidebar-backdrop').addEventListener('click', () => {
    $('server-sidebar').classList.remove('open');
    $('channel-sidebar').classList.remove('open');
    $('sidebar-backdrop').classList.remove('show');
    setTimeout(() => $('sidebar-backdrop').classList.add('hidden'), 300);
    $('mobile-menu-btn').classList.remove('hide');
});

// 2. PERFIL (PREVIEW EM TEMPO REAL)
window.updatePreview = () => {
    const name = $('edit-name').value || 'Seu Nome';
    const bio = $('edit-bio').value || 'Sua bio...';
    const font = $('edit-font').value;
    const avatar = $('edit-avatar-url').value || userProfile.avatar || 'zenirobg.png';
    const banner = $('edit-banner-url').value || userProfile.banner;
    const decor = $('edit-decor-url').value || userProfile.decoration;
    
    $('preview-name').innerText = name;
    $('preview-name').style.fontFamily = font;
    $('preview-bio').innerText = bio;
    $('preview-avatar').src = avatar;
    
    if (banner) $('preview-banner').style.backgroundImage = `url(${banner})`;
    else $('preview-banner').style.backgroundImage = 'none';

    if (decor) {
        $('preview-decoration').src = decor;
        $('preview-decoration').classList.remove('hidden');
    } else {
        $('preview-decoration').classList.add('hidden');
    }

    // Fundo do Perfil
    const bgType = $('edit-bg-type').value;
    const bgColor = $('edit-bg-color').value;
    const previewBox = $('live-preview');
    previewBox.className = 'profile-preview'; 
    previewBox.style.background = 'var(--bg-main)';
    
    if (bgType === 'solid') previewBox.style.background = bgColor;
    else if (bgType === 'grad-down') previewBox.style.background = `linear-gradient(to bottom, ${bgColor}, transparent)`;
    else if (bgType === 'grad-up') previewBox.style.background = `linear-gradient(to top, ${bgColor}, transparent)`;
    else if (bgType === 'rainbow') previewBox.classList.add('rainbow-border');
    else if (bgType === 'animated') previewBox.classList.add('bg-animated');

    // Tag
    const tagText = $('edit-tag-text').value;
    if (tagText) {
        $('preview-tag').classList.remove('hidden');
        $('preview-tag-text').innerText = tagText;
    } else {
        $('preview-tag').classList.add('hidden');
    }
};

const userRef = ref(db, 'users/' + userId);
onValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
        userProfile = { ...userProfile, ...snapshot.val() };
        $('my-name').innerText = userProfile.name;
        $('my-name').style.fontFamily = userProfile.font;
        $('my-avatar').src = userProfile.avatar || 'zenirobg.png';
        
        if (userProfile.decoration) {
            $('my-decoration').src = userProfile.decoration;
            $('my-decoration').classList.remove('hidden');
        }

        if (userProfile.tagText) {
            $('my-tag').classList.remove('hidden');
            $('tag-text').innerText = userProfile.tagText;
            if (userProfile.tagIcon) {
                $('tag-icon').src = userProfile.tagIcon;
                $('tag-icon').classList.remove('hidden');
            }
        }
        
        // Preenche Inputs
        $('edit-name').value = userProfile.name || '';
        $('edit-bio').value = userProfile.bio || '';
        $('edit-font').value = userProfile.font || "'Inter', sans-serif";
        $('edit-avatar-url').value = userProfile.avatar || '';
        $('edit-banner-url').value = userProfile.banner || '';
        $('edit-decor-url').value = userProfile.decoration || '';
        $('edit-bg-type').value = userProfile.bgType || 'solid';
        $('edit-bg-color').value = userProfile.bgColor || '#1e1f22';
        $('edit-tag-text').value = userProfile.tagText || '';
        if (userProfile.tagIcon) $('preview-tag-icon').src = userProfile.tagIcon;
        updatePreview();
    } else {
        set(userRef, userProfile);
    }
});

$('edit-profile-btn').addEventListener('click', () => $('profile-modal').classList.remove('hidden'));

// Uploads no Perfil
const handleUpload = async (inputId, urlInputId) => {
    const file = $(inputId).files[0];
    if (file) {
        const base64 = await fileToBase64(file);
        $(urlInputId).value = base64;
        updatePreview();
    }
};
$('edit-avatar-file').addEventListener('change', () => handleUpload('edit-avatar-file', 'edit-avatar-url'));
$('edit-banner-file').addEventListener('change', () => handleUpload('edit-banner-file', 'edit-banner-url'));
$('edit-decor-file').addEventListener('change', () => handleUpload('edit-decor-file', 'edit-decor-url'));

$('edit-tag-icon').addEventListener('change', async () => {
    const file = $('edit-tag-icon').files[0];
    if (file) {
        newTagIconBase64 = await fileToBase64(file);
        $('preview-tag-icon').src = newTagIconBase64;
        $('preview-tag-icon').classList.remove('hidden');
    }
});

$('save-profile').addEventListener('click', () => {
    update(userRef, {
        name: $('edit-name').value || 'Usuário',
        bio: $('edit-bio').value,
        font: $('edit-font').value,
        avatar: $('edit-avatar-url').value || 'zenirobg.png',
        banner: $('edit-banner-url').value,
        decoration: $('edit-decor-url').value,
        bgType: $('edit-bg-type').value,
        bgColor: $('edit-bg-color').value,
        tagText: $('edit-tag-text').value,
        tagIcon: newTagIconBase64 || userProfile.tagIcon || ''
    });
    newTagIconBase64 = null;
    $('profile-modal').classList.add('hidden');
});// 3. SERVIDORES E CANAIS
const serversRef = ref(db, 'servers');
const serverList = $('server-list');

onValue(ref(db, 'users/' + userId + '/servers'), (snapshot) => {
    const myServers = snapshot.val() || {};
    serverList.innerHTML = '';
    for (const id in myServers) {
        if (myServers[id] === true) {
            get(ref(db, 'servers/' + id)).then(snap => {
                if (snap.exists()) {
                    const s = snap.val();
                    const div = document.createElement('div');
                    div.className = `server-icon ${currentServerId === id ? 'active' : ''}`;
                    div.innerHTML = `<span>${s.name.substring(0, 2).toUpperCase()}</span>`;
                    div.onclick = () => switchServer(id, s.name);
                    serverList.appendChild(div);
                }
            });
        }
    }
});

$('create-server-btn').addEventListener('click', () => {
    const name = prompt("Nome do Servidor:");
    if (!name) return;
    const isPublic = confirm("Servidor Público? (OK = Sim / Cancelar = Apenas Local)");
    const newRef = push(serversRef);
    const serverId = newRef.key;
    set(newRef, { name, owner: userId, isPublic });
    set(ref(db, `users/${userId}/servers/${serverId}`), true);
    set(ref(db, `channels/${serverId}/geral`), { name: 'geral', type: 'text' });
    switchServer(serverId, name);
});

function switchServer(id, name) {
    currentServerId = id;
    currentChannelId = 'geral';
    $('current-server-name').innerText = name;
    $('current-channel-name').innerText = '# geral';
    $('add-channel-btn').classList.toggle('hidden', id === 'global');
    $('sidebar-backdrop').click();
    loadChannels();
    loadMessages();
}

// Buscar Servidores Públicos
$('search-server-btn').addEventListener('click', () => $('search-server-modal').classList.remove('hidden'));

$('search-server-input').addEventListener('input', async (e) => {
    const term = e.target.value.toLowerCase();
    if (term.length < 2) return $('search-results').innerHTML = '';
    
    const snapshot = await get(serversRef);
    $('search-results').innerHTML = '';
    
    if (snapshot.exists()) {
        const servers = snapshot.val();
        for (const id in servers) {
            const s = servers[id];
            if (s.isPublic && s.name.toLowerCase().includes(term)) {
                const memberSnap = await get(ref(db, `users/${userId}/servers/${id}`));
                const isMember = memberSnap.exists();

                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `
                    <div><strong>${s.name}</strong><p>Público</p></div>
                    <button class="${isMember ? 'danger-btn' : 'primary-btn'}">${isMember ? 'Sair' : 'Entrar'}</button>
                `;
                div.querySelector('button').onclick = () => {
                    if (isMember) {
                        remove(ref(db, `users/${userId}/servers/${id}`));
                        if (currentServerId === id) switchServer('global', 'Início');
                    } else {
                        set(ref(db, `users/${userId}/servers/${id}`), true);
                    }
                    $('search-server-modal').classList.add('hidden');
                };
                $('search-results').appendChild(div);
            }
        }
    }
});

// Canais
function loadChannels() {
    const container = $('channel-list');
    container.innerHTML = '<h3>CANAIS</h3>';
    onValue(ref(db, `channels/${currentServerId}`), (snapshot) => {
        container.innerHTML = '<h3>CANAIS</h3>';
        if (snapshot.exists()) {
            const channels = snapshot.val();
            for (const id in channels) {
                const c = channels[id];
                const div = document.createElement('div');
                div.className = `channel ${currentChannelId === id ? 'active' : ''}`;
                const icon = c.type === 'voice' ? '🔊' : '#';
                div.innerHTML = `<span>${icon}</span> ${c.name}`;
                if (c.type === 'text') {
                    div.onclick = () => {
                        currentChannelId = id;
                        $('current-channel-name').innerText = `# ${c.name}`;
                        loadChannels();
                        loadMessages();
                    };
                }
                container.appendChild(div);
            }
        }
    });
}

$('add-channel-btn').addEventListener('click', () => $('channel-modal').classList.remove('hidden'));
$('save-channel-btn').addEventListener('click', () => {
    const name = $('channel-name-input').value.trim();
    const type = $('channel-type-input').value;
    if (!name) return;
    const newRef = push(ref(db, `channels/${currentServerId}`));
    set(newRef, { name, type });
    $('channel-modal').classList.add('hidden');
    $('channel-name-input').value = '';
});

// 4. AMIGOS E PERFIL DE OUTROS USUÁRIOS
window.openProfile = async (uid) => {
    if (uid === userId) return;
    viewingUserId = uid;
    const snap = await get(ref(db, 'users/' + uid));
    if (snap.exists()) {
        const u = snap.val();
        $('v-name').innerText = u.name;
        $('v-bio').innerText = u.bio || 'Sem bio.';
        $('v-avatar').src = u.avatar || 'zenirobg.png';
        
        if (u.banner) $('v-banner').style.backgroundImage = `url(${u.banner})`;
        else $('v-banner').style.backgroundImage = 'none';
        
        if (u.decoration) {
            $('v-decoration').src = u.decoration;
            $('v-decoration').classList.remove('hidden');
        } else {
            $('v-decoration').classList.add('hidden');
        }

        if (u.tagText) {
            $('v-tag').classList.remove('hidden');
            $('v-tag-text').innerText = u.tagText;
            if(u.tagIcon) { $('v-tag-icon').src = u.tagIcon; $('v-tag-icon').classList.remove('hidden'); }
        } else {
            $('v-tag').classList.add('hidden');
        }

        const friendSnap = await get(ref(db, `friends/${userId}/${uid}`));
        const btn = $('add-friend-btn');
        if (friendSnap.exists()) {
            btn.innerText = 'Amigos';
            btn.disabled = true;
            btn.style.background = 'var(--border)';
        } else {
            btn.innerText = 'Adicionar Amigo';
            btn.disabled = false;
            btn.style.background = 'var(--accent)';
            btn.onclick = () => {
                set(ref(db, `friend_requests/${uid}/${userId}`), { name: userProfile.name, avatar: userProfile.avatar });
                btn.innerText = 'Pedido Enviado';
                btn.disabled = true;
            };
        }
        $('view-profile-modal').classList.remove('hidden');
    }
};

$('open-mailbox-btn').addEventListener('click', () => {
    $('mailbox-modal').classList.remove('hidden');
    const list = $('friend-requests-list');
    list.innerHTML = 'Carregando...';
    
    onValue(ref(db, `friend_requests/${userId}`), (snapshot) => {
        list.innerHTML = '';
        if (snapshot.exists()) {
            const reqs = snapshot.val();
            for (const senderId in reqs) {
                const r = reqs[senderId];
                const div = document.createElement('div');
                div.className = 'search-result-item';
                div.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px;">
                        <img src="${r.avatar || 'zenirobg.png'}" style="width:30px;height:30px;border-radius:50%;">
                        <strong>${r.name}</strong>
                    </div>
                    <div><button class="primary-btn accept-btn">Aceitar</button></div>
                `;
                div.querySelector('.accept-btn').onclick = () => {
                    set(ref(db, `friends/${userId}/${senderId}`), true);
                    set(ref(db, `friends/${senderId}/${userId}`), true);
                    remove(ref(db, `friend_requests/${userId}/${senderId}`));
                };
                list.appendChild(div);
            }
        } else {
            list.innerHTML = '<p style="color:gray; text-align:center;">Nenhum pedido pendente.</p>';
        }
    });
});

// 5. CONTEXT MENU (LONG PRESS - RESPONDER/APAGAR)
let pressTimer;
const contextMenu = $('context-menu');

function attachLongPress(element, msgId, senderId, senderName, msgText) {
    const startPress = (e) => {
        if (e.type === 'touchstart') element.dataset.startY = e.touches[0].clientY;
        
        pressTimer = setTimeout(() => {
            if (e.type === 'touchstart' && e.cancelable) e.preventDefault(); 
            replyingToData = { id: msgId, name: senderName, text: msgText };
            
            $('reply-name').innerText = senderName;
            $('reply-text').innerText = msgText;
            
            if (senderId === userId) {
                $('ctx-delete').classList.remove('hidden');
                $('ctx-delete').onclick = () => {
                    remove(ref(db, `messages/${currentServerId}/${currentChannelId}/${msgId}`));
                    $(`msg-${msgId}`).remove();
                    contextMenu.classList.add('hidden');
                };
            } else {
                $('ctx-delete').classList.add('hidden');
            }
            
            const rect = element.getBoundingClientRect();
            contextMenu.style.top = `${Math.min(rect.top, window.innerHeight - 100)}px`;
            contextMenu.style.left = `${Math.min(rect.left + 20, window.innerWidth - 150)}px`;
            contextMenu.classList.remove('hidden');
        }, 500);
    };
    
    const cancelPress = (e) => {
        if (e.type === 'touchmove') {
            if (Math.abs(e.touches[0].clientY - element.dataset.startY) > 10) clearTimeout(pressTimer);
        }
        clearTimeout(pressTimer);
    };
    
    element.addEventListener('mousedown', startPress);
    element.addEventListener('touchstart', startPress, {passive: false});
    element.addEventListener('mouseup', cancelPress);
    element.addEventListener('mouseleave', cancelPress);
    element.addEventListener('touchend', cancelPress);
    element.addEventListener('touchmove', cancelPress);
    element.addEventListener('contextmenu', (e) => e.preventDefault());
}

$('ctx-reply').addEventListener('click', () => {
    $('reply-context').classList.remove('hidden');
    contextMenu.classList.add('hidden');
    $('message-input').focus();
});

$('cancel-reply').addEventListener('click', () => {
    replyingToData = null;
    $('reply-context').classList.add('hidden');
});// 6. CHAT E MARKDOWN
function parseMarkdown(text, users) {
    let html = text;
    // Escapar HTML básico
    html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold e Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
    
    // Mentions (@Nome)
    html = html.replace(/@(\w+)/g, (match, name) => {
        const foundUser = Object.values(users).find(u => u.name === name);
        if (foundUser) {
            return `<span class="mention" onclick="openProfile('${foundUser.uid}')">@${name}</span>`;
        }
        return match;
    });
    return html;
}

const emojiData = {
    'Rostos': ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡'],
    'Gestos': ['👍','👎','👊','✌️','🤞','🖐️','✋','🤚','👋','🤙','💪','🙏'],
    'Objetos': ['🎮','🎲','🎯','🏆','⚽','🏀','🎸','🎧','🎤','💻','📱','💡','🔥','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯','💢','💥','💫','💦','💨','💣','💬','💤']
};

let allUsers = {}; // Cache de usuários para mentions
onValue(ref(db, 'users'), snap => { allUsers = snap.val() || {}; });

$('emoji-btn').addEventListener('click', () => {
    const list = $('emoji-list');
    const cats = $('emoji-categories');
    if (list.innerHTML === '') {
        let first = true;
        for (const [cat, emojis] of Object.entries(emojiData)) {
            const catSpan = document.createElement('span');
            catSpan.innerText = cat;
            catSpan.onclick = () => renderEmojis(emojis);
            cats.appendChild(catSpan);
            
            if (first) { renderEmojis(emojis); first = false; }
        }
    }
    $('emoji-picker').classList.toggle('hidden');
    $('gif-picker').classList.add('hidden');
});

function renderEmojis(emojis) {
    const list = $('emoji-list');
    list.innerHTML = '';
    emojis.forEach(e => {
        const span = document.createElement('span');
        span.innerText = e;
        span.onclick = () => { $('message-input').value += e; };
        list.appendChild(span);
    });
}

// GIFs (Tenor API)
const TENOR_API_KEY = 'LIVDSRZULELA';
$('gif-btn').addEventListener('click', () => {
    $('gif-picker').classList.toggle('hidden');
    $('emoji-picker').classList.add('hidden');
});

$('gif-search').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value;
        const url = `https://tenor.googleapis.com/v2/search?q=${query}&key=${TENOR_API_KEY}&limit=12`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            $('gif-list').innerHTML = '';
            data.results.forEach(gif => {
                const img = document.createElement('img');
                img.src = gif.media_formats.tinygif.url;
                img.onclick = () => { sendMessage(gif.media_formats.gif.url, 'gif'); $('gif-picker').classList.add('hidden'); };
                $('gif-list').append(img);
            });
        } catch (err) { console.error("Erro ao buscar GIF", err); }
    }
});

// Upload de Imagem/GIF no Chat
$('plus-btn').addEventListener('click', () => $('image-upload').click());
$('image-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Se for GIF, manda direto em Base64 pra não perder a animação
    if (file.type === 'image/gif') {
        const reader = new FileReader();
        reader.onload = (ev) => sendMessage(ev.target.result, 'image');
        reader.readAsDataURL(file);
    } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const canvas = $('resize-canvas');
                const ctx = canvas.getContext('2d');
                let width = img.width, height = img.height;
                const MAX_SIZE = 800;
                if (width > height && width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; }
                else if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; }
                canvas.width = width; canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                sendMessage(canvas.toDataURL('image/jpeg', 0.7), 'image');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }
});

function sendMessage(content, type = 'text') {
    if (!content.trim() && type === 'text') return;
    push(ref(db, `messages/${currentServerId}/${currentChannelId}`), {
        userId, name: userProfile.name, avatar: userProfile.avatar || 'zenirobg.png', 
        font: userProfile.font, text: type === 'text' ? content : '',
        media: type !== 'text' ? content : '', type: type,
        replyTo: replyingToData, timestamp: Date.now()
    });
    $('message-input').value = '';
    $('emoji-picker').classList.add('hidden');
    $('gif-picker').classList.add('hidden');
    replyingToData = null;
    $('reply-context').classList.add('hidden');
}

$('send-btn').addEventListener('click', () => sendMessage($('message-input').value));
$('message-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage($('message-input').value); });

function loadMessages() {
    const container = $('messages-container');
    container.innerHTML = '<div class="empty-bg"><img src="zenirobg.png"></div>';
    loadedMessages = {};
    
    onChildAdded(ref(db, `messages/${currentServerId}/${currentChannelId}`), (snapshot) => {
        const data = snapshot.val();
        const msgId = snapshot.key;
        if (loadedMessages[msgId]) return;
        loadedMessages[msgId] = true;

        const div = document.createElement('div');
        div.className = 'message';
        div.id = `msg-${msgId}`;
        
        let mediaHtml = data.type === 'image' || data.type === 'gif' ? `<img src="${data.media}" class="msg-image" onclick="openImage('${data.media}')">` : '';
        let replyHtml = data.replyTo ? `<div class="msg-reply-context"><strong>${data.replyTo.name}</strong><div>${data.replyTo.text.substring(0, 50)}</div></div>` : '';
        let parsedText = data.type === 'text' ? parseMarkdown(data.text, allUsers) : '';

        div.innerHTML = `
            <div class="avatar-wrapper" onclick="openProfile('${data.userId}')">
                <img class="user-avatar" src="${data.avatar}" onerror="this.src='zenirobg.png'">
            </div>
            <div class="msg-content">
                <div class="msg-header">
                    <span class="name" style="font-family: ${data.font}" onclick="openProfile('${data.userId}')">${data.name}</span>
                    <small>${new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                </div>
                ${replyHtml}
                ${data.type === 'text' ? `<div class="msg-text">${parsedText}</div>` : mediaHtml}
            </div>
        `;
        attachLongPress(div, msgId, data.userId, data.name, data.type === 'text' ? data.text : 'Mídia');
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    });
}

window.openImage = (src) => {
    $('viewer-img').src = src;
    $('download-img-btn').href = src;
    $('image-viewer').classList.remove('hidden');
};

// 7. WEBRTC (CHAMADAS)
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

async function initCall(video = true) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        $('local-video').srcObject = localStream;
        $('call-overlay').classList.remove('hidden');
        await populateDevices();

        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        
        peerConnection.onicecandidate = (e) => { if (e.candidate) push(ref(db, `calls/${currentServerId}/candidates`), e.candidate.toJSON()); };
        peerConnection.ontrack = (e) => { $('remote-video').srcObject = e.streams[0]; };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        set(ref(db, `calls/${currentServerId}/offer`), { offer, caller: userId });
    } catch (err) { alert("Erro ao acessar mídia: " + err.message); }
}

async function populateDevices() {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const micSelect = $('mic-select'), camSelect = $('camera-select');
    micSelect.innerHTML = ''; camSelect.innerHTML = '';
    devices.forEach(d => {
        if (d.kind === 'audioinput') micSelect.innerHTML += `<option value="${d.deviceId}">${d.label || 'Microfone'}</option>`;
        if (d.kind === 'videoinput') camSelect.innerHTML += `<option value="${d.deviceId}">${d.label || 'Câmera'}</option>`;
    });
}

$('call-settings-btn').addEventListener('click', () => $('call-settings-panel').classList.toggle('hidden'));
$('close-call-settings').addEventListener('click', () => $('call-settings-panel').classList.add('hidden'));

onValue(ref(db, `calls/${currentServerId}/offer`), async (snapshot) => {
    const data = snapshot.val();
    if (data && data.caller !== userId && !peerConnection) {
        $('call-overlay').classList.remove('hidden');
        peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnection.onicecandidate = (e) => { if (e.candidate) push(ref(db, `calls/${currentServerId}/candidates`), e.candidate.toJSON()); };
        peerConnection.ontrack = (e) => { $('remote-video').srcObject = e.streams[0]; };
        
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        set(ref(db, `calls/${currentServerId}/answer`), { answer, answerer: userId });
        
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        $('local-video').srcObject = localStream;
        await populateDevices();
    }
});

onValue(ref(db, `calls/${currentServerId}/answer`), async (snapshot) => {
    const data = snapshot.val();
    if (data && data.answerer !== userId && peerConnection && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
});

onChildAdded(ref(db, `calls/${currentServerId}/candidates`), async (snapshot) => {
    if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(snapshot.val()));
});

$('toggle-mic').addEventListener('click', function() {
    const track = localStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    this.classList.toggle('active');
});

$('toggle-video').addEventListener('click', function() {
    const track = localStream.getVideoTracks()[0];
    if (track) {
        track.enabled = !track.enabled;
        this.classList.toggle('active');
        $('local-video').style.opacity = track.enabled ? '1' : '0.2';
    }
});

$('end-call').addEventListener('click', () => {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    $('call-overlay').classList.add('hidden');
    remove(ref(db, `calls/${currentServerId}/offer`));
    remove(ref(db, `calls/${currentServerId}/answer`));
    peerConnection = null; localStream = null;
});

$('start-audio-call').addEventListener('click', () => initCall(false));
$('start-video-call').addEventListener('click', () => initCall(true));

// Fechar modais ao clicar fora
window.addEventListener('click', (e) => {
    if (!e.target.closest('.message') && !e.target.closest('#context-menu')) {
        $('context-menu').classList.add('hidden');
    }
    if (!e.target.closest('#emoji-picker') && !e.target.closest('#emoji-btn')) $('emoji-picker').classList.add('hidden');
    if (!e.target.closest('#gif-picker') && !e.target.closest('#gif-btn')) $('gif-picker').classList.add('hidden');
});
