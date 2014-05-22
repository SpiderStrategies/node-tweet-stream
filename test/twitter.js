var assert = require('assert')
  , Twitter = require('../')
  , nock = require('nock')

describe('twitter', function () {
  var twitter

  beforeEach(function () {
    twitter = new Twitter({
      consumer_key: 'key',
      consumer_secret: 'secret',
      token: 'token',
      token_secret: 'tokenSecret'
    })
  })

  it('fails if creds not received', function () {
    assert.throws(function () { new Twitter({}) }, Error)
  })

  it('emits reconnect', function (done) {
    twitter.on('reconnect', function (obj) {
      assert(obj)
      assert(obj.err.message)
      assert(obj.err.message.match(/401/)) // Bad twitter oauth credentials
      done()
    })
    twitter.track('tacos')
  })

  describe('tracking', function () {
    beforeEach(function () {
      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: 'tacos'
                  })
                  .replyWithFile(200, __dirname + '/tacos.json')

      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    // track: 'tacos%2Ctortas'
                    track: 'tacos,tortas'
                  })
                  .replyWithFile(200, __dirname + '/tacos.json')
    })

    it('prevents a reconnect', function () {
      var called = false
      twitter.reconnect = function () {
        called = true
      }
      twitter.track('tacos', false)
      assert.deepEqual(twitter.tracking(), ['tacos'])
      assert(!called)
    })

    it('emits tweets', function (done) {
      twitter.on('tweet', function (tweet) {
        assert.equal(tweet.text, 'Taco')
        done()
      })

      assert(!twitter.stream)
      twitter.track('tacos')
      assert.deepEqual(twitter.tracking(), ['tacos'])
    })

    it('tracks dups of same keyword', function () {
      assert(!twitter.stream)
      twitter.track('tacos')
      twitter.track('tacos')
      twitter.track('tortas')
      assert.equal(twitter._tracking.tacos, 2)
      assert.equal(twitter._tracking.tortas, 1)
      assert.deepEqual(twitter.tracking(), ['tacos', 'tortas'])
      twitter.untrack('tacos')
      assert.equal(twitter._tracking.tacos, 1)
      assert.deepEqual(twitter.tracking(), ['tacos', 'tortas'])
      twitter.track('tacos')
      assert.equal(twitter._tracking.tacos, 2)
      assert.deepEqual(twitter.tracking(), ['tacos', 'tortas'])
    })

    it('avoids dups in tracking stream', function () {
      var called = 0
      twitter.reconnect = function () {
        called++
      }

      assert(!twitter.stream)
      twitter.track('tacos')
      twitter.track('tacos')
      twitter.track('tacos')
      assert.deepEqual(twitter.tracking(), ['tacos'])
      assert(called, 3)
    })

    it('closes connection if tracking is empty', function (done) {
      twitter.abort = function () {
        assert.deepEqual(twitter.tracking(), [])
        done()
      }

      assert(!twitter.stream)
      twitter.track('tacos')
      assert.deepEqual(twitter.tracking(), ['tacos'])
      twitter.untrack('tacos')
    })

  })
})
