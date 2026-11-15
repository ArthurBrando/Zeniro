import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, push, onChildAdded, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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

// Estado do Usuário
let userId = localStorage.getItem('zeniro_uid') || 'user_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('zeniro_uid', userId);

// Elementos UI
const myName = document.getElementById('my-name');
const myAvatar = document.getElementById('my-avatar');
const messagesContainer = document.getElementById('messages-container');
const messageInput = document.getElementById('message-input');
const emojiPicker = document.getElementById('emoji-picker');
const overlayBg = document.getElementById('overlay-bg');

let currentServerId = 'global';
let userProfile = { name: 'Usuário', avatar: 'https://via.placeholder.com/32', font: "'Inter', sans-serif", bio: '' };

// --- MENU MOBILE ---
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const serverSidebar = document.getElementById('server-sidebar');
const channelSidebar = document.getElementById('channel-sidebar');

mobileMenuBtn.addEventListener('click', () => {
    serverSidebar.classList.add('open');
    channelSidebar.classList.add('open');
    overlayBg.classList.remove('hidden');
});

overlayBg.addEventListener('click', () => {
    serverSidebar.classList.remove('open');
    channelSidebar.classList.remove('open');
    overlayBg.classList.add('hidden');
});

// --- PERFIL ---
const userRef = ref(db, 'users/' + userId);
onValue(userRef, (snapshot) => {
    if (snapshot.exists()) {
        userProfile = snapshot.val();
        myName.innerText = userProfile.name;
        myName.style.fontFamily = userProfile.font;
        myAvatar.src = userProfile.avatar;
        
        // Preencher modais
        document.getElementById('edit-name').value = userProfile.name;
        document.getElementById('edit-bio').value = userProfile.bio || '';
        document.getElementById('edit-font').value = userProfile.font;
        
        document.getElementById('view-name').innerText = userProfile.name;
        document.getElementById('view-name').style.fontFamily = userProfile.font;
        document.getElementById('view-bio').innerText = userProfile.bio || 'Sem bio.';
        document.getElementById('view-avatar').src = userProfile.avatar;
    } else {
        set(userRef, userProfile);
    }
});

// Abrir Modais
document.getElementById('edit-profile-btn').addEventListener('click', () => document.getElementById('edit-profile-modal').classList.remove('hidden'));
document.getElementById('open-profile-btn').addEventListener('click', () => document.getElementById('view-profile-modal').classList.remove('hidden'));
document.querySelectorAll('.close-modal').forEach(btn => {
    btn.addEventListener('click', () => {
        document.getElementById('edit-profile-modal').classList.add('hidden');
        document.getElementById('view-profile-modal').classList.add('hidden');
    });
});

// Salvar Perfil
let newAvatarBase64 = null;
document.getElementById('edit-avatar').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => { newAvatarBase64 = event.target.result; };
        reader.readAsDataURL(file);
    }
});

document.getElementById('save-profile').addEventListener('click', () => {
    update(userRef, {
        name: document.getElementById('edit-name').value || userProfile.name,
        bio: document.getElementById('edit-bio').value,
        font: document.getElementById('edit-font').value,
        avatar: newAvatarBase64 || userProfile.avatar
    });
    newAvatarBase64 = null;
    document.getElementById('edit-profile-modal').classList.add('hidden');
});

// --- SERVIDORES ---
const serversRef = ref(db, 'servers');
const serverList = document.getElementById('server-list');
const currentServerName = document.getElementById('current-server-name');
const serverModal = document.getElementById('server-modal');
let editingServerId = null;

onValue(serversRef, (snapshot) => {
    serverList.innerHTML = '';
    if (snapshot.exists()) {
        const servers = snapshot.val();
        for (const id in servers) {
            const s = servers[id];
            const div = document.createElement('div');
            div.className = `server-icon ${currentServerId === id ? 'active' : ''}`;
            div.innerHTML = `<span>${s.name.substring(0, 2).toUpperCase()}</span>`;
            div.onclick = () => switchServer(id, s.name);
            serverList.appendChild(div);
        }
    }
});

document.getElementById('create-server-btn').addEventListener('click', () => {
    editingServerId = null;
    document.getElementById('server-modal-title').innerText = 'Criar Servidor';
    document.getElementById('server-name-input').value = '';
    document.getElementById('delete-server-btn').classList.add('hidden');
    serverModal.classList.remove('hidden');
});

document.getElementById('edit-server-btn').addEventListener('click', () => {
    if (currentServerId === 'global') return;
    editingServerId = currentServerId;
    document.getElementById('server-modal-title').innerText = 'Editar Servidor';
    document.getElementById('server-name-input').value = currentServerName.innerText;
    document.getElementById('delete-server-btn').classList.remove('hidden');
    serverModal.classList.remove('hidden');
});

document.querySelector('.close-server-modal').addEventListener('click', () => serverModal.classList.add('hidden'));

