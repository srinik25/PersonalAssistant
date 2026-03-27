// Local-only auth - no login required
var currentUser = { uid: 'local-user', email: 'local@localhost', displayName: 'Srini' };

function onAuthReady(callback) {
    callback(currentUser);
}

function requireAuth(callback) {
    callback(currentUser);
}
