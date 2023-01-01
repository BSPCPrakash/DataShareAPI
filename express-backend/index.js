const aws = require("aws-sdk");

const mongoose = require("mongoose");

const express = require("express");

const bcrypt = require("bcrypt");

// Create app instance
const app = express();
app.use(express.json());

// Register and set up the middleware

app.use(express.urlencoded({ extended: true }));

const entry = mongoose.Schema({
  username: String,
  password: String,
  email: String,
  device_id: String,
});
const access = new aws.Credentials({
  accessKeyId: "",
  secretAccessKey: "",
});
const s3 = new aws.S3({
  credentials: access,
  region: "us-east-1", //"us-west-2"
  signatureVersion: "v4",
});
const signedUrlExpireSeconds = 60 * 15;
const userEntry = mongoose.model("entry", entry);

const transaction = mongoose.Schema({
  device_id: String,
  sender_id: String,
  receive_id: String,
  file_url: String,
  status: Boolean,
});

const transEntry = mongoose.model("Transaction", transaction);
app.get("/",async(req,res)=>{
  res.send("API is listening").status(200);
});
// Request handler/endpoint
app.post("/changeStatus",async (req,res)=>{
  try{
    console.log(req.body);
    const{username,device_id,file_url}=req.body;
    await transEntry.updateMany(
      { username: username, deviceId: device_id, status: true,file_url:file_url },
      { $set: { status: false } }
    );

  }
  catch(error){
    console.log(error);
  }
});

app.post("/login", async (req, res) => {
  try {
    console.log(req.body);
    const { username, password } = req.body;
    let msg = "";
    console.log(username);
    const verifyData = await userEntry.find({ username: username });
    console.log(verifyData);
    
    const encrypt_password = await bcrypt.hash(password,10)
    console.log(encrypt_password);
    if (encrypt_password == verifyData[0].password) {
      console.log("Checking");
    }
    const verification = await bcrypt.compare(password, verifyData[0].password);
    console.log(verification);
    if (verification == true) {
      msg = "Correct";
    } else {
      msg = "Not Correct";
    }
    res.send({
      status: true,
      message: msg,
    });
  } catch (err) {
    console.log(err);
    res.send({
      status: false,
      message: "Not Authorized",
    });
  }
});

app.post("/register", async (req, res) => {
  try {
    const { username, password, email, device_id } = req.body;
    console.log(username);
    const isExistingUser = await userEntry.find({ username: username });
    if (isExistingUser.length > 1) {
      console.log(isExistingUser.length);
      res.status(401).send({
        status: false,
        message: "User Already registered",
      });
    } else {
      
      const encrypt_password = await bcrypt.hash(password,10);
      console.log(encrypt_password);
      const data = {
        username: username,
        password: encrypt_password,
        email: email,
        device_id: device_id,
      };
      const newEntry = new userEntry(data);
      await newEntry
        .save()
        .then(() => {
          console.log("User Registered");
          res.send({
            status: true,
            message: "User  registered",
          });
        })
        .catch(() => {
          res.send({
            status: false,
            message: "User not registered",
          });
        });
    }
  } catch (err) {
    console.log(err);
    res.send({
      status: false,
      message: "User not registered",
    });
  }
});

app.post("/transactions", async (req, res) => {
  try {
    const { username, device_id } = req.body;
    const verifyData = await transEntry.find({
      username: username,
      deviceId: device_id,
      status: true,
    });
    console.log(verifyData);
    res.status(200).send(verifyData);
  } catch (err) {
    console.log(err);
  }
});

app.post("/downloadURL", async (req, res) => {
  console.log(req.body);
  const { fileID, deviceId, type, username, receiverName } = req.body;
 
  const url = await s3.getSignedUrlPromise("getObject", {
    Bucket: "datasharebucket",
    Key: `${fileID}` + deviceId,
    Expires: signedUrlExpireSeconds,
  });
  const newEntry = new transEntry({
    device_id: deviceId,
    sender_id: username,
    receive_id: receiverName,
    file_url: url,
    status: true,
  });
  await newEntry
    .save()
    .then(() => {
      console.log("saved entry");
    })
    .catch((err) => {
      console.log(err);
      res.status(400).send("Error");
    });
  res.status(200).send("Done");
});

app.post("/uploadURL", async (req, res) => {
  console.log(req.body);
  const { fileID, deviceId, type } = req.body;

  const url = s3.getSignedUrl("putObject", {
    Bucket: "datasharebucket",
    ContentType: type,
    Expires: signedUrlExpireSeconds,
    Key: `${fileID}` + deviceId,
  });
  res.send({ url: url, message: "Url Aquired" }).status(200);
});

// Start up the server
mongoose
  .connect(
    "mongodb+srv://ChandraPrakash:Saiprakash09@cluster0.imaadqr.mongodb.net/?retryWrites=true&w=majority",
    { useNewUrlParser: true, useUnifiedTopology: true }
  )
  .then(() => {
    app.listen(5000, () => {
      console.log("Server is running at the port ");
    });
  })
  .catch((error) => {
    console.log("error: ", error.message);
  });
