const express = require('express')
const bodyParser = require('body-parser')
const coureseList = require('./courses')
const mongoose = require('mongoose');
const session = require('express-session')
const flush = require('connect-flash')
const passport = require('passport')
const bcrypt = require('bcryptjs')
let courseName;
const app = express();

mongoose.connect('mongodb+srv://hirenbhal:hiren123456bhal@usercluster.dxdr2.mongodb.net/userDB', {useNewUrlParser: true, useUnifiedTopology: true });
const db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', ()=> {
  console.log('database is connected succusefully')
});

var userSchema = new mongoose.Schema({
	username : {type: String},
	email : {type: String},
  password : {type: String},
  Courses : [{
    title : String,
    link : String,
    author : String,
    paid : String,
    id: Number
  }]
});
var User = mongoose.model('users', userSchema);

const insureAuthenticated = function(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  req.flash('error_msg', 'Please log in to view that resource');
  res.redirect('/login');
}
const forwardAuthenticated = function(req, res, next) {
  if (!req.isAuthenticated()) {
    return next();
  }
  res.redirect('/');      
}

app.use('/static', express.static('static'));
app.use(bodyParser.urlencoded({ extended: false }));
app.set('view engine', 'ejs');
app.set('views','./views');
app.use(session({ secret: 'secret', saveUninitialized: false, resave: false }))
app.use(flush());
app.use(passport.initialize());
app.use(passport.session());
app.use(function(req, res, next) {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.success = req.flash('success');
  res.locals.logged = req.isAuthenticated()
  next();
});
app.use(passport.initialize());
app.use(passport.session());

app.get('/', (req, res)=>{
  res.render('home', {user: req.user});
});

app.post('/', (req, res)=>{
  courseName=req.body.coursename;
  res.redirect('/'+courseName)
});

app.get('/register', forwardAuthenticated, (req, res)=>{
  res.render('register');
})

app.post('/register', (req, res) => {
  const { username, email, password, confirmPassword } = req.body;
  let errors = [];

  if (!username || !email || !password || !confirmPassword) {
    errors.push({ msg: 'Please enter all fields' });
  }

  if (password != confirmPassword) {
    errors.push({ msg: 'Passwords do not match' });
  }

  if (password.length < 8) {
    errors.push({ msg: 'Password must be at least 8 characters' });
  }

  if (errors.length > 0) {
    res.render('register', {
      errors,
      username,
      email,
      password,
      confirmPassword
    });
  } else {
    User.findOne({ email: email }).then(user => {
      if (user) {
        errors.push({ msg: 'Email already exists' });
        res.render('register', {
          errors,
          username,
          email,
          password,
          confirmPassword
        });
      } else {
        const user = new User({
          username,
          email,
          password
        });

        bcrypt.genSalt(10, (err, salt) => {
          bcrypt.hash(user.password, salt, (err, hash) => {
            if (err) throw err;
            user.password = hash;
            user
              .save()
              .then(user => {
                req.flash(
                  'success_msg',
                  'You are now registered and can log in'
                );
                res.redirect('/login');
              })
              .catch(err => console.log(err));
          });
        });
      }
    });
  }
});


app.get('/login', forwardAuthenticated, (req, res)=>{
  res.render('login')
});

var localStrategy = require('passport-local').Strategy;
passport.use(new localStrategy({ usernameField: 'email' }, (email, password, done) => {
  User.findOne({ email: email }, (err, data) => {
      if (err) throw err;
      if (!data) {
          return done(null, false, { message: "User Doesn't Exists.." });
      }
      bcrypt.compare(password, data.password, (err, match) => {
          if (err) {
              return done(null, false);
          }
          if (!match) {
              return done(null, false, { message: "Password Doesn't Match" });
          }
          if (match) {
              return done(null, data, { message: "Successfully Login" });
          }
      });
  });
}));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

app.get('/logout', (req, res)=> {
  req.logOut();
  req.flash('success_msg', 'You have logged out');
  res.redirect('/login');
}) 


app.post('/login', (req, res, next) => {
  passport.authenticate('local', {
    successRedirect: '/',
    failureRedirect: '/login',
    failureFlash: true,
    successFlash: true
  })(req, res, next);
});

app.get('/:courseName/:id', insureAuthenticated, (req, res)=>{
  let dbl = req.user.Courses;
  let cur_course = req.params.courseName;
  let course = coureseList[req.params.courseName];
  let some;
  for (let i = 0; i < dbl.length; i++) {
    if (dbl[i].id == parseInt(req.params.id)) {
      req.flash('error_msg', 'This course is already in your Courses')
      res.redirect('/' + cur_course);
    }
  }

  if (course.Udemy) {
    for (let i = 0; i < course.Udemy.length; i++) {
      if (course.Udemy[i].id === parseInt(req.params.id)) {
        some = course.Udemy[i];
        break;
      }
    }
  }
  if (course.Coursera) {
    for (let i = 0; i < course.Coursera.length; i++) {
      if (course.Coursera[i].id === parseInt(req.params.id)) {
        some = course.Coursera[i];
        break;
      }
    }
  }
  if (course.Youtube) {
    for (let i = 0; i < course.Youtube.length; i++) {
      if (course.Youtube[i].id === parseInt(req.params.id)) {
        some = course.Youtube[i];
        break;
      }
    }
  }
  let { title, link, author, paid, id } = some;
  let query = { email: req.user.email };

  User.findOne(query, (err, data)=>{
    if (!err) {
      data.Courses.push({title: title, link: link, author: author, paid: paid, id:id })
      data.save().then(user => {
        req.flash(
          'success_msg',
          'Saved in your courses'
        );
        res.redirect('/' + cur_course);
      }).catch(err => console.log(err));
    }
  });
});

app.get('/my_courses', insureAuthenticated,(req, res)=>{
  My_Courses = req.user.Courses;
  res.render('my_courses', {user: req.user, My_Courses});
});

app.get('/:courseName', insureAuthenticated, (req, res)=>{
  if (req.params.courseName) {
    params = coureseList[req.params.courseName];
    res.render('courses', {courseName: req.params.courseName, params, user: req.user});
  }
});

let port = process.env.PORT;
if (port == null || port == "") {
  port = 3000;
}
app.listen(port);