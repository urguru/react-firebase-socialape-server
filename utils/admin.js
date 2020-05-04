const admin = require('firebase-admin')
const firebase = require('firebase')

admin.initializeApp();
const db = admin.firestore()

module.exports={admin,db}