const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { validationResult } = require('express-validator');
const ip = require('ip');//for development purpose only..

var mailer = require("nodemailer");

// Use Smtp Protocol to send Email
var smtpTransport = mailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

const User = require('../models/user');
const { use } = require('../routes/auth');

exports.getLogin = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0]
  }
  else {
    message = null;
  }
  res.render('auth/login', {
    path: '/login',
    pageTitle: 'Login',
    isAuthenticated: false,
    errorMessage: message,
    oldInput: { email: '', password: '', confirmPassword: '' },

  });
};

exports.getSignup = (req, res, next) => {
  let message = req.flash('error');
  if (message.length > 0) {
    message = message[0];
  }
  else {
    message = null;
  }
  res.render('auth/signup', {
    path: '/signup',
    pageTitle: 'Signup',
    isAuthenticated: false,
    errorMessage: message,
    oldInput: { email: '', password: '', confirmPassword: '' },
    validationError: []

  });
};

exports.postLogin = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const error = validationResult(req);
  let errorMessage = error.array();
  if (!error.isEmpty()) {
    return res.status(422).render('auth/login', {
      path: '/login',
      pageTitle: 'Login',
      isAuthenticated: false,
      errorMessage: errorMessage[0].msg,
      oldInput: { email: email, password: password },
      validationError: errorMessage
    })
  }

  User.findOne({ email: email })
    .then(user => {
      if (!user) {
        return res.status(422).render('auth/login', {
          path: '/login',
          pageTitle: 'Login',
          isAuthenticated: false,
          errorMessage: 'Invalid email or Password',
          oldInput: { email: email, password: password },
          validationError: errorMessage
        })
      }
      bcrypt.compare(password, user.password)
        .then(doMatch => {
          if (doMatch) {
            req.session.isLoggedIn = true;
            req.session.user = user;

            return req.session.save(err => {
              res.redirect('/');
            });
          }
          return res.status(422).render('auth/login', {
            path: '/login',
            pageTitle: 'Login',
            isAuthenticated: false,
            errorMessage: 'Invalid email or Password',
            oldInput: { email: email, password: password },
            validationError: errorMessage
          })
        })
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);

    });
};

exports.postSignup = (req, res, next) => {
  const email = req.body.email;
  const password = req.body.password;
  const confirmPassword = req.body.confirmPassword;
  const error = validationResult(req);
  if (!error.isEmpty()) {
    let errorMessage = error.array();
    return res.status(422).render('auth/signup', {
      path: '/signup',
      pageTitle: 'Signup',
      isAuthenticated: false,
      errorMessage: errorMessage[0].msg,
      oldInput: { email: email, password: password, confirmPassword: confirmPassword },
      validationError: errorMessage
    })
  }


  bcrypt
    .hash(password, 12)
    .then(hashPassword => {
      const user = new User({
        email: email,
        password: hashPassword,
        cart: { items: [] }
      });
      return user.save();
    })
    .then(result => {
      return res.redirect('/login');
    })

};

exports.postLogout = (req, res, next) => {
  req.session.destroy(err => {
    res.redirect('/');
  });
};

exports.getReset = (req, res, next) => {
  let message = req.flash('error');
  let successfulMessage = req.flash('successful');
  if (message.length > 0) {
    message = message[0];
    successfulMessage = null;

  }
  else {
    message = null;
    if (successfulMessage.length > 0) {
      successfulMessage = successfulMessage[0];
    }
    else {
      successfulMessage = null;
    }
  }

  res.render('auth/reset', {
    path: '/reset',
    pageTitle: 'reset password',
    isAuthenticated: false,
    errorMessage: message,
    linkSentMessage: successfulMessage
  });
}

exports.postReset = (req, res, next) => {
  crypto.randomBytes(32, (err, buffer) => {
    if (err) {
      console.log(err);
      return res.redirect('/reset');
    }
    const token = buffer.toString('hex');
    User.findOne({ email: req.body.email })
      .then(user => {
        if (!user) {
          req.flash('error', 'No account found with that email');
          return res.redirect('/reset')
        }
        user.resetToken = token;
        user.resetTokenExpiration = Date.now() + 360000;
        return user.save();
      })
      .then(result => {
        if (result) {
          var mail = {
            from: process.env.EMAIL_FROM,
            to: req.body.email,
            subject: "for reset password",
            text: "reset password",
            html: `
            <p> Your request for password change </p>
            <p> click this link <a href="${process.env.DOMAIN}/reset/${token}"> to update password </a></p>  `
          }
          smtpTransport.sendMail(mail, function (error, response) {
            if (error) {
              const error = new Error(err);
              error.httpStatusCode = 500;
              return next(error);
            }
            smtpTransport.close();
            req.flash('successful', 'The link for reset the password has been sent to your email address.');
            return res.redirect('/reset');
          })
        }
      })
  })
}

exports.getNewPassword = (req, res, next) => {
  const token = req.params.token;
  User.findOne({ resetToken: token, resetTokenExpiration: { $gt: Date.now() } })
    .then(user => {
      let message = req.flash('error');
      if (message.length > 0) {
        message = message[0];
      } else {
        message = null;
      }
      res.render('auth/new-password', {
        path: '/new-password',
        pageTitle: 'New Password',
        errorMessage: message,
        isAuthenticated: false,
        passwordToken: token,
        userId: user._id.toString()
      });
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);

    });
}

exports.postNewPassword = (req, res, next) => {
  const newPassword = req.body.Password;
  const passwordToken = req.body.passwordToken;
  const userId = req.body.userId;
  let resetUser;

  User.findOne({
    resetToken: passwordToken,
    resetTokenExpiration: { $gt: Date.now() },
    _id: userId
  })
    .then(user => {
      const error = validationResult(req);
      if (!error.isEmpty()) {
        let errorMessage = error.array();
        return res.render('auth/new-password', {
          path: '/new-password',
          pageTitle: 'New Password',
          errorMessage: errorMessage[0].msg,
          isAuthenticated: false,
          passwordToken: passwordToken,
          userId: userId
        });
      }
      resetUser = user;
      return bcrypt.hash(newPassword, 12)
    })
    .then(hashPassword => {
      resetUser.password = hashPassword;
      resetUser.resetToken = undefined;
      resetUser.resetTokenExpiration = undefined;
      return resetUser.save();
    })
    .then(result => {
      res.redirect('/login');
    })
    .catch(err => {
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);

    });
}



