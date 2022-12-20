const jwt = require('jsonwebtoken')
const { User, Tweet, Followship } = require('../models')
const bcrypt = require('bcryptjs')
const helpers = require('../_helpers')

const userServices = {
  signUp: (req, cb) => {
    if (req.body.password !== req.body.checkPassword) {
      throw new Error('密碼不一致 !')
    }

    const { account, name, email, password } = req.body

    if (name.length > 50) throw new Error('字數超出上限！')

    return Promise.all([
      User.findOne({ where: { account }, raw: true }),
      User.findOne({ where: { email }, raw: true })
    ])
      .then(([userAccount, userEmail]) => {
        // account 和 email 都未重複，建立資料
        if (!userAccount && !userEmail) {
          return User.create({
            account,
            name,
            email,
            password: bcrypt.hashSync(password, 10)
          })
        }

        // account 或是 email 未重複
        if (!userAccount || !userEmail) {
          //  account 重複
          if (!userEmail) throw new Error('account 已重複註冊！')
          //  email 重複
          if (!userAccount) {
            throw new Error('email 已重複註冊！')
          }
        }
        // 重複 account
        if (userAccount.account === account) {
          throw new Error('account 已重複註冊！')
        }
        // 重複 email
        if (userEmail.email === email) throw new Error('email 已重複註冊！')
      })

      .then(() => cb(null, { success: 'true' }))
      .catch((err) => cb(err))
  }
}

