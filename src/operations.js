const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')
const BASE_URL = 'https://api.spotify.com/v1'

const convertToCSV = (objArray) => {
  const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray
  let str = ''
  let headerLine = ''
  if (array.length > 0) {
    headerLine = Object.keys(array[0]).join(',')
    str += headerLine + '\r\n'
  }
  for (let i = 0; i < array.length; i++) {
    let line = ''
    for (const index in array[i]) {
      if (line !== '') line += ','

      line += array[i][index]
    }
    str += line + '\r\n'
  }
  return str
}

/**
 * Joins multiple URL segments together into a single URL.
 *
 * @param {...string} args - The URL segments to be joined.
 * @return {string} - The joined URL.
 */
const urlJoin = (...args) => {
  return args
    .join('/')
    .replace(/[\\/]+/g, '/')
    .replace(/^(.+):\//, '$1://')
}

/**
 * Retrieves information about the user from the Spotify API.
 *
 * @param {string} accessToken - The access token for the user.
 * @return {Promise} A promise that resolves to the user information.
 */
const getSPUserInfo = (accessToken) => {
  return fetch(urlJoin(BASE_URL, 'me'), {
    method: 'GET',
    headers: {
      Authorization: 'Bearer ' + accessToken
    },
    json: true
  })
    .then((response) => response.json())
    .catch((error) => {
      console.log('Error(getSPUserInfo)', error)
    })
}

const getSPUserPlaylists = async (accessToken) => {
  let nextUrl = 'https://api.spotify.com/v1/me/playlists?limit=40&offset=0'
  const playlistitems = []
  while (nextUrl) {
    const rslt = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken
      },
      json: true
    })
      .then((response) => response.json())
      .catch((error) => {
        console.log(error)
      })
    nextUrl = rslt.next
    playlistitems.push(...rslt.items)
  }
  return playlistitems
}

const getSPUserPlaylistTracks = async (accessToken, playlistId) => {
  const trackItemps = []

  let nextUrl = 'https://api.spotify.com/v1/playlists/' + playlistId + '/tracks?limit=50&offset=0'

  while (nextUrl) {
    const rslt = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken
      },
      json: true
    })
      .then((response) => response.json())
      .catch((error) => {
        console.log(error)
      })
    nextUrl = rslt.next ?? null
    trackItemps.push(...rslt.items)
  }

  return trackItemps
}

const makeCSVTracks = async (tracks, playlistFoldName) => {
  const prcessedTracks = []
  tracks.forEach((track) => {
    const trackItem = {
      name: track.track.name,
      artists: track.track.artists.map((artist) => artist.name).join(', '),
      primary_color: track.primary_color,
      album_name: track.track.album.name,
      album_image: track.track.album.images[0]?.url,
      album_type: track.track.album.album_type,
      spotify_url: track.track.external_urls.spotify
    }
    prcessedTracks.push(trackItem)
  })
  const csv = convertToCSV(prcessedTracks)
  const csvPath = path.join(playlistFoldName, 'tracks.csv')
  fs.writeFileSync(csvPath, csv)
}

const getSPUserSavedTracks = async (accessToken) => {
  const tracks = []
  let nextUrl = 'https://api.spotify.com/v1/me/tracks?limit=50&offset=0'
  while (nextUrl) {
    const rslt = await fetch(nextUrl, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + accessToken
      },
      json: true
    })
      .then((response) => response.json())
      .catch((error) => {
        console.log(error)
      })
    nextUrl = rslt.next
    tracks.push(...rslt.items)
  }

  return tracks
}

module.exports = {
  getSPUserInfo,
  getSPUserPlaylists,
  getSPUserPlaylistTracks,
  makeCSVTracks,
  getSPUserSavedTracks,
  convertToCSV
}
