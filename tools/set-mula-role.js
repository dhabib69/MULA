#!/usr/bin/env node
// Run with Application Default Credentials that can administer Firebase Auth:
// node tools/set-mula-role.js <firebase-auth-uid> admin
const admin = require('../functions/node_modules/firebase-admin');

const [uid, role] = process.argv.slice(2);
if (!uid || !['admin', 'karyawan'].includes(role)) {
  console.error('Usage: node tools/set-mula-role.js <firebase-auth-uid> <admin|karyawan>');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.applicationDefault() });

(async () => {
  const user = await admin.auth().getUser(uid);
  const claims = { ...(user.customClaims || {}) };
  if (role === 'admin') claims.mula_role = 'admin';
  else delete claims.mula_role;
  await admin.auth().setCustomUserClaims(uid, claims);
  console.log(`Role updated for ${uid}: ${role}. The user must sign in again or refresh their ID token.`);
})().catch(error => {
  console.error(error.message || error);
  process.exit(1);
});