const multer = require('multer')
const upload = multer({ dest: 'tmp/' }) // 用參數設定使用者上傳的圖片會暫存到 tmp 這個臨時資料夾

module.exports = upload
