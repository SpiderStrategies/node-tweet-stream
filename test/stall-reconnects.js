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
      }, 10)

      setTimeout(function () {
        fs.createReadStream(__dirname + '/mocks/tacos.json').pipe(res, {end: false})
      }, 20)

    }).listen(3000)

    twitter.timeoutInterval = 50
    twitter.twitterUrl = 'http://localhost:3000'
  })

  afterEach(function (done) {
    server.close(done)
  })

  it('reconnects on stale and keeps emitting tweets', function (done) {
    var reconnects = 0
      , tweets = []
      , errors = []

    twitter.on('error', function (e) {
      errors.push(e)
    })

    twitter.on('reconnect', function (obj) {
      if (++reconnects === 3) {
        assert.equal(tweets.length, 3)
        assert.equal(errors.length, 0)
        done()
      }
    })

    twitter.on('tweet', function (tweet) {
      tweets.push(tweet)
    })
    twitter.track('tacos')
  })
})
