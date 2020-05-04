const { admin, db } = require('./admin')

exports.FBAuth = (req, res, next) => {
    let idToken;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
        idToken = req.headers.authorization.split("Bearer ")[1];
    } else {
        console.error("No token found")
        return res.status(403).send({ error: "Unautorized" })
    }
    admin.auth().verifyIdToken(idToken)
        .then(decodedToken => {
            req.user = decodedToken
            return db.collection('users').where('userId', '==', req.user.uid).limit(1).get()
        })
        .then(data => {
            req.user.handle = data.docs[0].data().handle
            req.user.imageUrl=data.docs[0].data().imageUrl
            return next()
        }).catch(err => {
            console.error(err, "While verifying token");
            return res.status(403).send({ err })
        })
}
