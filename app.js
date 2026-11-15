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

// Gerenciamento de Sessão
let userId = localStorage.getItem('zeniro_uid') || 'user_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('zeniro_uid', userId);

const $ = id => document.getElementById(id);

// Variáveis de Estado
let currentServerId = 'global';
let userProfile = { name: 'Usuário', avatar: '', banner: '', font: "'Inter', sans-serif", bio: '' };
let replyingTo = null;
let localStream = null;
let peerConnection = null;
let loadedMessages = {};

// ==========================================
// 1. NAVEGAÇÃO E SIDEBAR MOBILE
// ==========================================
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

// ==========================================
// 2. PERFIL (PREVIEW E EDIÇÃO)
// ==========================================
window.updatePreview = () => {
    const name = $('edit-name').value || 'Seu Nome';
    const bio = $('edit-bio').value || 'Sua bio...';
    const font = $('edit-font').value;
    const avatar = $('edit-avatar-url').value || userProfile.avatar || 'zenirobg.png';
    const banner = $('edit-banner-url').value || userProfile.banner;

    $('preview-name').innerText = name;
    $('preview-name').style.fontFamily = font;
    $('preview-bio').innerText = bio;
    $('preview-avatar').src = avatar;
    if (banner) $('preview-banner').style.backgroundImage = `url(${banner})`;
    else $('preview-banner').style.backgroundImage = 'none';
};

const userRef = ref(db, 'users/' + userId);
onValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
        userProfile = snapshot.val();
        $('my-name').innerText = userProfile.name;
        $('my-name').style.fontFamily = userProfile.font;
        $('my-avatar').src = userProfile.avatar || 'zenirobg.png';
        
        $('edit-name').value = userProfile.name || '';
        $('edit-bio').value = userProfile.bio || '';
        $('edit-font').value = userProfile.font || "'Inter', sans-serif";
        $('edit-avatar-url').value = userProfile.avatar || '';
        $('edit-banner-url').value = userProfile.banner || '';
        updatePreview();
    } else {
        set(userRef, userProfile);
    }
});

$('edit-profile-btn').addEventListener('click', () => $('profile-modal').classList.remove('hidden'));
document.querySelectorAll('.close-modal').forEach(btn => btn.addEventListener('click', () => $('profile-modal').classList.add('hidden')));

let newAvatarBase64 = null;
$('edit-avatar-file').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => { 
            newAvatarBase64 = ev.target.result; 
            $('preview-avatar').src = newAvatarBase64; 
        };
        reader.readAsDataURL(file);
    }
});

$('save-profile').addEventListener('click', () => {
    update(userRef, {
        name: $('edit-name').value || 'Usuário',
        bio: $('edit-bio').value,
        font: $('edit-font').value,
        avatar: newAvatarBase64 || $('edit-avatar-url').value || 'zenirobg.png',
        banner: $('edit-banner-url').value
    });
    newAvatarBase64 = null;
    $('profile-modal').classList.add('hidden');
});

// ==========================================
// 3. SISTEMA DE SERVIDORES
// ==========================================
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
    switchServer(serverId, name);
});

$('search-server-btn').addEventListener('click', () => $('search-server-modal').classList.remove('hidden'));
document.querySelector('.close-search-modal').addEventListener('click', () => $('search-server-modal').classList.add('hidden'));

