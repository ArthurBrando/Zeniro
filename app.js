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
const toBase64 = file => new Promise((res, rej) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = () => res(r.result); r.onerror = rej; });

let currentServerId = 'global';
let currentChannelId = 'geral';
let userProfile = { name: 'Usuário', avatar: '', banner: '', decoration: '', font: "'Inter', sans-serif", bio: '', tagText: '', tagIcon: '', username: 'user' };
let replyingToData = null;
let allUsers = {};
let localStream = null;
let peerConnection = null;
let loadedMessages = {};

// --- NAVEGAÇÃO MOBILE ---
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

$('mobile-back-btn').addEventListener('click', () => {
    $('chat-area').classList.add('hidden');
    $('profile-view').classList.add('hidden');
    $('mobile-menu-btn').click();
});

// --- SISTEMA DE PERFIL ---
onValue(ref(db, 'users'), snap => { allUsers = snap.val() || {}; });

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

// Uploads de Perfil
$('edit-avatar-file').addEventListener('change', async (e) => { if(e.target.files[0]) $('edit-avatar-url').value = await toBase64(e.target.files[0]); });
$('edit-banner-file').addEventListener('change', async (e) => { if(e.target.files[0]) $('edit-banner-url').value = await toBase64(e.target.files[0]); });
$('edit-decor-file').addEventListener('change', async (e) => { if(e.target.files[0]) $('edit-decor-url').value = await toBase64(e.target.files[0]); });

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
});

// Visualizar Perfil (Tela Cheia)
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
    } else { $('v-decoration').classList.add('hidden'); }

    if (data.tagText) {
        $('v-tag').classList.remove('hidden');
        $('v-tag-text').innerText = data.tagText;
        if (data.tagIcon) { $('v-tag-icon').src = data.tagIcon; $('v-tag-icon').classList.remove('hidden'); }
    } else { $('v-tag').classList.add('hidden'); }

    const btnContainer = $('profile-main-buttons');
    if (isMe) {
        btnContainer.innerHTML = `<button class="btn-primary" onclick="document.getElementById('edit-profile-modal').classList.remove('hidden')">Editar o Perfil Principal</button>`;
    } else {
        btnContainer.innerHTML = `
            <button class="btn-secondary" onclick="sendFriendRequest('${realUid}')">Adicionar Amigo</button>
            <button class="btn-primary" onclick="alert('Abrir DM com ${data.name} (Em breve)')">Mensagem</button>
        `;
    }
};

// --- AMIGOS ---
window.sendFriendRequest = (targetUid) => {
    set(ref(db, `friend_requests/${targetUid}/${userId}`), { name: userProfile.name, avatar: userProfile.avatar });
    alert("Pedido enviado!");
};

$('open-mailbox-btn').addEventListener('click', () => {
    $('mailbox-modal').classList.remove('hidden');
    onValue(ref(db, `friend_requests/${userId}`), (snap) => {
        const list = $('friend-requests-list'); list.innerHTML = '';
        if (snap.exists()) {
            const reqs = snap.val();
            for (const senderId in reqs) {
                const r = reqs[senderId];
                const div = document.createElement('div'); div.className = 'search-result-item';
                div.innerHTML = `<div style="display:flex; align-items:center; gap:8px;"><img src="${r.avatar || 'zenirobg.png'}" style="width:30px;height:30px;border-radius:50%;"><strong>${r.name}</strong></div><button class="primary-btn accept-btn">Aceitar</button>`;
                div.querySelector('.accept-btn').onclick = () => {
                    set(ref(db, `friends/${userId}/${senderId}`), true);
                    set(ref(db, `friends/${senderId}/${userId}`), true);
                    remove(ref(db, `friend_requests/${userId}/${senderId}`));
                };
                list.appendChild(div);
            }
        } else { list.innerHTML = '<p style="color:gray; text-align:center;">Nenhum pedido.</p>'; }
    });
});

// --- SERVIDORES E CANAIS ---
const serversRef = ref(db, 'servers');
onValue(ref(db, 'users/' + userId + '/servers'), (snapshot) => {
    const myServers = snapshot.val() || {};
    $('server-list').innerHTML = '';
    for (const id in myServers) {
        if (myServers[id] === true) {
            get(ref(db, 'servers/' + id)).then(snap => {
                if (snap.exists()) {
                    const s = snap.val(); const div = document.createElement('div');
                    div.className = `server-icon ${currentServerId === id ? 'active' : ''}`;
                    div.innerHTML = `<span>${s.name.substring(0, 2).toUpperCase()}</span>`;
                    div.onclick = () => switchServer(id, s.name);
                    $('server-list').appendChild(div);
                }
            });
        }
    }
});