document.getElementById('save-server-btn').addEventListener('click', () => {
    const name = document.getElementById('server-name-input').value.trim();
    if (!name) return;
    if (editingServerId) update(ref(db, 'servers/' + editingServerId), { name });
    else set(push(serversRef), { name, owner: userId });
    serverModal.classList.add('hidden');
});

document.getElementById('delete-server-btn').addEventListener('click', () => {
    if (editingServerId) {
        remove(ref(db, 'servers/' + editingServerId));
        switchServer('global', 'Início');
        serverModal.classList.add('hidden');
    }
});

function switchServer(id, name) {
    currentServerId = id;
    currentServerName.innerText = name;
    document.getElementById('edit-server-btn').classList.toggle('hidden', id === 'global');
    document.querySelectorAll('.server-icon').forEach(el => el.classList.remove('active'));
    if (id === 'global') document.querySelector('[data-server="global"]').classList.add('active');
    loadMessages();
    // Fechar menu mobile se estiver aberto
    serverSidebar.classList.remove('open');
    channelSidebar.classList.remove('open');
    overlayBg.classList.add('hidden');
}

// --- CHAT & EMOJIS ---
document.getElementById('emoji-btn').addEventListener('click', () => emojiPicker.classList.toggle('hidden'));
window.insertEmoji = (emoji) => {
    messageInput.value += emoji;
    messageInput.focus();
};

function loadMessages() {
    messagesContainer.innerHTML = '';
    const chatRef = ref(db, `messages/${currentServerId}/geral`);
    onChildAdded(chatRef, (snapshot) => {
        const data = snapshot.val();
        const div = document.createElement('div');
        div.className = 'message';
        div.innerHTML = `
            <img src="${data.avatar}" alt="Avatar">
            <div class="msg-content">
                <div class="msg-header">
                    <span style="font-family: ${data.font}">${data.name}</span>
                    <small>${new Date(data.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</small>
                </div>
                <div class="msg-text">${data.text}</div>
            </div>
        `;
        messagesContainer.appendChild(div);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
}

function sendMessage() {
    const text = messageInput.value.trim();
    if (!text) return;
    push(ref(db, `messages/${currentServerId}/geral`), {
        userId, name: userProfile.name, avatar: userProfile.avatar, font: userProfile.font, text, timestamp: Date.now()
    });
    messageInput.value = '';
    emojiPicker.classList.add('hidden');
}

document.getElementById('send-btn').addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });

loadMessages();

// --- WEBRTC (CHAMADAS) ---
let localStream;
let peerConnection;
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const callOverlay = document.getElementById('call-overlay');
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');

async function initCall(video = true) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video, audio: true });
        localVideo.srcObject = localStream;
        callOverlay.classList.remove('hidden');
        
        peerConnection = new RTCPeerConnection(rtcConfig);
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) push(ref(db, `calls/${currentServerId}/candidates`), event.candidate.toJSON());
        };

        peerConnection.ontrack = (event) => {
            remoteVideo.srcObject = event.streams[0];
        };

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        set(ref(db, `calls/${currentServerId}/offer`), { offer, caller: userId });

    } catch (err) {
        alert("Erro ao acessar câmera/microfone: " + err.message);
    }
}

// Receber Chamada
onValue(ref(db, `calls/${currentServerId}/offer`), async (snapshot) => {
    const data = snapshot.val();
    if (data && data.caller !== userId && !peerConnection) {
        callOverlay.classList.remove('hidden');
        peerConnection = new RTCPeerConnection(rtcConfig);
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) push(ref(db, `calls/${currentServerId}/candidates`), event.candidate.toJSON());
        };
        peerConnection.ontrack = (event) => { remoteVideo.srcObject = event.streams[0]; };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        set(ref(db, `calls/${currentServerId}/answer`), { answer, answerer: userId });

        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
        localVideo.srcObject = localStream;
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

// Controles de Chamada
document.getElementById('toggle-mic').addEventListener('click', function() {
    const track = localStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    this.classList.toggle('active');
});

document.getElementById('toggle-video').addEventListener('click', function() {
    const track = localStream.getVideoTracks()[0];
    if (track) {
        track.enabled = !track.enabled;
        this.classList.toggle('active');
        localVideo.style.opacity = track.enabled ? '1' : '0.2';
    }
});

document.getElementById('end-call').addEventListener('click', () => {
    if (peerConnection) peerConnection.close();
    if (localStream) localStream.getTracks().forEach(track => track.stop());
    callOverlay.classList.add('hidden');
    remove(ref(db, `calls/${currentServerId}/offer`));
    remove(ref(db, `calls/${currentServerId}/answer`));
    peerConnection = null;
    localStream = null;
});

document.getElementById('start-audio-call').addEventListener('click', () => initCall(false));
document.getElementById('start-video-call').addEventListener('click', () => initCall(true));
