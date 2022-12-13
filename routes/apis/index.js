const express = require('express')
const router = express.Router()
const passport = require('../../config/passport')
const admin = require('./modules/admin')
const restController = require('../../controllers/apis/restaurant-controller')
const userController = require('../../controllers/apis/user-controller')
const { apiErrorHandler } = require('../../middleware/error-handler')
const {
  authenticated,
  authenticatedAdmin
} = require('../../middleware/api-auth')

module.exports = router