$('btn-dm-home').addEventListener('click', () => { switchServer('global', 'Mensagens Diretas'); });

$('create-server-btn').addEventListener('click', () => {
    const name = prompt("Nome do Servidor:"); if (!name) return;
    const isPublic = confirm("Servidor Público? (OK = Sim / Cancelar = Local)");
    const newRef = push(serversRef); const serverId = newRef.key;
    set(newRef, { name, owner: userId, isPublic });
    set(ref(db, `users/${userId}/servers/${serverId}`), true);
    set(ref(db, `channels/${serverId}/geral`), { name: 'geral', type: 'text' });
    switchServer(serverId, name);
});

function switchServer(id, name) {
    currentServerId = id; currentChannelId = 'geral';
    $('current-server-name').innerText = name; $('current-channel-name').innerText = '# geral';
    $('add-channel-btn').classList.toggle('hidden', id === 'global');
    $('sidebar-backdrop').click();
    document.querySelectorAll('.server-icon').forEach(el => el.classList.remove('active'));
    if (id === 'global') $('btn-dm-home').classList.add('active');
    loadChannels(); loadMessages();
}

function loadChannels() {
    const container = $('channel-list'); container.innerHTML = '';
    if (currentServerId === 'global') {
        container.innerHTML = '<h3>Amigos</h3><div class="channel active">👥 Todos os Amigos</div><h3>Mensagens</h3><div class="channel">Nenhuma DM</div>';
        return;
    }
    onValue(ref(db, `channels/${currentServerId}`), (snapshot) => {
        container.innerHTML = '';
        if (snapshot.exists()) {
            const channels = snapshot.val();
            for (const id in channels) {
                const c = channels[id]; const div = document.createElement('div');
                if (c.type === 'category') {
                    div.innerHTML = `<h3>${c.name}</h3>`;
                } else {
                    div.className = `channel ${currentChannelId === id ? 'active' : ''}`;
                    div.innerHTML = `<span>${c.type === 'voice' ? '🔊' : '#'}</span> ${c.name}`;
                    if (c.type === 'text') {
                        div.onclick = () => { currentChannelId = id; $('current-channel-name').innerText = `# ${c.name}`; loadChannels(); loadMessages(); $('mobile-menu-btn').click(); };
                    }
                }
                container.appendChild(div);
            }
        }
    });
}

$('add-channel-btn').addEventListener('click', () => $('channel-modal').classList.remove('hidden'));
$('save-channel-btn').addEventListener('click', () => {
    const name = $('channel-name-input').value.trim(); const type = $('channel-type-input').value;
    if (!name) return;
    set(push(ref(db, `channels/${currentServerId}`)), { name, type });
    $('channel-modal').classList.add('hidden'); $('channel-name-input').value = '';
});

$('search-server-btn').addEventListener('click', () => $('search-server-modal').classList.remove('hidden'));
$('search-server-input').addEventListener('input', async (e) => {
    const term = e.target.value.toLowerCase(); if (term.length < 2) return $('search-results').innerHTML = '';
    const snapshot = await get(serversRef); $('search-results').innerHTML = '';
    if (snapshot.exists()) {
        const servers = snapshot.val();
        for (const id in servers) {
            const s = servers[id];
            if (s.isPublic && s.name.toLowerCase().includes(term)) {
                const isMember = (await get(ref(db, `users/${userId}/servers/${id}`))).exists();
                const div = document.createElement('div'); div.className = 'search-result-item';
                div.innerHTML = `<div><strong>${s.name}</strong><p>Público</p></div><button class="${isMember ? 'danger-btn' : 'primary-btn'}">${isMember ? 'Sair' : 'Entrar'}</button>`;
                div.querySelector('button').onclick = () => {
                    if (isMember) { remove(ref(db, `users/${userId}/servers/${id}`)); if (currentServerId === id) switchServer('global', 'Início'); }
                    else { set(ref(db, `users/${userId}/servers/${id}`), true); }
                    $('search-server-modal').classList.add('hidden');
                };
                $('search-results').appendChild(div);
            }
        }
    }
});

// --- CHAT E MARKDOWN ---
function parseMarkdown(text) {
    let html = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>').replace(/^## (.*$)/gim, '<h2>$1</h2>').replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>');
    html = html.replace(/@(\w+)/g, (match, name) => {
        const found = Object.entries(allUsers).find(([id, u]) => u.name.toLowerCase() === name.toLowerCase());
        return found ? `<span class="mention" onclick="openProfileView('${found[0]}')">@${name}</span>` : `<span class="mention">@${name}</span>`;
    });
    return html.replace(/\n/g, '<br>');
}

