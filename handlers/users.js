const {admin,db}=require('../utils/admin')

const firebase = require('firebase')
const config=require('../utils/config')
const {validateSignUpData,validateLogInData,reduceUserDetails}=require('../utils/validators')


firebase.initializeApp(config)
noImageUrl = 'default-profile-picture1.jpg'

let token, userID;
exports.userSignUp=(req, res) => {
    const newUser = {
        email: req.body.email,
        password: req.body.password,
        confirmPassword: req.body.confirmPassword,
        handle: req.body.handle
    }
    
    const {valid,errors}=validateSignUpData(newUser)
    if(!valid) return res.status(400).send(errors)

    db.doc(`/users/${newUser.handle}`).get()
        .then(doc => {
            if (doc.exists) {
                return res.status(400).send({ handle: "this handle is already taken" })
            }
            else {
                return firebase.auth().createUserWithEmailAndPassword(newUser.email, newUser.password)
            }
        }).then((data) => {
            userID = data.user.uid
            return data.user.getIdToken()
        }).then(tokenID => {
            token = tokenID
            const newUserCredentials = {
                handle: newUser.handle,
                email: newUser.email,
                createdAt: new Date().toISOString(),
                userId: userID,
                imageUrl: `https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${noImageUrl}?alt=media`

            }
            return db.doc(`users/${newUserCredentials.handle}`).set(newUserCredentials)
        })
        .then(() => {
            return res.status(201).send({ token })
        })
        .catch((e) => {
            console.error(e);
            if (e.code === "auth/email-already-in-use") {
                return res.status(400).send({
                    email: "Email is already in use"
                })
            }
            res.status(500).send({ general: "something went wrong, please try again" })

        })
}


exports.userLogIn = (req, res) => {
    const user = {
        email: req.body.email,
        password: req.body.password
    }

    const { valid, errors } = validateLogInData(user)
    if (!valid) return res.status(400).send(errors)
    
    firebase.auth().signInWithEmailAndPassword(user.email, user.password)
        .then(data => {
            return data.user.getIdToken()
        }).then(token => {
            return res.send({ token })
        }).catch(e => {
            console.error(e);
           res.status(403).send({ general: "Wrong credentials.Please try again" })
            
           

        })

}

//Add user details
exports.addUserDetails=(req,res)=>{
    let userDetails=reduceUserDetails(req.body)

    db.doc(`/users/${req.user.handle}`).update(userDetails)
    .then(()=>{
        return res.send({message:"Details added successfully"})
    }).catch((err)=>
    {
        console.error(err.code)
        return res.status(500).send({error:err.code})
    })
}
//Get any users details
exports.getUserDetails=(req,res)=>{
    let userData={}
    db.doc(`/users/${req.params.handle}`).get()
    .then(doc=>{
        if(doc.exists){
            userData.user=doc.data();
            return db.collection('scream').where('userHandle','==',req.params.handle)
            .orderBy('createdAt','desc')
            .get()
        }else{
            return res.status(404).json({error:"The requested userHandle doesnt exist"})
        }
    })
    .then(data=>{
        userData.screams=[]
        data.forEach(doc=>{
            userData.screams.push({
                ...doc.data()
            })
        })
        return res.json(userData);
    })
    .catch(err=>{
        console.error(err);
        return res.status(500).json({error:err.code})
    })
}




//get own user details
exports.getAuthenticatedUser=(req,res)=>{
    let userData={}
    userData.likes=[]
    db.doc(`/users/${req.user.handle}`).get()
    .then((doc)=>{
        if(doc.exists){
            userData.credentials=doc.data()
            return db.collection('likes').where('userHandle','==','req.user.handle').get()
        }
    }).then(data=>{
        if(typeof(data)!=='undefined')
       {
            data.forEach(doc => {
                userData.likes.push(doc.data())
            })
            return db.collection('notifications').where('recipient','==',req.user.handle)
            .orderBy('createdAt','desc').limit(10).get()
       }
      
    }).then((snapshot)=>{
        userData.notifications=[]
        snapshot.forEach(doc=>{
            userData.notifications.push(
                {
                    ...doc.data(),
                    notificationId:doc.id
                })
        })
        return res.send(userData)
    })
    .catch((err)=>{
        console.error(err)
        res.status(500).send({error:err.code})
    })

}






//Upload a profile image
exports.uploadImage=(req,res)=>{
    const BusBoy=require('busboy')
    const path=require('path')
    const os=require('os')
    const fs=require('fs')
    const busBoy=new BusBoy({headers:req.headers})
    let imgFileName;
    let imageToBeUploaded={};
    busBoy.on('file',(fieldname,file,filename,encoding,mimetype)=>{
        if(mimetype!=='image/jpeg' && mimetype!=='image/png'){
            return res.status(400).json({error:"Wrong filetype submitted"})
        }
        console.log(fieldname);
        console.log(filename); 
        console.log(mimetype);
        const imageExtension = filename.split('.')[filename.split('.').length-1]
        imgFileName=`${Math.round(Math.random()*100000000)}.${imageExtension}`
        const filepath=path.join(os.tmpdir(),imgFileName);
        imageToBeUploaded={filepath,mimetype};
        file.pipe(fs.createWriteStream(filepath))
    });
    busBoy.on('finish',()=>{
        admin.storage().bucket().upload(imageToBeUploaded.filepath,{
            resumable:false,
            metadata:{
                metadata:{
                    contentType:imageToBeUploaded.mimetype
                }
            }
        }).then(()=>{
            const imageUrl=`https://firebasestorage.googleapis.com/v0/b/${config.storageBucket}/o/${imgFileName}?alt=media`
            return db.doc(`/users/${req.user.handle}`).update({
                imageUrl
            }).then(()=>{
                return res.json({message:"Image uploaded successfully"})
            }).catch((err)=>{
                console.error(err);
                return res.status(500).json({error:err.code})   
            })
        })
    })

    busBoy.end(req.rawBody)
}


exports.markNotificationsRead=(req,res)=>{
    let batch=db.batch();
    req.body.forEach(notificationId=>{
        const notification=db.doc(`/notifications/${notificationId}`)
        batch.update(notification,{read:true})
    })
    batch.commit()
    .then(()=>{
        return res.json({message:'Notification marked read'})
    }).catch(err=>{
        console.error(err);
        return res.status(500).json({error:err.code})
    })
}