const express = require('express');
const { check, body } = require('express-validator')
const User = require('../models/user');

const authController = require('../controllers/auth');

const router = express.Router();

router.get('/login', authController.getLogin);

router.get('/signup', authController.getSignup);

router.post('/login', check('email')
    .isEmail()
    .withMessage('this email is invalid')
    .normalizeEmail(),
    body('password', 'Password has to be valid.')
        .isLength({ min: 5 })
        .isAlphanumeric()
        .trim()
    , authController.postLogin);

router.post('/signup', check('email')
    .isEmail()
    .withMessage('this email is invalid')
    .normalizeEmail()
    .custom((value, { req }) => {
        return User.findOne({ email: value })
            .then(userDoc => {
                if (userDoc) {
                    return Promise.reject('Email already Exists.')
                }
            })
    }),
    body('password', 'the password should be more than 5 characters and no special cahracters')
        .isLength({ min: 5 })
        .isAlphanumeric()
        .trim(),
    body('confirmPassword')
        .trim()
        .custom((value, { req }) => {
            if (value !== req.body.password) {
                throw new Error('Passwords have to match');
            }
            return true
        })
    , authController.postSignup)

router.post('/logout', authController.postLogout);

router.get('/reset', authController.getReset);

router.post('/reset', authController.postReset);

router.get('/reset/:token', authController.getNewPassword);

router.post('/new-password',
    body('Password', 'the password should be more than 5 characters and no special cahracters')
        .isLength({ min: 5 })
        .isAlphanumeric()
        .trim(),
    body('Conf-Password')
        .trim()
        .custom((value, { req }) => {
            if (value !== req.body.Password) {
                throw new Error('Passwords have to match');
            }
            return true
        })
    , authController.postNewPassword);

module.exports = router;