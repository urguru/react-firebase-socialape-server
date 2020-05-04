const { db } = require("../utils/admin");

exports.getAllScreams = (req, res) => {
  db.collection("scream")
    .orderBy("createdAt", "desc")
    .get()
    .then((data) => {
      let screams = [];
      data.forEach((doc) => {
        screams.push({
          screamId: doc.id,
          ...doc.data(),
        });
      });
      return res.send(screams);
    })
    .catch((e) => console.error(e));
};

exports.postScream = (req, res) => {
  if (req.body.body.trim() === "") {
    return res.status(400).send({ comment: "Must not be empty" });
  }
  const newScream = {
    userHandle: req.user.handle,
    body: req.body.body,
    createdAt: new Date().toISOString(),
    userImage: req.user.imageUrl,
    likeCount: 0,
    commentCount: 0,
  };

  db.collection("scream")
    .add(newScream)
    .then((doc) => {
      const resScream = newScream;
      resScream.screamId = doc.id;
      res.json(resScream);
    })
    .catch((err) => {
      res.status(500).json({ error: "something went wrong" });
      console.error(err);
    });
};

exports.getScream = (req, res) => {
  let screamData = {};
  db.doc(`/scream/${req.params.screamId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).json({ error: "Scream not found" });
      }
      screamData = doc.data();
      screamData.screamId = doc.id;
      return db
        .collection("comments")
        .orderBy("createdAt", "desc")
        .where("screamId", "==", req.params.screamId)
        .get();
    })
    .then((data) => {
      screamData.comments = [];
      data.forEach((doc) => screamData.comments.push(doc.data()));
      return res.send(screamData);
    })
    .catch((err) => {
      console.error(err);
      return res.status(500).send({ error: err.code });
    });
};

exports.commentOnScream = (req, res) => {
  if (req.body.body.trim() === "") {
    return res.status(400).send({ comment: "Must not be empty" });
  }
  const newComment = {
    body: req.body.body,
    createdAt: new Date().toISOString(),
    userHandle: req.user.handle,
    screamId: req.params.screamId,
    userImage: req.user.imageUrl,
  };
  db.doc(`/scream/${req.params.screamId}`)
    .get()
    .then((doc) => {
      if (!doc.exists) {
        return res.status(404).send({ error: "Scream not found" });
      }
      return doc.ref.update({ commentCount: doc.data().commentCount + 1 });
    })
    .then(() => {
      db.collection("comments")
        .add(newComment)
        .then(() => {
          res.status(201).send(newComment);
        });
    })
    .catch((err) => {
      console.error(err);
      res.status(500).send({ error: "Something went wrong" });
    });
};

//Like a scream
exports.likeScream = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("screamId", "==", req.params.screamId)
    .limit(1);

  const screamDocument = db.doc(`/scream/${req.params.screamId}`);

  let screamData = {};

  screamDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        screamData = doc.data();
        console.log(screamData);
        screamData.screamId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(400).json({ error: "Scream not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return db
          .collection("likes")
          .add({
            screamId: req.params.screamId,
            userHandle: req.user.handle,
          })
          .then(() => {
            screamData.likeCount++;
            return screamDocument.update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            return res.json(screamData);
          });
      } else {
        return res.status(400).json({ error: "Scream already liked" });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};

exports.unlikeScream = (req, res) => {
  const likeDocument = db
    .collection("likes")
    .where("userHandle", "==", req.user.handle)
    .where("screamId", "==", req.params.screamId)
    .limit(1);

  const screamDocument = db.doc(`/scream/${req.params.screamId}`);

  let screamData = {};

  screamDocument
    .get()
    .then((doc) => {
      if (doc.exists) {
        screamData = doc.data();
        screamData.screamId = doc.id;
        return likeDocument.get();
      } else {
        return res.status(400).json({ error: "Scream not found" });
      }
    })
    .then((data) => {
      if (data.empty) {
        return res.status(400).json({ error: "Scream not liked" });
      } else {
        return db
          .doc(`/likes/${data.docs[0].id}`)
          .delete()
          .then(() => {
            screamData.likeCount--;
            return screamDocument.update({ likeCount: screamData.likeCount });
          })
          .then(() => {
            res.json(screamData);
          });
      }
    })
    .catch((err) => {
      console.error(err);
      res.status(500).json({ error: err.code });
    });
};


exports.deleteScream= (req,res)=>{
  const document=db.doc(`/scream/${req.params.screamId}`)
  document.get()
  .then(doc=>{
    if(!doc.exists){
      return res.status(404).send({error:"Scream not found"})
    }
    if(doc.data().userHandle!==req.user.handle){
      return res.status(403).json({error:"Unathorized"})
    }
    else{
      return document.delete()
    }
  }).then(()=>{
    res.json({message: "Scream deleted successfully"})
  }).catch(err=>{
    console.error(err)
    res.status(500).json({error:err.code})
  })
}