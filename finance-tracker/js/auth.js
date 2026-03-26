// ========== AUTH HELPER ==========
var currentUser = null;
var _authReadyCallbacks = [];
var _authReady = false;

firebase.auth().onAuthStateChanged(function(user) {
    currentUser = user;
    _authReady = true;
    updateNavAuth(user);
    _authReadyCallbacks.forEach(function(cb) { cb(user); });
    _authReadyCallbacks = [];
});

function onAuthReady(callback) {
    if (_authReady) {
        callback(currentUser);
    } else {
        _authReadyCallbacks.push(callback);
    }
}

function requireAuth(callback) {
    onAuthReady(function(user) {
        if (!user) {
            window.location.href = 'login.html';
        } else {
            callback(user);
        }
    });
}

function signOut() {
    firebase.auth().signOut().then(function() {
        window.location.href = 'login.html';
    });
}

function updateNavAuth(user) {
    var navEl = document.querySelector('nav');
    if (!navEl) return;
    var existing = document.getElementById('nav-auth');
    if (existing) existing.remove();

    var authEl = document.createElement('span');
    authEl.id = 'nav-auth';
    authEl.style.cssText = 'font-size:0.82rem;display:flex;align-items:center;gap:8px;margin-left:8px;';

    if (user) {
        var name = user.displayName || user.email.split('@')[0];
        authEl.innerHTML = '<span style="color:#4a7aaa;font-weight:600;">' + escAuth(name) + '</span>' +
            '<a href="#" onclick="signOut();return false;" style="color:#6a7a8e;text-decoration:none;font-size:0.8rem;font-weight:500;">Sign Out</a>';
    } else {
        authEl.innerHTML = '<a href="login.html" style="color:#4a7aaa;text-decoration:none;font-weight:600;font-size:0.82rem;">Sign In</a>';
    }
    navEl.appendChild(authEl);
}

function escAuth(str) {
    var el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
}
