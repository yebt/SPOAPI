// Imports ------------------------------------
const express = require('express')
const cors = require('cors')
const fetch = require('node-fetch')
const path = require('path')
const fs = require('fs')
const cookieParser = require('cookie-parser')
const querystring = require('querystring')
const crypto = require('crypto')
const session = require('express-session')
const { getSPUserInfo, getSPUserPlaylists, getSPUserPlaylistTracks, makeCSVTracks, getSPUserSavedTracks } = require('./operations')

// Enviroment ------------------------------------
require('dotenv').config()

// CONSTS ------------------------------------
const PORT = process.env.PORT || 3000
const CLIENT_ID = process.env.CLIENT_ID
const CLIENT_SECRET = process.env.CLIENT_SECRET
// const BASE_URL = 'https://api.spotify.com/v1'
const SCOPE = 'user-read-private user-read-email user-library-read'
const STATEKEY = 'spotify_auth_state'
const REDIRECT_URI = `http://localhost:${PORT}/callback`
const SESSION_SECRET = process.env.SESSION_SECRET || 'keyboard cat'
// Functions ------------------------------------
const generateRandomString = (length) => {
  return crypto.randomBytes(60).toString('hex').slice(0, length)
}
// Config ------------------------------------

const app = express()
app
  //   .use(express.static(path.join(__dirname, '/public')))
  .use(cors())
  .use(cookieParser())
  .use(
    session({
      secret: SESSION_SECRET, // Clave secreta para firmar el cookie de la sesión
      resave: false, // Evita que la sesión se guarde si no se modificó
      saveUninitialized: false, // No guarda sesiones no inicializadas
      cookie: { secure: false } // Setear en true si estás usando HTTPS
    })
  )

// Routes ------------------------------------

app.get('/', async (req, res) => {
  const resData = []
  if (req.query.error) {
    res.json({ ...req.query })
    return
  }
  if (!req.session || !req.session.data || !req.session.data.access_token) {
    res.redirect('/login')
    return
  }

  const accessToken = req.session.data.access_token

  // Get user info
  const userInfo = await getSPUserInfo(accessToken)
  if (!userInfo || userInfo.error) {
    res.json(userInfo)
    return
  }

  // create user music directory
  const userId = userInfo.id
  const userName = userInfo.display_name?.replace(/\s/g, '_')
  const userFoldName = `./music/${userName}_${userId}`
  if (!fs.existsSync(userFoldName)) {
    fs.mkdirSync(userFoldName, { recursive: true })
  }

  // get playlists from the user
  const userPlaylists = await getSPUserPlaylists(accessToken)
  const userPlaylistTracks = []
  userPlaylists.forEach(async (playlist) => {
    const playlistName = playlist.name
    const playlistId = playlist.id
    const playlistFoldName = `${userFoldName}/${playlistName}_${playlistId}`
    if (!fs.existsSync(playlistFoldName)) {
      fs.mkdirSync(playlistFoldName, { recursive: true })
    }
    // create infor file
    fs.writeFileSync(`${playlistFoldName}/info.json`, JSON.stringify(playlist, null, 2))

    userPlaylistTracks.push(
      new Promise((resolve) => {
        getSPUserPlaylistTracks(accessToken, playlistId)
          .then((tracksRslt) => {
            fs.writeFileSync(`${playlistFoldName}/tracks.json`, JSON.stringify(tracksRslt, null, 2))
            makeCSVTracks(tracksRslt, playlistFoldName)
            resolve()
          })
          .catch((error) => {
            console.log(error)
          })
      })
    )
  })

  // get user saved tracks
  const savedTracksPath = `${userFoldName}/_SAVED_TRACKS`
  if (!fs.existsSync(savedTracksPath)) {
    fs.mkdirSync(savedTracksPath, { recursive: true })
  }

  const savedTracks = await getSPUserSavedTracks(accessToken)
  fs.writeFileSync(`${savedTracksPath}/tracks.json`, JSON.stringify(savedTracks, null, 2))
  makeCSVTracks(savedTracks, savedTracksPath)
  // savedTracks.forEach((track) => {

  // })
  // fs.writeFileSync(`${savedTracksPath}/info.json`, JSON.stringify(savedTracks, null, 2))
  // makeCSVTracks(savedTracks, savedTracksPath)

  // await Promise.all(userPlaylistTracks)

  res.json({ resData, success: true })
})

// Login
app.get('/login', (req, res) => {
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

app.get('/callback', async (req, res) => {
  const code = req.query.code || null
  const state = req.query.state || null
  const storedState = req.cookies ? req.cookies[STATEKEY] : null

  // res.json({ code, state, storedState })
  if (state === null || state !== storedState) {
    res.redirect(
      '/#' +
        querystring.stringify({
          error: 'state_mismatch'
        })
    )
  } else {
    res.clearCookie(STATEKEY)

    const authResult = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
      },
      body: querystring.stringify({
        code,
        redirect_uri: REDIRECT_URI,
        grant_type: 'authorization_code'
      })
    })
      .then((response) => response.json())
      .catch((error) => {
        console.log(error)
      })

    if (!authResult || authResult.error) {
      res.redirect(
        '/#' +
          querystring.stringify({
            error: 'invalid_token'
          })
      )
      return
    }
    req.session.data = req.session.data ?? {}
    req.session.data.access_token = authResult.access_token
    req.session.data.refresh_token = authResult.refresh_token
    res.redirect('/')
  }
})

// Server start ---------------------------------------------------------------------
app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`)
  console.log(`>  http://localhost:${PORT}/`)
})
