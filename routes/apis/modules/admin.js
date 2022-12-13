const express = require('express')
const router = express.Router()

const adminController = require('../../../controllers/apis/admin-controller')
const upload = require('../../../middleware/multer')

module.exports = router
