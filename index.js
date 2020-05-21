// 引用 linebot 套件
import linebot from 'linebot'
// 引用 dotenv 套件
import dotenv from 'dotenv'
// 引用 request 套件
import rp from 'request-promise'
// 引用 youtube 搜尋套件
import search from 'youtube-search'
// 引用 schedule 套件
import schedule from 'node-schedule'

// 讀取 env 檔
dotenv.config()

const bot = linebot({
  channelId: process.env.CHANNEL_ID,
  channelSecret: process.env.CHANNEL_SECRET,
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN
})

const optionToken = {
  method: 'POST',
  uri: 'https://account.kkbox.com/oauth2/token',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  form: {
    grant_type: 'client_credentials',
    client_id: process.env.KKBOX_ID,
    client_secret: process.env.KKBOX_SECRET
  },
  json: true
}
let token = ''

const getToken = async () => {
  try {
    const response = await rp(optionToken)
    token = response.access_token
  } catch (error) {
    console.log(error.message)
  }
}
getToken()
// 時間差問題，console.log(token) 要等一下

// 每天凌晨執行獲取 KKBOX 的 access token
schedule.scheduleJob('* * 0 * * *', async () => {
  try {
    const response = await rp(optionToken)
    token = response.access_token
  } catch (error) {
    console.log(error.message)
  }
})

const opts = {
  maxResults: 1,
  key: process.env.API_Key
}

bot.on('message', async function (event) {
  // -------------------------------------------------------------------------------------------
  class Leaderboard {
    constructor () {
      this.ary = []
      this.want = [0, 1, 2, 3, 4, 5, 6, 25, 26]
      this.option = {
        uri: 'https://api.kkbox.com/v1.1/charts',
        qs: {
          territory: 'TW'
        },
        auth: {
          bearer: token
        },
        json: true
      }
    }

    async info () {
      try {
        const response = await rp(this.option)
        for (const i of this.want) {
          this.ary.push(
            {
              thumbnailImageUrl: response.data[i].images[0].url,
              title: response.data[i].title,
              text: response.data[i].description,
              actions: [{
                type: 'postback',
                label: '看看歌單',
                data: response.data[i].id
              }, {
                type: 'uri',
                label: 'KKbox官網',
                uri: response.data[i].url
              }]
            }
          )
        }
      } catch (error) {
        console.log(error.message)
      }
      event.reply({
        type: 'template',
        altText: 'this is a carousel template',
        template: {
          type: 'carousel',
          columns: this.ary
        }
      })
    }
  }
  // -------------------------------------------------------------------------------------------
  class Search {
    constructor (searchtype) {
      this.ary = []
      this.artistid = ''
      this.artisttracksary = []
      this.option = {
        uri: 'https://api.kkbox.com/v1.1/search',
        qs: {
          q: event.message.text.substr(1),
          territory: 'TW',
          limit: 10,
          type: searchtype
        },
        auth: {
          bearer: token
        },
        json: true
      }
      this.artoption = {
        uri: 'https://api.kkbox.com/v1.1/artists/' + this.artistid + '/top-tracks',
        qs: {
          q: event.message.text.substr(1),
          territory: 'TW',
          limit: 10
        },
        auth: {
          bearer: token
        },
        json: true
      }
    }

    async trackinfo () {
      try {
        const response = await rp(this.option)
        for (const i of response.tracks.data) {
          const art = this.ary.map(num => {
            return num.text
          })
          if (!art.includes(i.album.artist.name) && art.length < 11) {
            this.ary.push(
              {
                thumbnailImageUrl: i.album.images[0].url,
                title: i.name,
                text: i.album.artist.name,
                actions: [{
                  type: 'postback',
                  label: '立即試聽',
                  data: i.name + ',' + i.album.artist.name
                }, {
                  type: 'uri',
                  label: '看看歌詞',
                  uri: i.url
                }]
              }
            )
          }
        }
      } catch (error) {
        console.log(error.message)
      }
      event.reply({
        type: 'template',
        altText: 'this is a carousel template',
        template: {
          type: 'carousel',
          columns: this.ary
        }
      })
    }

    async artistinfo () {
      try {
        const response = await rp(this.option)
        this.artoption.uri = 'https://api.kkbox.com/v1.1/artists/' + response.artists.data[0].id + '/top-tracks'
        const artisttracks = await rp(this.artoption)
        for (const i of artisttracks.data) {
          this.artisttracksary.push(
            {
              thumbnailImageUrl: i.album.images[0].url,
              title: i.name,
              text: i.album.name,
              actions: [{
                type: 'postback',
                label: '立即試聽',
                data: i.name + ',' + i.album.artist.name
              }, {
                type: 'uri',
                label: '看看歌詞',
                uri: i.url
              }]
            }
          )
        }
      } catch (error) {
        console.log(error.message)
      }
      event.reply({
        type: 'template',
        altText: 'this is a carousel template',
        template: {
          type: 'carousel',
          columns: this.artisttracksary
        }
      })
    }
  }
  // -------------------------------------------------------------------------------------------
  if (event.message.text.toLowerCase() === 'rank') {
    const top = new Leaderboard()
    top.info()
  } else if (event.message.text.includes('!')) {
    const seartrack = new Search('track')
    seartrack.trackinfo()
  } else if (event.message.text.includes('@')) {
    const searchartist = new Search('artist')
    searchartist.artistinfo()
    // console.log(searchartist)
  } else {
    // event.reply('請輸入以下指令\n 我很好 ★')
    event.reply('請輸入以下指令\n ★ rank：搜尋各大榜單\n ★ !歌曲名稱：搜尋歌曲\n ★ @歌手：搜尋歌手TOP歌曲')
  }
})

bot.on('postback', async (event) => {
  class LeaderboardTrack {
    constructor (id) {
      this.id = id
      this.ary = []
      this.option = {
        uri: 'https://api.kkbox.com/v1.1/charts/chart_id/tracks',
        qs: {
          territory: 'TW',
          limit: 10
        },
        auth: {
          bearer: token
        },
        json: true
      }
    }

    async info () {
      try {
        this.option.uri = 'https://api.kkbox.com/v1.1/charts/' + this.id + '/tracks'
        const response = await rp(this.option)
        for (const i of response.data) {
          this.ary.push(
            {
              thumbnailImageUrl: i.album.images[0].url,
              title: i.name,
              text: i.album.artist.name,
              actions: [{
                type: 'postback',
                label: '立即試聽',
                data: i.name + ',' + i.album.artist.name
              }, {
                type: 'uri',
                label: '看看歌詞',
                uri: i.url
              }]
            }
          )
        }
      } catch (error) {
        console.log(error.message)
      }
      event.reply({
        type: 'template',
        altText: 'this is a carousel template',
        template: {
          type: 'carousel',
          columns: this.ary
        }
      })
    }
  }
  const youtubeData = event.postback.data.split(',')
  if (youtubeData.length === 2) {
    const youtube = await search(youtubeData[1] + youtubeData[0], opts)
    event.reply(youtube.results[0].link)
  } else {
    const getTracks = new LeaderboardTrack(event.postback.data)
    getTracks.info()
  }
})

// https://www.postman.com/collections/5cd6236e9e9748fd1ed1

// 在 port 啟動
bot.listen('/', process.env.PORT, () => {
  console.log('機器人已啟動')
})
