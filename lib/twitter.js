var request = require('request')
  , Parser = require('./parser')
  , Writable = require('stream').Writable
  , util = require('util')

var Twitter = function (oauth) {
  if(!(this instanceof Twitter)) {
    return new Tweets(arguments)
  }

  if (!oauth || !(oauth.consumer_secret || oauth.consumer_key || oauth.token || oauth.token_secret)) {
    throw new Error('Oauth credentials required')
  }
  this.oauth = oauth

  this._tracking = {}

  Writable.call(this, {objectMode: true})
}

util.inherits(Twitter, Writable)

Twitter.prototype.track = function (keyword) {
  if (this._tracking[keyword]) {
    this._tracking[keyword]++
  } else {
    this._tracking[keyword] = 1
    if (this.stream) {
      this.abort()
    }
    this.connect()
  }
}

Twitter.prototype.tracking = function () {
  return Object.keys(this._tracking)
}

Twitter.prototype._write = function (data, encoding, done) {
  if (data.text) {
    this.emit('tweet', data)
  }
  done()
}

Twitter.prototype.untrack = function (keyword) {
  if (typeof this._tracking[keyword] === 'undefined') {
    return
  }
  if (--this._tracking[keyword] === 0) {
    delete this._tracking[keyword]
    if (this.stream) {
      this.abort()
    }
    this.connect()
  }
}

Twitter.prototype.connect = function () {
  if (Object.keys(this._tracking).length === 0) {
    return
  }

  this.stream = request.post({
    url: 'https://stream.twitter.com/1.1/statuses/filter.json',
    oauth: this.oauth,
    form: {
      track: Object.keys(this._tracking).join(',')
    }
  })

  this.stream.on('response', (function (res, e) {
    if (res.statusCode === 200) {
      this.stream.pipe(new Parser).pipe(this)

      // Handle this: https://dev.twitter.com/docs/streaming-apis/connecting#Stalls
      this.stream.on('data', (function () {
        var close = (function () {
            if (this.stream) {
              this.abort()
            }
          }).bind(this)
          , interval = 1000 * 90 // twitter timeout is 90 seconds
          , timeout = setTimeout(close, interval)

        return function () {
          clearTimeout(timeout)
          timeout = setTimeout(close, interval)
        }
      })())

    } else {
      this.emit('error', new Error('Twitter error ' + res.statusCode))
    }
  }).bind(this))

  this.stream.on('error', (function (err) {
    this.emit('error', err)
  }).bind(this))
}

Twitter.prototype.abort = function () {
  this.stream.removeAllListeners()

  this.stream.abort()
}

module.exports = Twitter
