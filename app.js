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
let userProfile = { name: 'Usuário', avatar: '', banner: '', decoration: '', font: "'Inter', sans-serif", bio: '', tagText: '', tagIcon: '', username: 'user' };
let replyingToData = null;
let localStream = null;
let peerConnection = null;
let loadedMessages = {};
let viewingUserId = null;
let allUsers = {};

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
});

$('sidebar-backdrop').addEventListener('click', () => {
    $('server-sidebar').classList.remove('open');
    $('channel-sidebar').classList.remove('open');
    $('sidebar-backdrop').classList.remove('show');
    setTimeout(() => $('sidebar-backdrop').classList.add('hidden'), 300);
});

// Botão de Voltar do Chat
$('mobile-back-btn').addEventListener('click', () => {
    $('chat-area').classList.add('hidden');
    $('profile-view').classList.add('hidden');
    // Simula abrir o menu
    $('mobile-menu-btn').click();
});

// Escuta todos os usuários para menções e perfis
onValue(ref(db, 'users'), snap => { allUsers = snap.val() || {}; });

// 2. PERFIL DO USUÁRIO LOGADO
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

        // Preenche Inputs de Edição
        $('edit-name').value = userProfile.name || '';
        $('edit-bio').value = userProfile.bio || '';
        $('edit-font').value = userProfile.font || "'Inter', sans-serif";
        $('edit-avatar-url').value = userProfile.avatar || '';
        $('edit-banner-url').value = userProfile.banner || '';
        $('edit-decor-url').value = userProfile.decoration || '';
        $('edit-tag-text').value = userProfile.tagText || '';
    } else {
        set(userRef, userProfile);
    }
});

// Uploads (Avatar, Banner, Moldura)
const handleUpload = async (inputId, urlInputId) => {
    const file = $(inputId).files[0];
    if (file) {
        const base64 = await fileToBase64(file);
        $(urlInputId).value = base64;
    }
};
$('edit-avatar-file').addEventListener('change', () => handleUpload('edit-avatar-file', 'edit-avatar-url'));
$('edit-banner-file').addEventListener('change', () => handleUpload('edit-banner-file', 'edit-banner-url'));
$('edit-decor-file').addEventListener('change', () => handleUpload('edit-decor-file', 'edit-decor-url'));

$('save-profile').addEventListener('click', () => {
    update(userRef, {
        name: $('edit-name').value || 'Usuário',
        bio: $('edit-bio').value,
        font: $('edit-font').value,
        avatar: $('edit-avatar-url').value || 'zenirobg.png',
        banner: $('edit-banner-url').value,
        decoration: $('edit-decor-url').value,
        tagText: $('edit-tag-text').value
    });
    $('edit-profile-modal').classList.add('hidden');
    $('profile-view').classList.add('hidden');
});

// 3. ABRIR TELA DE PERFIL (Estilo do Print)
window.openProfileView = async (uid) => {
    const isMe = (uid === 'my_id' || uid === userId);
    const realUid = isMe ? userId : uid;
    
    let data = isMe ? userProfile : allUsers[realUid];
    if (!data) return;

    $('chat-area').classList.add('hidden');
    $('profile-view').classList.remove('hidden');

    $('v-name').innerText = data.name || 'Usuário';
    $('v-name').style.fontFamily = data.font || "'Inter', sans-serif";
    $('v-bio').innerText = data.bio || 'Sem bio.';
    $('v-avatar').src = data.avatar || 'zenirobg.png';
    $('v-username').innerText = data.username || 'user_' + realUid.substr(0, 4);

    if (data.banner) $('v-banner').style.backgroundImage = `url(${data.banner})`;
    else $('v-banner').style.backgroundImage = 'none';

    if (data.decoration) {
        $('v-decoration').src = data.decoration;
        $('v-decoration').classList.remove('hidden');
    } else {
        $('v-decoration').classList.add('hidden');
    }

    if (data.tagText) {
        $('v-tag').classList.remove('hidden');
        $('v-tag-text').innerText = data.tagText;
        if (data.tagIcon) {
            $('v-tag-icon').src = data.tagIcon;
            $('v-tag-icon').classList.remove('hidden');
        } else {
            $('v-tag-icon').classList.add('hidden');
        }
    } else {
        $('v-tag').classList.add('hidden');
    }

    // Botões de Ação
    const btnContainer = $('profile-main-buttons');
    btnContainer.innerHTML = '';

    if (isMe) {
        btnContainer.innerHTML = `
            <button class="btn-primary" onclick="document.getElementById('edit-profile-modal').classList.remove('hidden')">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                Editar o Perfil Principal
            </button>
        `;
    } else {
        btnContainer.innerHTML = `
            <button class="btn-secondary" onclick="sendFriendRequest('${realUid}')">
                <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
                Adicionar Amigo
            </button>
            <button class="btn-primary" onclick="alert('Abrir chat privado com ${data.name}')">
                Mensagem
            </button>
        `;
    }
};