function sendMessage(content, type = 'text') {
    if (!content.trim() && type === 'text') return;
    push(ref(db, `messages/${currentServerId}/${currentChannelId}`), {
        userId, name: userProfile.name, avatar: userProfile.avatar || 'zenirobg.png', 
        font: userProfile.font, text: type === 'text' ? content : '', media: type !== 'text' ? content : '', 
        type: type, replyTo: replyingToData, timestamp: Date.now()
    });
    $('message-input').value = ''; $('emoji-picker').classList.add('hidden'); $('gif-picker').classList.add('hidden'); 
    replyingToData = null; $('reply-context').classList.add('hidden');
}

$('send-btn').addEventListener('click', () => sendMessage($('message-input').value));
$('message-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage($('message-input').value); });

function loadMessages() {
    const container = $('messages-container'); container.innerHTML = ''; loadedMessages = {};
    onChildAdded(ref(db, `messages/${currentServerId}/${currentChannelId}`), (snapshot) => {
        const data = snapshot.val(); const msgId = snapshot.key;
        if (loadedMessages[msgId]) return; loadedMessages[msgId] = true;
        const div = document.createElement('div'); div.className = 'message'; div.id = `msg-${msgId}`;
        let mediaHtml = data.type === 'image' || data.type === 'gif' ? `<img src="${data.media}" class="msg-image" onclick="window.open('${data.media}')">` : '';
        let replyHtml = data.replyTo ? `<div class="msg-reply-context"><strong>${data.replyTo.name}</strong><div>${data.replyTo.text.substring(0, 50)}...</div></div>` : '';
        let parsedText = data.type === 'text' ? parseMarkdown(data.text) : '';
        div.innerHTML = `
            <div class="avatar-wrapper" onclick="openProfileView('${data.userId}')"><img class="user-avatar" src="${data.avatar}" onerror="this.src='zenirobg.png'"></div>
            <div class="msg-content">
                <div class="msg-header"><span class="name" style="font-family: ${data.font}" onclick="openProfileView('${data.userId}')">${data.name}</span><small>${new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small></div>
                ${replyHtml}${data.type === 'text' ? `<div class="msg-text">${parsedText}</div>` : mediaHtml}
            </div>`;
        attachLongPress(div, msgId, data.userId, data.name, data.type === 'text' ? data.text : 'Mídia');
        container.appendChild(div); container.scrollTop = container.scrollHeight;
    });
}

// --- UPLOAD DE CHAT ---
$('plus-btn').addEventListener('click', () => $('image-upload').click());
$('image-upload').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    if (file.type === 'image/gif') { const r = new FileReader(); r.onload = ev => sendMessage(ev.target.result, 'image'); r.readAsDataURL(file); }
    else {
        const r = new FileReader(); r.onload = ev => {
            const img = new Image(); img.onload = () => {
                const c = $('resize-canvas'); const ctx = c.getContext('2d');
                let w = img.width, h = img.height; const MAX = 800;
                if (w > h && w > MAX) { h *= MAX / w; w = MAX; } else if (h > MAX) { w *= MAX / h; h = MAX; }
                c.width = w; c.height = h; ctx.drawImage(img, 0, 0, w, h);
                sendMessage(c.toDataURL('image/jpeg', 0.7), 'image');
            }; img.src = ev.target.result;
        }; r.readAsDataURL(file);
    }
});

// --- EMOJIS E GIFS ---
const emojiData = ['😀','😂','😍','😎','😭','😡','🤔','🥺','😴','🤯','👍','👎','👊','✌️','🙏','👋','💪','🎮','🔥','❤️','💀','🎉','💡','💣'];
$('emoji-btn').addEventListener('click', () => {
    if ($('emoji-list').innerHTML === '') {
        emojiData.forEach(e => { const s = document.createElement('span'); s.innerText = e; s.onclick = () => { $('message-input').value += e; }; $('emoji-list').appendChild(s); });
    }
    $('emoji-picker').classList.toggle('hidden'); $('gif-picker').classList.add('hidden');
});

$('gif-btn').addEventListener('click', () => { $('gif-picker').classList.toggle('hidden'); $('emoji-picker').classList.add('hidden'); });
$('gif-search').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const res = await fetch(`https://tenor.googleapis.com/v2/search?q=${e.target.value}&key=LIVDSRZULELA&limit=12`);
        const data = await res.json(); $('gif-list').innerHTML = '';
        data.results.forEach(g => { const img = document.createElement('img'); img.src = g.media_formats.tinygif.url; img.onclick = () => { sendMessage(g.media_formats.gif.url, 'gif'); $('gif-picker').classList.add('hidden'); }; $('gif-list').append(img); });
    }
});

