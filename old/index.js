// ENVIRONMENT
// ---------------------------------------------------------------------
require('dotenv').config()

// DEPENDENCIES
// ---------------------------------------------------------------------
const express = require('express')
const cors = require('cors')
const fetch = require('node-fetch')
const path = require('path')
const request = require('request')
const crypto = require('crypto')
const querystring = require('querystring')
const cookieParser = require('cookie-parser')
const fs = require('fs')
const { getSPUserInfo } = require('./operations')

// CONSTS
// ---------------------------------------------------------------------
const PORT = process.env.PORT || 3000
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
// const BASE_URL = 'https://api.spotify.com/v1'
const SCOPE = 'user-read-private user-read-email'
const STATEKEY = 'spotify_auth_state'
const REDIRECT_URI = `http://localhost:${PORT}/callback`

// Functions
// ---------------------------------------------------------------------
const generateRandomString = (length) => {
  return crypto.randomBytes(60).toString('hex').slice(0, length)
}

// Server
// ---------------------------------------------------------------------
const app = express()

app
  .use(express.static(path.join(__dirname, '/public')))
  .use(cors())
  .use(cookieParser())

// ROUTES
// ---------------------------------------------------------------------

app.get('/', async (req, res) => {
  const resData = []
  if (!req.query || !req.query.access_token) {
    res.redirect('/login')
    return
  }
  // get user ifno
  const userInfo = getSPUserInfo(req.query.access_token)
  if (!userInfo || userInfo.error) {
    res.json(userInfo)
    return
  }

  // get playlist from the user

  res.json({ success: true, resData, baseurl: 'http://localhost:3000' })
})

app.get('/old', async (req, res) => {
  const resData = []
  if (!req.query || !req.query.access_token) {
    res.redirect('/login')
    return
  }

  // Get user info
  const resultUserInfo = await fetch('https://api.spotify.com/v1/me', {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + req.query.access_token
    },
    json: true
  })
    .then((response) => response.json())
    .catch((error) => {
      console.log(error)
    })

  if (resultUserInfo.error) {
    if (resultUserInfo.error.status === 401) {
      res.redirect('/login')
    } else {
      res.json(resultUserInfo.error)
    }
    return
  }

  const userId = resultUserInfo.id

  // check if /music/userid exists
  // if not create
  const userName = resultUserInfo.display_name?.replace(/\s/g, '_')
  const userFoldName = `./music/${userName}_${userId}`

  if (!fs.existsSync(userFoldName)) {
    fs.mkdirSync(userFoldName, { recursive: true })
  }

  let nextUrl = ''
  nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=40&offset=0'
  const resultPlaylists = []

  while (nextUrl) {
    // Get playlists
    const rslt = await fetch(
      nextUrl,
      // 'https://api.spotify.com/v1/me/playlists?limit=40&offset=0',
      {
        method: 'GET',
        headers: {
          Authorization: 'Bearer ' + req.query.access_token
        },
        json: true
      }
    )
      .then((response) => response.json())
      .catch((error) => {
        console.log(error)
      })

    nextUrl = rslt.next
    resultPlaylists.push(...rslt.items)
  }

  // process each playlist
  const paylistProcess = []
  resultPlaylists.forEach((playlist) => {
    paylistProcess.push(
      new Promise((resolve) => {
        const playlistName = playlist.name
        const playlistId = playlist.id
        const playlistFoldName = `${userFoldName}/${playlistName}_${playlistId}`
        if (!fs.existsSync(playlistFoldName)) {
          fs.mkdirSync(playlistFoldName, { recursive: true })
        }
        // create infor file
        fs.writeFileSync(`${playlistFoldName}/info.json`, JSON.stringify(playlist, null, 2))
        // playlist items
        const tracksURL = playlist.tracks.href
        fetch(tracksURL, {
          method: 'GET',
          headers: {
            Authorization: 'Bearer ' + req.query.access_token
          },
          json: true
        })
          .then((response) => response.json())
          .then((tracksRslt) => {
            console.log(tracksRslt)
          })
          // .then((tracksRslt) => {
          //   resData.push(resData)
          // })
          .catch((error) => {
            console.log(error)
          })
          .finally(() => {
            resolve()
          })
        // resolve()
      })
    )
  })

  await Promise.all(paylistProcess)

  res.json({ success: true, resData, baseurl: 'http://localhost:3000' })

  // // Get user info
  // const resultUserInfo = await fetch('https://api.spotify.com/v1/me', {
  //   method: 'GET',
  //   headers: {
  //     Authorization: 'Bearer ' + req.query.access_token
  //   },
  //   json: true
  // })
  //   .then((response) => response.json())
  //   .catch((error) => {
  //     console.log(error)
  //   })

  // if (resultUserInfo.error) {
  //   if (resultUserInfo.error.status === 401) {
  //     res.redirect('/login')
  //   } else {
  //     res.json(resultUserInfo.error)
  //   }
  //   return
  // }

  // const userId = resultUserInfo.id

  // // check if /music/userid exists
  // // if not create
  // const userName = resultUserInfo.display_name?.replace(/\s/g, '_')
  // const userFoldName = `./music/${userName}_${userId}`

  // if (!fs.existsSync(userFoldName)) {
  //   fs.mkdirSync(userFoldName, { recursive: true })
  // }

  // let nextUrl = ''
  // nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=40&offset=0'
  // const resultPlaylists = []

  // while (nextUrl) {
  //   // Get playlists
  //   const rslt = await fetch(
  //     nextUrl,
  //     // 'https://api.spotify.com/v1/me/playlists?limit=40&offset=0',
  //     {
  //       method: 'GET',
  //       headers: {
  //         Authorization: 'Bearer ' + req.query.access_token
  //       },
  //       json: true
  //     }
  //   )
  //     .then((response) => response.json())
  //     .catch((error) => {
  //       console.log(error)
  //     })

  //   nextUrl = rslt.next
  //   resultPlaylists.push(...rslt.items)
  // }

  // resultPlaylists.forEach((playlist) => {
  //   const playlistName = playlist.name
  //   const playlistId = playlist.id
  //   const playlistFoldName = `${userFoldName}/${playlistName}_${playlistId}`
  //   if (!fs.existsSync(playlistFoldName)) {
  //     fs.mkdirSync(playlistFoldName, { recursive: true })
  //   }
  //   // create infor file
  //   fs.writeFileSync(`${playlistFoldName}/info.json`, JSON.stringify(playlist, null, 2))
  //   // make csv file with tracks}
  //   const tracksURL = playlist.tracks.href
  //   const tracksRslt = fetch(tracksURL, {
  //     method: 'GET',
  //     headers: {
  //       Authorization: 'Bearer ' + req.query.access_token
  //     },
  //     json: true
  //   })
  //     .then((response) => response.json())
  //     .catch((error) => {
  //       console.log(error)
  //     })
  //   // fs.writeFileSync(`${playlistFoldName}/tracks.json`, tracksRslt)
  // })

  // res.json({
  //   success: true,
  //   pl: resultPlaylists.length,
  //   resultPlaylists,
  //   ...req.query,
  //   root: 'http://localhost:3000'
  // })
})