// Enviar Pedido de Amizade
window.sendFriendRequest = (targetUid) => {
    set(ref(db, `friend_requests/${targetUid}/${userId}`), { name: userProfile.name, avatar: userProfile.avatar });
    alert("Pedido enviado com sucesso!");
};// 4. SERVIDORES
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

// Botão DM (Home)
$('btn-dm-home').addEventListener('click', () => {
    switchServer('global', 'Mensagens Diretas');
    $('btn-dm-home').classList.add('active');
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
    $('mobile-menu-btn').click(); // Fecha menu mobile
    
    document.querySelectorAll('.server-icon').forEach(el => el.classList.remove('active'));
    if (id === 'global') $('btn-dm-home').classList.add('active');
    
    loadChannels();
    loadMessages();
}

// 5. CANAIS E CATEGORIAS
function loadChannels() {
    const container = $('channel-list');
    container.innerHTML = '';
    
    if (currentServerId === 'global') {
        container.innerHTML = '<h3>Amigos</h3><div class="channel active">👥 Todos os Amigos</div><h3>Mensagens Diretas</h3><div class="channel">Nenhuma DM ainda</div>';
        return;
    }

    onValue(ref(db, `channels/${currentServerId}`), (snapshot) => {
        container.innerHTML = '';
        if (snapshot.exists()) {
            const channels = snapshot.val();
            for (const id in channels) {
                const c = channels[id];
                const div = document.createElement('div');
                
                if (c.type === 'category') {
                    div.className = 'channels h3';
                    div.innerHTML = `<h3>${c.name} <svg width="12" height="12" viewBox="0 0 24 24" fill="#949ba4"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg></h3>`;
                } else {
                    div.className = `channel ${currentChannelId === id ? 'active' : ''}`;
                    const icon = c.type === 'voice' ? '🔊' : '#';
                    div.innerHTML = `<span>${icon}</span> ${c.name}`;
                    if (c.type === 'text') {
                        div.onclick = () => {
                            currentChannelId = id;
                            $('current-channel-name').innerText = `# ${c.name}`;
                            loadChannels();
                            loadMessages();
                            $('mobile-menu-btn').click();
                        };
                    }
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

// 6. MENU DE CONTEXTO (LONG PRESS)
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
});// 7. MARKDOWN E MENÇÕES (@)
function parseMarkdown(text) {
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    
    // Headers
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    
    // Bold e Italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
    html = html.replace(/\*(.*?)\*/g, '<i>$1</i>');
    
    // Menções @Nome
    html = html.replace(/@(\w+)/g, (match, name) => {
        const foundUser = Object.entries(allUsers).find(([id, u]) => u.name.toLowerCase() === name.toLowerCase());
        if (foundUser) {
            return `<span class="mention" onclick="openProfileView('${foundUser[0]}')">@${name}</span>`;
        }
        return `<span class="mention" style="background:rgba(255,200,0,0.1); color:#ffd700;">@${name}</span>`;
    });
    
    // Quebras de linha
    html = html.replace(/\n/g, '<br>');
    return html;
}

// 8. ENVIO DE MENSAGEM E RENDERIZAÇÃO
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
    container.innerHTML = '';
    loadedMessages = {};
    
    onChildAdded(ref(db, `messages/${currentServerId}/${currentChannelId}`), (snapshot) => {
        const data = snapshot.val();
        const msgId = snapshot.key;
        if (loadedMessages[msgId]) return;
        loadedMessages[msgId] = true;

        const div = document.createElement('div');
        div.className = 'message';
        div.id = `msg-${msgId}`;
        
        let mediaHtml = data.type === 'image' || data.type === 'gif' ? `<img src="${data.media}" class="msg-image" onclick="window.open('${data.media}', '_blank')">` : '';
        let replyHtml = data.replyTo ? `<div class="msg-reply-context"><strong>${data.replyTo.name}</strong><div>${data.replyTo.text.substring(0, 50)}...</div></div>` : '';
        let parsedText = data.type === 'text' ? parseMarkdown(data.text) : '';

        div.innerHTML = `
            <div class="avatar-wrapper" onclick="openProfileView('${data.userId}')">
                <img class="user-avatar" src="${data.avatar}" onerror="this.src='zenirobg.png'">
            </div>
            <div class="msg-content">
                <div class="msg-header">
                    <span class="name" style="font-family: ${data.font}" onclick="openProfileView('${data.userId}')">${data.name}</span>
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

// 9. UPLOAD DE IMAGEM (CHAT)
$('plus-btn').addEventListener('click', () => $('image-upload').click());
$('image-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
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

// 10. EMOJIS E GIFS
const emojiData = { 'Rostos': ['😀','😂','😍','😎','😭','😡','🤔','🥺','😴','🤯'], 'Mãos': ['👍','👎','👊','✌️','🙏','👋','💪'], 'Objetos': ['🎮','🔥','❤️','💀','🎉','💡','💣'] };
$('emoji-btn').addEventListener('click', () => {
    const list = $('emoji-list');
    if (list.innerHTML === '') {
        let all = [];
        for (const cat in emojiData) all = all.concat(emojiData[cat]);
        all.forEach(e => {
            const span = document.createElement('span');
            span.innerText = e;
            span.onclick = () => { $('message-input').value += e; };
            list.appendChild(span);
        });
    }
    $('emoji-picker').classList.toggle('hidden');
    $('gif-picker').classList.add('hidden');
});

const TENOR_API_KEY = 'LIVDSRZULELA';
$('gif-btn').addEventListener('click', () => {
    $('gif-picker').classList.toggle('hidden');
    $('emoji-picker').classList.add('hidden');
});
$('gif-search').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${e.target.value}&key=${TENOR_API_KEY}&limit=12`);
        const data = await res.json();
        $('gif-list').innerHTML = '';
        data.results.forEach(gif => {
            const img = document.createElement('img');
            img.src = gif.media_formats.tinygif.url;
            img.onclick = () => { sendMessage(gif.media_formats.gif.url, 'gif'); $('gif-picker').classList.add('hidden'); };
            $('gif-list').append(img);
        });
    }
});

// 11. WEBRTC (CHAMADAS - Lógica básica mantida)
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
async function initCall(video = true) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        $('local-video').srcObject = localStream;
        $('call-overlay').classList.remove('hidden');
        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        peerConnection.onicecandidate = (e) => { if (e.candidate) push(ref(db, `calls/${currentServerId}/candidates`), e.candidate.toJSON()); };
        peerConnection.ontrack = (e) => { $('remote-video').srcObject = e.streams[0]; };
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        set(ref(db, `calls/${currentServerId}/offer`), { offer, caller: userId });
    } catch (err) { alert("Erro de mídia: " + err.message); }
}
$('start-audio-call').addEventListener('click', () => initCall(false));
$('start-video-call').addEventListener('click', () => initCall(true));
$('end-call').addEventListener('click', () => {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    $('call-overlay').classList.add('hidden');
    remove(ref(db, `calls/${currentServerId}/offer`));
    peerConnection = null; localStream = null;
});
