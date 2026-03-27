// ========== AUTH HELPER (local mode — no login required) ==========
var currentUser = { uid: 'local-user', email: 'local@localhost', displayName: 'Srini' };

function onAuthReady(callback) {
    callback(currentUser);
}

function requireAuth(callback) {
    callback(currentUser);
}

function signOut() {
    // no-op in local mode
}

function updateNavAuth(user) {
    // no auth UI in local mode
}

function escAuth(str) {
    var el = document.createElement('span');
    el.textContent = str || '';
    return el.innerHTML;
}