app.get('/login', function (req, res) {
  const state = generateRandomString(16)
  res.cookie(STATEKEY, state)
  // your application requests authorization
  res.redirect(
    'https://accounts.spotify.com/authorize?' +
      querystring.stringify({
        response_type: 'code',
        client_id: CLIENT_ID,
        scope: SCOPE,
        redirect_uri: REDIRECT_URI,
        state
      })
  )
})

app.get('/callback', function (req, res) {
  // your application requests refresh and access tokens
  // after checking the state parameter

  const code = req.query.code || null
  const state = req.query.state || null
  const storedState = req.cookies ? req.cookies[STATEKEY] : null

  if (state === null || state !== storedState) {
    res.redirect(
      '/#' +
        querystring.stringify({
          error: 'state_mismatch'
        })
    )
  } else {
    res.clearCookie(STATEKEY)
    const authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      },
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        Authorization:
          'Basic ' +
          new Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
      },
      json: true
    }

    request.post(authOptions, function (error, response, body) {
      if (!error && response.statusCode === 200) {
        const accessToken = body.access_token
        const refreshToken = body.refresh_token

        // const options = {
        //   url: 'https://api.spotify.com/v1/me',
        //   headers: { Authorization: 'Bearer ' + accessToken },
        //   json: true
        // }

        // // use the access token to access the Spotify Web API
        // request.get(options, function (error, response, body) {
        //   console.log('ERROR:\n', error)
        //   console.log('RESPONSE:\n', error)
        //   console.log(body)
        //   res.json(body)
        // })

        // we can also pass the token to the browser to make requests from there
        res.redirect(
          '/?' +
            querystring.stringify({
              access_token: accessToken,
              refresh_token: refreshToken
            })
        )
      } else {
        res.redirect(
          '/#' +
            querystring.stringify({
              error: 'invalid_token'
            })
        )
      }
    })
  }
})

app.get('/refresh_token', function (req, res) {
  const refreshToken = req.query.refresh_token
  const authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      Authorization:
        'Basic ' +
        new Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64')
    },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    },
    json: true
  }

  request.post(authOptions, function (error, response, body) {
    if (!error && response.statusCode === 200) {
      const accessToken = body.access_token
      const refreshToken = body.refresh_token
      res.send({
        access_token: accessToken,
        refresh_token: refreshToken
      })
    }
  })
})

// Server server
// ---------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
  console.log(`http://localhost:${PORT}/`)
})
