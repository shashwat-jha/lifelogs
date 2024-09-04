const express = require('express');
const ejs = require('ejs');
const path = require('path');
const cookieParser = require('cookie-parser');
const userModel = require('./models/users'); // Ensure this path is correct
const postModel = require("./models/post"); // Ensure this path is correct
const bcrypt = require('bcrypt');
const jwt = require("jsonwebtoken");
const multer  = require('multer');
const crypto = require("crypto");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/images/uploads");
  },
  filename: function (req, file, cb) {
    crypto.randomBytes(12, function(err, bytes) {
      if (err) {
        return cb(err);
      }
      const fn = bytes.toString('hex') + path.extname(file.originalname);
      cb(null, fn);
    });
  }
});

const upload = multer({ storage: storage });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, 'views'));

// Render index page
app.get('/', (req, res) => {
  res.render("index");
});

app.get("/manage-profile-pic", isLoggedIn, (req, res) => {
  res.render("manage-profile-pic");
});

app.post("/upload-profile-pic", isLoggedIn, upload.single('profilePic'), async (req, res) => {
  if (req.file) {
    let user = await userModel.findOne({ email: req.user.email });
    user.profilePic = '/images/uploads/' + req.file.filename;
    await user.save();
    res.redirect("/profile");
  } else {
    res.status(400).send("No file uploaded.");
  }
});

app.post("/remove-profile-pic", isLoggedIn, async (req, res) => {
  
    let user = await userModel.findOne({ email: req.user.email });

    if(user.profilePic != "/images/uploads/defaultImage.jpg") {
      user.profilePic = "/images/uploads/defaultImage.jpg";
      await user.save();
    }
    res.redirect("/profile");
});

// Render login page
app.get("/login", (req, res) => {
  res.render("login");
});

// Render registration page
app.get("/register", (req, res) => {
  res.render("register");
});

// Profile page with user data
app.get("/profile", isLoggedIn, async (req, res) => {
  try {
    const user = await userModel.findOne({ email: req.user.email }).populate("posts");
    if (!user) return res.status(404).send("User not found");
    res.render("profile", { user });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).send("An error occurred while fetching user data.");
  }
});

app.get("/all-posts", isLoggedIn, async (req, res) => {
  try {
      // Fetch all posts from the database
      const posts = await postModel.find().populate('userId', 'username profilePic');

      // Render the all-posts page and pass the posts data
      res.render("all-posts", { posts });
  } catch (err) {
      console.error('Error fetching posts:', err);
      res.status(500).send("An error occurred while fetching posts.");
  }
});

// Handle registration
app.post('/register', async (req, res) => {
  const { name, username, age, email, password } = req.body;
  let data = await userModel.findOne({ email: email });
  if (data) return res.status(400).send("User already exists");

  bcrypt.genSalt(10, (err, salt) => {
    if (err) return res.status(500).send("Error generating salt");

    bcrypt.hash(password, salt, async (err, hash) => {
      if (err) return res.status(500).send("Error hashing password");

      try {
        let user = await userModel.create({
          fullname: name, // Ensure correct field names
          username,
          age,
          email,
          password: hash
        });
        let token = jwt.sign({ email: email }, "secret", { expiresIn: '1h' });
        res.cookie("token", token);
        res.redirect("/profile");
      } catch (err) {
        console.error('Error creating user:', err);
        res.status(500).send("Error creating user");
      }
    });
  });
});

// Handle login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  let user = await userModel.findOne({ email: email });
  if (!user) return res.status(400).send("User not found");

  bcrypt.compare(password, user.password, (err, result) => {
    if (err) return res.status(500).send("Error comparing passwords");
    if (result) {
      let token = jwt.sign({ email: email }, "secret", { expiresIn: '1h' });
      res.cookie("token", token);
      return res.redirect("/profile");
    } else {
      return res.status(401).send("Invalid credentials");
    }
  });
});

app.post("/create-post", isLoggedIn, async (req, res) => {
  const user = await userModel.findOne({ email: req.user.email });
  let { title, content } = req.body;
  let post = await postModel.create({
    userId: user.id,
    title: title,
    content: content
  });
  user.posts.push(post._id);
  await user.save();

  res.redirect("/profile");
});

// Handle logout
app.get("/logout", (req, res) => {
  res.clearCookie("token");
  res.redirect("/login");
});

// Middleware to check if user is logged in
function isLoggedIn(req, res, next) {
  if (!req.cookies.token) {
    return res.redirect("/login");
  }
  try {
    const data = jwt.verify(req.cookies.token, "secret");
    req.user = data;
    next();
  } catch (err) {
    console.error('Error verifying token:', err);
    res.redirect("/login");
  }
}

// Start server
app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