$('search-server-input').addEventListener('input', async (e) => {
    const term = e.target.value.toLowerCase();
    if (term.length < 2) return $('search-results').innerHTML = '';
    
    $('search-results').innerHTML = 'Buscando...';
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

function switchServer(id, name) {
    currentServerId = id;
    $('current-server-name').innerText = name;
    $('edit-server-btn').classList.toggle('hidden', id === 'global');
    $('sidebar-backdrop').click();
    loadMessages();
}// ==========================================
// 4. CHAT, EMOJIS E GIFS
// ==========================================
const emojiData = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🔥','👍','👎','👊','✌️','🤞','🖐️','✋','🤚','👋','🤙','💪','🙏','🎮','🎲','🎯','🏆','⚽','🏀','🎸','🎧','🎤','💻','📱','💡','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','💯','💢','💥','💫','💦','💨','🕳️','💣','💬','💤'];

$('emoji-btn').addEventListener('click', () => {
    const list = $('emoji-list');
    if (list.innerHTML === '') {
        emojiData.forEach(e => {
            const span = document.createElement('span');
            span.innerText = e;
            span.onclick = () => { $('message-input').value += e; };
            list.appendChild(span);
        });
    }
    $('emoji-picker').classList.toggle('hidden');
    $('gif-picker').classList.add('hidden');
});

// API de GIFs (Tenor)
const TENOR_API_KEY = 'LIVDSRZULELA';
$('gif-btn').addEventListener('click', () => {
    $('gif-picker').classList.toggle('hidden');
    $('emoji-picker').classList.add('hidden');
});

$('gif-search').addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const query = e.target.value;
        const url = `https://tenor.googleapis.com/v2/search?q=${query}&key=${TENOR_API_KEY}&limit=12`;
        const res = await fetch(url);
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

// Upload de Imagem com Redimensionamento (Canvas)
$('plus-btn').addEventListener('click', () => $('image-upload').click());
$('image-upload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
});

// ==========================================
// 5. LÓGICA DE MENSAGENS E RESPOSTAS (LONG PRESS)
// ==========================================
let pressTimer;
const contextMenu = $('context-menu');
let selectedMessageId = null;

function attachLongPress(element, msgId, senderName, msgText) {
    const startPress = (e) => {
        if (e.type === 'touchstart') element.dataset.startY = e.touches[0].clientY;
        
        pressTimer = setTimeout(() => {
            if (e.type === 'touchstart' && e.cancelable) e.preventDefault(); 
            selectedMessageId = msgId;
            $('reply-name').innerText = senderName;
            $('reply-text').innerText = msgText;
            
            const rect = element.getBoundingClientRect();
            contextMenu.style.top = `${Math.min(rect.top, window.innerHeight - 100)}px`;
            contextMenu.style.left = `${Math.min(rect.left + 20, window.innerWidth - 120)}px`;
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
    replyingTo = selectedMessageId;
    $('reply-context').classList.remove('hidden');
    contextMenu.classList.add('hidden');
    $('message-input').focus();
});

$('cancel-reply').addEventListener('click', () => {
    replyingTo = null;
    $('reply-context').classList.add('hidden');
});

function sendMessage(content, type = 'text') {
    if (!content.trim() && type === 'text') return;
    push(ref(db, `messages/${currentServerId}/geral`), {
        userId, name: userProfile.name, avatar: userProfile.avatar || 'zenirobg.png', 
        font: userProfile.font, text: type === 'text' ? content : '',
        media: type !== 'text' ? content : '', type: type,
        replyTo: replyingTo, timestamp: Date.now()
    });
    $('message-input').value = '';
    $('emoji-picker').classList.add('hidden');
    $('gif-picker').classList.add('hidden');
    replyingTo = null;
    $('reply-context').classList.add('hidden');
}

$('send-btn').addEventListener('click', () => sendMessage($('message-input').value));
$('message-input').addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage($('message-input').value); });

function loadMessages() {
    const container = $('messages-container');
    container.innerHTML = '<div class="empty-bg"><img src="zenirobg.png"></div>';
    loadedMessages = {};
    
    onChildAdded(ref(db, `messages/${currentServerId}/geral`), (snapshot) => {
        const data = snapshot.val();
        const msgId = snapshot.key;
        if (loadedMessages[msgId]) return;
        loadedMessages[msgId] = true;

        const div = document.createElement('div');
        div.className = 'message';
        
        let mediaHtml = data.type === 'image' || data.type === 'gif' ? `<img src="${data.media}" class="msg-image" onclick="openImage('${data.media}')">` : '';
        let replyHtml = data.replyTo ? `<div class="msg-reply-context"><strong>${data.replyTo.name}</strong><div>${data.replyTo.text.substring(0, 50)}</div></div>` : '';

        div.innerHTML = `
            <img class="avatar" src="${data.avatar}" onerror="this.src='zenirobg.png'">
            <div class="msg-content">
                <div class="msg-header">
                    <span style="font-family: ${data.font}">${data.name}</span>
                    <small>${new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                </div>
                ${replyHtml}
                ${data.type === 'text' ? `<div class="msg-text">${data.text}</div>` : mediaHtml}
            </div>
        `;
        attachLongPress(div, msgId, data.name, data.type === 'text' ? data.text : 'Imagem');
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    });
}

window.openImage = (src) => {
    $('viewer-img').src = src;
    $('download-img-btn').href = src;
    $('image-viewer').classList.remove('hidden');
};// ==========================================
// 6. WEBRTC (CALLS DE ÁUDIO E VÍDEO)
// ==========================================
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
        if (d.kind === 'audioinput') micSelect.innerHTML += `<option value="${d.deviceId}">${d.label || 'Microfone Padrão'}</option>`;
        if (d.kind === 'videoinput') camSelect.innerHTML += `<option value="${d.deviceId}">${d.label || 'Câmera Padrão'}</option>`;
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

// Controles da Call
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

// Fechar menus ao clicar fora
window.addEventListener('click', (e) => {
    if (!e.target.closest('.message') && !e.target.closest('#context-menu')) {
        $('context-menu').classList.add('hidden');
    }
    if (!e.target.closest('#emoji-picker') && !e.target.closest('#emoji-btn')) $('emoji-picker').classList.add('hidden');
    if (!e.target.closest('#gif-picker') && !e.target.closest('#gif-btn')) $('gif-picker').classList.add('hidden');
});
