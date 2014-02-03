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

  it('emits twitter errors', function (done) {
    twitter.on('error', function (error) {
      assert(error)
      assert(error.message.match(/401/)) // Bad twitter oauth credentials
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
    })

    it('emits tweets', function (done) {
      twitter.on('tweet', function (tweet) {
        assert.equal(tweet.text, 'Taco')
        done()
      })

      assert(!twitter.stream)
      twitter.track('tacos')
      assert.deepEqual(twitter.tracking, ['tacos'])
    })

    it('avoids dups', function () {
      assert(!twitter.stream)
      twitter.track('tacos')
      twitter.track('tacos')
      twitter.track('tacos')
      assert.deepEqual(twitter.tracking, ['tacos'])
    })

    it('closes connection if tracking is empty', function (done) {
      twitter.abort = function () {
        assert.deepEqual(twitter.tracking, [])
        done()
      }

      assert(!twitter.stream)
      twitter.track('tacos')
      assert.deepEqual(twitter.tracking, ['tacos'])
      twitter.untrack('tacos')
    })
  })
})
