var assert = require('assert')
  , Twitter = require('../')
  , http = require('http')
  , fs = require('fs')

describe('reconnects on network hiccups', function () {
  var twitter
    , server

  beforeEach(function () {

    twitter = new Twitter({
      consumer_key: 'key',
      consumer_secret: 'secret',
      token: 'token',
      token_secret: 'tokenSecret'
    })

    server = http.createServer(function (req, res) {
      res.writeHead(200, {'Content-Type': 'stuff'})
      res._send('') // flush the response headers

      var writes = 0
      var keepAlive = setInterval(function () {
        if (writes++ == 2) {
          clearInterval(keepAlive)
          return res.end()
        }
        res.write('\r\n')
      }, 100)

      setTimeout(function () {
        fs.createReadStream(__dirname + '/mocks/tacos.json').pipe(res, {end: false})
      }, 200)

    }).listen(3000)

    twitter.timeoutInterval = 2000
    twitter.twitterUrl = 'http://localhost:3000'
  })

  afterEach(function (done) {
    server.close(done)
  })

  it('reconnects on stale and keeps emitting tweets', function (done) {
    this.timeout(10000)
    var reconnect = false
      , tweets = []
    twitter.on('error', function (e) {
      console.log('error!', e)
    })
    twitter.on('reconnect', function (obj) {
      reconnect = true
      console.log('reconnect', obj)
    })
    twitter.on('tweet', function (tweet) {
      tweets.push(tweet)
      console.log('tweet', tweet)
    })
    twitter.track('tacos')
  })
})