const userController = {
  signUp: (req, res, next) => {
    userServices.signUp(req, (err, data) => (err ? next(err) : res.json(data)))
  },
  signIn: (req, res, next) => {
    const { account, password } = req.body
    if (!account || !password) {
      throw new Error('account and password are required.')
    }

    User.findOne({ where: { account, role: 'user' }, raw: true })
      .then((user) => {
        if (!user) {
          throw new Error('帳號不存在！')
        }
        const isValidPassword = bcrypt.compareSync(password, user.password)

        if (!isValidPassword) {
          throw new Error('帳號不存在！')
        }

        const UserId = { id: user.id }
        const token = jwt.sign(UserId, process.env.JWT_SECRET, {
          expiresIn: '30d'
        })

        delete user.password
        return res.status(200).json({ success: true, token, user })
      })
      .catch((err) => next(err))
  },
  getUser: (req, res, next) => {
    const { id } = req.params
    User.findByPk(id, {
      include: [
        Tweet,
        { model: User, as: 'Followings' },
        { model: User, as: 'Followers' }
      ]
    })
      .then((user) => {
        if (!user) throw new Error('使用者不存在 !')

        // 使用者推文數
        const tweetCount = user.Tweets.length
        // 使用者追蹤數
        const followingCount = user.Followings.length
        // 使用者被追蹤數
        const followerCount = user.Followers.length
        // 登入者與個別使用者追蹤關係
        const isFollowed = req.user.Followings.some((f) => f.id === user.id)

        user = user.toJSON()
        // 刪除非必要屬性
        delete user.Tweets
        delete user.Followings
        delete user.Followers
        delete user.password
        // 新增屬性
        user.tweetCount = tweetCount
        user.followingCount = followingCount
        user.followerCount = followerCount
        user.isFollowed = isFollowed

        return res.status(200).send(user)
      })
      .catch((err) => next(err))
  },
  putUser: (req, res, next) => {
    const { account, name, email, introduction } = req.body
    const { id } = req.params
    const { files } = req
    // 設定 avatar 和 cover 暫存變數
    let avatarFile
    let coverFile
    // 未上傳檔案 (上傳檔案為空的情況下)
    if (!files) {
      avatarFile = [{ path: '' }]
      coverFile = [{ path: '' }]
    }
    // 上傳檔案
    if (files) {
      avatarFile = files.avatar
      coverFile = files.cover
      // 都未上傳檔案
      if (!avatarFile && !coverFile) {
        avatarFile = [{ path: '' }]
        coverFile = [{ path: '' }]
      }

      // 只上傳其中一個檔案
      if (!avatarFile || !coverFile) {
        // 未上傳 avatar，上傳 cover
        if (!avatarFile) {
          avatarFile = [{ path: '' }]
          coverFile = req.files.cover
        }
        // 未上傳 cover，上傳 avatar
        if (!coverFile) {
          coverFile = [{ path: '' }]
          avatarFile = req.files.avatar
        }
      }
    }

    return Promise.all([User.findByPk(id), avatarFile, coverFile])
      .then(([user, avatarFile, coverFile]) => {
        if (!user) throw new Error('使用者不存在!')

        return user.update({
          account,
          name,
          email,
          introduction,
          avatar: avatarFile[0].path || user.avatar,
          cover: coverFile[0].path || user.cover
        })
      })
      .then((updateUser) => res.status(200).send(updateUser))
      .catch((err) => next(err))
  },
  getFollowing: (req, res, next) => {
    const { id } = req.params
    const user = helpers.getUser(req)
    return Promise.all([
      User.findByPk(id, {
        include: [
          { model: User, as: 'Followers' },
          { model: User, as: 'Followings' }
        ]
      }),
      Followship.findAll({ where: { followerId: id }, raw: true })
    ])
      .then(([trackData, followingList]) => {
        // 儲存登入者的追蹤者 id
        let checkBox = []
        // 登入者的追蹤者 id
        user.Followings.forEach((f) => {
          checkBox.push(f.id)
        })

        // 儲存追蹤者清單屬性
        let followingsbox = []

        trackData.Followings.forEach((l) => {
          let temp = {}
          let data = {}
          data.id = l.id
          data.name = l.name
          data.avatar = l.avatar
          data.introduction = l.introduction
          temp.result = data
          followingsbox.push(temp)
        })
        followingList.forEach((list, index) => {
          //將 followingId 改成 id
          list.id = list.followingId
          // 新增 isFollowed, name, introduction, avatar 屬性
          list.name = followingsbox[index].result.name
          list.avatar = followingsbox[index].result.avatar
          list.introduction = followingsbox[index].result.introduction
          list.isFollowed = checkBox.includes(list.followingId)
          // 刪除 followerId 以及 舊的 followingId key
          delete list.followerId
          delete list.followingId
        })

        res.status(200).send(followingList)
      })
      .catch((err) => next(err))
  },
  getFollower: (req, res, next) => {
    const { id } = req.params
    const user = helpers.getUser(req)
    return Promise.all([
      User.findByPk(id, {
        include: [
          { model: User, as: 'Followings' },
          { model: User, as: 'Followers' }
        ]
      }),
      Followship.findAll({ where: { followingId: id }, raw: true })
    ])
      .then(([trackData, followerList]) => {
        // 儲存登入者的追蹤者 id
        let checkBox = []
        // 登入者的追蹤者 id
        user.Followings.forEach((f) => {
          checkBox.push(f.id)
        })

        // 儲存追隨者清單屬性
        let followersbox = []

        trackData.Followers.forEach((l) => {
          let temp = {}
          let data = {}
          data.id = l.id
          data.name = l.name
          data.avatar = l.avatar
          data.introduction = l.introduction
          temp.result = data
          followersbox.push(temp)
        })
        followerList.forEach((list, index) => {
          //將 followerId 改成 id
          list.id = list.followerId
          // 新增 isFollowed, name, introduction, avatar 屬性
          list.name = followersbox[index].result.name
          list.avatar = followersbox[index].result.avatar
          list.introduction = followersbox[index].result.introduction
          list.isFollowed = checkBox.includes(list.followerId)
          // 刪除 followingId 以及 舊的 followerId key
          delete list.followerId
          delete list.followingId
        })
        res.status(200).send(followerList)
      })
      .catch((err) => next(err))
  },
  getTopUsers: (req, res, next) => {
    User.findAll({
      include: [{ model: User, as: 'Followers' }]
    })
      .then((users) => {
        const result = users
          .map((user) => ({
            ...user.toJSON(),
            followerCount: user.Followers.length,
            isFollowed: req.user.Followings.some((f) => f.id === user.id) // 登入者是否追隨名單中的使用者
          }))
          .sort((a, b) => b.followerCount - a.followerCount)
        const finalResult = result.slice(0, 9) // 取前10名
        res.status(200).send(finalResult)
      })
      .catch((err) => next(err))
  }
}

module.exports = userController
