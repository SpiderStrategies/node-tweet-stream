var assert = require('assert')
  , Twitter = require('../')
  , nock = require('nock')
  , Readable = require('stream').Readable

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
                    track: 'tacos',
                    locations: '',
                    follow: '',
                    language: ''
                  })
                  .replyWithFile(200, __dirname + '/mocks/tacos.json')

      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: 'tacos,tortas',
                    locations: '',
                    follow: '',
                    language: ''
                  })
                  .replyWithFile(200, __dirname + '/mocks/tacos.json')
    })

    it('emits connect', function (done) {
      twitter.on('connect', function () {
        done()
      })
      twitter.track('tacos')
    })

    it('handles chunks', function (done) {
      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: 'chunks',
                    locations: '',
                    follow: '',
                    language: ''
                  })
                  .reply(200, function (uri, body) {
                    var rs = new Readable
                      , calls = 0
                    rs._read = function () {
                      if (++calls === 1) {
                        rs.push('{"text":')
                      } else {
                        rs.push('"taco"}\r\n')
                        rs.push(null)
                      }
                    }
                    return rs
                  })

      twitter.on('tweet', function (tweet) {
        done()
      })
      twitter.track('chunks')
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
      assert.equal(twitter._filters.tracking.tacos, 2)
      assert.equal(twitter._filters.tracking.tortas, 1)
      assert.deepEqual(twitter.tracking(), ['tacos', 'tortas'])
      twitter.untrack('tacos')
      assert.equal(twitter._filters.tracking.tacos, 1)
      assert.deepEqual(twitter.tracking(), ['tacos', 'tortas'])
      twitter.track('tacos')
      assert.equal(twitter._filters.tracking.tacos, 2)
      assert.deepEqual(twitter.tracking(), ['tacos', 'tortas'])
    })

    it('can start tracking multiple words at once', function () {
      assert(!twitter.stream)
      twitter.trackMultiple(['tacos', 'tortas'])
      assert.equal(twitter._filters.tracking.tacos, 1)
      assert.equal(twitter._filters.tracking.tortas, 1)
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
      assert.equal(called, 1)
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

  describe('Location filters', function () {
      beforeEach(function () {
        nock('https://stream.twitter.com')
                    .post('/1.1/statuses/filter.json', {
                      track: '',
                      locations: '123,123',
                      follow: '',
                      language: ''
                    })
                    .replyWithFile(200, __dirname + '/mocks/tacos.json')

        nock('https://stream.twitter.com')
                    .post('/1.1/statuses/filter.json', {
                      track: '',
                      locations: '123,123,321,321',
                      follow: '',
                      language: ''
                    })
                    .replyWithFile(200, __dirname + '/mocks/tacos.json')
      })



    it('tracks dups of same location', function () {
      assert(!twitter.stream)
      twitter.location('123,123')
      twitter.location('123,123')
      twitter.location('321,321')
      assert.equal(twitter._filters.location['123,123'], 2)
      assert.equal(twitter._filters.location['321,321'], 1)
      assert.deepEqual(twitter.locations(), ['123,123', '321,321'])
      twitter.unlocate('123,123')
      assert.equal(twitter._filters.location['123,123'], 1)
      assert.deepEqual(twitter.locations(), ['123,123', '321,321'])
      twitter.location('123,123')
      assert.equal(twitter._filters.location['123,123'], 2)
      assert.deepEqual(twitter.locations(), ['123,123', '321,321'])
    })

    it('avoids dups of locations in the stream request', function () {
      var called = 0
      twitter.reconnect = function () {
        called++
      }

      assert(!twitter.stream)
      twitter.location('123,123')
      twitter.location('123,123')
      twitter.location('123,123')
      assert.deepEqual(twitter.locations(), ['123,123'])
      assert(called, 3)
    })

    it('closes connection if locations is empty', function (done) {
      twitter.abort = function () {
        assert.deepEqual(twitter.locations(), [])
        done()
      }

      assert(!twitter.stream)
      twitter.location('123,123')
      assert.deepEqual(twitter.locations(), ['123,123'])
      twitter.unlocate('123,123')
    })
  })

  describe('follow filters', function () {
    beforeEach(function () {
      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: '',
                    locations: '',
                    follow: '12345',
                    language: ''
                  })
                  .replyWithFile(200, __dirname + '/mocks/tacos.json')

      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: '',
                    locations: '',
                    follow: '12345,123456',
                    language: ''
                  })
                  .replyWithFile(200, __dirname + '/mocks/tacos.json')
    })

    it('tracks dups of same user', function () {
      assert(!twitter.stream)
      twitter.follow('12345')
      twitter.follow('12345')
      twitter.follow('123456')
      assert.equal(twitter._filters.follow['12345'], 2)
      assert.equal(twitter._filters.follow['123456'], 1)
      assert.deepEqual(twitter.following(), ['12345', '123456'])
      twitter.unfollow('12345')
      assert.equal(twitter._filters.follow['12345'], 1)
      assert.deepEqual(twitter.following(), ['12345', '123456'])
      twitter.follow('12345')
      assert.equal(twitter._filters.follow['12345'], 2)
      assert.deepEqual(twitter.following(), ['12345', '123456'])
    })

    it('avoids dups of users in the stream request', function () {
      var called = 0
      twitter.reconnect = function () {
        called++
      }

      assert(!twitter.stream)
      twitter.follow('12345')
      twitter.follow('12345')
      twitter.follow('12345')
      assert.deepEqual(twitter.following(), ['12345'])
      assert(called, 3)
    })

    it('closes connection if following is empty', function (done) {
      twitter.abort = function () {
        assert.deepEqual(twitter.following(), [])
        done()
      }

      assert(!twitter.stream)
      twitter.follow('12345')
      assert.deepEqual(twitter.following(), ['12345'])
      twitter.unfollow('12345')
    })
  })

  describe('language filters', function () {
    beforeEach(function () {
      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: 'tacos',
                    locations: '',
                    follow: '',
                    language: 'en'
                  })
                  .replyWithFile(200, __dirname + '/mocks/tacos.json')
    })

    it('tracks dups of same language', function () {
      assert(!twitter.stream)
      twitter.language('en')
      twitter.language('en')
      twitter.language('es')
      assert.equal(twitter._filters.language['en'], 2)
      assert.equal(twitter._filters.language['es'], 1)
      assert.deepEqual(twitter.languages(), ['en', 'es'])
      twitter.unlanguage('en')
      assert.equal(twitter._filters.language['en'], 1)
      assert.deepEqual(twitter.languages(), ['en', 'es'])
      twitter.language('en')
      assert.equal(twitter._filters.language['en'], 2)
      assert.deepEqual(twitter.languages(), ['en', 'es'])
    })

    it('filters language', function (done) {
      twitter.on('tweet', function (tweet) {
        assert.equal(tweet.lang, 'en')
        done()
      })

      assert(!twitter.stream)
      twitter.track('tacos')
      twitter.language('en')
      assert.deepEqual(twitter.languages(), ['en'])
    })

  })

  describe('other stream messages', function () {
    beforeEach(function () {
      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: 'delete',
                    locations: '',
                    follow: '',
                    language: ''
                  })
                  .replyWithFile(200, __dirname + '/mocks/delete.json')
      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: 'scrub_geo',
                    locations: '',
                    follow: '',
                    language: ''
                  })
                  .replyWithFile(200, __dirname + '/mocks/scrub_geo.json')
      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: 'limit',
                    locations: '',
                    follow: '',
                    language: ''
                  })
                  .replyWithFile(200, __dirname + '/mocks/limit.json')
      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: 'status_withheld',
                    locations: '',
                    follow: '',
                    language: ''
                  })
                  .replyWithFile(200, __dirname + '/mocks/status_withheld.json')
      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: 'user_withheld',
                    locations: '',
                    follow: '',
                    language: ''
                  })
                  .replyWithFile(200, __dirname + '/mocks/user_withheld.json')
      nock('https://stream.twitter.com')
                  .post('/1.1/statuses/filter.json', {
                    track: 'disconnect',
                    locations: '',
                    follow: '',
                    language: ''
                  })
                  .replyWithFile(200, __dirname + '/mocks/disconnect.json')
    })

    it('emits delete event', function (done) {
      twitter.on('delete', function (tweet) {
        assert.equal(tweet.status.id_str, '521997465973952512')
        assert.equal(tweet.status.user_id, 12345)
        done()
      })
      twitter.track('delete')
    })

    it('emits scrub_geo event', function (done) {
      twitter.on('scrub_geo', function (tweet) {
        assert.equal(tweet.up_to_status_id_str, '23260136625')
        assert.equal(tweet.user_id, 12345)
        done()
      })
      twitter.track('scrub_geo')
    })

    it('emits limit event', function (done) {
      twitter.on('limit', function (tweet) {
        assert.equal(tweet.track, 1234)
        done()
      })
      twitter.track('limit')
    })

    it('emits status_withheld event', function (done) {
      twitter.on('status_withheld', function (tweet) {
        assert.deepEqual(tweet.withheld_in_countries, ['DE', 'AR'])
        done()
      })
      twitter.track('status_withheld')
    })

    it('emits user_withheld event', function (done) {
      twitter.on('user_withheld', function (tweet) {
        assert.deepEqual(tweet.withheld_in_countries, ['DE', 'AR'])
        done()
      })
      twitter.track('user_withheld')
    })

    it('emits disconnect event', function (done) {
      twitter.on('disconnect', function (tweet) {
        assert.equal(tweet.code, 6)
        done()
      })
      twitter.track('disconnect')
    })
  })
})