// --- CONTEXT MENU (LONG PRESS) ---
let pressTimer; const contextMenu = $('context-menu');
function attachLongPress(element, msgId, senderId, senderName, msgText) {
    const start = (e) => {
        if (e.type === 'touchstart') element.dataset.startY = e.touches[0].clientY;
        pressTimer = setTimeout(() => {
            if (e.type === 'touchstart' && e.cancelable) e.preventDefault(); 
            replyingToData = { id: msgId, name: senderName, text: msgText };
            $('reply-name').innerText = senderName; $('reply-text').innerText = msgText;
            if (senderId === userId) {
                $('ctx-delete').classList.remove('hidden');
                $('ctx-delete').onclick = () => { remove(ref(db, `messages/${currentServerId}/${currentChannelId}/${msgId}`)); $(`msg-${msgId}`).remove(); contextMenu.classList.add('hidden'); };
            } else { $('ctx-delete').classList.add('hidden'); }
            const rect = element.getBoundingClientRect();
            contextMenu.style.top = `${Math.min(rect.top, window.innerHeight - 100)}px`;
            contextMenu.style.left = `${Math.min(rect.left + 20, window.innerWidth - 150)}px`;
            contextMenu.classList.remove('hidden');
        }, 500);
    };
    const cancel = (e) => { if (e.type === 'touchmove' && Math.abs(e.touches[0].clientY - element.dataset.startY) > 10) clearTimeout(pressTimer); clearTimeout(pressTimer); };
    element.addEventListener('mousedown', start); element.addEventListener('touchstart', start, {passive: false});
    element.addEventListener('mouseup', cancel); element.addEventListener('mouseleave', cancel); element.addEventListener('touchend', cancel); element.addEventListener('touchmove', cancel); element.addEventListener('contextmenu', e => e.preventDefault());
}
$('ctx-reply').addEventListener('click', () => { $('reply-context').classList.remove('hidden'); contextMenu.classList.add('hidden'); $('message-input').focus(); });
$('cancel-reply').addEventListener('click', () => { replyingToData = null; $('reply-context').classList.add('hidden'); });

// --- WEBRTC (CALL) ---
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
async function initCall(video = true) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        $('local-video').srcObject = localStream; $('call-overlay').classList.remove('hidden');
        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream));
        peerConnection.onicecandidate = (e) => { if (e.candidate) push(ref(db, `calls/${currentServerId}/candidates`), e.candidate.toJSON()); };
        peerConnection.ontrack = (e) => { $('remote-video').srcObject = e.streams[0]; };
        const offer = await peerConnection.createOffer(); await peerConnection.setLocalDescription(offer);
        set(ref(db, `calls/${currentServerId}/offer`), { offer, caller: userId });
    } catch (err) { alert("Erro de mídia: " + err.message); }
}
$('start-audio-call').addEventListener('click', () => initCall(false));
$('start-video-call').addEventListener('click', () => initCall(true));
$('end-call').addEventListener('click', () => { if (peerConnection) peerConnection.close(); if (localStream) localStream.getTracks().forEach(t => t.stop()); $('call-overlay').classList.add('hidden'); remove(ref(db, `calls/${currentServerId}/offer`)); peerConnection = null; localStream = null; });
$('toggle-mic').addEventListener('click', function() { const t = localStream.getAudioTracks()[0]; t.enabled = !t.enabled; this.classList.toggle('active'); });
$('toggle-video').addEventListener('click', function() { const t = localStream.getVideoTracks()[0]; if(t) { t.enabled = !t.enabled; this.classList.toggle('active'); $('local-video').style.opacity = t.enabled ? '1' : '0.2'; } });

onValue(ref(db, `calls/${currentServerId}/offer`), async (snap) => {
    const data = snap.val();
    if (data && data.caller !== userId && !peerConnection) {
        $('call-overlay').classList.remove('hidden'); peerConnection = new RTCPeerConnection(rtcConfig);
        peerConnection.onicecandidate = (e) => { if (e.candidate) push(ref(db, `calls/${currentServerId}/candidates`), e.candidate.toJSON()); };
        peerConnection.ontrack = (e) => { $('remote-video').srcObject = e.streams[0]; };
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const ans = await peerConnection.createAnswer(); await peerConnection.setLocalDescription(ans);
        set(ref(db, `calls/${currentServerId}/answer`), { answer: ans, answerer: userId });
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getTracks().forEach(t => peerConnection.addTrack(t, localStream)); $('local-video').srcObject = localStream;
    }
});
onValue(ref(db, `calls/${currentServerId}/answer`), async (snap) => {
    const data = snap.val();
    if (data && data.answerer !== userId && peerConnection && !peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
    }
});
onChildAdded(ref(db, `calls/${currentServerId}/candidates`), async (snap) => {
    if (peerConnection) await peerConnection.addIceCandidate(new RTCIceCandidate(snap.val()));
});